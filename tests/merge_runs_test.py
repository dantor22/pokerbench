
import unittest
from unittest.mock import patch
import json
import os
import shutil
import tempfile
import sys
import numpy as np

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import merge_runs

class TestMergeRuns(unittest.TestCase):

    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.source_dir = os.path.join(self.test_dir, "source")
        self.target_dir = os.path.join(self.test_dir, "target")
        os.makedirs(self.source_dir)
        
        # Create a dummy game file
        self.game_data = {
            "game_id": "test_uuid",
            "players": ["P1", "P2"],
            "config": {"hands": 2, "start_stack": 10000},
            "hands": [
                {
                    "hand_number": 1,
                    "pre_hand_stacks": {"P1": 10000, "P2": 10000},
                    "results": [
                        {"player": "P1", "net_gain": 500, "winner": True},
                        {"player": "P2", "net_gain": -500, "winner": False}
                    ],
                    "actions": [
                        {"type": "player_action", "player": "P1", "action": "bet", "amount": 500, "cost": 0.01}
                    ]
                }
            ]
        }
        with open(os.path.join(self.source_dir, "game_test.json"), 'w') as f:
            json.dump(self.game_data, f)

    def tearDown(self):
        shutil.rmtree(self.test_dir)

    def test_calculate_stats_from_games(self):
        stats, histories = merge_runs.calculate_stats_from_games([self.game_data])
        
        self.assertEqual(len(stats), 1)
        self.assertEqual(stats[0]["P1"]["final_stack"], 10500)
        self.assertEqual(stats[0]["P2"]["final_stack"], 9500)
        self.assertEqual(stats[0]["P1"]["wins"], 1)
        self.assertEqual(stats[0]["P1"]["total_cost"], 0.01)
        
        self.assertEqual(len(histories), 1)
        self.assertEqual(histories[0]["P1"], [10000, 10500])

    def test_main_merge(self):
        # Mock sys.argv
        with patch('sys.argv', ['merge_runs.py', '--sources', self.source_dir, '--target', self.target_dir]):
            merge_runs.main()
            
        self.assertTrue(os.path.exists(os.path.join(self.target_dir, "game_test.json")))
        self.assertTrue(os.path.exists(os.path.join(self.target_dir, "summary.json")))
        self.assertTrue(os.path.exists(os.path.join(self.target_dir, "stack_history.png")))

    def test_summary_accuracy_multi_game(self):
        # Create game 2 where P2 wins
        game2_data = {
            "game_id": "test_uuid_2",
            "players": ["P1", "P2"],
            "config": {"hands": 1, "start_stack": 10000},
            "hands": [
                {
                    "hand_number": 1,
                    "pre_hand_stacks": {"P1": 10000, "P2": 10000},
                    "results": [
                        {"player": "P1", "net_gain": -1000, "winner": False},
                        {"player": "P2", "net_gain": 1000, "winner": True}
                    ],
                    "actions": []
                }
            ]
        }
        with open(os.path.join(self.source_dir, "game_test_2.json"), 'w') as f:
            json.dump(game2_data, f)
            
        with patch('sys.argv', ['merge_runs.py', '--sources', self.source_dir, '--target', self.target_dir]):
            merge_runs.main()
            
        with open(os.path.join(self.target_dir, "summary.json"), 'r') as f:
            summary = json.load(f)
            
        self.assertEqual(summary["total_games"], 2)
        leaderboard = {entry["name"]: entry for entry in summary["leaderboard"]}
        
        # P1: Game 1 (+500), Game 2 (-1000). Total -500. Avg -250.
        # Win rate: Game 1 (1/1 hands = 100%), Game 2 (0/1 hands = 0%).
        # Note: Win rate is total_wins / total_hands.
        # Game 1: 1 win, 1 hand. Game 2: 0 wins, 1 hand.
        # Total: 1 win / 2 hands = 50%
        
        p1 = leaderboard["P1"]
        self.assertEqual(p1["avg_profit"], -250.0)
        self.assertEqual(p1["win_rate"], 50.0)
        self.assertEqual(p1["total_hands"], 2)
        
        # P2: Game 1 (-500), Game 2 (+1000). Total +500. Avg +250.
        # Win rate: 1 win / 2 hands = 50%
        p2 = leaderboard["P2"]
        self.assertEqual(p2["avg_profit"], 250.0)
        self.assertEqual(p2["win_rate"], 50.0)

if __name__ == '__main__':
    unittest.main()
