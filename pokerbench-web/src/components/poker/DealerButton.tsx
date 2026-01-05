import React from 'react';
import { Text } from '@react-three/drei';

export default function DealerButton({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Button Body */}
      <mesh position={[0, 0.075, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.35, 0.35, 0.15, 32]} />
        <meshStandardMaterial color="white" roughness={0.2} metalness={0.1} />
      </mesh>

      {/* Top Detail */}
      <group position={[0, 0.151, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        {/* Black Ring */}
        <mesh>
          <ringGeometry args={[0.25, 0.30, 32]} />
          <meshStandardMaterial color="black" />
        </mesh>
        
        {/* White Center Override (to cover potential z-fighting if needed, though geometry handles it) */}
        {/* Actually, the cylinder top is white. We just need the black ring and maybe text. */}
        
        <Text
          position={[0, 0, 0.01]}
          fontSize={0.15}
          color="black"
          anchorX="center"
          anchorY="middle"
          rotation={[0, 0, Math.PI]} // Rotate 180 to face player? Or 0? "DEALER" usually readable by player.
          // If rotationY of player group is facing center, then text with rot Z 0 is usually upright relative to camera if camera is above.
          // Let's assume default orientation.
        >
          DEALER
        </Text>
      </group>
    </group>
  );
}
