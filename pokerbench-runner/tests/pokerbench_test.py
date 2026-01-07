
import unittest
from unittest.mock import MagicMock, patch
import json
import os
import sys
import tempfile
import shutil
from collections import deque
from types import SimpleNamespace

# Add parent directory to path to import pokerbench
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pokerbench

class TestPokerBench(unittest.TestCase):

    def setUp(self):
        self.game_id = "test_game"
        self.num_hands = 5
        self.memory_size = 10
        self.temperature = 0.5
        self.runner = pokerbench.PokerBenchRunner(
            self.game_id, self.num_hands, self.memory_size, self.temperature, debug=False
        )

    def test_parse_llm_response_clean_json(self):
        content = '{"action": "call", "amount": 100, "thought_process": "I have a good hand"}'
        expected = {"action": "call", "amount": 100, "thought_process": "I have a good hand"}
        result = self.runner._parse_llm_response(content)
        self.assertEqual(result, expected)

    def test_parse_llm_response_markdown_json(self):
        content = '```json\n{"action": "bet", "amount": 500, "thought_process": "Aggressive play"}\n```'
        expected = {"action": "bet", "amount": 500, "thought_process": "Aggressive play"}
        result = self.runner._parse_llm_response(content)
        self.assertEqual(result, expected)

    def test_parse_llm_response_markdown_no_tag(self):
        content = '```\n{"action": "fold", "amount": 0, "thought_process": "Bad hand"}\n```'
        expected = {"action": "fold", "amount": 0, "thought_process": "Bad hand"}
        result = self.runner._parse_llm_response(content)
        self.assertEqual(result, expected)

    def test_format_cards_flat_list(self):
        cards = ["As", "Kd"]
        result = self.runner.format_cards(cards)
        self.assertEqual(result, ["As", "Kd"])

    def test_format_cards_nested_list(self):
        cards = [("As", "Kd"), "Qh"]
        result = self.runner.format_cards(cards)
        self.assertEqual(result, ["As", "Kd", "Qh"])

    def test_normalize_histories(self):
        self.runner.stack_history = {
            "Player1": [10000, 10500],
            "Player2": [10000, 9500, 9000]
        }
        self.runner.normalize_histories()
        self.assertEqual(len(self.runner.stack_history["Player1"]), 3)
        self.assertEqual(self.runner.stack_history["Player1"][-1], 10500)

    @patch('pokerbench.completion_cost')
    @patch('pokerbench.completion')
    def test_get_llm_decision(self, mock_completion, mock_cost):
        # Mock response from litellm using SimpleNamespace for safety with hasattr
        mock_response = MagicMock()
        mock_response.choices = [
            SimpleNamespace(
                message=SimpleNamespace(content='{"action": "call", "amount": 200, "thought_process": "Call test"}')
            )
        ]
        mock_response.usage = SimpleNamespace(
            completion_tokens_details=SimpleNamespace(reasoning_tokens=50)
        )
        
        mock_completion.return_value = mock_response
        mock_cost.return_value = 0.01

        # Set runner models to match mock state
        self.runner.models = [
            {"seat": 0, "name": "TestModel", "model_id": "test-id"},
            {"seat": 1, "name": "Opponent", "model_id": "opp-id"}
        ]
        self.runner.all_player_names = ["TestModel", "Opponent"]
        for name in self.runner.all_player_names:
            self.runner.player_histories[name] = deque()
            self.runner.current_hand_thoughts[name] = []
            self.runner.stats[name] = {"total_cost": 0.0, "decision_count": 0, "total_reasoning_tokens": 0}

        # Mock state
        mock_state = MagicMock()
        mock_state.hole_cards = [["As", "Ah"], ["Kh", "Ks"]]
        mock_state.stacks = [10000, 10000]
        mock_state.board_cards = []
        mock_state.pot_amounts = [300]
        mock_state.bets = [100, 100]
        mock_state.checking_or_calling_amount = 100
        mock_state.min_completion_betting_or_raising_to_amount = 200

        model_config = self.runner.models[0]
        decision, cost, r_tokens = self.runner.get_llm_decision(model_config, mock_state, 0, 1, 0)

        self.assertEqual(decision["action"], "call")
        self.assertEqual(decision["amount"], 200)
        self.assertEqual(r_tokens, 50)
        self.assertTrue(mock_completion.called)
        self.assertTrue(mock_cost.called)

    def test_fill_remaining_history(self):
        self.runner.all_player_names = ["P1", "P2"]
        self.runner.models = [{"name": "P1"}, {"name": "P2"}]
        self.runner.stacks = [5000, 15000]
        self.runner.stack_history = {"P1": [10000], "P2": [10000]}
        
        self.runner.fill_remaining_history(1)
        # Should fill up to num_hands + 1 (5+1 = 6 entries)
        self.assertEqual(len(self.runner.stack_history["P1"]), 6)
        self.assertEqual(self.runner.stack_history["P1"][-1], 5000)
        self.assertEqual(self.runner.stack_history["P2"][-1], 15000)

    def test_from_json(self):
        game_data = {
            "game_id": "resume_test",
            "players": ["Minni", "Flash"],
            "config": {"hands": 2, "start_stack": 10000},
            "hands": [
                {
                    "hand_number": 1,
                    "dealer": "Minni",
                    "pre_hand_stacks": {"Minni": 10000, "Flash": 10000},
                    "hole_cards": {"Minni": ["As", "Ah"], "Flash": ["Kh", "Ks"]},
                    "results": [
                        {"player": "Minni", "net_gain": 500, "winner": True},
                        {"player": "Flash", "net_gain": -500, "winner": False}
                    ],
                    "actions": [
                        {"type": "player_action", "player": "Minni", "action": "bet", "amount": 500, "cost": 0.01}
                    ]
                }
            ]
        }
        
        resumed_runner = pokerbench.PokerBenchRunner.from_json(
            game_data, target_hands=5, memory_size=10, temperature=1.0
        )
        
        self.assertEqual(resumed_runner.game_id, "resume_test")
        self.assertEqual(resumed_runner.num_hands, 5)
        self.assertEqual(len(resumed_runner.game_log["hands"]), 1)
        # Minni was dealer, so Flash should be next dealer
        self.assertEqual(resumed_runner.models[0]["name"], "Flash")
        self.assertEqual(resumed_runner.stacks[0], 9500)
        self.assertEqual(resumed_runner.stacks[1], 10500)
        self.assertEqual(resumed_runner.stats["Minni"]["wins"], 1)

    @patch('pokerbench.GAMES_DIR', tempfile.gettempdir())
    def test_save_game_file(self):
        self.runner.game_id = "save_test"
        self.runner.save_game_file()
        expected_path = os.path.join(tempfile.gettempdir(), f"game_save_test.json")
        self.assertTrue(os.path.exists(expected_path))
        os.remove(expected_path)


