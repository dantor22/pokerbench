import { useMemo } from 'react';
import { Text } from '@react-three/drei';

type ChipDenomination = 1 | 5 | 25 | 100 | 500 | 1000;

const CHIP_COLORS: Record<number, string> = {
  1: '#ffffff',     // White
  5: '#ef4444',     // Red
  25: '#22c55e',    // Green
  100: '#1e293b',   // Black
  500: '#a855f7',   // Purple
  1000: '#f97316',  // Orange
};

const CHIP_THICKNESS = 0.05;
const CHIP_RADIUS = 0.25;

interface ChipProps {
  value: ChipDenomination;
  position: [number, number, number];
  rotation?: [number, number, number];
}

const Chip = ({ value, position, rotation = [0, 0, 0] }: ChipProps) => {
  return (
    <group position={position} rotation={rotation}>
      {/* Main Chip Body */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[CHIP_RADIUS, CHIP_RADIUS, CHIP_THICKNESS, 32]} />
        <meshStandardMaterial
          color={CHIP_COLORS[value]}
          roughness={0.2}
          metalness={0.3}
        />
      </mesh>

      {/* Edge Stripes (Simplified as 8 small boxes around the edge) */}
      {[...Array(8)].map((_, i) => (
        <group key={i} rotation={[0, (i * Math.PI) / 4, 0]}>
          <mesh position={[CHIP_RADIUS, 0, 0]}>
            <boxGeometry args={[0.02, CHIP_THICKNESS * 1.1, 0.08]} />
            <meshStandardMaterial color="white" roughness={0.3} />
          </mesh>
        </group>
      ))}

      {/* Top Decal/Value */}
      <group position={[0, CHIP_THICKNESS / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        {/* Outer White Ring */}
        <mesh>
          <ringGeometry args={[CHIP_RADIUS * 0.6, CHIP_RADIUS * 0.8, 32]} />
          <meshBasicMaterial color="white" />
        </mesh>
        {/* Inner Value Circle */}
        <mesh position={[0, 0, 0.001]}>
          <circleGeometry args={[CHIP_RADIUS * 0.6, 32]} />
          <meshBasicMaterial color="white" />
        </mesh>
        <Text
          position={[0, 0, 0.002]}
          fontSize={0.14}
          color="black"
          anchorX="center"
          anchorY="middle"
        >
          {value}
        </Text>
      </group>
    </group>
  );
};

export default function ChipStack({ amount, position }: { amount: number; position: [number, number, number] }) {
  const chipPiles = useMemo(() => {
    // 1. Calculate counts for each denomination
    const counts = new Map<number, number>();
    let remaining = amount;
    const denoms: ChipDenomination[] = [1000, 500, 100, 25, 5, 1];

    for (const d of denoms) {
      const c = Math.floor(remaining / d);
      if (c > 0) {
        counts.set(d, c);
        remaining = Number((remaining - c * d).toFixed(2));
      }
    }

    // 2. Build piles (max chips per pile)
    const MAX_PER_PILE = 25;
    const allPileContents: ChipDenomination[][] = [];

    for (const d of denoms) {
      let count = counts.get(d) || 0;
      while (count > 0) {
        const take = Math.min(count, MAX_PER_PILE);
        const pile = Array(take).fill(d);
        allPileContents.push(pile);
        count -= take;
      }
    }

    // 3. Layout piles in a grid/cluster
    const piles: { x: number; z: number; chips: { val: ChipDenomination; y: number; rot: number; offset: [number, number, number] }[] }[] = [];

    // Simple packing: Square-ish grid
    const spacing = 0.55;
    const numPiles = allPileContents.length;
    const cols = Math.ceil(Math.sqrt(numPiles));

    allPileContents.forEach((chipsInPile, idx) => {
      const row = Math.floor(idx / cols);
      const col = idx % cols;

      const pileX = (col - (cols - 1) / 2) * spacing;
      const pileZ = (row - (Math.ceil(numPiles / cols) - 1) / 2) * spacing;

      const chips = chipsInPile.map((val, i) => ({
        val,
        y: i * CHIP_THICKNESS + CHIP_THICKNESS / 2,
        rot: Math.random() * Math.PI * 2,
        offset: [(Math.random() - 0.5) * 0.02, 0, (Math.random() - 0.5) * 0.02] as [number, number, number],
      }));

      piles.push({ x: pileX, z: pileZ, chips });
    });

    return piles;
  }, [amount]);

  if (amount <= 0) return null;

  return (
    <group position={position}>
      {chipPiles.map((pile, i) => (
        <group key={i} position={[pile.x, 0, pile.z]}>
          {pile.chips.map((c, j) => (
            <Chip key={j} value={c.val} position={[c.offset[0], c.y, c.offset[2]]} rotation={[0, c.rot, 0]} />
          ))}
        </group>
      ))}
    </group>
  );
}
