'use client';

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

interface ProgressChartProps {
  data: Record<string, number[]>;
}

const COLORS = [
  '#ef4444', // red
  '#3b82f6', // blue
  '#22c55e', // green
  '#eab308', // yellow
  '#a855f7', // purple
  '#ec4899', // pink
  '#f97316', // orange
  '#06b6d4', // cyan
];

export default function AggregatedProgressChart({ data }: ProgressChartProps) {
  // Transform data for Recharts
  // data is { PlayerName: [stack1, stack2, ...], ... }
  // We need [{ hand: 1, PlayerName: stack1, ... }, ...]

  if (!data || Object.keys(data).length === 0) return <div>No data available</div>;

  const players = Object.keys(data);
  const totalHands = data[players[0]]?.length || 0;

  const chartData = Array.from({ length: totalHands }, (_, i) => {
    const entry: Record<string, any> = { hand: i + 1 };
    players.forEach(player => {
      entry[player] = data[player][i];
    });
    return entry;
  });

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4">Aggregated Stack Progression</h2>
      <div style={{ width: '100%', height: 400 }}>
        <ResponsiveContainer>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
            <XAxis
              dataKey="hand"
              stroke="#94a3b8"
              tick={{ fill: '#94a3b8' }}
            />
            <YAxis
              stroke="#94a3b8"
              tick={{ fill: '#94a3b8' }}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#f8fafc'
              }}
            />
            <Legend />
            {players.map((player, index) => (
              <Line
                key={player}
                type="monotone"
                dataKey={player}
                stroke={COLORS[index % COLORS.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