try:
    from pokerkit import NoLimitTexasHoldem, Automation
except ImportError:
    pass

class MockLLMRunner(pokerbench.PokerBenchRunner):
    """Subclass of PokerBenchRunner to inject deterministic decisions."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.decision_queue = deque() # Queue of (player_name, decision_dict)

    def queue_decision(self, player_name, action, amount=0):
        self.decision_queue.append((player_name, {
            "action": action,
            "amount": amount,
            "thought_process": f"Mocking {action} {amount}"
        }))

    def get_llm_decision(self, model_config, state, model_seat_idx, current_hand_idx, rotation_offset):
        # Check if next queued decision matches this player
        if not self.decision_queue:
            # Default fallback: check/call if possible, else fold (not used in strict tests)
            return {"action": "check", "amount": 0, "thought_process": "Default"}, 0.0, 0
        
        expected_player, decision = self.decision_queue[0]
        current_player = model_config['name']
        
        if expected_player != current_player:
            # If we are asked for a decision for a player not at the head of the queue, 
            # ideally the test setup is wrong. For robust tests, we crash.
            raise ValueError(f"Expected decision for {expected_player}, but got request for {current_player}")
        
        self.decision_queue.popleft()
        return decision, 0.0, 0 # 0 cost, 0 tokens

class TestPromptAccuracy(unittest.TestCase):
    """
    Validates that the text prompt sent to the LLM accurately reflects 
    the game state (Cards, Board, Pot, Stacks).
    """
    def setUp(self):
        self.runner = pokerbench.PokerBenchRunner("prompt_test", 1, 100, 0)
        self.runner.models = [
            {"seat": 0, "name": "Hero", "model_id": "m1"},
            {"seat": 1, "name": "Villain", "model_id": "m2"}
        ]
        self.runner.all_player_names = ["Hero", "Villain"]
        self.runner.stacks = [5000, 5000]
        # Init tracking
        for n in ["Hero", "Villain"]:
            self.runner.player_histories[n] = deque()
            self.runner.current_hand_thoughts[n] = []
            self.runner.stats[n] = {"total_cost": 0, "decision_count": 0, "total_reasoning_tokens": 0}

    @patch('pokerbench.completion')
    def test_prompt_content_preflop(self, mock_completion):
        # Setup mock response
        mock_response = MagicMock()
        mock_response.choices = [SimpleNamespace(message=SimpleNamespace(content='{"action":"fold","amount":0,"thought_process":"test"}'))]
        mock_completion.return_value = mock_response

        # Setup STATE directly
        # Hero (SB/Btn), Villain (BB).
        state = MagicMock()
        # Case: Preflop.
        # Hero is Seat 0. Villain Seat 1.
        # If rotation_offset=1.
        # Hero pk_idx = (0 - 1) % 2 = 1.
        # Villain pk_idx = (1 - 1) % 2 = 0.
        state.hole_cards = {1: ["As", "Ks"], 0: ["2h", "7d"]} # 1 is Hero
        state.stacks = {1: 4950, 0: 4900} # Hero posted 50, Villain 100
        state.board_cards = []
        
        # Pot: 50+100=150
        state.pot_amounts = [0, 0]
        state.bets = [100, 50] # Villain(0) 100, Hero(1) 50
        
        state.checking_or_calling_amount = 50 # Hero needs 50 to call
        state.min_completion_betting_or_raising_to_amount = 200
        
        # Call SUT
        # Hero is model_seat_idx 0.
        self.runner.get_llm_decision(
            self.runner.models[0], # Hero
            state,
            0, # seat_idx
            1, # hand_idx
            1  # rotation_offset
        )
        
        # Inspect arguments
        call_args = mock_completion.call_args[1]
        messages = call_args["messages"]
        user_prompt = messages[1]["content"]
        
        # Assertions
        # 1. Identity
        self.assertIn("Name: Hero", user_prompt)
        self.assertIn("Position: Button (SB)", user_prompt) # 2-player labeling
        
        # 2. Cards
        self.assertIn("Cards: [As Ks]", user_prompt)
        
        # 3. Stack (Current stack in state is 4950)
        self.assertIn("Stack: 4950", user_prompt)
        
        # 4. Pot (100+50 = 150)
        self.assertIn("Pot: 150", user_prompt)
        self.assertIn("To Call: 50", user_prompt)
        
        # 5. Opponents
        # Villain stack 4900.
        self.assertIn("Villain (Big Blind): 4900", user_prompt)

    @patch('pokerbench.completion')
    def test_prompt_content_flop(self, mock_completion):
        mock_response = MagicMock()
        mock_response.choices = [SimpleNamespace(message=SimpleNamespace(content='{"action":"check","amount":0,"thought_process":"test"}'))]
        mock_completion.return_value = mock_response

        # Scenario: Flop [Ah Kh Qh]. Pot 200.
        # Hero (Seat 0) acts first? In HU postfloat, BB (Villain) acts first.
        # Let's test checking for Villain (Seat 1).
        
        state = MagicMock()
        # rotation_offset=1.
        # Villain (Seat 1). pk_idx = (1-1)%2 = 0.
        state.hole_cards = {0: ["2h", "7d"]} 
        state.stacks = {0: 4900, 1: 4900}
        state.board_cards = ["Ah", "Kh", "Qh"]
        state.pot_amounts = [200]
        state.bets = [0, 0]
        state.checking_or_calling_amount = 0
        state.min_completion_betting_or_raising_to_amount = 100
        state.street_index = 1
        
        self.runner.get_llm_decision(
            self.runner.models[1], # Villain
            state,
            1, # seat_idx
            1,
            1 
        )
        
        user_prompt = mock_completion.call_args[1]["messages"][1]["content"]
        
        self.assertIn("Name: Villain", user_prompt)
        self.assertIn("Position: Big Blind", user_prompt)
        self.assertIn("Cards: [2h 7d]", user_prompt)
        self.assertIn("Board: [Ah Kh Qh]", user_prompt)
        self.assertIn("Pot: 200", user_prompt)

class TestPokerBenchScenarios(unittest.TestCase):

    def setUp(self):
        # Minimal setup
        self.runner = MockLLMRunner("test_scenario", num_hands=1, memory_size=10, temperature=0, debug=False)
        # Override default models with simpler 2-player or 3-player setup in tests
        self.runner.models = []
        self.runner.stacks = []

    def setup_players(self, count=2, stacks=None):
        names = ["P1", "P2", "P3", "P4", "P5", "P6"]
        self.runner.models = [
            {"seat": i, "name": names[i], "model_id": f"mock-{names[i]}"}
            for i in range(count)
        ]
        self.runner.all_player_names = [m['name'] for m in self.runner.models]
        if stacks:
            self.runner.stacks = stacks
        else:
            self.runner.stacks = [10000] * count
        
        # Reset tracking dicts
        for name in self.runner.all_player_names:
            self.runner.player_histories[name] = deque()
            self.runner.current_hand_thoughts[name] = []
            self.runner.stats[name] = {
                "wins": 0, "hands_played": 0, "vpip_count": 0, "decision_count": 0,
                "final_stack": 0, "total_cost": 0.0, "total_reasoning_tokens": 0
            }
            self.runner.stack_history[name] = [self.runner.stacks[names.index(name)]]
            self.runner.hand_profits[name] = []

    def test_heads_up_blinds(self):
        """Verify Heads-Up blind posting: Dealer is SB, Other is BB."""
        self.setup_players(2, [1000, 1000])
        self.runner.num_hands = 1
        
        # P1 (Dealer/BTN/SB) posts 50, P2 (BB) posts 100.
        # Action starts with P1 (SB).
        # P1 folds. P2 wins walk.
        self.runner.queue_decision("P1", "fold")
        
        stats, profits, history, _ = self.runner.run()
        
        # P1 lost 50 (SB)
        self.assertEqual(profits["P1"][0], -50)
        # P2 won 50
        self.assertEqual(profits["P2"][0], 50)
        
        # Verify log actions
        hand_log = self.runner.game_log["hands"][0]
        # P1 should have folder
        actions = [a for a in hand_log["actions"] if a["type"] == "player_action"]
        self.assertEqual(len(actions), 1)
        self.assertEqual(actions[0]["player"], "P1")
        self.assertEqual(actions[0]["action"], "fold")

    def test_showdown_winner(self):
        """Verify simple showdown logic."""
        self.setup_players(2, [1000, 1000])
        self.runner.num_hands = 1
        
        # P1 (SB) calls 100 (adds 50)
        self.runner.queue_decision("P1", "call", 100) # Call 100 total
        # P2 (BB) checks
        self.runner.queue_decision("P2", "check")
        
        # FLOP: P2 acts first? 
        # In HU, P1 is BTN/SB. P2 is BB. 
        # Post-flop: BB (P2) acts first.
        self.runner.queue_decision("P2", "check")
        self.runner.queue_decision("P1", "check")
        
        # TURN
        self.runner.queue_decision("P2", "check")
        self.runner.queue_decision("P1", "check")
        
        # RIVER
        self.runner.queue_decision("P2", "check")
        self.runner.queue_decision("P1", "check")
        
        # Assume board/cards are random, but we can inspect result consistency.
        # Just ensure game completes and net gains sum to 0
        stats, profits, history, _ = self.runner.run()
        
        gain_p1 = profits["P1"][0]
        gain_p2 = profits["P2"][0]
        self.assertEqual(gain_p1 + gain_p2, 0)
        # Pot was 200 (100 each). Winner gets +100 net, Loser gets -100 net.
        # Or split pot: 0, 0.
        self.assertTrue(gain_p1 in [100, -100, 0])

    def test_side_pot_logic(self):
        """
        Verify multiple all-in side pot calculations.
        P1 stack: 100 (All-in)
        P2 stack: 1000
        P3 stack: 1000
        
        P1 All-in 100.
        P2 Call 100.
        P3 Raise to 500.
        P2 Call 500.
        
        Main Pot: 300 (100x3) -> Contested by P1, P2, P3
        Side Pot: 800 (400x2) -> Contested by P2, P3
        """
        self.setup_players(3, [100, 1000, 1000]) # P1, P2, P3
        # Rotation: P1 (D), P2 (SB), P3 (BB).
        # Preflop order: P1 (BTN) acts first after blinds.
        # Blinds: P2(50), P3(100).
        
        # P1 (BTN) - All in 100
        self.runner.queue_decision("P1", "raise", 100) # Technically raising to 100 (min is BB 100)
        
        # P2 (SB) - Call 100 (adds 50)
        self.runner.queue_decision("P2", "call", 100)
        
        # P3 (BB) - Raise to 500
        self.runner.queue_decision("P3", "raise", 500)
        
        # P1 is All-in, skipped.
        # P2 needs to call 500.
        self.runner.queue_decision("P2", "call", 500)
        
        # Flop/Turn/River - P2 and P3 checking down side pot
        # P2 acts first (SB) vs P3 (BB)
        for _ in range(3): # Flop, Turn, River
             self.runner.queue_decision("P2", "check")
             self.runner.queue_decision("P3", "check")
             
        stats, profits, history, _ = self.runner.run()
        
        # Verify pot logic via net gains
        # Total in pots: 100(P1) + 500(P2) + 500(P3) = 1100.
        # Main Pot: 300. Side Pot: 800.
        
        # We can't easily force who wins without mocking cards, BUT:
        # P1 max win = 200 (net +200, profit).
        # P1 can never win > 200.
        self.assertLessEqual(profits["P1"][0], 200)
        
        # Ensure total sum is 0 (rake is 0)
        total_p = sum([profits[n][0] for n in ["P1", "P2", "P3"]])
        self.assertAlmostEqual(total_p, 0, delta=0.01)

    def test_all_in_runout_logging(self):
        """Verify that when players are all-in, the board completes and is logged."""
        self.setup_players(2, [1000, 1000])
        # P1(SB), P2(BB)
        
        # Preflop:
        # P1 Raise to 1000 (All-in)
        self.runner.queue_decision("P1", "raise", 1000)
        # P2 Call 1000 (All-in)
        self.runner.queue_decision("P2", "call", 1000)
        
        # No more decisions needed. Game should auto-run runout.
        stats, profits, history, _ = self.runner.run()
        
        hand_log = self.runner.game_log["hands"][0]
        actions = hand_log["actions"]
        
        # Check for RUNOUT event or street events for Flop/Turn/River
        # Pokerkit might just emit street events as state advances?
        # The runner code has a block: "if state.street_index != last_street_idx..."
        # And a special "Final Board Check" block.
        
        # We expect a board of 5 cards
        self.assertEqual(len(hand_log["board"]), 5)
        
        # Verify we have "street_event" logs or a runout log
        street_events = [a for a in actions if a["type"] == "street_event"]
    def test_json_output_structure_and_content(self):
        """Run a complete hand and strictly validate the structure and content of the output log."""
        self.setup_players(2, [1000, 1000]) # P1 (SB), P2 (BB)
        
        # Action: P1 calls, P2 checks. Flop. P2 checks, P1 bets, P2 folds.
        # Preflop
        self.runner.queue_decision("P1", "call", 100)
        self.runner.queue_decision("P2", "check")
        # Flop
        self.runner.queue_decision("P2", "check")
        self.runner.queue_decision("P1", "bet", 50) # Bet 50
        self.runner.queue_decision("P2", "fold")
        
        self.runner.run()
        
        log = self.runner.game_log
        
        # 1. Top Level Fields
        self.assertIn("game_id", log)
        self.assertIn("timestamp", log)
        self.assertIn("config", log)
        self.assertIn("players", log)
        self.assertIn("hands", log)
        self.assertEqual(len(log["hands"]), 1)
        
        hand = log["hands"][0]
        
        # 2. Hand Fields
        self.assertEqual(hand["hand_number"], 1)
        self.assertEqual(hand["dealer"], "P1")
        self.assertEqual(hand["pre_hand_stacks"]["P1"], 1000)
        self.assertEqual(hand["pre_hand_stacks"]["P2"], 1000)
        
        # 3. Actions consistency
        actions = hand["actions"]
        player_actions = [a for a in actions if a["type"] == "player_action"]
        
        # P1 call, P2 check, P2 check, P1 bet, P2 fold -> 5 actions
        self.assertEqual(len(player_actions), 5)
        
        # Verify first action (P1 Call) details
        act1 = player_actions[0]
        self.assertEqual(act1["player"], "P1")
        self.assertEqual(act1["action"], "call")
        self.assertEqual(act1["amount"], 100) # Total invested in street
        self.assertEqual(act1["chips_added"], 50) # Added 50 (SB is 50)
        self.assertEqual(act1["pot_before"], 150) # SB(50)+BB(100) = 150.
        
        # 4. Results
        results = hand["results"]
        p1_res = next(r for r in results if r["player"] == "P1")
        p2_res = next(r for r in results if r["player"] == "P2")
        
        self.assertTrue(p1_res["winner"])
        self.assertFalse(p2_res["winner"])
        # P1 wins. Pot: 100(P1 pre) + 100(P2 pre) + 50(P1 flop) = 250.
        # P2 folded. P2 put in 100.
        # P1 input 150. Got back 250. Net +100.
        # P2 input 100. Net -100.
        self.assertEqual(p1_res["net_gain"], 100)
        self.assertEqual(p2_res["net_gain"], -100)


class TestSummaryValidation(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.output_dir = os.path.join(self.test_dir, "poker_output")
        os.makedirs(self.output_dir)
        
        # We need to patch OUTPUT_DIR in pokerbench to use our temp dir
        self.patcher = patch('pokerbench.OUTPUT_DIR', self.output_dir)
        self.patcher.start()

    def tearDown(self):
        self.patcher.stop()
        shutil.rmtree(self.test_dir)

    def test_save_summary_structure(self):
        """Validate the structure of the summary.json generated by save_summary."""
        all_stats = [
            {"P1": {"wins": 5, "hands_played": 10, "final_stack": 10500}},
            {"P1": {"wins": 2, "hands_played": 10, "final_stack": 9500}}
        ]
        # all_histories structure: list of dicts {player: [stack1, stack2...]}
        all_histories = [
            {"P1": [10000, 10100, 10500]},
            {"P1": [10000, 9900, 9500]}
        ]
        
        rank_data = [
            {"name": "P1", "avg_profit": 0, "win_rate": 35.0}
        ]
        
        pokerbench.save_summary(all_stats, all_histories, rank_data)
        
        summary_path = os.path.join(self.output_dir, "summary.json")
        self.assertTrue(os.path.exists(summary_path))
        
        with open(summary_path, 'r') as f:
            data = json.load(f)
            
        self.assertIn("timestamp", data)
        self.assertEqual(data["total_games"], 2)
        self.assertEqual(len(data["leaderboard"]), 1)
        self.assertEqual(data["leaderboard"][0]["name"], "P1")
        
        # Check aggregated stacks
        # Game 1: [10000, 10100, 10500]
        # Game 2: [10000, 9900, 9500]
        # Avg:    [10000, 10000, 10000]
        self.assertIn("aggregated_stacks", data)
        self.assertIn("P1", data["aggregated_stacks"])
        # Numpy might return numpy floats, json dump handles list conversion in save_summary
        agg_stack = data["aggregated_stacks"]["P1"]
        self.assertEqual(agg_stack, [10000.0, 10000.0, 10000.0])

if __name__ == '__main__':
    unittest.main()
