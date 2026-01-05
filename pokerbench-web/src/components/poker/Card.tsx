import { Text } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';

const SUIT_COLORS = {
  h: '#ef4444', // Hearts - Red
  d: '#ef4444', // Diamonds - Red
  c: '#1e293b', // Clubs - Black
  s: '#1e293b', // Spades - Black
};

const SUIT_SYMBOLS = {
  h: '♥',
  d: '♦',
  c: '♣',
  s: '♠',
};

// Create a rounded rectangle shape
const createCardShape = (width: number, height: number, radius: number) => {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;

  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);

  return shape;
};

const cardShape = createCardShape(1.4, 2, 0.1);

const Card = ({ card, position, rotation = [0, 0, 0], renderOnTop = false }: { card: string; position: [number, number, number]; rotation?: [number, number, number]; renderOnTop?: boolean }) => {
  // Parse "Ah", "Td", etc.
  // Code might be "ACE OF HEARTS (Ah)" or just "Ah"
  const shortCode = useMemo(() => {
    if (card.includes('(')) {
      return card.split('(')[1]?.replace(')', '') || card;
    }
    return card;
  }, [card]);

  const rank = shortCode.slice(0, -1);
  const suit = shortCode.slice(-1).toLowerCase() as keyof typeof SUIT_COLORS;

  const color = SUIT_COLORS[suit] || '#000000';
  const symbol = SUIT_SYMBOLS[suit] || '?';

  // If renderOnTop is true, we force these to render later (on top of geometry) 
  // and ignore depth testing against other objects (like the player body).
  // We stagger renderOrder to ensure text renders on top of the card body.
  const baseOrder = renderOnTop ? 100 : 0;
  const depthTest = !renderOnTop;

  // Extrude settings for a very thin card
  const extrudeSettings = useMemo(() => ({
    steps: 1,
    depth: 0.005, // Extremely thin
    bevelEnabled: true,
    bevelThickness: 0.01, // Slight bevel for roundness
    bevelSize: 0.01,
    bevelSegments: 2
  }), []);

  // Actually, standard playing cards don't really have a bevel.
  // Let's use 0 bevel and just pure thin depth.
  const flatExtrudeSettings = useMemo(() => ({
    steps: 1,
    depth: 0.002, // Very thin
    bevelEnabled: false,
  }), []);

  return (
    <group position={position} rotation={rotation}>
      {/* Card Body - Centered by offsetting mesh */}
      <mesh position={[0, 0, -0.001]} renderOrder={baseOrder} castShadow receiveShadow>
        <extrudeGeometry args={[cardShape, flatExtrudeSettings]} />
        <meshStandardMaterial
          color="#ffffff"
          roughness={0.4}
          metalness={0.1}
          depthTest={depthTest}
          depthWrite={depthTest}
          transparent={renderOnTop}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Card Back (Blue Pattern) - Slightly offset behind */}
      <mesh position={[0, 0, -0.004]} rotation={[0, Math.PI, 0]} renderOrder={baseOrder}>
        <planeGeometry args={[1.3, 1.9]} />
        <meshStandardMaterial
          color="#2563eb"
          depthTest={depthTest}
          depthWrite={depthTest}
          transparent={renderOnTop}
        />
      </mesh>
      <mesh position={[0, 0, -0.007]} rotation={[0, Math.PI, 0]} renderOrder={baseOrder}>
        <planeGeometry args={[1.1, 1.7]} />
        <meshStandardMaterial
          color="#1d4ed8"
          depthTest={depthTest}
          depthWrite={depthTest}
          transparent={renderOnTop}
        />
      </mesh>

      <group position={[0, 0, 0.005]}>
        {/* Top Left Rank */}
        <Text
          position={[-0.45, 0.72, 0]}
          fontSize={0.5}
          color={color}
          anchorX="center"
          anchorY="middle"
          renderOrder={baseOrder + 1}
          material-depthTest={depthTest}
          strokeWidth={0.02}
          strokeColor={color}
          fontWeight="bold"
        >
          {rank}
        </Text>

        {/* Bottom Right Rank (Rotated) */}
        <Text
          position={[0.45, -0.72, 0]}
          fontSize={0.5}
          color={color}
          rotation={[0, 0, Math.PI]}
          anchorX="center"
          anchorY="middle"
          renderOrder={baseOrder + 1}
          material-depthTest={depthTest}
          strokeWidth={0.02}
          strokeColor={color}
          fontWeight="bold"
        >
          {rank}
        </Text>

        {/* Center Big Symbol */}
        <Text
          position={[0, 0, 0]}
          fontSize={0.65}
          color={color}
          anchorX="center"
          anchorY="middle"
          renderOrder={baseOrder + 1}
          material-depthTest={depthTest}
        >
          {symbol}
        </Text>
      </group>
    </group>
  );
};

export default Card;
