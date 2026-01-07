import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GameSimulator from './GameSimulator';

// Mock Canvas and PokerScene
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: any) => <div data-testid="canvas">{children}</div>,
  useThree: () => ({ camera: { type: 'PerspectiveCamera', updateProjectionMatrix: vi.fn() } }),
}));

vi.mock('./PokerScene', () => ({
  default: () => <div data-testid="poker-scene" />
}));

describe('GameSimulator', () => {
  const mockGame = {
    players: ['Pro', 'Claude'],
    hands: [
      {
        hand_number: 1,
        dealer: 'Pro',
        pre_hand_stacks: { Pro: 10000, Claude: 10000 },
        hole_cards: { Pro: ['Ah', 'Ad'], Claude: ['Ks', 'Kd'] },
        actions: [
          { type: 'player_action', player: 'Pro', action: 'bet', chips_added: 100, thought: 'Thinking...' }
        ],
        results: [{ player: 'Pro', winner: true, net_gain: 100 }]
      }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders hand number and dealer info', () => {
    render(<GameSimulator game={mockGame as any} />);
    expect(screen.getByText('Hand #1')).toBeInTheDocument();
    expect(screen.getByText('Gemini 3 Pro Button')).toBeInTheDocument();
  });

  it('renders playback controls', () => {
    render(<GameSimulator game={mockGame as any} />);
    expect(screen.getByTitle('Play')).toBeInTheDocument();
    expect(screen.getByTitle('Previous Hand')).toBeInTheDocument();
    expect(screen.getByTitle('Next Hand')).toBeInTheDocument();
  });

  it('renders the 3D scene container', () => {
    render(<GameSimulator game={mockGame as any} />);
    expect(screen.getByTestId('canvas')).toBeInTheDocument();
  });
});
