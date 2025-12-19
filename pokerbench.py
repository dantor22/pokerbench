import os
import json
import argparse
import statistics
import concurrent.futures
from collections import deque
from typing import List, Dict, Any, Optional

# Third-party imports
try:
    from pokerkit import NoLimitTexasHoldem, Automation
    from litellm import completion
    import matplotlib.pyplot as plt
    import numpy as np
except ImportError:
    print("Missing dependencies. Please run: pip install pokerkit litellm matplotlib")
    exit(1)

# --- ENVIRONMENT SETUP ---
def setup_environment():
    # Set your keys here if not already in environment variables
    # os.environ["OPENAI_API_KEY"] = "sk-..."
    pass

setup_environment()

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
    def __init__(self, num_hands: int, memory_size: int, temperature: float, debug: bool = False, quiet: bool = False):
        self.num_hands = num_hands
        self.memory_size = memory_size 
        self.temperature = temperature
        self.debug = debug
        self.quiet = quiet
        self.log_filename = f"poker_debug_{os.getpid()}.log"
        
        # Define players here
        self.models = [
            {"seat": 0, "name": "Minni", "model_id": "gpt-5-mini"},
            {"seat": 1, "name": "Flash", "model_id": "gemini/gemini-3-flash-preview"},
            {"seat": 2, "name": "Pro", "model_id": "gemini/gemini-3-pro-preview"},
            {"seat": 3, "name": "FiveTwo", "model_id": "gpt-5.2"},
        ]
        
        self.all_player_names = [m['name'] for m in self.models]
        self.initial_stack = 10000
        self.big_blind = 100
        self.stacks = [self.initial_stack] * len(self.models)
        
        # Track stack size after every hand for plotting [start, hand1, hand2...]
        self.stack_history = {name: [self.initial_stack] for name in self.all_player_names}
        
        self.player_histories = {name: deque(maxlen=self.memory_size) for name in self.all_player_names}
        self.current_hand_history = [] 
        self.hand_profits = {name: [] for name in self.all_player_names} 
        self.stats = {
            name: {
                "wins": 0, 
                "hands_played": 0,
                "vpip_count": 0,
                "final_stack": 0
            } for name in self.all_player_names
        }

        if self.debug:
            with open(self.log_filename, "w", encoding="utf-8") as f:
                f.write(f"--- POKER DEBUG LOG STARTED (PID: {os.getpid()}) ---\n")

    def log(self, message):
        if not self.quiet:
            print(message)

    def format_cards(self, cards):
        if not cards: return "None"
        flat_cards = []
        for item in cards:
            if isinstance(item, (list, tuple)):
                flat_cards.extend(item)
            else:
                flat_cards.append(item)
        return " ".join(map(str, flat_cards))

    def log_debug_data(self, model_name: str, label: str, data: Any):
        if not self.debug: return
        with open(self.log_filename, "a", encoding="utf-8") as f:
            f.write(f"\n{'='*15} {label}: {model_name.upper()} {'='*15}\n")
            if isinstance(data, (dict, list)):
                f.write(json.dumps(data, indent=2))
            else:
                f.write(str(data))
            f.write(f"\n{'='*50}\n")

    def get_llm_decision(self, model_config, state, model_seat_idx, current_hand_idx, rotation_offset):
        pk_idx = (model_seat_idx - rotation_offset) % len(self.models)
        try:
            hand_str = self.format_cards(state.hole_cards[pk_idx])
            my_stack = state.stacks[pk_idx]
        except IndexError:
            hand_str = "Unknown"
            my_stack = 0
        
        board_str = self.format_cards(state.board_cards)
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
                if i == 3: pos_labels[i] = "UTG"
                elif i == num_players - 1: pos_labels[i] = "Cutoff"
                else: pos_labels[i] = f"UTG+{i-3}"

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
        current_progress = "\n".join(self.current_hand_history)

        base_prompt = f"""
=== TOURNAMENT STATUS ===
Current Hand: {current_hand_idx} of {self.num_hands}
Active Players: {len(self.models)}
=== PREVIOUS COMPLETED HANDS ===
{past_hands_context}
=== CURRENT HAND PROGRESS ===
{current_progress}
=== YOUR CURRENT STATE ===
Your Name: {p_name}
Your Position: {my_position_label}
Your Hand: [{hand_str}]
Board: [{board_str}]
Your Stack: {my_stack}
Opponent Info: {" | ".join(opponent_info)}
Pot: {sum(state.pot_amounts)}
To Call: {state.checking_or_calling_amount}
Min Raise To: {min_raise_str}
Decide your action based on the defined JSON schema.
"""
        formatted_system_prompt = SYSTEM_PROMPT_TEMPLATE.format(total_hands=self.num_hands)
        messages = [{"role": "system", "content": formatted_system_prompt}, {"role": "user", "content": base_prompt}]
        
        self.log_debug_data(p_name, "REQUEST", messages)
        try:
            response = completion(
                model=model_config['model_id'],
                messages=messages,
                response_format=POKER_DECISION_SCHEMA, 
                temperature=self.temperature
            )
            self.log_debug_data(p_name, "RESPONSE", response)
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            self.log_debug_data(p_name, "ERROR", str(e))
            return {"action": "fold", "thought_process": f"API Error: {str(e)}", "amount": 0}

    def run(self):
        if not self.quiet:
            print(f"Starting PokerBench | Hands: {self.num_hands} | Eliminations: ON")

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
                self.log(f"\n!!! TOURNAMENT ENDED - WINNER: {self.models[0]['name']} !!!")
                # Fill remaining history with final stack
                for _ in range(hand_idx, self.num_hands + 1):
                    current_stacks_map = {m['name']: self.stacks[i] for i, m in enumerate(self.models)}
                    for name in self.all_player_names:
                        self.stack_history[name].append(current_stacks_map.get(name, 0))
                break

            self.log(f"\n{'='*25} HAND {hand_idx} / {self.num_hands} {'='*25}")

            # Rotate Dealer
            if hand_idx > 1 and not skip_rotation:
                p_moved, s_moved = self.models.pop(0), self.stacks.pop(0)
                self.models.append(p_moved)
                self.stacks.append(s_moved)
                for i, m in enumerate(self.models): m['seat'] = i
            
            skip_rotation = False
            self.log(f"Dealer (Button): {self.models[0]['name']}")

            start_stacks = list(self.stacks)
            hand_vpip = {m['name']: False for m in self.models}
            active_player_names = {m['name'] for m in self.models}
            self.current_hand_history = [f"Hand #{hand_idx}:"]

            # PokerKit State
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

            # Deal
            current_hole_cards = {}
            for i, m in enumerate(self.models):
                pk_idx = (i - rotation_offset) % len(self.models)
                cards = self.format_cards(state.hole_cards[pk_idx])
                current_hole_cards[m['name']] = cards
                self.log(f"  {m['name']}: [{cards}] ({self.stacks[i]})")
            
            last_street_idx = -1
            while state.status:
                if state.street_index != last_street_idx:
                    last_street_idx = state.street_index
                    street_name = STREET_NAMES.get(last_street_idx, f"STREET {last_street_idx}")
                    board_cards = self.format_cards(state.board_cards)
                    self.log(f"\n[{street_name}] Board: {board_cards}")
                    self.current_hand_history.append(f"[{street_name}] Board: {board_cards}")

                if state.actor_index is not None:
                    pk_actor_idx = state.actor_index
                    model_seat_idx = (pk_actor_idx + rotation_offset) % len(self.models)
                    p_name = self.models[model_seat_idx]['name']
                    
                    decision = self.get_llm_decision(self.models[model_seat_idx], state, model_seat_idx, hand_idx, rotation_offset)
                    action = str(decision.get("action", "fold")).lower()
                    amount = int(decision.get("amount", 0)) if decision.get("amount") else 0
                    thought = decision.get("thought_process", "")

                    try:
                        if action == "fold":
                            state.fold()
                            self.current_hand_history.append(f"  - {p_name} folded.")
                            active_player_names.discard(p_name)
                        elif action in ["check", "call"]:
                            call_amt = state.checking_or_calling_amount
                            state.check_or_call()
                            self.current_hand_history.append(f"  - {p_name} checked/called {call_amt}.")
                            if state.street_index == 0: hand_vpip[p_name] = True
                        elif action in ["bet", "raise"]:
                            min_r = state.min_completion_betting_or_raising_to_amount
                            actual_amt = max(amount, min_r) if min_r else amount
                            state.complete_bet_or_raise_to(actual_amt)
                            self.current_hand_history.append(f"  - {p_name} raised to {actual_amt}.")
                            if state.street_index == 0: hand_vpip[p_name] = True
                        else:
                            state.fold()
                            active_player_names.discard(p_name)

                        self.log(f"   {p_name}: {action.upper()} {amount if action in ['bet','raise'] else ''}")

                    except Exception as e:
                        state.fold()
                        active_player_names.discard(p_name)
                        self.log(f"   {p_name}: ERROR - {str(e)}")
                else: continue

            # Payoffs
            final_pk_stacks = list(state.stacks)
            self.stacks = final_pk_stacks if is_heads_up else final_pk_stacks[-1:] + final_pk_stacks[:-1]

            for i in range(len(self.models)):
                model_seat_idx = (i + rotation_offset) % len(self.models)
                p_name = self.models[model_seat_idx]['name']
                payoff = state.payoffs[i]

                if payoff > 0:
                    self.stats[p_name]["wins"] += 1
                    self.current_hand_history.append(f"RESULT: {p_name} wins {payoff} chips.")
                    self.log(f"RESULT: {p_name} wins {payoff} chips.")
                
                self.stats[p_name]["hands_played"] += 1
                if hand_vpip[p_name]: self.stats[p_name]["vpip_count"] += 1
                self.hand_profits[p_name].append(self.stacks[model_seat_idx] - start_stacks[model_seat_idx])

            # Update Stack History for all players (including eliminated ones who are now 0)
            current_stacks_map = {m['name']: self.stacks[i] for i, m in enumerate(self.models)}
            for name in self.all_player_names:
                s = current_stacks_map.get(name, 0)
                self.stack_history[name].append(s)

            # Record History
            public_log = "\n".join(self.current_hand_history)
            for p_name, cards in current_hole_cards.items():
                if p_name in self.player_histories:
                    self.player_histories[p_name].append(f"Hand #{hand_idx} | Held: [{cards}]\n{public_log}")

            # Elimination
            surviving, surviving_stacks = [], []
            for i, stack in enumerate(self.stacks):
                if stack > 0:
                    surviving.append(self.models[i])
                    surviving_stacks.append(stack)
                else:
                    self.log(f"  [X] ELIMINATED: {self.models[i]['name']}")
                    if i == 0: skip_rotation = True
            
            self.models = surviving
            self.stacks = surviving_stacks

        # Final Cleanup
        for m in self.models:
            idx = self.models.index(m)
            self.stats[m['name']]['final_stack'] = self.stacks[idx]
        
        # Ensure stack history is equal length for all (if game ended early)
        max_len = max(len(h) for h in self.stack_history.values())
        for name in self.stack_history:
            while len(self.stack_history[name]) < max_len:
                self.stack_history[name].append(self.stack_history[name][-1])

        return self.stats, self.hand_profits, self.stack_history

