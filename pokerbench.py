"""
PokerBench: A High-Stakes Poker Tournament Simulation Framework.

This script orchestrates a poker tournament environment where Large Language Models
compete against each other in No-Limit Texas Hold'em. It utilizes `pokerkit` for accurate
game mechanics and `litellm` to interface with various AI models.

Key Features:
- Multi-game parallel execution.
- LLM-based player decision making with structured outputs.
- Comprehensive game logging and debug capabilities.
- Automated statistics collection and visualizations.

Example run command:

python3 pokerbench_parallel.py --hands 150 --games 5

Provide --debug to directly inspect LLM requests/responses.

Author: Joe Azar-Williams
"""

import os
import json
import argparse
import statistics
import concurrent.futures
import uuid
import time
import sys
import random
from collections import deque
from typing import List, Dict, Any, Optional

# Third-party imports
try:
    from pokerkit import NoLimitTexasHoldem, Automation
    import litellm
    from litellm import completion, completion_cost
    import matplotlib.pyplot as plt
    import numpy as np
    from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
except ImportError:
    print("Missing dependencies. Please run: pip install pokerkit litellm matplotlib numpy tenacity")
    exit(1)

# Try importing tqdm for progress bars, define dummy if missing
try:
    from tqdm import tqdm
except ImportError:
    def tqdm(iterable, total=None, desc=""):
        print(f"--- {desc} Started ---")
        return iterable

import re

# --- ENVIRONMENT SETUP ---
litellm.enable_json_schema_validation = False

# Ensure output directories exist
OUTPUT_DIR = "poker_output"
GAMES_DIR = os.path.join(OUTPUT_DIR, "games")
DEBUG_DIR = os.path.join(OUTPUT_DIR, "debug")
os.makedirs(GAMES_DIR, exist_ok=True)
os.makedirs(DEBUG_DIR, exist_ok=True)

STREET_NAMES = {0: "PRE-FLOP", 1: "FLOP", 2: "TURN", 3: "RIVER"}

SYSTEM_PROMPT_TEMPLATE = """
You are a world-class professional poker player competing in the PokerBench High Roller Tournament. 
Your goal is to maximize your stack size over {total_hands} hands. You are playing 50/100 No-Limit Texas Hold'em.

OUTPUT FORMAT:
You must output a JSON object adhering to the provided schema.
- 'action': One of "fold", "check", "call", "bet", "raise".
- 'amount': The total integer amount of chips to put in the pot (including current street bets). Use 0 for fold/check.
- 'thought_process': An explanation of your strategic reasoning.
"""

POKER_DECISION_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "poker_action",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "thought_process": {
                    "type": "string",
                    "description": "Strategic reasoning for the decision."
                },
                "action": {
                    "type": "string",
                    "enum": ["fold", "check", "call", "bet", "raise"],
                    "description": "The action to take."
                },
                "amount": {
                    "type": "integer",
                    "description": "Total chips to commit to the pot."
                }
            },
            "required": ["thought_process", "action", "amount"],
            "additionalProperties": False
        }
    }
}

def _log_retry(retry_state):
    """Callback for tenacity to log retry attempts."""
    self_obj = retry_state.args[0]
    model_name = retry_state.args[1]
    error = retry_state.outcome.exception()
    attempt = retry_state.attempt_number
    
    msg = f"API Error: {error}"
    self_obj.log_debug_data(model_name, f"RETRY_{attempt}", msg)
    
    # Also notify console
    self_obj.progress(f"RETRYING {model_name} (Attempt {attempt+1}/5) due to error: {error}")

