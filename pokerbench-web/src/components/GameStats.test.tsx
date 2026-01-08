import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import GameStats from './GameStats';
import { Game } from '../lib/types';

describe('GameStats', () => {
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
          { type: 'player_action', player: 'Pro', action: 'raise', chips_added: 200 },
          { type: 'player_action', player: 'Claude', action: 'call', chips_added: 100 },
          { type: 'street_event', street: 'FLOP', cards: ['2h', '3h', '4h'] },
          { type: 'player_action', player: 'Pro', action: 'bet', chips_added: 200 }
        ],
        results: []
      }
    ]
  };

  it('renders game statistics table', () => {
    render(<GameStats game={mockGame} />);
    expect(screen.getByText('Game Statistics')).toBeInTheDocument();
    expect(screen.getByText('VPIP')).toBeInTheDocument();
    expect(screen.getByText('PFR')).toBeInTheDocument();
    expect(screen.getByText('3B%')).toBeInTheDocument();
    expect(screen.getByText('CB%')).toBeInTheDocument();
  });

  it('displays calculated stats for players', () => {
    render(<GameStats game={mockGame} />);
    // Pro: VPIP 100, PFR 100, 3B 0, CB 100
    // Claude: VPIP 100, PFR 0, 3B 0, CB 0

    expect(screen.getAllByText('100.0%').length).toBeGreaterThan(0);

    expect(screen.getByText('Gemini 3 Pro')).toBeInTheDocument();
    expect(screen.getByText('Opus 4.5')).toBeInTheDocument();
  });
});
