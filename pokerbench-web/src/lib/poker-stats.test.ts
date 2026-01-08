import { describe, it, expect } from 'vitest';
import { calculateGameStats } from './poker-stats';
import { Game } from './types';

describe('poker-stats', () => {
  const mockGame: Game = {
    game_id: 'test',
    timestamp: 123,
    config: { hands: 1, start_stack: 10000 },
    players: ['Pro', 'Claude'],
    hands: [
      {
        hand_number: 1,
        dealer: 'Pro',
        pre_hand_stacks: { Pro: 10000, Claude: 10000 },
        hole_cards: { Pro: ['Ah', 'Ad'], Claude: ['Ks', 'Kd'] },
        board: ['2h', '3h', '4h'],
        actions: [
          { type: 'street_event', street: 'PRE-FLOP' },
          { type: 'player_action', player: 'Pro', action: 'raise', chips_added: 200 }, // Pro raises (PFR, VPIP)
          { type: 'player_action', player: 'Claude', action: 'call', chips_added: 100 }, // Claude calls (VPIP, 3-bet Opp? No, Pro opened, Claude called face-2-bet)
          { type: 'street_event', street: 'FLOP', cards: ['2h', '3h', '4h'] },
          { type: 'player_action', player: 'Pro', action: 'bet', chips_added: 200 } // Pro C-bets
        ],
        results: []
      }
    ]
  };

  it('should calculate VPIP correctly', () => {
    const stats = calculateGameStats(mockGame);
    expect(stats['Pro'].vpip).toBe(100);
    expect(stats['Claude'].vpip).toBe(100);
  });

  it('should calculate PFR correctly', () => {
    const stats = calculateGameStats(mockGame);
    expect(stats['Pro'].pfr).toBe(100);
    expect(stats['Claude'].pfr).toBe(0);
  });

  it('should calculate 3-bet Opp correctly', () => {
    const stats = calculateGameStats(mockGame);
    // Pro raised, Claude faced it. Claude has 3-bet opp.
    expect(stats['Claude'].threeBetOpp).toBe(1);
    expect(stats['Pro'].threeBetOpp).toBe(0);
  });

  it('should calculate C-bet correctly', () => {
    const stats = calculateGameStats(mockGame);
    expect(stats['Pro'].c_bet).toBe(100);
    expect(stats['Pro'].cBetCount).toBe(1);
    expect(stats['Pro'].cBetOpp).toBe(1);
  });

  it('should handle missing C-bet correctly', () => {
    const missGame: Game = {
      ...mockGame,
      hands: [{
        ...mockGame.hands[0],
        actions: [
          { type: 'street_event', street: 'PRE-FLOP' },
          { type: 'player_action', player: 'Pro', action: 'raise', chips_added: 200 },
          { type: 'player_action', player: 'Claude', action: 'call', chips_added: 100 },
          { type: 'street_event', street: 'FLOP', cards: ['2h', '3h', '4h'] },
          { type: 'player_action', player: 'Pro', action: 'check' } // Pro checks (Missed C-bet)
        ]
      }]
    };
    const stats = calculateGameStats(missGame);
    expect(stats['Pro'].c_bet).toBe(0);
    expect(stats['Pro'].cBetCount).toBe(0);
    expect(stats['Pro'].cBetOpp).toBe(1);
  });

  it('should handle limped pots correctly', () => {
    const limpGame: Game = {
      ...mockGame,
      hands: [{
        ...mockGame.hands[0],
        actions: [
          { type: 'street_event', street: 'PRE-FLOP' },
          { type: 'player_action', player: 'Pro', action: 'call', chips_added: 50 },
          { type: 'player_action', player: 'Claude', action: 'check' }
        ]
      }]
    };
    const stats = calculateGameStats(limpGame);
    expect(stats['Pro'].vpip).toBe(100);
    expect(stats['Pro'].pfr).toBe(0);
    expect(stats['Claude'].vpip).toBe(0); // BB checking is not VPIP
    expect(stats['Claude'].pfr).toBe(0);
  });

  it('should handle 4-bets correctly', () => {
    const multiRaiseGame: Game = {
      ...mockGame,
      hands: [{
        ...mockGame.hands[0],
        actions: [
          { type: 'street_event', street: 'PRE-FLOP' },
          { type: 'player_action', player: 'Pro', action: 'raise', chips_added: 200 }, // 2-bet
          { type: 'player_action', player: 'Claude', action: 'raise', chips_added: 400 }, // 3-bet
          { type: 'player_action', player: 'Pro', action: 'raise', chips_added: 600 }, // 4-bet
          { type: 'player_action', player: 'Claude', action: 'call', chips_added: 400 }
        ]
      }]
    };
    const stats = calculateGameStats(multiRaiseGame);
    expect(stats['Claude'].three_bet).toBe(100);
    expect(stats['Pro'].three_bet).toBe(0); // Pro did 4-bet, but 3rd bet was Claude
    // Currently our logic only counts 3-bet for the 2nd raiser.
  });

  it('should handle hands that end pre-flop', () => {
    const preflopEndGame: Game = {
      ...mockGame,
      hands: [{
        ...mockGame.hands[0],
        actions: [
          { type: 'street_event', street: 'PRE-FLOP' },
          { type: 'player_action', player: 'Pro', action: 'raise', chips_added: 200 },
          { type: 'player_action', player: 'Claude', action: 'fold' }
        ]
      }]
    };
    const stats = calculateGameStats(preflopEndGame);
    expect(stats['Pro'].cBetOpp).toBe(0); // Never reached flop
  });

  it('should respect currentHandIndex and only calculate stats up to that hand', () => {
    const multiHandGame: Game = {
      ...mockGame,
      hands: [
        mockGame.hands[0], // Hand 1: Pro raises, Claude calls, Pro C-bets (VPIP/PFR for Pro, VPIP for Claude)
        {
          hand_number: 2,
          dealer: 'Claude',
          pre_hand_stacks: { Pro: 10000, Claude: 10000 },
          hole_cards: { Pro: ['2h', '7s'], Claude: ['Ah', 'Ad'] },
          board: [],
          actions: [
            { type: 'street_event', street: 'PRE-FLOP' },
            { type: 'player_action', player: 'Claude', action: 'raise', chips_added: 200 },
            { type: 'player_action', player: 'Pro', action: 'fold' }
          ],
          results: []
        }
      ]
    };

    // Only process hand 0 (index 0)
    const statsHand0 = calculateGameStats(multiHandGame, 0);
    expect(statsHand0['Claude'].pfr).toBe(0);
    expect(statsHand0['Claude'].vpipOpp).toBe(1);

    // Process up to hand 1 (index 1)
    const statsHand1 = calculateGameStats(multiHandGame, 1);
    expect(statsHand1['Claude'].pfr).toBe(50); // Raised in hand 2 (index 1)
    expect(statsHand1['Claude'].vpipOpp).toBe(2);
  });
});
