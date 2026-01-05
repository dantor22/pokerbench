import { Environment, MeshReflectorMaterial, Instance, Instances, Float } from '@react-three/drei';
import * as THREE from 'three';
import { useMemo } from 'react';

// --- Procedural Textures ---

function generateCarpetTexture() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Background - Royal Blue
  ctx.fillStyle = '#0f172a'; // Slate 900 / Navy
  ctx.fillRect(0, 0, 512, 512);

  // Pattern - Gold Fleur-de-lis ish shapes
  ctx.fillStyle = '#b45309'; // Amber 700
  ctx.globalAlpha = 0.3;

  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const cx = i * 64 + 32;
      const cy = j * 64 + 32;

      ctx.beginPath();
      ctx.arc(cx, cy, 20, 0, Math.PI * 2);
      ctx.fill();

      // Detail
      ctx.fillStyle = '#fbbf24'; // Amber 400
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#b45309';
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(200, 200);
  return texture;
}

// --- Components ---

const Pillar = ({ position }: { position: [number, number, number] }) => (
  <group position={position}>
    {/* Base */}
    <mesh position={[0, -4.8, 0]} castShadow receiveShadow>
      <boxGeometry args={[1.8, 0.4, 1.8]} />
      <meshStandardMaterial color="#2d1a12" roughness={0.4} />
    </mesh>
    <mesh position={[0, -4.5, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.7, 0.8, 0.4, 32]} />
      <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.2} />
    </mesh>

    {/* Column Body - Marble-ish */}
    <mesh position={[0, 0, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.6, 0.6, 9.9, 32]} />
      <meshStandardMaterial
        color="#fef3c7"
        roughness={0.1}
        metalness={0.1}
      />
    </mesh>

    {/* Capital */}
    <mesh position={[0, 4.5, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[0.8, 0.7, 0.4, 32]} />
      <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.2} />
    </mesh>
    <mesh position={[0, 4.8, 0]} castShadow receiveShadow>
      <boxGeometry args={[1.6, 0.4, 1.6]} />
      <meshStandardMaterial color="#2d1a12" roughness={0.4} />
    </mesh>
  </group>
);

const SlotMachine = ({ position, rotation = [0, 0, 0] }: { position: [number, number, number], rotation?: [number, number, number] }) => {
  const screenColor = useMemo(() => {
    const hues = ['#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#eab308'];
    return hues[Math.floor(Math.random() * hues.length)];
  }, []);

  return (
    <group position={position} rotation={new THREE.Euler(...rotation)}>
      {/* Cabinet Body */}
      <mesh position={[0, 1, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 2, 1]} />
        <meshStandardMaterial color="#1e293b" roughness={0.3} metalness={0.6} />
      </mesh>

      {/* Top Box / Sign */}
      <mesh position={[0, 2.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.6, 0.8]} />
        <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, 2.3, 0.41]}>
        <planeGeometry args={[1, 0.4]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
      </mesh>

      {/* Screen (Emissive) */}
      <mesh position={[0, 1.2, 0.51]}>
        <planeGeometry args={[0.9, 0.8]} />
        <meshStandardMaterial
          color={screenColor}
          emissive={screenColor}
          emissiveIntensity={2}
          toneMapped={false}
        />
      </mesh>

      {/* Button Panel */}
      <mesh position={[0, 0.3, 0.6]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[1.2, 0.4, 0.4]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
    </group>
  );
};

const Chandelier = ({ position }: { position: [number, number, number] }) => (
  <group position={position}>
    <Float speed={1} rotationIntensity={0.1} floatIntensity={0.1}>
      {/* Main Ring */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2, 0.1, 16, 100]} />
        <meshStandardMaterial color="#fbbf24" metalness={1} roughness={0} />
      </mesh>

      {/* Light Sources (Bulbs) */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const x = Math.cos(angle) * 2;
        const z = Math.sin(angle) * 2;
        return (
          <mesh key={i} position={[x, 0.2, z]}>
            <sphereGeometry args={[0.15, 16, 16]} />
            <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={2} />
          </mesh>
        );
      })}

      {/* Single Central Glow for Performance */}
      <pointLight
        position={[0, -1, 0]}
        color="#fff7ed"
        intensity={2}
        distance={15}
        decay={2}
      />

      {/* Center Crystal */}
      <mesh position={[0, -0.5, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.5, 1.5, 32]} />
        <meshPhysicalMaterial
          color="#ffffff"
          transmission={0.9}
          thickness={1}
          roughness={0}
          ior={1.5}
        />
      </mesh>
    </Float>
  </group >
);

