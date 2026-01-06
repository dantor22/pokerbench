import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Decal, useTexture } from '@react-three/drei';
import * as THREE from 'three';

interface AvatarProps {
  name: string;
  isActive: boolean;
  isAction: boolean;
  isDealer: boolean;
}

const getLogo = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes('gpt') || n.includes('oai')) return '/logos/openai.svg';
  if (n.includes('grok')) return '/logos/grok.svg';
  if (n.includes('gemini')) return '/logos/gemini_2025.svg';
  if (n.includes('opus') || n.includes('claude')) return '/logos/anthropic.svg';
  return null;
};

// Sub-component for the decal to handle texture loading hooks individually
function LogoDecal({ url, opacity, position, rotation }: { url: string; opacity: number; position: [number, number, number]; rotation: [number, number, number] }) {
  const texture = useTexture(url);
  return (
    <Decal
      position={position}
      rotation={rotation}
      scale={[1.9, 1.9, 1.9]}
      renderOrder={1}
    >
      <meshStandardMaterial
        map={texture}
        transparent
        opacity={opacity}
        polygonOffset
        polygonOffsetFactor={-1}
        roughness={0.8}
        depthTest={true}
        depthWrite={false}
      />
    </Decal>
  );
}

export default function Avatar({ name, isActive, isAction, isDealer }: AvatarProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Subtle breathing animation for active player
  useFrame((state) => {
    if (isAction && groupRef.current) {
      const t = state.clock.getElapsedTime();
      groupRef.current.position.y = Math.sin(t * 2) * 0.05;
    }
  });

  const skinColor = "#050505"; // Black obsidian
  const suitColor = isActive ? (isAction ? "#1d4ed8" : "#334155") : "#0f172a";
  const opacity = isActive ? 1 : 0.4;
  const logo = getLogo(name);

  return (
    <group ref={groupRef}>
      {/* Seat/Chair (Below the avatar) */}
      <group position={[0, -2, 0]}>
        {/* Chair Base */}
        <mesh position={[0, -1, 0]}>
          <cylinderGeometry args={[0.6, 0.6, 0.2, 32]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.5} roughness={0.2} />
        </mesh>
        {/* Chair Stem */}
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 2, 16]} />
          <meshStandardMaterial color="#404040" metalness={0.8} roughness={0.1} />
        </mesh>
        {/* Cushion */}
        <mesh position={[0, 1.1, 0]}>
          <cylinderGeometry args={[0.7, 0.7, 0.4, 32]} />
          <meshStandardMaterial color="#450a0a" roughness={0.8} />
        </mesh>
        {/* Gold Trim on Cushion */}
        <mesh position={[0, 1.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.7, 0.05, 16, 64]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
        </mesh>
      </group>

      {/* Head with Logo Decal Pattern */}
      <mesh position={[0, 1.0, 0]} castShadow>
        <sphereGeometry args={[1.2, 32, 32]} />
        <meshStandardMaterial
          color={skinColor}
          roughness={0.1}
          metalness={0.8}
          transparent
          opacity={opacity}
        />
        {logo && [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((angle, i) => (
          <LogoDecal
            key={i}
            url={logo}
            opacity={opacity}
            position={[-1.2 * Math.sin(angle), 0.15, -1.2 * Math.cos(angle)]}
            rotation={[0, Math.PI + angle, 0]}
          />
        ))}
      </mesh>

      {/* Action Indicator Ring (Halo) */}
      {isAction && (
        <mesh position={[0, 2.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.4, 0.1, 16, 64]} />
          <meshStandardMaterial color="#60a5fa" emissive="#60a5fa" emissiveIntensity={3} />
        </mesh>
      )}


    </group>
  );
}
