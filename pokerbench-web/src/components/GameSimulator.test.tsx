import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock speechSynthesis - MUST BE BEFORE IMPORTS THAT USE IT
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'speechSynthesis', {
    value: {
      speak: vi.fn(),
      cancel: vi.fn(),
      getVoices: vi.fn(() => []),
      onvoiceschanged: null,
    },
    writable: true,
  });
  // Also mock SpeechSynthesisUtterance if needed
  // @ts-ignore
  window.SpeechSynthesisUtterance = vi.fn();

  // Mock HTMLMediaElement for Audio
  window.HTMLMediaElement.prototype.load = vi.fn();
  window.HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
  window.HTMLMediaElement.prototype.pause = vi.fn();
}

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
  it('advances/retreats between hands when clicking next/previous step', async () => {
    const multiHandGame = {
      players: ['Pro', 'Claude'],
      hands: [
        {
          hand_number: 1,
          dealer: 'Pro',
          pre_hand_stacks: { Pro: 10000, Claude: 10000 },
          hole_cards: { Pro: ['Ah', 'Ad'], Claude: ['Ks', 'Kd'] },
          actions: [
            { type: 'street_event', street: 'PRE-FLOP', cards: [] },
            { type: 'player_action', player: 'Pro', action: 'bet', chips_added: 100 }
          ],
          results: []
        },
        {
          hand_number: 2,
          dealer: 'Claude',
          pre_hand_stacks: { Pro: 9900, Claude: 10100 },
          hole_cards: { Pro: ['Qh', 'Qd'], Claude: ['Js', 'Jd'] },
          actions: [
            { type: 'street_event', street: 'PRE-FLOP', cards: [] },
            { type: 'player_action', player: 'Claude', action: 'bet', chips_added: 100 }
          ],
          results: []
        }
      ]
    };

    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(<GameSimulator game={multiHandGame as any} />);

    expect(screen.getByText('Hand #1')).toBeInTheDocument();
    expect(screen.getByText('0/1')).toBeInTheDocument();

    const nextStepBtn = screen.getByTitle('Next Step');
    const prevStepBtn = screen.getByTitle('Previous Step');

    // Hand #1: Move to end (step 1/1)
    await user.click(nextStepBtn);
    expect(screen.getByText('1/1')).toBeInTheDocument();

    // Click Next Step at end of Hand #1 moves to Hand #2
    await user.click(nextStepBtn);
    expect(screen.getByText('Hand #2')).toBeInTheDocument();
    expect(screen.getByText('0/1')).toBeInTheDocument();

    // Click Previous Step at start of Hand #2 moves back to end of Hand #1
    await user.click(prevStepBtn);
    expect(screen.getByText('Hand #1')).toBeInTheDocument();
    expect(screen.getByText('1/1')).toBeInTheDocument();

    // Click Previous Step again moves to start of Hand #1
    await user.click(prevStepBtn);
    expect(screen.getByText('0/1')).toBeInTheDocument();

    // Verify icons (Next Step should always be FastForward, not SkipForward)
    // The icon component itself won't have the text, but we can check if SkipForward is NOT there when at end
    await user.click(nextStepBtn); // Hand #1, Step 1/1
    // We can check the svg class if needed, but let's just ensure it still renders.
    // The previous implementation used {currentStepIndex < steps.length - 1 ? <FastForward size={14} /> : <SkipForward size={14} />}
    // Now it's always <FastForward size={14} />
  });

  it('toggles play/pause when spacebar is pressed', async () => {
    const multiStepGame = {
      ...mockGame,
      hands: [{
        ...mockGame.hands[0],
        actions: [
          { type: 'player_action', player: 'Pro', action: 'bet', chips_added: 100 },
          { type: 'player_action', player: 'Claude', action: 'call', chips_added: 100 }
        ]
      }]
    };
    const { fireEvent, waitFor } = await import('@testing-library/react');
    render(<GameSimulator game={multiStepGame as any} />);

    // Initially not playing
    expect(screen.getByTitle('Play')).toBeInTheDocument();

    // Simulate spacebar press
    await act(async () => {
      fireEvent.keyDown(window, { key: ' ', code: 'Space', bubbles: true });
    });

    // Now should be playing (shows Pause button)
    await waitFor(() => expect(screen.getByTitle('Pause')).toBeInTheDocument());

    // Press spacebar again
    await act(async () => {
      fireEvent.keyDown(window, { key: ' ', code: 'Space', bubbles: true });
    });

    // Should be paused again
    await waitFor(() => expect(screen.getByTitle('Play')).toBeInTheDocument());
  });

  it('does not toggle play/pause when spacebar is pressed in an input', async () => {
    const { fireEvent } = await import('@testing-library/react');
    render(<GameSimulator game={mockGame as any} />);

    // Create a dummy input to focus on
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    // Simulate spacebar press on input
    await act(async () => {
      fireEvent.keyDown(input, { code: 'Space', bubbles: true });
    });

    // Should still be paused
    expect(screen.getByTitle('Play')).toBeInTheDocument();

    document.body.removeChild(input);
  });

  it('displays ElevenLabs key input in YouTube mode when keys are missing', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(<GameSimulator game={mockGame as any} />);

    // Activate YouTube mode via cheat code
    await user.keyboard('yt mode');

    // Click the toggle button to actually enable YouTube mode
    const toggleBtn = screen.getByTitle('Toggle YouTube Generation Mode');
    await user.click(toggleBtn);

    expect(screen.getByPlaceholderText('ElevenLabs Key (xi-...)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('OpenAI Key (sk-...)')).toBeInTheDocument();
  });

  it('persists ElevenLabs key to localStorage', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(<GameSimulator game={mockGame as any} />);

    // Activate YouTube mode
    await user.keyboard('yt mode');

    // Click the toggle button
    const toggleBtn = screen.getByTitle('Toggle YouTube Generation Mode');
    await user.click(toggleBtn);

    const keyInput = screen.getByPlaceholderText('ElevenLabs Key (xi-...)');
    await user.type(keyInput, 'xi-test-key');

    expect(localStorage.getItem('elevenlabs_tts_key')).toBe('xi-test-key');
  });
});