const WallSegment = ({ position, rotation = [0, 0, 0], width = 10, height = 12 }: any) => (
  <group position={position} rotation={new THREE.Euler(...rotation)}>
    {/* Baseboard / Wainscoting */}
    <mesh position={[0, -height / 2 + 2, 0]} receiveShadow>
      <boxGeometry args={[width, 4, 0.5]} />
      <meshStandardMaterial color="#451a03" roughness={0.3} />
    </mesh>
    {/* Top Moldings */}
    <mesh position={[0, -height / 2 + 4.1, 0.2]} receiveShadow>
      <boxGeometry args={[width, 0.2, 0.2]} />
      <meshStandardMaterial color="#fbbf24" metalness={0.5} roughness={0.3} />
    </mesh>
    {/* Wallpaper Part */}
    <mesh position={[0, 0.5, 0]} receiveShadow>
      <boxGeometry args={[width, height - 5, 0.2]} />
      <meshStandardMaterial color="#78350f" roughness={0.9} />
    </mesh>
    {/* Cornice */}
    <mesh position={[0, height / 2 - 0.5, 0.3]} receiveShadow>
      <boxGeometry args={[width, 1, 0.5]} />
      <meshStandardMaterial color="#451a03" roughness={0.3} />
    </mesh>
  </group>
)

export default function Room() {
  const carpetTexture = useMemo(() => generateCarpetTexture(), []);

  const slotRows = useMemo(() => {
    const slots = [];
    const radius = 34;
    const count = 50;

    // Create a large arc from right to left, wrapping around the back
    // 0 is Right (+X), -PI/2 is Back (-Z), -PI is Left (-X)
    const startAngle = 0.8; // Front-Right
    const endAngle = -Math.PI - 0.8; // Front-Left

    const totalAngle = startAngle - endAngle;

    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const theta = startAngle - t * totalAngle;
      const x = radius * Math.cos(theta);
      const z = radius * Math.sin(theta);

      // Rotation to face center
      // Formula derived: at -PI/2 (back) we want rotY=0 (face +Z)
      // rotY = -theta - PI/2

      slots.push({
        pos: [x, -4, z],
        rot: [0, -theta - Math.PI / 2, 0]
      });
    }
    return slots;
  }, []);

  return (
    <>
      <Environment preset="city" />

      <color attach="background" args={['#0f172a']} />
      <fog attach="fog" args={['#0f172a', 50, 110]} />

      {/* --- LIGHTING --- */}
      <ambientLight intensity={0.4} />
      {/* Table Spotlight */}
      <spotLight
        position={[0, 25, 0]}
        angle={0.6}
        penumbra={0.4}
        intensity={6} // Increased intensity
        castShadow
        shadow-bias={-0.0001}
        color="#fff7ed"
      />

      {/* Warm Ambience fill */}
      <pointLight position={[-10, 10, -10]} intensity={2} color="#f59e0b" distance={40} />
      <pointLight position={[10, 10, 10]} intensity={2} color="#f59e0b" distance={40} />

      {/* --- ARCHITECTURE --- */}

      {/* Floor with Carpet */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -5, 0]} receiveShadow>
        <planeGeometry args={[1000, 1000]} />
        {carpetTexture ? (
          <meshStandardMaterial
            map={carpetTexture}
            roughness={0.8}
            color="#ffffff"
          />
        ) : (
          <MeshReflectorMaterial
            blur={[300, 100]}
            resolution={512}
            mixBlur={1}
            mixStrength={10}
            roughness={1}
            depthScale={1.2}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.4}
            color="#1e1b4b"
            metalness={0}
            mirror={0}
          />
        )}
      </mesh>

      {/* Pillars Layout */}
      {/* Distant Pillars for depth */}
      <Pillar position={[-25, 0, -15]} />
      <Pillar position={[-25, 0, 15]} />
      <Pillar position={[25, 0, -15]} />
      <Pillar position={[25, 0, 15]} />

      {/* Walls */}
      {/* Front Wall */}
      {/* <WallSegment position={[0, 0, 50]} width={80} height={30} /> */}
      {/* Back Wall */}
      {/* <WallSegment position={[0, 0, -50]} width={80} height={30} /> */}
      {/* Left Wall */}
      {/* <WallSegment position={[-40, 0, 0]} rotation={[0, Math.PI / 2, 0]} width={100} height={30} /> */}
      {/* Right Wall */}
      {/* <WallSegment position={[40, 0, 0]} rotation={[0, -Math.PI / 2, 0]} width={100} height={30} /> */}



      {/* --- DECOR --- */}

      {/* Chandeliers */}
      <Chandelier position={[0, 6, 0]} />

      {/* Slot Machines */}
      {/* {slotRows.map((slot, i) => (
        // @ts-ignore
        <SlotMachine key={i} position={slot.pos} rotation={slot.rot} />
      ))} */}

    </>
  );
}