def run_game_wrapper(args_dict):
    try:
        runner = PokerBenchRunner(
            num_hands=args_dict['hands'],
            memory_size=args_dict['memory'],
            temperature=args_dict['temp'],
            debug=args_dict['debug'],
            quiet=True
        )
        return runner.run()
    except Exception as e:
        print(f"Error in game process: {e}")
        return None

def generate_results_graph(all_histories, filename="poker_stack_history.png"):
    print(f"Generating improved graph: {filename}...")

    # Use a style that pops more
    plt.style.use('bmh')
    plt.figure(figsize=(14, 8))

    player_names = list(all_histories[0].keys())

    # High contrast colors
    colors = ['#D62728', '#1F77B4', '#2CA02C', '#FF7F0E', '#9467BD', '#8C564B']
    color_map = {name: colors[i % len(colors)] for i, name in enumerate(player_names)}

    # Loop through each player to calculate stats and plot
    for name in player_names:
        c = color_map[name]

        # 1. Collect data: Create a matrix of [Games x Hands]
        # We need to handle cases where games might have slightly different lengths
        # (though the runner usually pads them, extra safety helps)
        raw_data = [g[name] for g in all_histories]

        # Determine max length to standardize arrays (pad with last value)
        max_len = max(len(r) for r in raw_data)
        padded_data = []
        for r in raw_data:
            if len(r) < max_len:
                r = r + [r[-1]] * (max_len - len(r))
            padded_data.append(r)

        data_array = np.array(padded_data)

        # 2. Calculate the Average trajectory
        mean_stack = np.mean(data_array, axis=0)

        # 3. Plot Individual Games (The "Ghost" Lines)
        # We adjust alpha based on number of games. Fewer games = darker lines.
        num_games = len(all_histories)
        ghost_alpha = 0.4 if num_games <= 5 else 0.15

        for row in data_array:
            plt.plot(row, color=c, alpha=ghost_alpha, linewidth=1, linestyle='-')

        # 4. Plot the Average Line (The "Story" Line)
        plt.plot(mean_stack, color=c, linewidth=3, marker='o', markersize=4, label=f"{name} (Avg)")

    # Formatting
    plt.title(f"Stack Performance: Average of {len(all_histories)} Games", fontsize=16, pad=20)
    plt.xlabel("Hand Number", fontsize=12)
    plt.ylabel("Stack Size (Chips)", fontsize=12)

    # Starting Stack Line
    plt.axhline(y=10000, color='black', linestyle='--', alpha=0.5, linewidth=2, label="Starting Stack")

    plt.legend(loc='upper left', frameon=True, shadow=True, fontsize=11)
    plt.grid(True, which='both', linestyle='--', alpha=0.7)
    plt.minorticks_on()

    plt.tight_layout()
    plt.savefig(filename, dpi=300) # Higher DPI for clearer text
    print("Graph saved successfully.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--hands", type=int, default=10, help="Total hands to play per game")
    parser.add_argument("--games", type=int, default=1, help="Number of games to run in parallel")
    parser.add_argument("--memory", type=int, default=3, help="Memory size")
    parser.add_argument("--temp", type=float, default=0.5, help="Temperature")
    parser.add_argument("--debug", action="store_true", help="Enable debug logs")
    args = parser.parse_args()

    worker_args = vars(args)

    if args.games == 1:
        runner = PokerBenchRunner(args.hands, args.memory, args.temp, args.debug, quiet=False)
        stats, profits, history = runner.run()
        all_stats = [stats]
        all_profits = [profits]
        all_histories = [history]
    else:
        print(f"Starting {args.games} games in parallel on {os.cpu_count() or 4} cores...")
        all_stats, all_profits, all_histories = [], [], []
        
        with concurrent.futures.ProcessPoolExecutor() as executor:
            futures = [executor.submit(run_game_wrapper, worker_args) for _ in range(args.games)]
            completed = 0
            for future in concurrent.futures.as_completed(futures):
                res = future.result()
                if res:
                    s, p, h = res
                    all_stats.append(s)
                    all_profits.append(p)
                    all_histories.append(h)
                    completed += 1
                    print(f"Finished game {completed}/{args.games}")

    # --- RANKING TABLE ---
    print(f"\n{'='*35} PLAYER RANKING (Avg Profit) {'='*35}")
    rank_data = []
    player_names = all_stats[0].keys()

    for name in player_names:
        total_profit = 0
        total_wins = 0
        total_hands = 0
        
        for i in range(len(all_stats)):
            final_stack = all_stats[i][name]['final_stack']
            total_profit += (final_stack - 10000)
            total_wins += all_stats[i][name]['wins']
            total_hands += all_stats[i][name]['hands_played']

        avg_profit = total_profit / len(all_stats)
        win_rate = (total_wins / total_hands * 100) if total_hands > 0 else 0
        rank_data.append({"name": name, "profit": avg_profit, "win_rate": win_rate})

    # Sort by Average Profit Descending
    rank_data.sort(key=lambda x: x['profit'], reverse=True)

    print(f"{'Rank':<4} | {'Player':<15} | {'Avg Profit ($)':<15} | {'Win Rate':<10}")
    print("-" * 55)
    for i, p in enumerate(rank_data):
        print(f"{i+1:<4} | {p['name']:<15} | {p['profit']:+,.0f}".ljust(38) + f" | {p['win_rate']:.1f}%")

    # --- GENERATE GRAPH ---
    if len(all_histories) > 0:
        generate_results_graph(all_histories)
