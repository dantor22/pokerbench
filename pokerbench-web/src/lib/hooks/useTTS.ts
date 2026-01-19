import { useState, useEffect, useRef, useCallback } from 'react';

interface UseTTSOptions {
  enabled: boolean;
  openAIKey?: string;
  elevenLabsKey?: string;
  provider?: 'openai' | 'elevenlabs' | 'native';
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: any) => void;
}

export function useTTS({ enabled, openAIKey, elevenLabsKey, provider, onStart, onEnd, onError }: UseTTSOptions) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [voiceName, setVoiceName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const cancel = useCallback(() => {
    // Cancel Native TTS
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    // Cancel OpenAI/ElevenLabs Audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.oncanplaythrough = null;
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    // Cancel In-Flight Requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Cancel Pending Native TTS
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setIsSpeaking(false);
    setIsActive(false);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis;
      // Ensure we start with a clean state
      synthRef.current.cancel();

      // Chrome loads voices asynchronously
      const loadVoices = () => {
        window.speechSynthesis.getVoices();
      };

      loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }

    return () => {
      cancel();
    };
  }, [cancel]);

  // Stop everything if disabled
  useEffect(() => {
    if (!enabled) {
      cancel();
    }
  }, [enabled, cancel]);

  const speak = useCallback(async (text: string, options?: { voice?: string, elevenLabsVoice?: string, nativeVoice?: string }) => {
    if (!enabled || !text) return;

    cancel();

    // 1. ElevenLabs TTS Strategy
    const useElevenLabs = provider === 'elevenlabs' || (!provider && elevenLabsKey && options?.elevenLabsVoice);
    if (useElevenLabs && elevenLabsKey && options?.elevenLabsVoice) {
      try {
        setIsActive(true);
        setIsLoading(true);

        // Simple ElevenLabs voice ID or default
        const voiceId = options.elevenLabsVoice;
        setVoiceName(`ElevenLabs (${voiceId})`);

        const controller = new AbortController();
        abortControllerRef.current = controller;

        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: "POST",
          headers: {
            "xi-api-key": elevenLabsKey.trim(),
            "Content-Type": "application/json",
            "Accept": "audio/mpeg"
          },
          body: JSON.stringify({
            text: text,
            model_id: "eleven_turbo_v2",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              speed: 1.15
            }
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`ElevenLabs API Error: ${response.statusText}`);
        }

        const blob = await response.blob();
        if (controller.signal.aborted) return;

        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;

        audio.oncanplaythrough = () => {
          if (controller.signal.aborted) {
            audio.pause();
            return;
          }
          setIsLoading(false);
          setIsSpeaking(true);
          onStart?.();
          audio.play();
        };

        audio.onended = () => {
          setIsSpeaking(false);
          setIsActive(false);
          onEnd?.();
          URL.revokeObjectURL(url);
        };

        audio.onerror = (e) => {
          console.error("ElevenLabs Playback Error", e);
          setIsSpeaking(false);
          setIsActive(false);
          setIsLoading(false);
          onError?.(e);
          onEnd?.();
        };

        return; // Success or still working

      } catch (e: any) {
        if (e.name === 'AbortError') {
          // Ignore
        } else {
          console.error("ElevenLabs TTS Failed:", e);
          // Only fallback if not explicitly requested
          if (provider) {
            setIsSpeaking(false);
            setIsActive(false);
            setIsLoading(false);
            onError?.(e);
            onEnd?.();
            return;
          }
        }
      }
    }

    // 2. OpenAI TTS Strategy
    const useOpenAI = provider === 'openai' || (!provider && openAIKey);
    if (useOpenAI && openAIKey) {
      try {
        setIsActive(true); // Pause game immediately
        setIsLoading(true); // Signal buffering (can pause recorder)
        const selectedVoice = options?.voice || "echo";
        setVoiceName(`OpenAI (${selectedVoice})`);

        const controller = new AbortController();
        abortControllerRef.current = controller;

        const response = await fetch("https://api.openai.com/v1/audio/speech", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openAIKey.trim()}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "gpt-4o-mini-tts",
            input: text,
            voice: selectedVoice,
            response_format: "mp3",
            speed: 1.2
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`OpenAI API Error: ${response.statusText}`);
        }

        const blob = await response.blob();
        if (controller.signal.aborted) return;

        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;

        audio.oncanplaythrough = () => {
          // If we were aborted during loading audio, don't play
          if (controller.signal.aborted) {
            audio.pause();
            return;
          }

          setIsLoading(false); // Done buffering
          setIsSpeaking(true); // Start Speaking

          onStart?.();
          audio.play();
        };

        audio.onended = () => {
          setIsSpeaking(false);
          setIsActive(false);
          onEnd?.();
          URL.revokeObjectURL(url);
        };

        audio.onerror = (e) => {
          console.error("Audio Playback Error", e);
          setIsSpeaking(false);
          setIsActive(false);
          setIsLoading(false);
          onError?.(e);
          onEnd?.();
        };

        return;

      } catch (e: any) {
        if (e.name === 'AbortError') {
          // Ignore aborts
        } else {
          console.error("OpenAI TTS Failed:", e);
          if (provider) {
            setIsSpeaking(false);
            setIsActive(false);
            setIsLoading(false);
            onError?.(e);
            onEnd?.();
            return;
          }
        }
      }
    }

    // 3. Native TTS Strategy (Fallback or explicit)
    if (!synthRef.current) return;

    try {
      // Small delay to allow previous cancellations to settle and prevent race conditions
      // where multiple utterances start simultaneously (especially during rapid skipping)
      timeoutRef.current = setTimeout(() => {
        if (!synthRef.current) return;

        // Native is instant, no loading
        setIsSpeaking(true);
        setIsActive(true);

        const utterance = new SpeechSynthesisUtterance(text);
        utteranceRef.current = utterance;

        const voices = synthRef.current.getVoices();

        let preferredVoice = null;
        if (options?.nativeVoice) {
          preferredVoice = voices.find(v => v.name.includes(options.nativeVoice as string));
        }

        if (!preferredVoice) {
          preferredVoice = voices.find(v => v.name.includes('Google US English'));
        }
        if (!preferredVoice) preferredVoice = voices.find(v => v.name.includes('Google') && v.lang.startsWith('en'));
        if (!preferredVoice) preferredVoice = voices.find(v => v.lang === 'en-US');
        if (!preferredVoice) preferredVoice = voices[0];

        if (preferredVoice) {
          utterance.voice = preferredVoice;
          setVoiceName(preferredVoice.name);
        } else {
          setVoiceName("Default System Voice (May not record)");
        }

        utterance.rate = 1.25;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        utterance.onstart = () => {
          onStart?.();
        };

        utterance.onend = () => {
          setIsSpeaking(false);
          setIsActive(false);
          onEnd?.();
        };

        utterance.onerror = (e) => {
          console.error('TTS Error:', e);
          setIsSpeaking(false);
          setIsActive(false);
          if (e.error !== 'canceled' && e.error !== 'interrupted') {
            onEnd?.();
          }
        };

        synthRef.current.speak(utterance);
      }, 50);

    } catch (e) {
      console.error('TTS Exception:', e);
      onError?.(e);
      onEnd?.();
    }
  }, [enabled, openAIKey, elevenLabsKey, provider, cancel, onStart, onEnd, onError]);

  return {
    speak,
    cancel,
    isSpeaking,
    isActive,
    isLoading,
    voiceName
  };
}
