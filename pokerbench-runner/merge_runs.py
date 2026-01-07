import os
import json
import argparse
import shutil
import time
import numpy as np
import matplotlib.pyplot as plt

def load_game_data(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading {file_path}: {e}")
        return None

def generate_results_graph(all_histories, output_dir, filename="stack_history.png"):
    if not all_histories:
        return
    print(f"Generating graph: {filename}...")
    plt.style.use('bmh')
    plt.figure(figsize=(14, 8))

    player_names = list(all_histories[0].keys())
    # Match colors from pokerbench.py if possible, or use default cycle
    colors = ['#D62728', '#1F77B4', '#2CA02C', '#FF7F0E', '#9467BD', '#8C564B']
    color_map = {name: colors[i % len(colors)] for i, name in enumerate(player_names)}

    for name in player_names:
        c = color_map.get(name, 'black')
        raw_data = []
        for g in all_histories:
            if name in g:
                raw_data.append(g[name])
        
        if not raw_data:
            continue
            
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
    plt.savefig(os.path.join(output_dir, filename), dpi=300)
    print(f"Graph saved to {os.path.join(output_dir, filename)}")

def calculate_stats_from_games(games):
    all_stats = []
    all_histories = []
    
    for game in games:
        # Reconstruct stats for this game
        # We need to parse the game log to get stats matching pokerbench structure
        # Or we can just extract what we need for the summary if it's already there?
        # pokerbench.py calculates stats on the fly from the runner or loaded log
        # Let's try to do a lightweight extraction similar to PokerBenchRunner.from_json but just for stats
        
        # Actually, let's just use the end state if possible, or re-calculate.
        # Re-calculating using the logic from pokerbench.py is safest to be consistent.
        
        # Simplified stat extraction:
        players = game["players"]
        stats = {name: {
            "wins": 0, "hands_played": 0, "vpip_count": 0, "decision_count": 0,
            "final_stack": 0, "total_cost": 0.0, "total_reasoning_tokens": 0
        } for name in players}
        
        stack_history = {name: [game["config"]["start_stack"]] for name in players}
        
        # Iterate hands
        for h in game["hands"]:
            # Results
            for r in h["results"]:
                p = r["player"]
                if p in stats:
                    if r.get("winner"): stats[p]["wins"] += 1
                    stats[p]["hands_played"] += 1
                    
                    # Stack history
                    # We can rely on pre_hand_stacks + net_gain
                    # But game log might not have sequential coherence if it was just a snapshot? 
                    # Usually it does.
                    current_stack = h["pre_hand_stacks"].get(p, 0) + r["net_gain"]
                    stack_history[p].append(current_stack)

            # Actions for cost/tokens
            for act in h["actions"]:
                if act["type"] == "player_action":
                    p = act["player"]
                    if p in stats:
                        stats[p]["decision_count"] += 1
                        stats[p]["total_cost"] += (act.get("cost") or 0.0)
                        stats[p]["total_reasoning_tokens"] += (act.get("reasoning_tokens") or 0)
        
        # Set final stack
        if game["hands"]:
            last_hand = game["hands"][-1]
            for r in last_hand["results"]:
                 p = r["player"]
                 if p in stats:
                     stats[p]["final_stack"] = last_hand["pre_hand_stacks"].get(p, 0) + r["net_gain"]
        else:
            # No hands?
            for p in players:
                stats[p]["final_stack"] = game["config"]["start_stack"]

        all_stats.append(stats)
        
        # Normalize history lengths
        max_len = max(len(h) for h in stack_history.values())
        for name in stack_history:
            while len(stack_history[name]) < max_len:
                stack_history[name].append(stack_history[name][-1])
        all_histories.append(stack_history)

    return all_stats, all_histories

def main():
    parser = argparse.ArgumentParser(description="Merge poker runs")
    parser.add_argument("--sources", nargs="+", required=True, help="Source directories")
    parser.add_argument("--target", required=True, help="Target directory")
    args = parser.parse_args()

    target_dir = args.target
    if not os.path.exists(target_dir):
        os.makedirs(target_dir)

    all_game_files = []
    
    # 1. Collect and Copy Files
    for source in args.sources:
        if not os.path.exists(source):
            print(f"Warning: Source {source} does not exist.")
            continue
            
        for filename in os.listdir(source):
            if filename.startswith("game_") and filename.endswith(".json"):
                src_path = os.path.join(source, filename)
                dst_path = os.path.join(target_dir, filename)
                
                # Check if already exists? Overwrite? 
                # Let's assume we want to merge set of unique games.
                # If content is same, it's fine. If different content but same ID, we might have collision.
                # Usually IDs are random UUIDs so collision unlikely unless it's literally the same file.
                if not os.path.exists(dst_path):
                    shutil.copy2(src_path, dst_path)
                    print(f"Copied {filename} from {source}")
                else:
                    print(f"Skipping {filename} (already exists in target)")
    
    # 2. Read All Games from Target
    games = []
    for filename in os.listdir(target_dir):
        if filename.startswith("game_") and filename.endswith(".json"):
            path = os.path.join(target_dir, filename)
            data = load_game_data(path)
            if data:
                games.append(data)
    
    if not games:
        print("No games found in validation step.")
        return

    print(f"Found {len(games)} total games in {target_dir}")

    # 3. Recalculate Stats
    all_stats, all_histories = calculate_stats_from_games(games)

    # 4. Generate Leaderboard/Summary
    rank_data = []
    # Use keys from first game (or union of all)
    all_player_names = set()
    for s in all_stats:
        all_player_names.update(s.keys())
    
    player_names = list(all_player_names)

    for name in player_names:
        total_profit = 0
        total_wins = 0
        total_hands = 0
        total_cost = 0.0
        total_decisions = 0
        total_reasoning_tokens = 0
        
        count_participated = 0
        
        for i in range(len(all_stats)):
            if name not in all_stats[i]:
                continue
            count_participated += 1
            final_stack = all_stats[i][name].get('final_stack', 10000) # Default to start stack if missing?
            total_profit += (final_stack - 10000)
            total_wins += all_stats[i][name]['wins']
            total_hands += all_stats[i][name]['hands_played']
            total_cost += all_stats[i][name].get('total_cost', 0.0)
            total_decisions += all_stats[i][name].get('decision_count', 0)
            total_reasoning_tokens += all_stats[i][name].get('total_reasoning_tokens', 0)

        if count_participated == 0:
            continue

        avg_profit = total_profit / count_participated
        win_rate = (total_wins / total_hands * 100) if total_hands > 0 else 0
        avg_cost_per_decision = total_cost / total_decisions if total_decisions > 0 else 0
        
        rank_data.append({
            "name": name, 
            "avg_profit": round(avg_profit, 2), 
            "win_rate": round(win_rate, 2),
            "total_hands": total_hands,
            "total_cost": total_cost,
            "avg_cost_per_decision": avg_cost_per_decision,
            "avg_reasoning_tokens": total_reasoning_tokens / total_decisions if total_decisions > 0 else 0
        })

    rank_data.sort(key=lambda x: x['avg_profit'], reverse=True)

    # 5. Save Summary
    summary = {
        "timestamp": time.time(),
        "total_games": len(games),
        "leaderboard": rank_data,
        "aggregated_stacks": {},
        "raw_game_ids": [g.get("game_id") for g in games]
    }
    
    # Aggregated Stacks
    for name in player_names:
        raw_data = []
        for g in all_histories:
            if name in g:
                raw_data.append(g[name])
        
        if not raw_data:
            continue
            
        max_len = max(len(r) for r in raw_data)
        padded = [r + [r[-1]] * (max_len - len(r)) for r in raw_data]
        summary["aggregated_stacks"][name] = np.mean(np.array(padded), axis=0).tolist()

    summary_path = os.path.join(target_dir, "summary.json")
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2)
    print(f"Summary data saved to {summary_path}")

    # 6. Generate Graph
    generate_results_graph(all_histories, target_dir)

if __name__ == "__main__":
    main()
