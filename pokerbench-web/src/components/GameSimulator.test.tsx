import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GameSimulator from './GameSimulator';

// Mock Canvas and PokerScene
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: any) => <div data-testid="canvas">{children}</div>,
  useThree: () => ({ camera: { type: 'PerspectiveCamera', updateProjectionMatrix: vi.fn() } }),
}));

const mockCalculate = vi.fn();
vi.mock('../lib/poker-engine', () => ({
  calculateWinProbabilities: (...args: any[]) => mockCalculate(...args),
  normalizeCard: (c: string) => c
}));

const mockPokerSceneProps = vi.fn();
vi.mock('./PokerScene', () => ({
  default: (props: any) => {
    mockPokerSceneProps(props);
    return <div data-testid="poker-scene" />;
  }
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

  it('calculates win probabilities lazily', async () => {
    vi.useFakeTimers();
    mockCalculate.mockReturnValue([80, 20]);

    render(<GameSimulator game={mockGame as any} />);

    // Initially probabilities should be null or empty
    const initialProps = mockPokerSceneProps.mock.calls[0][0];
    expect(initialProps.players[0].winProbability).toBe(null);

    // Advance time to trigger lazy calculation
    act(() => {
      vi.runAllTimers();
    });

    // Check if calculate was called
    expect(mockCalculate).toHaveBeenCalled();

    // Check props
    const lastProps = mockPokerSceneProps.mock.calls[mockPokerSceneProps.mock.calls.length - 1][0];
    expect(lastProps.players[0].winProbability).toBe(80);
    expect(lastProps.players[1].winProbability).toBe(20);

    vi.useRealTimers();
  });

  it('shows calculating state while pending', async () => {
    vi.useFakeTimers();
    render(<GameSimulator game={mockGame as any} />);

    // After render but before timer, should be calculating
    const props = mockPokerSceneProps.mock.calls[mockPokerSceneProps.mock.calls.length - 1][0];
    expect(props.players[0].isCalculating).toBe(true);

    vi.useRealTimers();
  });
});
