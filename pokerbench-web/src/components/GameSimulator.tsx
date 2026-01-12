'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import ReasoningOverlay from './poker/ReasoningOverlay';
import { Game } from '../lib/types';
import { formatModelName, MODEL_CONFIG } from '../lib/constants';
import { Canvas, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import PokerScene from './PokerScene';
import { Play, Pause, SkipForward, SkipBack, FastForward, Rewind, ZoomIn, ZoomOut, Eye, List, Youtube, Video, StopCircle } from 'lucide-react';
import GameTimeline from './GameTimeline';
import StackSizeChart from './StackSizeChart';
import GameStats from './GameStats';
import { calculateWinProbabilities } from '../lib/poker-engine';
import { useTTS } from '../lib/hooks/useTTS';
import { transformPokerThoughts } from '../lib/poker-tts-utils';

function CameraUpdater({ fov }: { fov: number }) {
  const { camera } = useThree();
  useEffect(() => {
    // @ts-ignore - TS might complain about fov on Camera but PerspectiveCamera has it
    if (camera.type === 'PerspectiveCamera') {
      // @ts-ignore
      camera.fov = fov;
      // @ts-ignore
      camera.zoom = 0.6; // Fixed optical zoom
      camera.updateProjectionMatrix();
    }
  }, [fov, camera]);
  return null;
}

interface GameSimulatorProps {
  game: Game;
  runId?: string;
}

export default function GameSimulator({ game, runId }: GameSimulatorProps) {
  const [currentHandIndex, setCurrentHandIndex] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [fov, setFov] = useState(35);
  const [zoom, setZoom] = useState(0.6);
  const [sceneReady, setSceneReady] = useState(false);
  const [winProbabilities, setWinProbabilities] = useState<(number | null)[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);

  // YouTube Mode State
  const [isYouTubeMode, setIsYouTubeMode] = useState(false);
  const [showYouTubeControls, setShowYouTubeControls] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [openAIKey, setOpenAIKey] = useState('');

  const keyHistory = useRef('');

  // Load key from storage
  useEffect(() => {
    const key = localStorage.getItem('openai_tts_key');
    if (key) setOpenAIKey(key);
  }, []);

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setOpenAIKey(val);
    localStorage.setItem('openai_tts_key', val);
  };

  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const lastSpokenStepRef = useRef<string | null>(null); // Track last spoken "handId-stepIndex"

  const currentHand = game.hands[currentHandIndex];
  const steps = useMemo(() => {
    return currentHand?.actions || [];
  }, [currentHand]);

  // TTS Hook
  const { speak, cancel, isSpeaking, isActive: isTTSActive, isLoading: isTTSLoading, voiceName } = useTTS({
    enabled: isYouTubeMode,
    openAIKey: openAIKey, // Pass key to hook
    onEnd: () => {
      // Resume playback logic handled in tick
    }
  });

  const stateRef = useRef({ currentStepIndex, steps, currentHandIndex, game, isTTSActive, isTTSLoading, isYouTubeMode }); // keep ref in sync

  // Update ref when state changes
  useEffect(() => {
    stateRef.current = { currentStepIndex, steps, currentHandIndex, game, isTTSActive, isTTSLoading, isYouTubeMode };
  }, [currentStepIndex, steps, currentHandIndex, game, isTTSActive, isTTSLoading, isYouTubeMode]);

  // SMART RECORDER PAUSE: Edit out latency!
  useEffect(() => {
    if (!isRecording || !videoRecorderRef.current) return;

    // If TTS is buffering, PAUSE recording to skip the silence
    if (isTTSLoading && videoRecorderRef.current.state === 'recording') {
      videoRecorderRef.current.pause();
    }
    // When buffer finishes, RESUME recording
    else if (!isTTSLoading && videoRecorderRef.current.state === 'paused') {
      videoRecorderRef.current.resume();
    }
  }, [isTTSLoading, isRecording]);

  const useTTSResult = { voiceName }; // Helper for the render block below where I couldn't easily change variable scope logic without bigger diffs

  // Reconstruct state for the current step
  const gameState = useMemo(() => {
    if (!currentHand) {
      return { players: [], board: [], pot: 0, dealerIndex: -1 };
    }

    const players = game.players.map(name => ({
      name,
      displayName: formatModelName(name, runId),
      stack: currentHand.pre_hand_stacks[name] || 0,
      bet: 0,
      cards: currentHand.hole_cards[name] || [],
      isActive: (currentHand.pre_hand_stacks[name] || 0) > 0,
      isFolded: false,
      isDealer: currentHand.dealer === name,
      isAction: false,
      thought: '',
      currentAction: undefined as string | undefined,
      netGain: 0,
      winProbability: null as number | null
    }));

    let pot = 0;
    const board: string[] = [];
    const dealerIndex = game.players.indexOf(currentHand.dealer);

    // Initialize Blinds with Elimination Handling
    const activePlayersCount = players.filter(p => p.stack > 0).length;

    const getNextActive = (startIdx: number) => {
      let current = (startIdx + 1) % players.length;
      for (let i = 0; i < players.length; i++) {
        if (players[current].stack > 0) return current;
        current = (current + 1) % players.length;
      }
      return -1;
    };

    let sbIndex = -1;
    let bbIndex = -1;

    if (activePlayersCount === 2) {
      // Heads Up: Dealer is SB, Opponent is BB
      sbIndex = dealerIndex;
      bbIndex = getNextActive(dealerIndex);
    } else if (activePlayersCount > 2) {
      // Normal: SB left of Dealer, BB left of SB
      sbIndex = getNextActive(dealerIndex);
      if (sbIndex !== -1) {
        bbIndex = getNextActive(sbIndex);
      }
    }

    // Apply blinds (cap at stack size)
    if (sbIndex !== -1 && players[sbIndex]) {
      const sbAmt = Math.min(players[sbIndex].stack, 50);
      players[sbIndex].bet = sbAmt;
      players[sbIndex].stack -= sbAmt;
    }
    if (bbIndex !== -1 && players[bbIndex]) {
      const bbAmt = Math.min(players[bbIndex].stack, 100);
      players[bbIndex].bet = bbAmt;
      players[bbIndex].stack -= bbAmt;
    }

    // Apply actions up to currentStepIndex
    for (let i = 0; i <= currentStepIndex && i < steps.length; i++) {
      const action = steps[i];
      if (action.type === 'street_event') {
        // Collect folded cards when moving to next street
        players.forEach(p => { p.isFolded = false; });

        if (action.cards) {
          board.splice(0, board.length, ...action.cards);
        }
        if (action.street && action.street !== 'PRE-FLOP') {
          // Collect bets
          players.forEach(p => {
            pot += p.bet;
            p.bet = 0;
          });
        }
      } else if (action.type === 'player_action') {
        const pIndex = players.findIndex(p => p.name === action.player);
        if (pIndex !== -1) {
          const p = players[pIndex];
          const amount = action.chips_added || 0;
          p.stack -= amount;
          p.bet += amount;
          p.thought = (i === currentStepIndex) ? (action.thought || '') : '';
          p.isAction = (i === currentStepIndex);
          if (i === currentStepIndex) {
            p.currentAction = action.action;
          }

          if (action.action === 'fold') {
            p.isActive = false;
            p.isFolded = true;
          }
        }
      }
    }

    // Check results at end of hand
    if (currentStepIndex >= steps.length - 1) {
      currentHand.results.forEach(r => {
        const p = players.find(pl => pl.name === r.player);
        if (p) p.netGain = r.net_gain;
      });
    }

    return { players, board, pot, dealerIndex };
  }, [currentHand, currentStepIndex, game.players, steps]);

  // TTS Trigger Effect
  useEffect(() => {
    if (!isYouTubeMode) return;

    const currentHandId = currentHand?.hand_number || currentHandIndex;
    const stepKey = `${currentHandId}-${currentStepIndex}`;

    // Find active thought
    const activePlayer = gameState.players.find(p => p.isAction && p.thought);
    if (activePlayer && activePlayer.thought && lastSpokenStepRef.current !== stepKey) {
      lastSpokenStepRef.current = stepKey;
      const modelConfig = MODEL_CONFIG[activePlayer.name as keyof typeof MODEL_CONFIG] || {};

      const transformedThought = transformPokerThoughts(activePlayer.thought);

      speak(transformedThought, {
        voice: modelConfig.voice,
        nativeVoice: modelConfig.nativeVoice
      });
    }
  }, [currentStepIndex, currentHandIndex, isYouTubeMode, gameState.players, speak]); 

  // Calculate win probabilities lazily to not lag the simulation
  useEffect(() => {
    setWinProbabilities([]);

    const activeWithCards = gameState.players.filter(p => p.isActive && p.cards.length === 2);
    if (activeWithCards.length < 2) {
      setIsCalculating(false);
      return;
    }

    setIsCalculating(true);
    const timer = setTimeout(() => {
      const { players, board } = gameState;
      if (players.length === 0) {
        setIsCalculating(false);
        return;
      }

      const result = calculateWinProbabilities(players, board);
      setWinProbabilities(result);
      setIsCalculating(false);
    }, isPlaying ? 200 : 50);

    return () => clearTimeout(timer);
  }, [gameState.players, gameState.board, isPlaying]);

  // Merge win probabilities into game state for the scene
  const scenePlayers = useMemo(() => {
    return gameState.players.map((p, i) => ({
      ...p,
      winProbability: winProbabilities[i] ?? null,
      isCalculating: isCalculating && p.isActive && p.cards.length === 2
    }));
  }, [gameState.players, winProbabilities, isCalculating]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Cheat Code: "yt mode"
      keyHistory.current = (keyHistory.current + e.key).slice(-20);
      if (keyHistory.current.toLowerCase().endsWith('yt mode')) {
        setShowYouTubeControls(prev => !prev);
        // Clear history to prevent double-triggering if they keep typing
        keyHistory.current = '';
      }

      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault(); // Prevent scrolling
        setIsPlaying(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-play logic


  useEffect(() => {
    if (!isPlaying) return;

    const tick = () => {
      const { currentStepIndex, steps, currentHandIndex, game, isTTSActive, isTTSLoading, isYouTubeMode } = stateRef.current;

      // Pause if TTS is speaking or loading
      if (isYouTubeMode) {
        if (isTTSActive || isTTSLoading) return;

        // If current step has a thought we haven't spoken yet, wait for the effect to trigger speak()
        const activeAction = steps[currentStepIndex];
        const stepKey = `${game.hands[currentHandIndex]?.hand_number || currentHandIndex}-${currentStepIndex}`;
        if (activeAction?.type === 'player_action' && activeAction.thought && lastSpokenStepRef.current !== stepKey) {
          return;
        }
      }

      if (currentStepIndex < steps.length - 1) {
        setCurrentStepIndex(prev => prev + 1);
      } else {
        // If we're at the end of the current hand, move to the next one
        if (currentHandIndex < game.hands.length - 1) {
          setCurrentHandIndex(h => h + 1);
          setCurrentStepIndex(0);
        } else {
          setIsPlaying(false);
        }
      }
    };

    tick();
    const interval = setInterval(tick, 2000 / playbackSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, isTTSActive]); 

  const handleNextHand = () => {
    if (currentHandIndex < game.hands.length - 1) {
      setCurrentHandIndex(prev => prev + 1);
      setCurrentStepIndex(0);
      cancel(); // Stop speaking on manual nav
    }
  };

  const handlePrevHand = () => {
    if (currentHandIndex > 0) {
      setCurrentHandIndex(prev => prev - 1);
      setCurrentStepIndex(0);
      cancel();
    }
  };

  const handleStepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentStepIndex(Number(e.target.value));
    cancel();
  };

  // Recording Logic
  const startRecording = async () => {
    // strict guidance
    const confirmReady = window.confirm(
      "IMPORTANT FOR AUDIO:\n\n1. In the next popup, select the 'This Tab' option (not Window/Screen).\n2. You MUST check the 'Also share tab audio' box.\n\nClick OK to proceed."
    );
    if (!confirmReady) return;

    try {
      // @ts-ignore
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: ['browser'],
          width: { ideal: 3840 },
          height: { ideal: 2160 },
          frameRate: 60
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        },
        selfBrowserSurface: 'include',
        preferCurrentTab: true
      });

      if (displayStream.getAudioTracks().length === 0) {
        alert('NO AUDIO DETECTED!\n\nYou must check "Also share tab audio" in the popup for TTS to work.\n\nPlease reload and try again.');
        displayStream.getTracks().forEach(t => t.stop());
        return;
      }

      // Play a test beep to "wake up" the audio graph and verify capture
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.value = 440; // A4
      gainNode.gain.value = 0.1;
      oscillator.start();
      setTimeout(() => oscillator.stop(), 200);

      // Create a canvas to draw the cropped video
      const canvas = document.createElement('canvas');
      canvas.width = 3840;
      canvas.height = 2160;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Create a hidden video element to play the stream (required to capture it on canvas)
      // We must mute it locally to prevent feedback, but we will capture the audio tracks directly from the stream
      const video = document.createElement('video');
      video.srcObject = displayStream;
      video.muted = true;
      video.play();

      const stream = canvas.captureStream(60); // 60 FPS
      const combinedStream = new MediaStream([
        ...stream.getVideoTracks(),
        ...displayStream.getAudioTracks() // capture the raw system audio
      ]);

      const drawLoop = () => {
        if (video.paused || video.ended) return;

        const container = document.querySelector('.poker-scene-container');
        if (container) {
          const rect = container.getBoundingClientRect();
          const videoWidth = video.videoWidth;
          const videoHeight = video.videoHeight;

          const scaleX = videoWidth / window.innerWidth;
          const scaleY = videoHeight / window.innerHeight;

          ctx.fillStyle = 'black';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          ctx.drawImage(
            video,
            rect.left * scaleX, rect.top * scaleY, rect.width * scaleX, rect.height * scaleY,
            0, 0, canvas.width, canvas.height
          );
        } else {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }

        requestAnimationFrame(drawLoop);
      };

      video.onloadedmetadata = () => {
        drawLoop();
      };

      const recorder = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm;codecs=vp9,opus', // Explicit audio codec
        videoBitsPerSecond: 60000000 // 60Mbps for ultra-high quality 4K
      });
      const chunks: Blob[] = [];

      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `poker-hand-${currentHandIndex + 1}.webm`;
        a.click();

        // Cleanup
        displayStream.getTracks().forEach(t => t.stop());
      };

      recorder.start();
      videoRecorderRef.current = recorder;
      setIsRecording(true);
      // Auto-enter cinematic mode implicitly via isRecording
    } catch (err) {
      console.error("Error starting recording:", err);
      // alert("Failed to start recording. See console for details.");
    }
  };

  const stopRecording = () => {
    if (videoRecorderRef.current) {
      videoRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  if (!currentHand) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400">
        No hand data available.
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 mb-0 select-none ${isYouTubeMode ? 'youtube-mode' : ''}`}>
      <div
        className={`card text-white relative overflow-hidden p-0 bg-black mb-0 poker-scene-container transition-all duration-300 mx-auto ${isYouTubeMode ? 'aspect-video w-full max-w-[3840px] border-4 border-slate-900 shadow-2xl relative' : ''
          }`}
      >
        <div className={`absolute top-4 left-4 z-10 select-none transition-opacity ${isRecording ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}>
          <h2 className="text-2xl font-bold bg-black-50 px-2 rounded">Hand #{currentHand.hand_number}</h2>
          <div className="mt-2 space-y-1">
            {currentHand.results.length > 0 && currentStepIndex >= steps.length - 1 && (
              <div className="bg-green-900-80 p-2 rounded max-w-xs">
                <span className="font-bold text-green-300">Winner:</span> {formatModelName(currentHand.results.find(r => r.winner)?.player || '', runId)}
              </div>
            )}
          </div>
        </div>


        {/* Persistent Loading Overlay - Fades out only when Scene is actually ready */}
        {!sceneReady && (
          <div className="loading-overlay">
            <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                <div className="text-blue-400 font-bold tracking-widest text-sm uppercase animate-pulse">
                  Loading...
                </div>
              </div>
          </div>
        )}

        <Suspense fallback={null}>
          <Canvas
            shadows
            camera={{ position: [-9.43, 12.03, 26.47], fov: fov, zoom: 0.6 }}
            dpr={[1, 3]}
            gl={{ antialias: true, powerPreference: "high-performance" }}
          >
            <CameraUpdater fov={fov} />
            <PokerScene
              players={scenePlayers}
              board={gameState.board}
              pot={gameState.pot}
              dealerIndex={gameState.dealerIndex}
              zoomLevel={zoom}
              onZoomChange={setZoom}
              onSceneReady={() => setSceneReady(true)}
              isYouTubeMode={isYouTubeMode}
            />
          </Canvas>
        </Suspense>

        <ReasoningOverlay
          isVisible={isYouTubeMode}
          thought={gameState.players.find(p => p.thought)?.thought || ''}
          playerName={gameState.players.find(p => p.thought)?.displayName || gameState.players.find(p => p.thought)?.name}
        />
      </div>

      <div className={`layout-split mb-0 transition-all duration-500 ${isRecording ? 'opacity-0 h-0 overflow-hidden m-0' : 'opacity-100'}`}>
        {/* Control Panel (Left) */}
        <div className="control-panel mb-0 h-full flex flex-col gap-4">
          <div className="flex-responsive-tight">
            <div className="flex items-center gap-1">
              <button type="button" onClick={handlePrevHand} className="btn-control" style={{ marginRight: '4px' }} title="Previous Hand"><SkipBack size={14} /></button>
              <button
                type="button"
                onClick={() => {
                  if (currentStepIndex > 0) {
                    setCurrentStepIndex(currentStepIndex - 1);
                    cancel();
                  } else if (currentHandIndex > 0) {
                    const prevHand = game.hands[currentHandIndex - 1];
                    setCurrentHandIndex(currentHandIndex - 1);
                    setCurrentStepIndex(prevHand.actions.length - 1);
                  }
                }}
                className="btn-control"
                title="Previous Step"
              >
                <Rewind size={14} />
              </button>

              <div style={{ margin: '0 4px' }}>
                <button
                  type="button"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="btn-play"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause size={20} className="fill-white" /> : <Play size={20} className="fill-white" style={{ marginLeft: '3px' }} />}
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (currentStepIndex < steps.length - 1) {
                    setCurrentStepIndex(currentStepIndex + 1);
                    cancel();
                  } else {
                    handleNextHand();
                  }
                }}
                className="btn-control"
                title="Next Step"
              >
                <FastForward size={14} />
              </button>
              <button type="button" onClick={handleNextHand} className="btn-control" style={{ marginLeft: '4px' }} title="Next Hand"><SkipForward size={14} /></button>
            </div>

            <div className="flex items-center gap-3" style={{ background: 'rgba(30, 41, 59, 0.3)', padding: '0.375rem', borderRadius: '0.5rem', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <span className="text-xs font-bold text-slate-400 px-2 lg-visible">SPEED</span>
              <div className="flex gap-2">
                {[0.5, 1, 2, 5].map(speed => (
                  <button
                    type="button"
                    key={speed}
                    onClick={() => setPlaybackSpeed(speed)}
                    className={`speed-toggle ${playbackSpeed === speed ? 'active' : ''}`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Unified Control Panel Section */}
          <div className="panel-section flex-responsive-tight">
            {/* Step/Progress Control */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex items-center gap-2 shrink-0">
                <List size={14} className="text-blue-400" />
                <span className="text-xs font-bold text-slate-400">Step</span>
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <input
                  type="range"
                  min={0}
                  max={steps.length - 1}
                  value={currentStepIndex}
                  onChange={handleStepChange}
                  className="range-slider"
                  style={{ height: '4px' }}
                />
                <span className="text-xs font-mono text-slate-300 w-12 text-right shrink-0">{currentStepIndex}/{steps.length - 1}</span>
              </div>
            </div>

            <div className="w-px h-6 bg-white/10 shrink-0 lg-visible" />

            {/* View Controls Group */}
            <div className="flex items-center gap-4 shrink-0 flex-wrap sm:flex-nowrap">
              {/* FOV */}
              <div className="flex items-center gap-2">
                <Eye size={14} className="text-blue-400" />
                <span className="text-xs font-bold text-slate-400 xl-visible">FOV</span>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={fov}
                  onChange={(e) => setFov(Number(e.target.value))}
                  className="range-slider"
                  style={{ width: '60px', height: '4px' }}
                />
              </div>

              {/* Zoom */}
              <div className="flex items-center gap-2">
                <ZoomIn size={14} className="text-blue-400" />
                <span className="text-xs font-bold text-slate-400 xl-visible">Zoom</span>
                <input
                  type="range"
                  min={0.4}
                  max={1.5}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="range-slider"
                  style={{ width: '60px', height: '4px' }}
                />
              </div>

              <div className="w-px h-6 bg-white/10 shrink-0 lg-visible" />

              {/* YouTube Mode Toggle */}
              {(showYouTubeControls || isYouTubeMode) && (
                <button
                  type="button"
                  onClick={() => setIsYouTubeMode(!isYouTubeMode)}
                  className="btn-control transition-all duration-300"
                  style={{
                    backgroundColor: isYouTubeMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(30, 41, 59, 0.5)',
                    color: isYouTubeMode ? '#fff' : '#94a3b8',
                    border: `1px solid ${isYouTubeMode ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
                    boxShadow: isYouTubeMode ? '0 0 15px rgba(239, 68, 68, 0.3)' : 'none',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 16px',
                    width: 'auto',
                    height: 'auto',
                    gap: '10px',
                    whiteSpace: 'nowrap'
                  }}
                  title="Toggle YouTube Generation Mode"
                >
                  <Youtube size={18} color={isYouTubeMode ? '#fff' : '#ef4444'} />
                  <span style={{ fontSize: '0.75rem', fontWeight: '900', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
                    {isYouTubeMode ? 'ON AIR' : 'YOUTUBE MODE'}
                  </span>
                </button>
              )}

              {isYouTubeMode && (
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`btn-control transition-all duration-300 ${isRecording ? 'animate-pulse' : ''}`}
                  style={{
                    background: isRecording
                      ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)'
                      : 'rgba(59, 130, 246, 0.2)',
                    color: '#fff',
                    border: `1px solid ${isRecording ? 'rgba(255, 255, 255, 0.3)' : 'rgba(59, 130, 246, 0.5)'}`,
                    boxShadow: isRecording ? '0 0 25px rgba(239, 68, 68, 0.5)' : 'none',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 16px',
                    width: 'auto',
                    height: 'auto',
                    gap: '10px',
                    whiteSpace: 'nowrap'
                  }}
                  title={isRecording ? "Stop Recording" : "Start Recording"}
                >
                  {isRecording ? <StopCircle size={18} /> : <Video size={18} />}
                  <span style={{ fontSize: '0.75rem', fontWeight: '900', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
                    {isRecording ? "STOP REC" : "REC VIDEO"}
                  </span>
                </button>
              )}

              {isYouTubeMode && !openAIKey && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <input
                        type="password"
                        placeholder="OpenAI Key (sk-...)"
                        value={openAIKey}
                        onChange={handleKeyChange}
                        style={{
                          background: 'rgba(0, 0, 0, 0.5)',
                          border: '1px solid rgba(51, 65, 85, 1)',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          fontSize: '10px',
                          color: 'white',
                          width: '120px',
                          transition: 'width 0.2s'
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Thoughts Panel (Right) - Hidden in YT Mode since we use Bubbles */}
        {!isYouTubeMode && (
          <div className="card border-l-4 border-blue-500 mb-0 flex flex-col overflow-hidden h-full" style={{ minHeight: '160px' }}>
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10 shrink-0">
              {gameState.players.find(p => p.thought)?.thought ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <span className="font-bold text-blue-400">
                    {gameState.players.find(p => p.thought)?.displayName || gameState.players.find(p => p.thought)?.name}
                  </span>
                  <span className="text-xs text-slate-500 uppercase tracking-wider font-mono">
                    {'// REASONING TRACE'}
                  </span>
                </>
              ) : (
                <span className="text-xs text-slate-600 uppercase tracking-wider font-mono">{'// WAITING FOR ACTION'}</span>
              )}
            </div>
            <div className="text-slate-300 text-sm leading-relaxed font-mono whitespace-pre-wrap flex-1 overflow-y-auto pr-2 custom-scrollbar select-text">
              {gameState.players.find(p => p.thought)?.thought || <span className="text-slate-700 italic">No active thoughts...</span>}
            </div>
          </div>
        )}
      </div>

      <div className={`transition-all duration-500 ${isRecording ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>
        <GameTimeline
          hands={game.hands}
          currentHandIndex={currentHandIndex}
          onHandSelect={(index) => {
            setCurrentHandIndex(index);
            setCurrentStepIndex(0);
            setIsPlaying(false);
            cancel();
          }}
        />
        <StackSizeChart game={game} currentHandIndex={currentHandIndex} runId={runId} />
        <GameStats game={game} currentHandIndex={currentHandIndex} runId={runId} />
      </div>
    </div>
  );
}
