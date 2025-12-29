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

It runs about 1.25 hands/minute/game with the provided 4 player configuration. This cannot
be accelarated on an intra-game basis as hands must be executed serially. However, games
can be run in parallel. Example run command:

python3 pokerbench_parallel.py --hands 150 --games 5 --memory 150 --temp 1

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
except ImportError:
    print("Missing dependencies. Please run: pip install pokerkit litellm matplotlib numpy")
    exit(1)

# Try importing tqdm for progress bars, define dummy if missing
try:
    from tqdm import tqdm
except ImportError:
    def tqdm(iterable, total=None, desc=""):
        print(f"--- {desc} Started ---")
        return iterable

# --- ENVIRONMENT SETUP ---
litellm.enable_json_schema_validation = True

# Ensure output directories exist
OUTPUT_DIR = "poker_output"
GAMES_DIR = os.path.join(OUTPUT_DIR, "games")
DEBUG_DIR = os.path.join(OUTPUT_DIR, "debug")
os.makedirs(GAMES_DIR, exist_ok=True)
os.makedirs(DEBUG_DIR, exist_ok=True)

STREET_NAMES = {0: "PRE-FLOP", 1: "FLOP", 2: "TURN", 3: "RIVER"}

SYSTEM_PROMPT_TEMPLATE = """
You are a world-class professional poker player competing in the PokerBench High Roller Tournament. 
Your goal is to maximize your stack size over {total_hands} hands. You are playing No-Limit Texas Hold'em.

OUTPUT FORMAT:
You must output a JSON object adhering to the provided schema.
- 'action': One of "fold", "check", "call", "bet", "raise".
- 'amount': The total integer amount of chips to put in the pot (including current street bets). Use 0 for fold/check.
- 'thought_process': A concise explanation of your strategic reasoning.
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
            {"seat": 3, "name": "FiveTwo", "model_id": "gpt-5.2", "reasoning_effort": "medium"},
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
        self.stats = {
            name: {
                "wins": 0, 
                "hands_played": 0,
                "vpip_count": 0,
                "final_stack": 0,
                "total_cost": 0.0
            } for name in self.all_player_names
        }

        # Initialize Debug Log if enabled
        if self.debug:
            with open(self.debug_filename, "w", encoding="utf-8") as f:
                f.write(f"--- POKER DEBUG LOG STARTED (Game: {self.game_id}) ---\n")

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

        base_prompt = f"""
