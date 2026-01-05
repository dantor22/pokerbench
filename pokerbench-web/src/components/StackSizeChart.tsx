'use client';

import { useMemo } from 'react';
import { Game } from '../lib/types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface StackSizeChartProps {
  game: Game;
  currentHandIndex: number;
}

const PLAYER_COLORS = [
  '#3b82f6', // blue-500
  '#ef4444', // red-500
  '#22c55e', // green-500
  '#eab308', // yellow-500
  '#a855f7', // purple-500
  '#ec4899', // pink-500
  '#f97316', // orange-500
  '#06b6d4', // cyan-500
];

export default function StackSizeChart({ game, currentHandIndex }: StackSizeChartProps) {
  const data = useMemo(() => {
    if (!game.hands || game.hands.length === 0) return [];

    // Map each hand's pre-hand stacks
    const points = game.hands.map((hand) => ({
      hand: hand.hand_number,
      ...hand.pre_hand_stacks
    }));

    // Add the final state after the last hand
    const lastHand = game.hands[game.hands.length - 1];
    if (lastHand && lastHand.results) {
      const finalStacks: Record<string, number> = { ...lastHand.pre_hand_stacks };
      let hasResults = false;

      lastHand.results.forEach(result => {
        if (finalStacks[result.player] !== undefined) {
          finalStacks[result.player] += result.net_gain;
          hasResults = true;
        }
      });

      if (hasResults) {
        points.push({
          hand: lastHand.hand_number + 1, // Representing "End"
          ...finalStacks
        });
      }
    }

    return points;
  }, [game.hands]);

  // Apply the filter separately to avoid re-calculating the whole array (though it's cheap here)
  const visibleData = useMemo(() => {
    // Current Hand Index 0 -> Hand 1. We want to see Hand 1's starting stack.
    // But a line chart needs 2 points to draw a line. 
    // If we only have 1 point, it just shows a dot (or nothing depending on config).
    // The user probably wants context.

    // If we filter STRICTLY to currentHandIndex, we get:
    // Index 0: Hand 1 Pre-Stack.
    // Index 1: Hand 2 Pre-Stack.

    // If I am on Hand 1, I only see Index 0.
    // If I am on Hand 2, I see Index 0 and 1.

    // This seems correct for "history".

    const maxHandNumber = (game.hands[currentHandIndex]?.hand_number || 0);
    // Only show points up to the start of the current hand.
    // Ideally this means for Hand 1 (Index 0), we only show Point 1 (Start of Hand 1).
    // A single point renders nothing on a line chart, effectively "empty".
    // For Hand 2 (Index 1), we show Point 1 and Point 2 (Start of Hand 2).
    // This draws the line 1->2, effectively showing the history of Hand 1.

    return data.filter(p => p.hand <= maxHandNumber);
  }, [data, currentHandIndex, game.hands]);

  if (!visibleData.length) return null;

  return (
    <div className="card w-full">
      <h3 className="text-sm font-bold mb-4 text-muted uppercase tracking-wider">Stack History</h3>
      <div style={{ width: '100%', height: '240px' }}>
        <ResponsiveContainer>
          <LineChart data={visibleData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
            <XAxis
              dataKey="hand"
              stroke="#94a3b8"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              label={{ value: 'Hand #', position: 'insideBottomRight', offset: -5, fill: '#64748b', fontSize: 10 }}
            />
            <YAxis
              stroke="#94a3b8"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '0.375rem',
                fontSize: '12px'
              }}
              itemStyle={{ padding: 0 }}
            />
            <Legend
              wrapperStyle={{ paddingTop: '10px' }}
              iconType="circle"
              iconSize={8}
            />
            {game.players.map((player, index) => (
              <Line
                key={player}
                type="monotone"
                dataKey={player}
                stroke={PLAYER_COLORS[index % PLAYER_COLORS.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