class PokerBenchRunner:
    def __init__(self, game_id: str, num_hands: int, memory_size: int, temperature: float, debug: bool = False):
        self.game_id = game_id
        self.num_hands = num_hands
        self.memory_size = memory_size 
        self.temperature = temperature
        self.debug = debug
        
        # Unique log file for raw LLM debugging (PID + GameID to avoid collisions)
        self.debug_filename = os.path.join(DEBUG_DIR, f"poker_debug_{os.getpid()}_{self.game_id}.log")
        
        # Define players here
        self.models = [
            {"seat": 0, "name": "Minni", "model_id": "gpt-5-mini", "reasoning_effort": "high"},
            {"seat": 1, "name": "Flash", "model_id": "gemini/gemini-3-flash-preview", "reasoning_effort": "high"},
            {"seat": 2, "name": "Pro", "model_id": "gemini/gemini-3-pro-preview", "reasoning_effort": "high"},
            {"seat": 3, "name": "FiveTwo", "model_id": "gpt-5.2", "reasoning_effort": "high"},
            {"seat": 4, "name": "Claude", "model_id": "claude-opus-4-5-20251101", "reasoning_effort": "medium"},
            {"seat": 5, "name": "Elon", "model_id": "xai/grok-4-1-fast-reasoning"},
        ]
        
        # Randomize Seating
        random.shuffle(self.models)
        for i, m in enumerate(self.models):
            m['seat'] = i
        
        self.all_player_names = [m['name'] for m in self.models]
        self.initial_stack = 10000
        self.stacks = [self.initial_stack] * len(self.models)
        
        # Data Collection for Website
        self.game_log = {
            "game_id": self.game_id,
            "timestamp": time.time(),
            "config": {"hands": num_hands, "start_stack": self.initial_stack},
            "players": self.all_player_names,
            "hands": [] 
        }

        self.stack_history = {name: [self.initial_stack] for name in self.all_player_names}
        self.player_histories = {name: deque(maxlen=self.memory_size) for name in self.all_player_names}
        self.current_hand_history_text = [] 
        self.hand_profits = {name: [] for name in self.all_player_names} 
        self.current_hand_thoughts = {name: [] for name in self.all_player_names}
        self.stats = {
            name: {
                "wins": 0, 
                "hands_played": 0,
                "vpip_count": 0,
                "decision_count": 0,
                "final_stack": 0,
                "total_cost": 0.0,
                "total_reasoning_tokens": 0
            } for name in self.all_player_names
        }

        if self.debug:
            with open(self.debug_filename, "w", encoding="utf-8") as f:
                f.write(f"--- POKER DEBUG LOG STARTED (Game: {self.game_id}) ---\n")

    @classmethod
    def from_json(cls, data: Dict[str, Any], target_hands: int, memory_size: int, temperature: float, debug: bool = False):
        """Reconstructs a PokerBenchRunner from a saved JSON game log."""
        game_id = data["game_id"]
        # Use target hands if provided, else use existing config hands
        num_hands = max(target_hands, data["config"]["hands"])
        
        # Create instance (we'll overwrite its state)
        instance = cls(game_id, num_hands, memory_size, temperature, debug)
        
        # Load hand history
        instance.game_log = data
        instance.game_log["config"]["hands"] = num_hands
        
        # Identify all players from the log (including eliminated ones)
        instance.all_player_names = data["players"]
        
        # Reconstruct standard_models mapping from the instance
        standard_models = {m['name']: m for m in instance.models}

        # Identify the last hand
        if not data["hands"]:
            return instance # Empty game, just start fresh

        last_hand = data["hands"][-1]
        last_dealer = last_hand["dealer"]
        
        # Reconstruct stacks from last hand's results
        pre_stacks = last_hand["pre_hand_stacks"]
        results = {r["player"]: r["net_gain"] for r in last_hand["results"]}
        
        current_stacks = {}
        for name in instance.all_player_names:
            start_val = pre_stacks.get(name, 0)
            gain = results.get(name, 0)
            current_stacks[name] = max(0, start_val + gain)
        
        # Initialize stats and histories from the log
        instance.stack_history = {name: [instance.initial_stack] for name in instance.all_player_names}
        instance.stats = {name: {
                "wins": 0, "hands_played": 0, "vpip_count": 0, "decision_count": 0,
                "final_stack": 0, "total_cost": 0.0, "total_reasoning_tokens": 0
            } for name in instance.all_player_names
        }
        
        # Re-derive stats by iterating over all hands in log
        for h in data["hands"]:
            # results
            for r in h["results"]:
                p = r["player"]
                if p not in instance.stats: continue
                if r.get("winner"): instance.stats[p]["wins"] += 1
                instance.stats[p]["hands_played"] += 1
            
            # vpip and actions
            for act in h["actions"]:
                if act["type"] == "player_action":
                    p = act["player"]
                    if p in instance.stats:
                        instance.stats[p]["decision_count"] += 1
                        instance.stats[p]["total_cost"] += (act.get("cost") or 0.0)
                        instance.stats[p]["total_reasoning_tokens"] += (act.get("reasoning_tokens") or 0)

            # Reconstruct stack history properly
            for r in h["results"]:
                p = r["player"]
                if p in instance.stack_history:
                    new_s = h["pre_hand_stacks"].get(p, 0) + r["net_gain"]
                    instance.stack_history[p].append(new_s)

            # Reconstruct player_histories
            public_log = []
            current_hand_idx = h["hand_number"]
            public_log.append(f"Hand #{current_hand_idx}:")
            for act in h["actions"]:
                if act["type"] == "street_event":
                    public_log.append(f"[{act['street']}] Board: {' '.join(act['cards'])}")
                elif act["type"] == "player_action":
                    past_tense = {"bet": "bet", "raise": "raised", "call": "called", "check": "checked", "fold": "folded"}
                    verb = past_tense.get(act["action"], act["action"] + "ed")
                    txt = "folded" if act["action"] == "fold" else f"{verb} {act['amount']}"
                    public_log.append(f"  - {act['player']} {txt}")
            
            log_text = "\n".join(public_log)
            for p_name in instance.all_player_names:
                cards = h["hole_cards"].get(p_name, [])
                cards_str = " ".join(cards)
                entry = f"Hand #{current_hand_idx} | Held: [{cards_str}]\n{log_text}"
                instance.player_histories[p_name].append(entry)

        # Correctly reconstruct surviving players and their rotation
        all_players = data["players"]
        last_dealer = last_hand["dealer"]
        surviving_names = [p for p in all_players if current_stacks[p] > 0]

        # Find who should be the dealer for the NEXT hand
        # This is the next person in survivors after the last_dealer
        try:
            d_idx = all_players.index(last_dealer)
            next_dealer_name = None
            for i in range(1, len(all_players) + 1):
                cand = all_players[(d_idx + i) % len(all_players)]
                if cand in surviving_names:
                    next_dealer_name = cand
                    break
        except ValueError:
            next_dealer_name = surviving_names[0]
        
        # Order survivors so the new dealer is at index 0
        s_idx = surviving_names.index(next_dealer_name)
        ordered_survivors = surviving_names[s_idx:] + surviving_names[0:s_idx]
        
        instance.models = [standard_models.get(name, {"name": name, "model_id": "gpt-4o"}) for name in ordered_survivors]
        instance.stacks = [current_stacks[m['name']] for m in instance.models]
        instance.resumed_skip_rotation = True 

        return instance

    def log_debug_data(self, model_name: str, label: str, data: Any):
        """Writes raw prompts and responses to a text file for inspection."""
        if not self.debug: return
        with open(self.debug_filename, "a", encoding="utf-8") as f:
            f.write(f"\n{'='*15} {label}: {model_name.upper()} {'='*15}\n")
            if isinstance(data, (dict, list)):
                f.write(json.dumps(data, indent=2))
            else:
                f.write(str(data))
            f.write(f"\n{'='*50}\n")

    def progress(self, message):
        print(f"[{self.game_id[:4]}] {message}", flush=True)

    def format_cards(self, cards):
        if not cards: return []
        flat_cards = []
        for item in cards:
            if isinstance(item, (list, tuple)):
                flat_cards.extend(item)
            else:
                flat_cards.append(item)
        return [str(c) for c in flat_cards]

    @retry(
        stop=stop_after_attempt(5),
        wait=wait_exponential(multiplier=1, min=4, max=60),
        retry=retry_if_exception_type(Exception),
        before_sleep=_log_retry,
        reraise=True
    )
    def _make_api_call(self, model_name, completion_args):
        """Wrapper for litellm.completion with retry logic."""
        response = completion(**completion_args)
        # Validate that we can parse the response (triggers retry if fails)
        try:
            self._parse_llm_response(response.choices[0].message.content)
        except Exception as e:
            raise ValueError(f"Invalid JSON response from {model_name}: {e}")
        return response

    def _parse_llm_response(self, content):
        """Clean markdown formatting and parse JSON."""
        content = content.strip()
        # Try finding JSON block in markdown - for Haiku
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", content)
        if match:
            content = match.group(1)
        return json.loads(content)

    def get_llm_decision(self, model_config, state, model_seat_idx, current_hand_idx, rotation_offset):
        pk_idx = (model_seat_idx - rotation_offset) % len(self.models)
        try:
            raw_cards = state.hole_cards[pk_idx]
            hand_str = " ".join(self.format_cards(raw_cards))
            my_stack = state.stacks[pk_idx]
        except IndexError:
            hand_str = "Unknown"
            my_stack = 0
        
        board_str = " ".join(self.format_cards(state.board_cards))
        min_raise_val = state.min_completion_betting_or_raising_to_amount
        min_raise_str = str(min_raise_val) if min_raise_val is not None else "N/A"

        # Positional Info
        num_players = len(self.models)
        pos_labels = [""] * num_players
        if num_players == 2:
            pos_labels[0], pos_labels[1] = "Button (SB)", "Big Blind"
        elif num_players == 6:
            pos_labels = ["Button", "Small Blind", "Big Blind", "UTG", "Middle", "Cutoff"]
        else:
            pos_labels[0], pos_labels[1], pos_labels[2] = "Button", "Small Blind", "Big Blind"
            for i in range(3, num_players):
                pos_labels[i] = f"UTG+{i-3}" if i > 3 else "UTG"
        
        my_position_label = pos_labels[model_seat_idx]
        opponent_info = []
        for i, m in enumerate(self.models):
            if i != model_seat_idx:
                opp_pk_idx = (i - rotation_offset) % len(self.models)
                opp_stack = state.stacks[opp_pk_idx]
                opponent_info.append(f"{m['name']} ({pos_labels[i]}): {opp_stack}")
        
        p_name = model_config['name']
        my_history = self.player_histories[p_name]
        past_hands_context = "\n\n".join(my_history) if my_history else "No previous hands recorded."
        current_progress = "\n".join(self.current_hand_history_text)
        
        my_thoughts = self.current_hand_thoughts[p_name]
        current_hand_thoughts_text = "\n".join(my_thoughts) if my_thoughts else "No previous thoughts this hand."

        base_prompt = f"""
=== PREVIOUS HANDS ===
{past_hands_context}
=== TOURNAMENT STATUS ===
Current Hand: {current_hand_idx} of {self.num_hands}
Active Players: {len(self.models)}
=== CURRENT HAND LOG ===
{current_progress}
=== YOUR PREVIOUS THOUGHTS THIS HAND ===
{current_hand_thoughts_text}
=== YOUR STATE ===
Name: {p_name} | Position: {my_position_label} | Stack: {my_stack}
Cards: [{hand_str}] | Board: [{board_str}]
Pot: {sum(state.pot_amounts) + sum(state.bets)} | To Call: {state.checking_or_calling_amount}
Min Raise To: {min_raise_str}
Opponents: {" | ".join(opponent_info)}

Decide your action.
"""
        formatted_system_prompt = SYSTEM_PROMPT_TEMPLATE.format(total_hands=self.num_hands)
        messages = [{"role": "system", "content": formatted_system_prompt}, {"role": "user", "content": base_prompt}]
        
        # --- LOG REQUEST ---
        self.log_debug_data(p_name, "REQUEST", messages)

        try:
            # Prepare completion arguments
            completion_args = {
                "model": model_config['model_id'],
                "messages": messages,
                "response_format": POKER_DECISION_SCHEMA,
                "temperature": self.temperature,
                "drop_params": True
            }

            # Only include reasoning_effort if it's explicitly set in the config
            if model_config.get('reasoning_effort') is not None:
                completion_args["reasoning_effort"] = model_config['reasoning_effort']

            response = self._make_api_call(p_name, completion_args)
            
            # --- LOG RESPONSE ---
            self.log_debug_data(p_name, "RESPONSE", response)
            
            # --- TRACK COST ---
            cost = 0.0
            r_tokens = 0
            try :
                cost = completion_cost(completion_response=response)
                self.stats[p_name]["total_cost"] += cost
                self.stats[p_name]["decision_count"] += 1
                
                # Track reasoning tokens
                usage = getattr(response, "usage", None)
                if usage:
                    # Try OpenAI/LiteLLM standard: usage.completion_tokens_details.reasoning_tokens
                    if hasattr(usage, "completion_tokens_details") and usage.completion_tokens_details:
                        r_tokens = getattr(usage.completion_tokens_details, "reasoning_tokens", 0)
                    # Fallback for some providers that might put it directly in usage
                    elif hasattr(usage, "reasoning_tokens"):
                        r_tokens = usage.reasoning_tokens
                    
                    self.stats[p_name]["total_reasoning_tokens"] += (r_tokens or 0)
                    
            except Exception as e:
                self.log_debug_data(p_name, "STATS_TRACKING_ERROR", str(e))
                pass # Ignore stats calculation errors to avoid crashing game

            return self._parse_llm_response(response.choices[0].message.content), cost, r_tokens
        except Exception as e:
            self.log_debug_data(p_name, "ERROR", str(e))
            raise e

    def run(self):
        automations = (
            Automation.ANTE_POSTING, Automation.BLIND_OR_STRADDLE_POSTING,
            Automation.HOLE_DEALING, Automation.BOARD_DEALING,
            Automation.CARD_BURNING, Automation.BET_COLLECTION,
            Automation.CHIPS_PUSHING, Automation.CHIPS_PULLING,
            Automation.HOLE_CARDS_SHOWING_OR_MUCKING, Automation.HAND_KILLING,
        )

        skip_rotation = getattr(self, "resumed_skip_rotation", False)
        start_hand = len(self.game_log["hands"]) + 1

        for hand_idx in range(start_hand, self.num_hands + 1):
            if len(self.models) < 2:
                self.progress(f"Game Ended - Winner: {self.models[0]['name']}")
                self.fill_remaining_history(hand_idx)
                break

            # --- Rotation Logic ---
            if hand_idx > 1 and not skip_rotation:
                p_moved, s_moved = self.models.pop(0), self.stacks.pop(0)
                self.models.append(p_moved)
                self.stacks.append(s_moved)
                for i, m in enumerate(self.models): m['seat'] = i
            
            # --- PROGRESS INDICATOR ---
            self.progress(f"Starting Hand {hand_idx}/{self.num_hands} | Dealer: {self.models[0]['name']}")

            skip_rotation = False
            start_stacks = list(self.stacks)
            hand_vpip = {m['name']: False for m in self.models}
            active_player_names = {m['name'] for m in self.models}
            
            self.current_hand_history_text = [f"Hand #{hand_idx}:"]
            # Reset thoughts for the new hand
            for name in self.all_player_names:
                self.current_hand_thoughts[name] = []
            
            hand_record = {
                "hand_number": hand_idx,
                "dealer": self.models[0]['name'],
                "pre_hand_stacks": {m['name']: s for m, s in zip(self.models, self.stacks)},
                "hole_cards": {},
                "board": [],
                "actions": [],
                "results": []
            }

            # --- PokerKit State ---
            is_heads_up = (len(self.models) == 2)
            
            # UNIFIED LOGIC FIX:
            # Always rotate so the Dealer (self.models[0]) is at the END of the list passed to PokerKit.
            # In Ring: P0(D), P1(SB), P2(BB) -> [P1, P2, P0]. Dealer is last.
            # In HU: P0(D/SB), P1(BB) -> [P1, P0]. Dealer is last.
            # result: P0 is Index 1. Index 1 in HU is SB?
            # Test confirmed: Index 1 is SB in HU [BB, SB] list logic?
            # Actually test confirmed: If list is [P1, P0]. Index 0=P1, Index 1=P0.
            # Bets=[100, 50]. Index 1 posted 50. Index 1 is SB. Index 1 acts first.
            # So P0 acts first. Correct.
            
            pk_stacks = self.stacks[1:] + self.stacks[:1]
            rotation_offset = 1
            blind_config = (50, 100)

            if any(s <= 0 for s in pk_stacks): break

            try:
                state = NoLimitTexasHoldem.create_state(
                    automations, True, 0, blind_config, 100, pk_stacks, len(self.models)
                )
            except ValueError: break

            # --- Deal ---
            current_hole_cards_text = {}
            for i, m in enumerate(self.models):
                pk_idx = (i - rotation_offset) % len(self.models)
                cards_list = self.format_cards(state.hole_cards[pk_idx])
                hand_record["hole_cards"][m['name']] = cards_list
                current_hole_cards_text[m['name']] = " ".join(cards_list)

            # --- Game Loop ---
            last_street_idx = -1
            try:
                while state.status:
                    if state.street_index != last_street_idx:
                        last_street_idx = state.street_index
                        street_name = STREET_NAMES.get(last_street_idx, f"STREET {last_street_idx}")
                        board_cards = self.format_cards(state.board_cards)
                        hand_record["board"] = board_cards 
                        
                        log_msg = f"[{street_name}] Board: {' '.join(board_cards)}"
                        self.current_hand_history_text.append(log_msg)
                        
                        hand_record["actions"].append({
                            "type": "street_event",
                            "street": street_name,
                            "cards": board_cards
                        })

                    if state.actor_index is not None:
                        pk_actor_idx = state.actor_index
                        model_seat_idx = (pk_actor_idx + rotation_offset) % len(self.models)
                        p_name = self.models[model_seat_idx]['name']
                        
                        decision, cost, r_tokens = self.get_llm_decision(self.models[model_seat_idx], state, model_seat_idx, hand_idx, rotation_offset)
                        action = str(decision.get("action", "fold")).lower()
                        amount = int(decision.get("amount", 0)) if decision.get("amount") else 0
                        thought = decision.get("thought_process", "No thought provided")

                        try:
                            # Capture pot state BEFORE action for accurate logging
                            # Include current street bets in "Pot Before" so it's not 0 pre-flop
                            pot_before_action = sum(state.pot_amounts) + sum(state.bets)

                            valid_move = True
                            final_amount_logged = 0
                            chips_added = 0

                            if action == "fold":
                                state.fold()
                                txt_action = "folded"
                                active_player_names.discard(p_name)
                                final_amount_logged = 0
                                chips_added = 0
                            elif action in ["check", "call"]:
                                call_amt = state.checking_or_calling_amount
                                prev_bet = state.bets[pk_actor_idx]
                                state.check_or_call()
                                if call_amt > 0:
                                    txt_action = f"called {call_amt}"
                                else:
                                    txt_action = "checked"
                                if state.street_index == 0: hand_vpip[p_name] = True
                                
                                chips_added = call_amt
                                # Standardize amount: if moving chips, show Total Street Investment
                                if call_amt > 0:
                                    final_amount_logged = prev_bet + call_amt
                                else:
                                    final_amount_logged = 0 # Check
                            elif action in ["bet", "raise"]:
                                min_r = state.min_completion_betting_or_raising_to_amount
                                actual_amt = max(amount, min_r) if min_r else amount
                                # Calculate DELTA (chips added) for strict parsing
                                chips_added = actual_amt - state.bets[pk_actor_idx]
                                
                                state.complete_bet_or_raise_to(actual_amt)
                                txt_action = f"raised to {actual_amt}"
                                if state.street_index == 0: hand_vpip[p_name] = True
                                final_amount_logged = actual_amt # Narrative "Raise To" Amount
                            else:
                                state.fold()
                                txt_action = "folded (invalid action)"
                                valid_move = False
                                final_amount_logged = 0
                                chips_added = 0

                            self.current_hand_history_text.append(f"  - {p_name} {txt_action}")
                            hand_record["actions"].append({
                                "type": "player_action",
                                "player": p_name,
                                "action": action,
                                "amount": final_amount_logged,
                                "chips_added": chips_added,
                                "pot_before": pot_before_action,
                                "thought": thought,
                                "valid": valid_move,
                                "cost": cost,
                                "reasoning_tokens": r_tokens
                            })

                            # Record thought for this hand
                            current_street = STREET_NAMES.get(state.street_index, f"STREET {state.street_index}")
                            self.current_hand_thoughts[p_name].append(f"[{current_street}] {thought}")

                        except Exception as e:
                            if self.debug: self.log_debug_data(p_name, "EXEC_ERROR", str(e))
                            state.fold()
                            hand_record["actions"].append({
                                "type": "error",
                                "player": p_name,
                                "message": str(e)
                            })
                    else: continue
            except Exception as e:
                self.progress(f"Game Terminated Early: {str(e)}")
                break
            # --- Final Board Check (Fix for All-In Runouts) ---
            # If state finished with board cards not yet logged (e.g. all-in runout), log them now.
            if state.street_index != last_street_idx or self.format_cards(state.board_cards) != hand_record.get("board", []):
                final_board = self.format_cards(state.board_cards)
                if len(final_board) > len(hand_record.get("board", [])):
                    hand_record["board"] = final_board
                    log_msg = f"[RUNOUT] Final Board: {' '.join(final_board)}"
                    self.current_hand_history_text.append(log_msg)
                    hand_record["actions"].append({
                        "type": "street_event",
                        "street": "RUNOUT",
                        "cards": final_board
                    })
            # --- Payoffs ---
            final_pk_stacks = list(state.stacks)
            
            # Robust Stack Mapping (Fix for Stack Persistence)
            new_stacks_map = {}
            for pk_i in range(len(self.models)):
                # pk_i maps to model_seat_idx via rotation
                model_seat_idx = (pk_i + rotation_offset) % len(self.models)
                new_stacks_map[model_seat_idx] = final_pk_stacks[pk_i]

            # Rebuild self.stacks in order of self.models (0..N)
            self.stacks = [new_stacks_map[i] for i in range(len(self.models))]

            for i in range(len(self.models)):
                model_seat_idx = (i + rotation_offset) % len(self.models)
                p_name = self.models[model_seat_idx]['name']
                payoff = state.payoffs[i]
                
                if payoff > 0:
                    self.stats[p_name]["wins"] += 1
                    hand_record["results"].append({"player": p_name, "net_gain": payoff, "winner": True})
                else:
                    hand_record["results"].append({"player": p_name, "net_gain": payoff, "winner": False})

                self.stats[p_name]["hands_played"] += 1
                if hand_vpip[p_name]: self.stats[p_name]["vpip_count"] += 1
                self.hand_profits[p_name].append(self.stacks[model_seat_idx] - start_stacks[model_seat_idx])

            # Stack History
            current_stacks_map = {m['name']: self.stacks[i] for i, m in enumerate(self.models)}
            for name in self.all_player_names:
                self.stack_history[name].append(current_stacks_map.get(name, 0))

            # History Update
            public_log = "\n".join(self.current_hand_history_text)
            for p_name, cards in current_hole_cards_text.items():
                if p_name in self.player_histories:
                    self.player_histories[p_name].append(f"Hand #{hand_idx} | Held: [{cards}]\n{public_log}")

            self.game_log["hands"].append(hand_record)

            # Eliminations
            surviving, surviving_stacks = [], []
            for i, stack in enumerate(self.stacks):
                if stack > 0:
                    surviving.append(self.models[i])
                    surviving_stacks.append(stack)
                else:
                    self.progress(f"  [X] ELIMINATED: {self.models[i]['name']}")
                    if i == 0: skip_rotation = True
            
            self.models = surviving
            self.stacks = surviving_stacks

        # Cleanup
        for m in self.models:
            idx = self.models.index(m)
            self.stats[m['name']]['final_stack'] = self.stacks[idx]
            
        self.normalize_histories()
        self.save_game_file()
        return self.stats, self.hand_profits, self.stack_history, self.game_id

    def fill_remaining_history(self, start_idx):
        for _ in range(start_idx, self.num_hands + 1):
            current_stacks_map = {m['name']: self.stacks[i] for i, m in enumerate(self.models)}
            for name in self.all_player_names:
                self.stack_history[name].append(current_stacks_map.get(name, 0))

    def normalize_histories(self):
        max_len = max(len(h) for h in self.stack_history.values())
        for name in self.stack_history:
            while len(self.stack_history[name]) < max_len:
                self.stack_history[name].append(self.stack_history[name][-1])

    def save_game_file(self):
        filename = os.path.join(GAMES_DIR, f"game_{self.game_id}.json")
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(self.game_log, f, indent=2)

