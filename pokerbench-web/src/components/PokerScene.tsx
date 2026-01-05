'use client';

import { Html, OrbitControls, Billboard } from '@react-three/drei';
import { useRef, useEffect } from 'react';
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
}

interface PokerSceneProps {
  players: PlayerState[];
  board: string[];
  pot: number;
  dealerIndex: number;
}

const PlayerGroup = ({ data, index, totalPlayers }: { data: PlayerState; index: number; totalPlayers: number }) => {
  // Table radius is ~11. Players sit at ~14.
  const radius = 14;
  const angle = (index / totalPlayers) * Math.PI * 2 + Math.PI / 2;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;

  // Calculate rotation to face center
  const rotationY = -angle + Math.PI / 2;

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
          <group position={[0, 0.08, -6]}>
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
          <group position={[1.0, 0, -4.2]} rotation={[0, -0.2, 0]}>
            <ChipStack amount={data.stack} position={[0, 0, 0]} />
          </group>
        )}

        {/* Dealer Button - Next to stack */}
        {data.isDealer && (
          // Positioned slightly to the right of the stack (x=1.6 vs x=1.0) - moved to 2.2 to avoid clipping
          <DealerButton position={[2.2, 0, -4.2]} />
        )}


        {/* Bets - Further in, on the felt (R<9) */}
        {data.bet > 0 && (
          <group position={[0, 0, -6.0]}>
            <ChipStack amount={data.bet} position={[0, 0, 0]} />
          </group>
        )}
      </group>

      {/* Floating UI (Name, Stack, Action) */}
      <Html position={[0, 4, 0]} center zIndexRange={[100, 0]}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '180px',
          pointerEvents: 'none'
        }}>
          {/* Relative Container for Name/Stack to anchor the absolute Action Badge */}
          <div className="relative flex flex-col items-center">

            {/* Action Badge - Absolute positioned above using inline styles for robustness */}
            {data.isAction && data.currentAction && (
              <div
                className="absolute px-3 py-1 rounded-full font-black text-xs tracking-wider shadow-[0_0_15px_rgba(0,0,0,0.5)] transform animate-in zoom-in duration-300 whitespace-nowrap"
                style={{
                  top: '-30px', /* Lowered by 30px as requested */
                  backgroundColor: data.currentAction === 'fold' ? '#dc2626' : data.currentAction === 'check' ? '#10b981' : '#f59e0b',
                  color: (data.currentAction === 'fold' || data.currentAction === 'check') ? 'white' : 'black',
                  border: '1px solid rgba(255,255,255,0.2)',
                  textTransform: 'uppercase'
                }}
              >
                {data.currentAction}
              </div>
            )}

            {/* Name & Stack Badge (Casino Style - Refined) */}
            <div className={`badge-container ${data.isAction ? 'action' : ''} ${!data.isActive ? 'inactive' : ''}`}>
              {/* Name - Glassmorphic Pill */}
              <div className={`player-name-badge ${data.isAction ? 'action' : ''}`}>
                <span className="inline-block tracking-wide">{data.displayName || data.name}</span>
              </div>

              {/* Stack - Clean Pill */}
              <div className="player-stack-badge">
                ${data.stack.toLocaleString()}
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
    </group>
  );
};

export default function PokerScene({ players, board, pot, dealerIndex, zoomLevel, onZoomChange }: PokerSceneProps & { zoomLevel: number; onZoomChange: (z: number) => void }) {
  // const [isAutoFollowing, setIsAutoFollowing] = useState(true); // Removed tracking
  const controlsRef = useRef<any>(null);
  const ZOOM_CONSTANT = 18.6;

  useEffect(() => {
    // Manually ensure controls are updated to avoid black screen start
    if (controlsRef.current) {
      controlsRef.current.update();
    }
  }, []);

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



  return (
    <>
      <Room />

      {/* Center Table Group */}
      <group position={[0, -2, 0]}>
        <Table />

        {/* Pot */}
        <group position={[0, 0.1, 0]}>
          <ChipStack amount={pot} position={[0, 0, 0]} />
          <Html position={[0, 2, 0]} center>
            <div className="text-yellow-400 font-bold text-xl drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] neon-text">
              POT: ${(pot + players.reduce((sum, p) => sum + p.bet, 0)).toLocaleString()}
            </div>
          </Html>
        </group>

        {/* Board Cards */}
        <group position={[0, 0.2, 3]}>
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
          <PlayerGroup key={player.name} data={player} index={i} totalPlayers={players.length} />
        ))}
      </group>

      <OrbitControls
        ref={controlsRef}
        target={[-0.11, -2.45, 0.76]}
        enablePan={true}
        minPolarAngle={Math.PI / 4.5}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={10}
        maxDistance={40}
        onChange={handleControlsChange}
      />


    </>
  );
}
