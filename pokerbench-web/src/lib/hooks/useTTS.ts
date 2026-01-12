import { useState, useEffect, useRef, useCallback } from 'react';

interface UseTTSOptions {
  enabled: boolean;
  openAIKey?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: any) => void;
}

export function useTTS({ enabled, openAIKey, onStart, onEnd, onError }: UseTTSOptions) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [voiceName, setVoiceName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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
  }, []);

  const cancel = useCallback(() => {
    // Cancel Native TTS
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    // Cancel OpenAI Audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    // Cancel In-Flight Requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setIsSpeaking(false);
    setIsActive(false);
    setIsLoading(false);
  }, []);

  const speak = useCallback(async (text: string, options?: { voice?: string, nativeVoice?: string }) => {
    if (!enabled || !text) return;

    cancel();

    // 1. OpenAI TTS Strategy
    if (openAIKey) {
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
            "Authorization": `Bearer ${openAIKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "tts-1",
            input: text,
            voice: selectedVoice,
            response_format: "mp3",
            speed: 1.1
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`OpenAI API Error: ${response.statusText}`);
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;

        audio.oncanplaythrough = () => {
          // If we were aborted during loading audio, don't play
          if (controller.signal.aborted) return;

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

      } catch (e: any) {
        if (e.name === 'AbortError') {
          // Ignore aborts
        } else {
          console.error("OpenAI TTS Failed:", e);
          setIsSpeaking(false);
          setIsActive(false);
          setIsLoading(false);
          onError?.(e);
          onEnd?.();
        }
      }
      return;
    }

    // 2. Native TTS Strategy (Fallback)
    if (!synthRef.current) return;

    try {
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

      utterance.rate = 1.1;
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
    } catch (e) {
      console.error('TTS Exception:', e);
      onError?.(e);
      onEnd?.();
    }
  }, [enabled, openAIKey, cancel, onStart, onEnd, onError]);

  return {
    speak,
    cancel,
    isSpeaking,
    isActive,
    isLoading,
    voiceName
  };
}