=== TOURNAMENT STATUS ===
Current Hand: {current_hand_idx} of {self.num_hands}
Active Players: {len(self.models)}
=== PREVIOUS HANDS ===
{past_hands_context}
=== CURRENT HAND LOG ===
{current_progress}
=== YOUR STATE ===
Name: {p_name} | Position: {my_position_label} | Stack: {my_stack}
Cards: [{hand_str}] | Board: [{board_str}]
Pot: {sum(state.pot_amounts)} | To Call: {state.checking_or_calling_amount}
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

            if model_config['reasoning_effort']:
                completion_args['reasoning_effort'] = model_config['reasoning_effort']

            response = completion(**completion_args)
            
            # --- LOG RESPONSE ---
            self.log_debug_data(p_name, "RESPONSE", response)

            # Track Cost
            try:
                cost = completion_cost(completion_response=response)
                self.stats[p_name]["total_cost"] += cost
            except Exception as e:
                if self.debug: print(f"Cost calculation failed for {p_name}: {e}")
            
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            self.log_debug_data(p_name, "ERROR", str(e))
            return {"action": "fold", "thought_process": f"API Error: {str(e)}", "amount": 0}

    def run(self):
        automations = (
            Automation.ANTE_POSTING, Automation.BLIND_OR_STRADDLE_POSTING,
            Automation.HOLE_DEALING, Automation.BOARD_DEALING,
            Automation.CARD_BURNING, Automation.BET_COLLECTION,
            Automation.CHIPS_PUSHING, Automation.CHIPS_PULLING,
            Automation.HOLE_CARDS_SHOWING_OR_MUCKING, Automation.HAND_KILLING,
        )

        skip_rotation = False

        for hand_idx in range(1, self.num_hands + 1):
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
            pk_stacks = list(self.stacks) if is_heads_up else self.stacks[1:] + self.stacks[:1]
            rotation_offset = 0 if is_heads_up else 1
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
                    
                    decision = self.get_llm_decision(self.models[model_seat_idx], state, model_seat_idx, hand_idx, rotation_offset)
                    action = str(decision.get("action", "fold")).lower()
                    amount = int(decision.get("amount", 0)) if decision.get("amount") else 0
                    thought = decision.get("thought_process", "No thought provided")

                    try:
                        valid_move = True
                        if action == "fold":
                            state.fold()
                            txt_action = "folded"
                            active_player_names.discard(p_name)
                        elif action in ["check", "call"]:
                            call_amt = state.checking_or_calling_amount
                            state.check_or_call()
                            txt_action = f"checked/called {call_amt}"
                            if state.street_index == 0: hand_vpip[p_name] = True
                        elif action in ["bet", "raise"]:
                            min_r = state.min_completion_betting_or_raising_to_amount
                            actual_amt = max(amount, min_r) if min_r else amount
                            state.complete_bet_or_raise_to(actual_amt)
                            txt_action = f"raised to {actual_amt}"
                            if state.street_index == 0: hand_vpip[p_name] = True
                        else:
                            state.fold()
                            txt_action = "folded (invalid action)"
                            valid_move = False

                        self.current_hand_history_text.append(f"  - {p_name} {txt_action}")
                        hand_record["actions"].append({
                            "type": "player_action",
                            "player": p_name,
                            "action": action,
                            "amount": amount,
                            "pot_before": sum(state.pot_amounts),
                            "thought": thought,
                            "valid": valid_move
                        })

                    except Exception as e:
                        if self.debug: self.log_debug_data(p_name, "EXEC_ERROR", str(e))
                        state.fold()
                        hand_record["actions"].append({
                            "type": "error",
                            "player": p_name,
                            "message": str(e)
                        })
                else: continue

            # --- Payoffs ---
            final_pk_stacks = list(state.stacks)
            self.stacks = final_pk_stacks if is_heads_up else final_pk_stacks[-1:] + final_pk_stacks[:-1]

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
    parser.add_argument("--hands", type=int, default=10)
    parser.add_argument("--games", type=int, default=1)
    parser.add_argument("--memory", type=int, default=3)
    parser.add_argument("--temp", type=float, default=0.5)
    parser.add_argument("--debug", action="store_true")
    args = parser.parse_args()

    worker_args = vars(args)

    print(f"Starting {args.games} games on {os.cpu_count() or 4} cores...")
    print(f"Output directory: {os.path.abspath(OUTPUT_DIR)}")

    all_stats, all_profits, all_histories = [], [], []
    
    # Run games
    if args.games == 1:
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
    player_names = all_stats[0].keys()

    for name in player_names:
        total_profit = 0
        total_wins = 0
        total_hands = 0
        for i in range(len(all_stats)):
            final_stack = all_stats[i][name].get('final_stack', 0)
            total_profit += (final_stack - 10000)
            total_wins += all_stats[i][name]['wins']
            total_hands += all_stats[i][name]['hands_played']

        avg_profit = total_profit / len(all_stats)
        win_rate = (total_wins / total_hands * 100) if total_hands > 0 else 0
        rank_data.append({
            "name": name, 
            "avg_profit": round(avg_profit, 2), 
            "win_rate": round(win_rate, 2),
            "total_hands": total_hands,
            "cost": sum(g[name].get('total_cost', 0) for g in all_stats) / len(all_stats)
        })

    rank_data.sort(key=lambda x: x['avg_profit'], reverse=True)

    print(f"\n{'='*35} PLAYER RANKING {'='*35}")
    print(f"{'Rank':<4} | {'Player':<15} | {'Avg Profit ($)':<15} | {'Win Rate':<10} | {'Cost ($)':<10}")
    print("-" * 75)
    for i, p in enumerate(rank_data):
        print(f"{i+1:<4} | {p['name']:<15} | {p['avg_profit']:+,.0f}".ljust(38) + f" | {p['win_rate']:>5.1f}%   | ${p['cost']:>8.4f}")

    if len(all_histories) > 0:
        generate_results_graph(all_histories)
        save_summary(all_stats, all_histories, rank_data)

    print("\nProcessing Complete.")