def run_game_wrapper(args_dict):
    try:
        uid = str(uuid.uuid4())[:8]
        runner = PokerBenchRunner(
            game_id=uid,
            num_hands=args_dict['hands'],
            memory_size=args_dict['memory'],
            temperature=args_dict['temp'],
            debug=args_dict['debug']
        )
        return runner.run()
    except Exception as e:
        print(f"Error in game process: {e}")
        import traceback
        traceback.print_exc()
        return None

def generate_results_graph(all_histories, filename="stack_history.png"):
    print(f"Generating graph: {filename}...")
    plt.style.use('bmh')
    plt.figure(figsize=(14, 8))

    player_names = list(all_histories[0].keys())
    colors = ['#D62728', '#1F77B4', '#2CA02C', '#FF7F0E', '#9467BD', '#8C564B']
    color_map = {name: colors[i % len(colors)] for i, name in enumerate(player_names)}

    for name in player_names:
        c = color_map[name]
        raw_data = [g[name] for g in all_histories]
        max_len = max(len(r) for r in raw_data)
        padded_data = [r + [r[-1]] * (max_len - len(r)) for r in raw_data]

        data_array = np.array(padded_data)
        mean_stack = np.mean(data_array, axis=0)
        
        ghost_alpha = 0.4 if len(all_histories) <= 5 else 0.15
        for row in data_array:
            plt.plot(row, color=c, alpha=ghost_alpha, linewidth=1, linestyle='-')

        plt.plot(mean_stack, color=c, linewidth=3, marker='o', markersize=4, label=f"{name} (Avg)")

    plt.title(f"Stack Performance: Average of {len(all_histories)} Games", fontsize=16)
    plt.xlabel("Hand Number")
    plt.ylabel("Stack Size")
    plt.axhline(y=10000, color='black', linestyle='--', alpha=0.5, label="Start")
    plt.legend(loc='upper left')
    plt.tight_layout()
    plt.savefig(os.path.join(OUTPUT_DIR, filename), dpi=300)
    print(f"Graph saved to {os.path.join(OUTPUT_DIR, filename)}")

