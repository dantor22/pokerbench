import { useRef } from 'react';
import { useTexture, Text } from '@react-three/drei';
import * as THREE from 'three';

function CurvedText({ text, radius = 6.5, spacing = 0.12, ...props }: { text: string; radius?: number; spacing?: number;[key: string]: any }) {
  const letters = text.split('');
  const totalAngle = (letters.length - 1) * spacing;
  const startAngle = -Math.PI / 2 - totalAngle / 2;

  return (
    <group {...props}>
      {letters.map((char, i) => {
        const angle = startAngle + i * spacing;
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);

        return (
          <Text
            key={i}
            position={[x, y, 0]}
            rotation={[0, 0, angle + Math.PI / 2]}
            fontSize={0.6}
            color="#fbbf24"
            fillOpacity={0.25}
            anchorX="center"
            anchorY="bottom"
          >
            {char}
          </Text>
        );
      })}
    </group>
  );
}

export default function Table() {
  return (
    <group>
      {/* Table Main Body/Substructure */}
      <mesh position={[0, -0.4, 0]} receiveShadow>
        <cylinderGeometry args={[11.2, 11, 0.4, 64]} />
        <meshStandardMaterial color="#1a0f0a" roughness={0.4} />
      </mesh>

      {/* Felt - Central Play Area */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <circleGeometry args={[9, 64]} />
        <meshStandardMaterial
          color="#065f46" // Slightly lighter forest green (Emerald 800)
          roughness={0.9} // Very rough for felt
          metalness={0}
        />
        <CurvedText
          text="pokerbench.adfontes.io"
          radius={7}
          spacing={0.09}
          position={[0, 0, 0.01]}
        />
        <CurvedText
          text="pokerbench.adfontes.io"
          radius={7}
          spacing={0.09}
          position={[0, 0, 0.01]}
          rotation={[0, 0, Math.PI]}
        />
      </mesh>

      {/* Racetrack (The wooden/veneer area where chips often sit) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <ringGeometry args={[9, 11, 64]} />
        <meshStandardMaterial
          color="#2d1a12"
          roughness={0.2}
          metalness={0.1}
        />
      </mesh>

      {/* Inner Trim between Felt and Racetrack */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[8.95, 9.05, 128]} />
        <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Center Logo/Pattern (Subtle) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[3, 3.1, 64]} />
        <meshStandardMaterial color="#fbbf24" transparent opacity={0.2} />
      </mesh>

      {/* Padded Rail (Leather/Vinyl look) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]} castShadow receiveShadow>
        <torusGeometry args={[11.5, 0.8, 20, 100]} />
        <meshStandardMaterial
          color="#1c1917" // Very dark stone/black
          roughness={0.4}
          metalness={0.05}
        />
      </mesh>

      {/* Outer Gold Trim on Rail */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
        <torusGeometry args={[12.35, 0.05, 16, 100]} />
        <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Leg / Pedestal Base (Simple sturdy look) */}
      <mesh position={[0, -2.5, 0]}>
        <cylinderGeometry args={[2, 4, 5, 32]} />
        <meshStandardMaterial color="#1a0f0a" roughness={0.4} />
      </mesh>
    </group>
  );
}
