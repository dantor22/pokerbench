'use client';

import { useMemo } from 'react';
import { Game } from '../lib/types';
import { formatModelName, getModelColor } from '../lib/constants';
import { ChartCustomDot } from './ChartCustomDot';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

interface StackSizeChartProps {
  game: Game;
  currentHandIndex: number;
  runId?: string;
}

const CustomActiveDot = (props: any) => {
  const { cx, cy, fill, index, dataLength } = props;
  if (index === dataLength - 1) return null;
  return <circle cx={cx} cy={cy} r={4} fill={fill} strokeWidth={0} />;
};

export default function StackSizeChart({ game, currentHandIndex, runId }: StackSizeChartProps) {
  const data = useMemo(() => {
    if (!game.hands || game.hands.length === 0) return [];

    // Map each hand's pre-hand stacks
    const points = game.hands.map((hand) => ({
      hand: hand.hand_number - 1,
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
          hand: lastHand.hand_number, // Representing "End"
          ...finalStacks
        });
      }
    }

    return points;
  }, [game.hands]);

  // Apply the filter separately to avoid re-calculating the whole array (though it's cheap here)
  const visibleData = useMemo(() => {
    // Current Hand Index 0 -> Hand 1. We want to see Hand 1's starting stack (Hand 0 in chart).
    // If we only have 1 point, it just shows a dot.
    
    // Index 0 -> Hand 0.
    // Index 1 -> Hand 1.

    // If I am on Hand 1 (index 0), I want to see point 0 (Start of Hand 1).
    // If I am on Hand 2 (index 1), I want to see point 0 and 1 (Start of Hand 1, End of Hand 1/Start of Hand 2).

    return data.filter(p => p.hand <= currentHandIndex + 1);
  }, [data, currentHandIndex, game.hands]);

  if (!visibleData.length) return null;

  return (
    <div className="card w-full">
      <h3 className="text-sm font-bold mb-4 text-muted uppercase tracking-wider">Stack History</h3>
      <div style={{ width: '100%', height: '240px' }} className="select-none">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <LineChart data={visibleData} margin={{ top: 20, right: 45, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
            <XAxis
              dataKey="hand"
              padding={{ right: 20 }}
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
              tickFormatter={(value) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              width={55}
            />
            <ReferenceLine y={10000} stroke="#475569" strokeDasharray="3 3" label={{ value: '$10k', position: 'right', fill: '#64748b', fontSize: 10 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '0.375rem',
                fontSize: '12px'
              }}
              formatter={(value: any, name: any) => [`$${Math.round(Number(value || 0)).toLocaleString()}`, name]}
              itemStyle={{ padding: 2 }}
            />
            <Legend 
              iconType="circle" 
              iconSize={8}
              wrapperStyle={{ 
                paddingTop: '20px', 
                fontSize: '11px',
                lineHeight: '1.2'
              }}
            />
            {game.players.map((player) => (
              <Line
                key={player}
                name={formatModelName(player, runId)}
                type="monotone"
                dataKey={player}
                stroke={getModelColor(player)}
                strokeWidth={2}
                dot={(props: any) => {
                  // Find the last index where this player has a value
                  // We do this inside the render to have access to updated visibleData if needed,
                  // but ideally pre-calc. Since it's light, this is fine.
                  // actually props doesn't have data, we use the closure variable `visibleData`
                  let lastIndex = visibleData.length - 1;
                  for (let i = visibleData.length - 1; i >= 0; i--) {
                    const row = visibleData[i] as any;
                    if (row[player] !== undefined && row[player] !== null) {
                      lastIndex = i;
                      break;
                    }
                  }
                  return <ChartCustomDot {...props} lastPointIndex={lastIndex} modelName={player} />;
                }}
                activeDot={(props) => <CustomActiveDot {...props} dataLength={visibleData.length} fill={getModelColor(player)} />}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
