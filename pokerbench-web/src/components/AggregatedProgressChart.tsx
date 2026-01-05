'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { formatModelName, MODEL_CONFIG, getModelColor } from '../lib/constants';
import { ChartCustomDot } from './ChartCustomDot';

interface ProgressChartProps {
  data: Record<string, number[]>;
}

export default function AggregatedProgressChart({ data }: ProgressChartProps) {
  if (!data || Object.keys(data).length === 0) return <div>No data available</div>;

  const players = Object.keys(data);
  const totalHands = data[players[0]]?.length || 0;

  const chartData = Array.from({ length: totalHands }, (_, i) => {
    const entry: Record<string, any> = { hand: i };
    players.forEach(player => {
      entry[player] = data[player][i];
    });
    return entry;
  });

  return (
    <div className="card bg-slate-900 border-slate-800 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-100">Money balance over time</h2>
        <p className="text-slate-400 text-sm">Average across runs</p>
      </div>
      
      <div style={{ width: '100%', height: 400 }} className="select-none">
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ top: 20, right: 40, left: 10, bottom: 20 }}>
            <CartesianGrid vertical={false} stroke="#334155" strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="hand"
              stroke="#64748b"
              tick={{ fill: '#64748b', fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              label={{ value: 'Hands played', position: 'insideBottom', offset: -10, fill: '#64748b', fontSize: 12 }}
            />
            <YAxis
              stroke="#64748b"
              tick={{ fill: '#64748b', fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `$${value}`}
              padding={{ top: 30, bottom: 30 }}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#f8fafc',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
              formatter={(value: any, name: any) => [`$${Math.round(Number(value || 0)).toLocaleString()}`, name]}
              labelFormatter={(label) => `Hand: ${label}`}
              itemStyle={{ paddingBottom: 4 }}
            />
            <Legend 
              iconType="circle" 
              wrapperStyle={{ paddingTop: '10px' }}
            />
            {players.map((player) => {
              const color = getModelColor(player);
              return (
                <Line
                  key={player}
                  name={formatModelName(player)}
                  type="monotone"
                  dataKey={player}
                  stroke={color}
                  strokeWidth={2}
                  dot={<ChartCustomDot lastPointIndex={totalHands - 1} modelName={player} />}
                  activeDot={{ r: 6, strokeWidth: 0, fill: color }}
                  isAnimationActive={false}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
