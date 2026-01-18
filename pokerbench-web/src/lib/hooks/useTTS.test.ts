import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useTTS } from './useTTS';

// Mock window.Audio
const mockAudioPlay = vi.fn(() => Promise.resolve());
const mockAudioPause = vi.fn();
const mockAudioEvents: Record<string, Function> = {};

class MockAudio {
  src: string;
  currentTime: number = 0;

  constructor(src: string) {
    this.src = src;
  }

  play() {
    return mockAudioPlay();
  }

  pause() {
    mockAudioPause();
  }

  set oncanplaythrough(cb: Function) {
    mockAudioEvents['canplaythrough'] = cb;
  }

  set onended(cb: Function) {
    mockAudioEvents['ended'] = cb;
  }

  set onerror(cb: Function) {
    mockAudioEvents['error'] = cb;
  }
}

// Mock window.fetch for ElevenLabs/OpenAI
global.fetch = vi.fn();

// Mock window.speechSynthesis for Native TTS
const mockSpeak = vi.fn();
const mockCancel = vi.fn();
const mockGetVoices = vi.fn(() => []);

Object.defineProperty(window, 'speechSynthesis', {
  value: {
    speak: mockSpeak,
    cancel: mockCancel,
    getVoices: mockGetVoices,
    onvoiceschanged: null,
  },
  writable: true,
});

// Mock URL.createObjectURL/revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'blob:url');
global.URL.revokeObjectURL = vi.fn();

// Mock SpeechSynthesisUtterance
class MockSpeechSynthesisUtterance {
  text: string;
  onstart: any;
  onend: any;
  volume: number = 1;
  rate: number = 1;
  pitch: number = 1;
  voice: any = null;

  constructor(text: string) {
    this.text = text;
  }
}
global.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance as any;

describe('useTTS', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore
    window.Audio = MockAudio;
    mockAudioEvents['canplaythrough'] = undefined as any;
    mockAudioEvents['ended'] = undefined as any;
    mockAudioEvents['error'] = undefined as any;
  });

  it('uses ElevenLabs when key is provided', async () => {
    const onStart = vi.fn();
    const onEnd = vi.fn();

    // Mock successful fetch response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(new Blob(['audio'])),
    });

    const { result } = renderHook(() => useTTS({
      enabled: true,
      elevenLabsKey: 'xi-test-key',
      onStart,
      onEnd
    }));

    await act(async () => {
      await result.current.speak('Hello world', { elevenLabsVoice: 'my-voice-id' });
    });

    // Verify ElevenLabs API call
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://api.elevenlabs.io/v1/text-to-speech/my-voice-id'),
      expect.objectContaining({
        headers: expect.objectContaining({ 'xi-api-key': 'xi-test-key' })
      })
    );

    // Simulate audio loading and playing
    act(() => {
      if (mockAudioEvents['canplaythrough']) mockAudioEvents['canplaythrough']();
    });

    expect(result.current.isSpeaking).toBe(true);
    expect(onStart).toHaveBeenCalled();
    expect(mockAudioPlay).toHaveBeenCalled();

    // Simulate audio ending
    act(() => {
      if (mockAudioEvents['ended']) mockAudioEvents['ended']();
    });

    expect(result.current.isSpeaking).toBe(false);
    expect(onEnd).toHaveBeenCalled();
  });

  it('falls back to Native TTS when no keys provided', async () => {
    const onStart = vi.fn();
    const onEnd = vi.fn();

    const { result } = renderHook(() => useTTS({
      enabled: true,
      onStart,
      onEnd
    }));

    act(() => {
      // @ts-ignore
      window.speechSynthesis.getVoices.mockReturnValue([{ name: 'Google US English', lang: 'en-US' }]);
      result.current.speak('Hello native');
    });

    // Wait for async if any (native is synchronous in this hook implementation but good to wait)
    expect(mockSpeak).toHaveBeenCalled();
    const utterance = mockSpeak.mock.calls[0][0];
    expect(utterance.text).toBe('Hello native');

    // Simulate native start/end
    act(() => {
      utterance.onstart();
    });
    expect(result.current.isSpeaking).toBe(true);
    expect(onStart).toHaveBeenCalled();

    act(() => {
      utterance.onend();
    });
    expect(result.current.isSpeaking).toBe(false);
    expect(onEnd).toHaveBeenCalled();
  });

  it('cancels playback when requested', async () => {
    // Setup active playback first
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(new Blob(['audio'])),
    });

    const { result } = renderHook(() => useTTS({ enabled: true, elevenLabsKey: 'key' }));

    await act(async () => {
      await result.current.speak('test', { elevenLabsVoice: 'my-voice-id' });
    });

    // Simulate play start to ensure ref is set and playing
    act(() => {
      if (mockAudioEvents['canplaythrough']) mockAudioEvents['canplaythrough']();
    });

    // Now cancel
    act(() => {
      result.current.cancel();
    });

    expect(mockCancel).toHaveBeenCalled();
    expect(mockAudioPause).toHaveBeenCalled();
  });

  it('automatically cancels playback when disabled via props', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(new Blob(['audio'])),
    });

    const { result, rerender } = renderHook(({ enabled }) => useTTS({ enabled, elevenLabsKey: 'key' }), {
      initialProps: { enabled: true }
    });

    await act(async () => {
      await result.current.speak('test', { elevenLabsVoice: 'my-voice-id' });
    });

    act(() => {
      if (mockAudioEvents['canplaythrough']) mockAudioEvents['canplaythrough']();
    });

    expect(result.current.isSpeaking).toBe(true);

    // Disable the hook
    rerender({ enabled: false });

    expect(mockCancel).toHaveBeenCalled();
    expect(mockAudioPause).toHaveBeenCalled();
    expect(result.current.isSpeaking).toBe(false);
  });
});