def save_summary(all_stats, all_histories, rank_data):
    summary = {
        "timestamp": time.time(),
        "total_games": len(all_stats),
        "leaderboard": rank_data,
        "aggregated_stacks": {},
        "raw_game_ids": []
    }
    player_names = all_histories[0].keys()
    for name in player_names:
        raw_data = [g[name] for g in all_histories]
        max_len = max(len(r) for r in raw_data)
        padded = [r + [r[-1]] * (max_len - len(r)) for r in raw_data]
        summary["aggregated_stacks"][name] = np.mean(np.array(padded), axis=0).tolist()

    path = os.path.join(OUTPUT_DIR, "summary.json")
    with open(path, "w") as f:
        json.dump(summary, f, indent=2)
    print(f"Summary data saved to {path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--hands", type=int, default=5, help="Target total number of hands")
    parser.add_argument("--games", type=int, default=1, help="Number of games to run (ignored if --load-games is used)")
    parser.add_argument("--memory", type=int, default=150)
    parser.add_argument("--temp", type=float, default=1)
    parser.add_argument("--debug", action="store_true")
    parser.add_argument("--load-games", nargs="+", help="JSON files of games to continue")
    args = parser.parse_args()

    worker_args = vars(args)

    print(f"Starting {args.games} games on {os.cpu_count() or 4} cores...")
    print(f"Output directory: {os.path.abspath(OUTPUT_DIR)}")

    all_stats, all_profits, all_histories = [], [], []
    
    # Run games
    if args.load_games:
        # Continue existing games
        loaded_game_data = []
        for file_path in args.load_games:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    loaded_game_data.append(json.load(f))
            except Exception as e:
                print(f"Error loading {file_path}: {e}")

        if not loaded_game_data:
            print("No valid games loaded.")
            exit()

        print(f"Continuing {len(loaded_game_data)} games...")
        
        # Parallel execution for loaded games
        with concurrent.futures.ProcessPoolExecutor() as executor:
            # We need a special wrapper or just use PokerBenchRunner directly in a loop
            # Let's define a resume wrapper
            def resume_game_wrapper(data):
                try:
                    runner = PokerBenchRunner.from_json(
                        data, 
                        target_hands=args.hands, 
                        memory_size=args.memory, 
                        temperature=args.temp, 
                        debug=args.debug
                    )
                    return runner.run()
                except Exception as e:
                    print(f"Error resuming game: {e}")
                    import traceback
                    traceback.print_exc()
                    return None

            futures = [executor.submit(resume_game_wrapper, d) for d in loaded_game_data]
            try:
                iterator = tqdm(concurrent.futures.as_completed(futures), total=len(loaded_game_data), desc="Games Continued")
            except Exception:
                iterator = concurrent.futures.as_completed(futures)

            for future in iterator:
                res = future.result()
                if res:
                    s, p, h, gid = res
                    all_stats.append(s)
                    all_profits.append(p)
                    all_histories.append(h)

    elif args.games == 1:
        res = run_game_wrapper(worker_args)
        if res:
            all_stats, all_profits, all_histories, _ = [res[0]], [res[1]], [res[2]], [res[3]]
    else:
        with concurrent.futures.ProcessPoolExecutor() as executor:
            futures = [executor.submit(run_game_wrapper, worker_args) for _ in range(args.games)]
            try:
                iterator = tqdm(concurrent.futures.as_completed(futures), total=args.games, desc="Games Completed")
            except Exception:
                iterator = concurrent.futures.as_completed(futures)

            for future in iterator:
                res = future.result()
                if res:
                    s, p, h, gid = res
                    all_stats.append(s)
                    all_profits.append(p)
                    all_histories.append(h)

    if not all_stats:
        print("No games completed successfully.")
        exit()

    # Ranking
    rank_data = []
    # Use keys from the first game's stats to ensure we get all players
    # even if they might have been eliminated (keys should exist for all)
    player_names = all_stats[0].keys()

    for name in player_names:
        total_profit = 0
        total_wins = 0
        total_hands = 0
        total_cost = 0.0
        total_decisions = 0
        total_reasoning_tokens = 0
        
        for i in range(len(all_stats)):
            final_stack = all_stats[i][name].get('final_stack', 0)
            total_profit += (final_stack - 10000)
            total_wins += all_stats[i][name]['wins']
            total_hands += all_stats[i][name]['hands_played']
            total_cost += all_stats[i][name].get('total_cost', 0.0)
            total_decisions += all_stats[i][name].get('decision_count', 0)
            total_reasoning_tokens += all_stats[i][name].get('total_reasoning_tokens', 0)

        avg_profit = total_profit / len(all_stats)
        win_rate = (total_wins / total_hands * 100) if total_hands > 0 else 0
        total_cost_val = total_cost
        avg_cost_per_decision = total_cost / total_decisions if total_decisions > 0 else 0
        
        rank_data.append({
            "name": name, 
            "avg_profit": round(avg_profit, 2), 
            "win_rate": round(win_rate, 2),
            "total_hands": total_hands,
            "total_cost": total_cost_val,
            "avg_cost_per_decision": avg_cost_per_decision,
            "avg_reasoning_tokens": total_reasoning_tokens / total_decisions if total_decisions > 0 else 0
        })

    rank_data.sort(key=lambda x: x['avg_profit'], reverse=True)

    print(f"\n{'='*35} PLAYER RANKING {'='*35}")
    print(f"{'Rank':<4} | {'Player':<15} | {'Avg Profit ($)':<15} | {'Win Rate':<10} | {'Total Cost ($)':<14} | {'Avg Cost/Dec':<12} | {'Avg Reason Tok':<12}")
    print("-" * 110)
    for i, p in enumerate(rank_data):
        print(f"{i+1:<4} | {p['name']:<15} | {p['avg_profit']:+,.0f}".ljust(38) + f" | {p['win_rate']:5.1f}%   | ${p['total_cost']:.4f}".ljust(25) + f" | ${p['avg_cost_per_decision']:.4f}".ljust(15) + f" | {p['avg_reasoning_tokens']:,.0f}")

    if len(all_histories) > 0:
        generate_results_graph(all_histories)
        save_summary(all_stats, all_histories, rank_data)

    print("\nProcessing Complete.")
