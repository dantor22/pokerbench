'use client';

import { Html, OrbitControls, Billboard } from '@react-three/drei';
import { useRef, useEffect, useMemo, memo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import Table from './poker/Table';
import ChipStack from './poker/ChipStack';
import Card from './poker/Card';
import Avatar from './poker/Avatar';
import Room from './poker/Room';
import DealerButton from './poker/DealerButton';


interface PlayerState {
  name: string;
  displayName?: string;
  stack: number;
  bet: number;
  cards: string[]; // e.g., ["Ah", "Kd"]
  isActive: boolean; // Not folded
  isFolded: boolean; // Folded specifically
  isDealer: boolean;
  isAction: boolean; // Currently acting
  currentAction?: string; // e.g. "check", "call", "raise"
  thought?: string;
  netGain?: number; // For end of hand
  winProbability?: number | null;
  isCalculating?: boolean;
}

interface PokerSceneProps {
  players: PlayerState[];
  board: string[];
  pot: number;
  dealerIndex: number;
  isYouTubeMode?: boolean;
}

const PlayerGroup = memo(({ data, index, totalPlayers, tableScale, isYouTubeMode }: { data: PlayerState; index: number; totalPlayers: number; tableScale: number; isYouTubeMode?: boolean }) => {
  const badgeRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const vec = useMemo(() => new THREE.Vector3(), []); // Reusable vector

  // Table radius is ~11. Players sit at ~14.
  const radius = 14 * tableScale;
  const angle = (index / totalPlayers) * Math.PI * 2 + Math.PI / 2;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;

  // Calculate rotation to face center
  const rotationY = -angle + Math.PI / 2;

  // Adaptive scaling logic
  useFrame(() => {
    if (badgeRef.current) {
      badgeRef.current.getWorldPosition(vec);
      const dist = camera.position.distanceTo(vec);
      // Non-linear scale: stays readable far away, doesn't get too huge up close
      // A linear scale (dist/15) keeps it constant size on screen. 
      // We'll use a slightly slower growth so it still feels 3D.
      const scale = Math.max(.5, dist / 15);
      badgeRef.current.scale.set(scale, scale, scale);
    }
  });

  return (
    <group position={[x, 0, z]}>
      {/* Avatar Rotated to face center */}
      <group rotation={[0, rotationY, 0]}>
        <Avatar
          name={data.displayName || data.name}
          isActive={data.isActive}
          isAction={data.isAction}
          isDealer={data.isDealer}
        />



        {/* Active Cards - Face Up, facing camera */}
        {data.isActive && data.cards.length > 0 && (
          <Billboard position={[0, 0.5, 1.8]} follow={true} lockX={false} lockY={false} lockZ={false}>
            <Card card={data.cards[0]} position={[-0.75, 0, 0]} renderOnTop={true} />
            <Card card={data.cards[1]} position={[0.75, 0, 0]} renderOnTop={true} />
          </Billboard>
        )}

        {/* Folded Cards - Face Down on Table (Felt is ~ 0.01 in local space) */}
        {data.isFolded && data.cards.length > 0 && (
          <group position={[0, 0.08, -6 * tableScale]}>
            <Card
              card={data.cards[0]}
              position={[-0.5, 0, 0]}
              rotation={[Math.PI / 2, 0, THREE.MathUtils.degToRad(-15)]}
              renderOnTop={false}
            />
            <Card
              card={data.cards[1]}
              position={[0.5, 0.01, 0]}
              rotation={[Math.PI / 2, 0, THREE.MathUtils.degToRad(15)]}
              renderOnTop={false}
            />
          </group>
        )}

        {/* Player Stack - On table, to the right. Adjusted to avoid rail clipping (Rail starts at R=10.7) */}
        {/* Player R=14, z=-4.2 -> R=9.8. With x=1.0, R_eff ~9.85. Safe from rail. */}
        {data.stack > 0 && (
          <group position={[1.0 * tableScale, 0, -4.2 * tableScale]} rotation={[0, -0.2, 0]}>
            <ChipStack amount={data.stack} position={[0, 0, 0]} />
          </group>
        )}

        {/* Dealer Button - Next to stack */}
        {data.isDealer && (
          // Positioned slightly to the right of the stack (x=1.6 vs x=1.0) - moved to 2.2 to avoid clipping
          <DealerButton position={[2.2 * tableScale, 0, -4.2 * tableScale]} />
        )}


        {/* Bets - Further in, on the felt (R<9) */}
        {data.bet > 0 && (
          <group position={[0, 0, -6.0 * tableScale]}>
            <ChipStack amount={data.bet} position={[0, 0, 0]} />
          </group>
        )}
      </group>

      <Billboard 
        ref={badgeRef}
        position={[0, 5, 0]} 
        follow={true} 
        lockX={false} 
        lockY={false} 
        lockZ={false}
      >
        <Html 
          center 
          transform 
          zIndexRange={[100, 0]}
        >
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '180px',
            pointerEvents: 'none'
          }}>
            {/* Relative Container for Name/Stack to anchor the absolute Action Badge */}
            <div className="relative flex flex-col items-center">

              {/* Action Badge - Absolute positioned above using inline styles for robustness */}
              {data.isAction && data.currentAction && (
                <div 
                  className="absolute left-1/2 -translate-x-1/2 w-max z-10 pointer-events-none"
                  style={{ top: '-34px' }}
                >
                  <div
                    className="action-intent-badge flex items-center gap-1 px-3 py-1 rounded-full font-black text-xs tracking-wider shadow-[0_0_15px_rgba(0,0,0,0.5)] transform animate-in zoom-in duration-300 whitespace-nowrap overflow-hidden"
                    style={{
                      backgroundColor: data.currentAction === 'fold' ? '#dc2626' : data.currentAction === 'check' ? '#10b981' : '#f59e0b',
                      color: (data.currentAction === 'fold' || data.currentAction === 'check') ? 'white' : 'black',
                      border: '1px solid rgba(255,255,255,0.2)',
                      textTransform: 'uppercase'
                    }}
                  >
                    <span>{data.currentAction}</span>
                    {['bet', 'call', 'raise', 'all-in'].includes(data.currentAction.toLowerCase()) && data.bet > 0 && (
                      <span>${data.bet.toLocaleString()}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Name & Stack Badge (Casino Style - Refined) */}
              <div className={`badge-container ${data.isAction ? 'action' : ''} ${!data.isActive ? 'inactive' : ''}`}>
                {/* Name - Glassmorphic Pill */}
                <div className={`player-name-badge ${data.isAction ? 'action' : ''}`}>
                  <span className="inline-block tracking-wide">{data.displayName || data.name}</span>
                </div>

                <div className="badge-row">
                  {/* Stack - Clean Pill */}
                  <div className="player-stack-badge">
                    ${data.stack.toLocaleString()}
                  </div>

                  {/* Win Probability Display */}
                  {data.isCalculating ? (
                    <div className="flex items-center justify-center" style={{ width: '2.2rem', height: '1.25rem' }}>
                      <div className="equity-spinner" />
                    </div>
                  ) : (
                    data.isActive && data.winProbability !== undefined && data.winProbability !== null && (
                      <div className="equity-bubble animate-in zoom-in duration-300">
                        {data.winProbability.toFixed(0)}%
                      </div>
                    )
                  )}
                </div>

                {data.netGain !== undefined && data.netGain !== 0 && (
                  <div className={`player-profit-badge ${data.netGain > 0 ? 'win' : 'loss'}`}>
                    {data.netGain > 0 ? '+$' : '-$'}{Math.abs(data.netGain).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Html>
      </Billboard>
    </group>
  );
}, (prev, next) => {
  // Custom comparison to prevent re-renders of PlayerGroup
  if (prev.index !== next.index) return false;
  if (prev.totalPlayers !== next.totalPlayers) return false;
  if (prev.tableScale !== next.tableScale) return false;
  if (prev.isYouTubeMode !== next.isYouTubeMode) return false;

  // Deep compare data
  const p = prev.data;
  const n = next.data;
  return (
    p.name === n.name &&
    p.displayName === n.displayName &&
    p.stack === n.stack &&
    p.bet === n.bet &&
    p.cards.length === n.cards.length && p.cards[0] === n.cards[0] && p.cards[1] === n.cards[1] &&
    p.isActive === n.isActive &&
    p.isFolded === n.isFolded &&
    p.isDealer === n.isDealer &&
    p.isAction === n.isAction &&
    p.currentAction === n.currentAction &&
    p.netGain === n.netGain &&
    p.winProbability === n.winProbability &&
    p.isCalculating === n.isCalculating
  );
});

export default function PokerScene({ players, board, pot, dealerIndex, zoomLevel, onZoomChange, onSceneReady, isYouTubeMode }: PokerSceneProps & { zoomLevel: number; onZoomChange: (z: number) => void; onSceneReady?: () => void }) {
  const potBadgeRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const ZOOM_CONSTANT = 18.6;

  const tableScale = useMemo(() => {
    if (players.length <= 2) return 0.75;
    if (players.length <= 4) return 0.85;
    if (players.length <= 6) return 0.95;
    return 1.0;
  }, [players.length]);

  // Adaptive scaling for POT
  useFrame(() => {
    if (potBadgeRef.current) {
      const dist = camera.position.distanceTo(potBadgeRef.current.getWorldPosition(new THREE.Vector3()));
      const scale = Math.max(0.8, dist / 15);
      potBadgeRef.current.scale.set(scale, scale, scale);
    }
  });

  useEffect(() => {
    // Manually ensure controls are updated to avoid black screen start
    if (controlsRef.current) {
      controlsRef.current.update();
    }
    // Signal that the scene is mounted and controls are ready
    if (onSceneReady) {
      // Small timeout to allow one frame of rendering
      requestAnimationFrame(() => {
        onSceneReady();
      });
    }
  }, []);

  // YouTube Mode Camera Logic (Active Player POV)
  const OVERHEAD_TARGET = new THREE.Vector3(0, -1.8, 3 * tableScale);
  const desiredCameraPos = useRef(new THREE.Vector3(0, 30, 3 * tableScale));
  const desiredTarget = useRef(OVERHEAD_TARGET.clone());

  // Manual Pan tracking for YouTube Mode
  const panOffset = useRef(new THREE.Vector3(0, 0, 0));
  const isInteracting = useRef(false);
  const lastTarget = useRef(new THREE.Vector3(0, 0, 0));

  // Reset pan offset when entering YT mode or starting a new hand (if desired)
  useEffect(() => {
    if (isYouTubeMode) {
      panOffset.current.set(0, 0, 0);
    }
  }, [isYouTubeMode]);

  useEffect(() => {
    if (!isYouTubeMode) return;

    // Find active player
    const activeIndex = players.findIndex(p => p.isAction);

    if (activeIndex !== -1) {
      const totalPlayers = players.length;
      // Replicate PlayerGroup positioning logic
      const angle = (activeIndex / totalPlayers) * Math.PI * 2 + Math.PI / 2;

      // Camera position: Behind the player
      const camRadius = 26 * tableScale;
      const camHeight = 14 * tableScale;

      const camX = Math.cos(angle) * camRadius;
      const camZ = Math.sin(angle) * camRadius;

      desiredCameraPos.current.set(camX, camHeight, camZ);
      desiredTarget.current.set(0, -2, 0);
    } else {
      // Default YouTube View (Board Overhead)
      // Use a significant Z-offset to force OrbitControls to start the azimuthal rotation
      // earlier in the transition flight, preventing a "late snap" twist.
      // Zoomed in closer (height reduced from 40 to 25)
      desiredCameraPos.current.set(0, 25 * tableScale, 3 * tableScale + 5 * tableScale);
      desiredTarget.current.set(0, -1.8, 3 * tableScale);
    }
  }, [isYouTubeMode, players, tableScale]);

  useFrame((state, delta) => {
    if (isYouTubeMode && controlsRef.current) {
      // Don't fight the user if they are currently panning
      if (isInteracting.current) return;

      // Smoothly interpolate camera position and controls target
      // Lerp factor ~3.0 gives roughly 1s transition
      const step = 3.0 * delta;

      // Apply any manual pan offset to the cinematic positions
      const finalCameraPos = desiredCameraPos.current.clone().add(panOffset.current);
      const finalTarget = desiredTarget.current.clone().add(panOffset.current);

      state.camera.position.lerp(finalCameraPos, step);
      controlsRef.current.target.lerp(finalTarget, step);
      controlsRef.current.update();
    }
  });

  // Sync zoomLevel prop to Camera Distance
  useEffect(() => {
    if (controlsRef.current && zoomLevel) {
      const currentDist = controlsRef.current.getDistance();
      const targetDist = ZOOM_CONSTANT / zoomLevel;
      
      if (Math.abs(currentDist - targetDist) > 0.5) {
        const cam = controlsRef.current.object;
        const target = controlsRef.current.target;
        
        // Calculate new position maintaining direction
        const dir = new THREE.Vector3().subVectors(cam.position, target).normalize();
        cam.position.copy(target).add(dir.multiplyScalar(targetDist));
        controlsRef.current.update();
      }
    }
  }, [zoomLevel]);

  // Handle OrbitControls changes (User Interaction)
  const handleControlsChange = (e: any) => {
    if (isYouTubeMode && isInteracting.current && controlsRef.current) {
      // Calculate delta pan
      const currentTarget = controlsRef.current.target;
      const delta = new THREE.Vector3().subVectors(currentTarget, lastTarget.current);
      panOffset.current.add(delta);
      lastTarget.current.copy(currentTarget);
    }

    if (onZoomChange) {
      const dist = e.target.getDistance();
      // Avoid division by zero, though unlikely with minDistance
      if (dist > 0) {
        const newZoom = ZOOM_CONSTANT / dist;
        // Only update if difference is significant to avoid loop/jitter
        if (Math.abs(newZoom - zoomLevel) > 0.01) {
          onZoomChange(newZoom);
        }
      }
    }
  };

  // Auto-follow logic removed


  // Debug: Log camera state on 'L' key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if not typing in an input
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      if (e.key === 'l' || e.key === 'L') {
        const cam = camera;
        const controls = controlsRef.current;
        console.log('🎥 --- Camera State Log --- 🎥');
        console.log(`Position: [${cam.position.x.toFixed(3)}, ${cam.position.y.toFixed(3)}, ${cam.position.z.toFixed(3)}]`);
        // Rotation in Euler is less useful for OrbitControls usually, but good to have
        console.log(`Rotation: [${cam.rotation.x.toFixed(3)}, ${cam.rotation.y.toFixed(3)}, ${cam.rotation.z.toFixed(3)}]`);

        if (cam instanceof THREE.PerspectiveCamera) {
          console.log(`FOV: ${cam.fov}`);
        }

        if (controls) {
          console.log(`Target (Pan): [${controls.target.x.toFixed(3)}, ${controls.target.y.toFixed(3)}, ${controls.target.z.toFixed(3)}]`);
          console.log(`Distance: ${controls.getDistance().toFixed(3)}`);
          console.log(`Polar Angle: ${controls.getPolarAngle().toFixed(3)} rad`);
          console.log(`Azimuthal Angle: ${controls.getAzimuthalAngle().toFixed(3)} rad`);

          // Reconstruct the controls props to easily copy-paste
          console.log(`\n📋 Copy-Paste Props:\ntarget={[${controls.target.x.toFixed(3)}, ${controls.target.y.toFixed(3)}, ${controls.target.z.toFixed(3)}]}\nposition={[${cam.position.x.toFixed(3)}, ${cam.position.y.toFixed(3)}, ${cam.position.z.toFixed(3)}]}`);
        }
        console.log('----------------------------');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [camera]);
  return (
    <>
      <Room isYouTubeMode={isYouTubeMode} />

      {/* Center Table Group */}
      <group position={[0, -2, 0]}>
        <Table scale={tableScale} />

        <group position={[0, 0.1, 0]}>
          <ChipStack amount={pot} position={[0, 0, 0]} />
          <Billboard 
            ref={potBadgeRef}
            position={[0, 2.5, 0]} 
            follow={true} 
            lockX={false} 
            lockY={false} 
            lockZ={false}
          >
            <Html center transform>
              <div className="text-yellow-400 font-bold text-xl drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] neon-text whitespace-nowrap">
                POT: ${(pot + players.reduce((sum, p) => sum + p.bet, 0)).toLocaleString()}
              </div>
            </Html>
          </Billboard>
        </group>

        {/* Board Cards */}
        <group position={[0, 0.2, 3 * tableScale]}>
          {board.map((card, i) => (
            <Card
              key={i}
              card={card}
              position={[(i - 2) * 1.6, 0, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
            />
          ))}
        </group>

        {/* Players */}
        {players.map((player, i) => (
          <PlayerGroup key={player.name} data={player} index={i} totalPlayers={players.length} tableScale={tableScale} isYouTubeMode={isYouTubeMode} />
        ))}
      </group>

      <OrbitControls
        ref={controlsRef}
        target={isYouTubeMode ? [0, -1.8, 3 * tableScale] : [-0.11, -2.45, 0.76]}
        enablePan={true}
        enableZoom={!isYouTubeMode}
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={10}
        maxDistance={40}
        onChange={handleControlsChange}
        onStart={() => {
          isInteracting.current = true;
          if (controlsRef.current) {
            lastTarget.current.copy(controlsRef.current.target);
          }
        }}
        onEnd={() => {
          isInteracting.current = false;
        }}
      />


    </>
  );
}
