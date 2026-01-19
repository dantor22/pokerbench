import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
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

    // Default Worker mock for all tests
    class MockWorker {
      postMessage = vi.fn();
      terminate = vi.fn();
      onmessage = null;
      onerror = null;
    }
    // @ts-ignore
    window.Worker = MockWorker;
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

    // Mock Worker instance capture
    let capturedWorker: any;
    // @ts-ignore
    window.Worker = class MockWorker {
      constructor() {
        capturedWorker = this;
      }
      postMessage = vi.fn();
      terminate = vi.fn();
      onmessage = null;
      onerror = null;
    };

    render(<GameSimulator game={mockGame as any} />);

    // Initially probabilities should be null or empty
    const initialProps = mockPokerSceneProps.mock.calls[0][0];
    expect(initialProps.players[0].winProbability).toBe(null);

    // Advance time to trigger delayed worker creation
    act(() => {
      vi.runAllTimers();
    });

    // Check if worker was instantiated and captured
    expect(capturedWorker).toBeDefined();
    expect(capturedWorker.postMessage).toHaveBeenCalled();

    // Simulate worker response
    act(() => {
      if (capturedWorker.onmessage) {
        capturedWorker.onmessage({ data: { type: 'success', result: [80, 20] } } as MessageEvent);
      }
    });

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

  it('cancels TTS when navigating between hands or steps', async () => {
    const multiHandGame = {
      players: ['Pro', 'Claude'],
      hands: [
        {
          hand_number: 1,
          dealer: 'Pro',
          pre_hand_stacks: { Pro: 10000, Claude: 10000 },
          hole_cards: { Pro: ['Ah', 'Ad'], Claude: ['Ks', 'Kd'] },
          actions: [{ type: 'player_action', player: 'Pro', action: 'bet', chips_added: 100 }],
          results: []
        },
        {
          hand_number: 2,
          dealer: 'Claude',
          pre_hand_stacks: { Pro: 9900, Claude: 10100 },
          hole_cards: { Pro: ['Qh', 'Qd'], Claude: ['Js', 'Jd'] },
          actions: [{ type: 'player_action', player: 'Claude', action: 'bet', chips_added: 100 }],
          results: []
        }
      ]
    };

    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(<GameSimulator game={multiHandGame as any} />);

    const nextHandBtn = screen.getByTitle('Next Hand');
    const prevHandBtn = screen.getByTitle('Previous Hand');
    const nextStepBtn = screen.getByTitle('Next Step');
    const prevStepBtn = screen.getByTitle('Previous Step');

    // Test Next Hand
    await user.click(nextHandBtn);
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
    vi.clearAllMocks();

    // Test Previous Hand
    await user.click(prevHandBtn);
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
    vi.clearAllMocks();

    // Test Next Step (at end of hand)
    await user.click(nextStepBtn); // Step 0 -> 1 (or 0 -> next hand if only 1 action)
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
    vi.clearAllMocks();

    // Test Previous Step (at start of hand)
    // First move to Hand 2
    await user.click(nextHandBtn);
    vi.clearAllMocks();
    await user.click(prevStepBtn);
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
  });

  it('limits shuffling sound to 4 seconds in YouTube mode', async () => {
    vi.useFakeTimers();
    const { fireEvent } = await import('@testing-library/react');

    // Mock HTMLMediaElement properties
    const pauseSpy = vi.spyOn(window.HTMLMediaElement.prototype, 'pause');
    const playSpy = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);

    render(<GameSimulator game={mockGame as any} />);

    // Activate YouTube mode via fireEvent for space/keys if needed, 
    // but easiest is to just find the toggle if it's rendered, 
    // or simulate the cheat code.
    // Let's just simulate the keyboard event for the cheat code.
    act(() => {
      fireEvent.keyDown(window, { key: 'y' });
      fireEvent.keyDown(window, { key: 't' });
      fireEvent.keyDown(window, { key: ' ' });
      fireEvent.keyDown(window, { key: 'm' });
      fireEvent.keyDown(window, { key: 'o' });
      fireEvent.keyDown(window, { key: 'd' });
      fireEvent.keyDown(window, { key: 'e' });
    });

    const toggleBtn = screen.getByTitle('Toggle YouTube Generation Mode');
    act(() => {
      fireEvent.click(toggleBtn);
    });

    // Initial state Hand #1, Step 0 should trigger shuffle
    expect(playSpy).toHaveBeenCalled();

    pauseSpy.mockClear();

    // Advance time by 4 seconds
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(pauseSpy).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('toggles TTS normalization and persists to localStorage', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(<GameSimulator game={mockGame as any} />);

    // Activate YouTube mode
    await user.keyboard('yt mode');
    const toggleModeBtn = screen.getByTitle('Toggle YouTube Generation Mode');
    await user.click(toggleModeBtn);

    // Find the RAW TTS toggle
    const toggle = screen.getByTitle('Disable poker notation transformation for TTS');
    expect(toggle).toBeInTheDocument();
    expect(screen.getByText('RAW TTS')).toBeInTheDocument();

    // Initially should have slate-600 indicator
    const indicator = toggle.querySelector('.rounded-full');
    expect(indicator).toHaveClass('bg-slate-600');

    // Click to disable normalization
    await user.click(toggle);

    // Should now have orange-500 indicator
    expect(indicator).toHaveClass('bg-orange-500');
    expect(localStorage.getItem('disable_tts_normalization')).toBe('true');

    // Click again to enable
    await user.click(toggle);
    expect(indicator).toHaveClass('bg-slate-600');
    expect(localStorage.getItem('disable_tts_normalization')).toBe('false');
  });

  it('renders TTS provider toggle in YouTube mode', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(<GameSimulator game={mockGame as any} />);

    // Activate YouTube mode
    await user.keyboard('yt mode');
    const toggleBtn = screen.getByTitle('Toggle YouTube Generation Mode');
    await user.click(toggleBtn);

    expect(screen.getByText('ELEVENLABS')).toBeInTheDocument();
    expect(screen.getByText('OPENAI')).toBeInTheDocument();
    expect(screen.getByText('NATIVE')).toBeInTheDocument();
  });

  it('updates TTS provider and persists to localStorage', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(<GameSimulator game={mockGame as any} />);

    // Activate YouTube mode
    await user.keyboard('yt mode');
    const toggleBtn = screen.getByTitle('Toggle YouTube Generation Mode');
    await user.click(toggleBtn);

    const openaiBtn = screen.getByText('OPENAI');
    await user.click(openaiBtn);

    expect(localStorage.getItem('tts_provider')).toBe('openai');

    // Check if button is active (has specific class)
    expect(openaiBtn).toHaveClass('bg-blue-600');
  });

  it.skip('plays light_card SFX during board events in YouTube mode', async () => {
    vi.useFakeTimers();
    // Use manual fireEvent for everything to be ultra fast and reliable with fake timers

    // Mock play to track calls
    const playSpy = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);

    const boardEventGame = {
      players: ['Pro', 'Claude'],
      hands: [{
        hand_number: 1,
        dealer: 'Pro',
        pre_hand_stacks: { Pro: 10000, Claude: 10000 },
        hole_cards: { Pro: ['Ah', 'Ad'], Claude: ['Ks', 'Kd'] },
        actions: [
          { type: 'street_event', street: 'PRE-FLOP', cards: [] },
          { type: 'street_event', street: 'FLOP', cards: ['2h', '3h', '4h'] }
        ],
        results: []
      }]
    };

    render(<GameSimulator game={boardEventGame as any} />);

    // Activate YouTube mode via cheat code
    act(() => {
      'yt mode'.split('').forEach(key => {
        fireEvent.keyDown(window, { key });
      });
    });

    // Enable YouTube mode
    const toggleBtn = screen.getByTitle('Toggle YouTube Generation Mode');
    act(() => { fireEvent.click(toggleBtn); });

    // Clear any calls from background music/initialization
    playSpy.mockClear();

    // Move to Flop (Step 1)
    const nextStepBtn = screen.getByTitle('Next Step');
    act(() => {
      fireEvent.click(nextStepBtn);
    });

    // Run timers to trigger the effect
    act(() => {
      vi.runOnlyPendingTimers();
    });

    // Should have triggered play once
    expect(playSpy).toHaveBeenCalled();

    // Advance time for second repeat
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(playSpy).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('handles camera movement state from PokerScene', async () => {
    const { fireEvent } = await import('@testing-library/react');
    render(<GameSimulator game={mockGame as any} />);

    // Get the onCameraMoveChange prop passed to PokerScene
    const lastCall = mockPokerSceneProps.mock.calls[mockPokerSceneProps.mock.calls.length - 1][0];
    expect(lastCall.onCameraMoveChange).toBeDefined();

    // Trigger camera movement
    act(() => {
      lastCall.onCameraMoveChange(true);
    });

    // We can't easily check the internal state isCameraMoving without more complex exposure 
    // or checking the effect's side effects.
    // But we've verified the wiring.
  });
});
