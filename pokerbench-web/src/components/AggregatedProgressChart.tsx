import { useState } from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { formatModelName, getModelColor } from '../lib/constants';
import { ChartCustomDot } from './ChartCustomDot';

interface ProgressChartProps {
  data: Record<string, number[]>;
  enrichedData?: Record<string, { mean: number[], low: number[], high: number[], individual?: number[][] }>;
  showStats?: boolean;
  onToggleStats?: (show: boolean) => void;
}

const CustomActiveDot = (props: any) => {
  const { cx, cy, fill, index, dataLength } = props;
  if (index === dataLength - 1) return null;
  return <circle cx={cx} cy={cy} r={6} fill={fill} strokeWidth={0} />;
};

export default function AggregatedProgressChart({ 
  data, 
  enrichedData, 
  showStats = false, 
  onToggleStats
}: ProgressChartProps) {
  if (!data || Object.keys(data).length === 0) return <div>No data available</div>;

  const players = Object.keys(data);
  const totalHands = data[players[0]]?.length || 0;
  
  // Can we show stats?
  const canShowStats = !!enrichedData && Object.keys(enrichedData).length > 0;
  const actuallyShowStats = canShowStats && showStats;

  const chartData = Array.from({ length: totalHands }, (_, i) => {
    const entry: Record<string, any> = { hand: i };
    players.forEach(player => {
      if (enrichedData && enrichedData[player]) {
        entry[`${player}_mean`] = enrichedData[player].mean[i];
        
        // Only add range if stats are being shown to avoid expanding Y-axis unnecessarily
        if (actuallyShowStats) {
          entry[`${player}_range`] = [enrichedData[player].low[i], enrichedData[player].high[i]];
        }
        
        // Add individual trajectories if requested
        if (actuallyShowStats && enrichedData[player].individual) {
          enrichedData[player].individual!.forEach((traj, trajIdx) => {
            entry[`${player}_traj_${trajIdx}`] = traj[i] ?? traj[traj.length - 1];
          });
        }
      } else {
        entry[player] = data[player][i];
      }
    });
    return entry;
  });

  return (
    <div className="card bg-slate-900 border-slate-800 pb-2 relative">
      <div className="flex-responsive">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Stack size over time</h2>
          <p className="text-slate-400 text-sm">
            Average across aggregated runs 
          </p>
        </div>
        <div className="flex items-center gap-4 self-start md-self-auto">
          {canShowStats && onToggleStats && (
            <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700/50 hover:bg-slate-800 transition-colors">
              <input 
                type="checkbox" 
                id="nerd-stats" 
                className="accent-blue-500 w-4 h-4 cursor-pointer"
                checked={showStats}
                onChange={(e) => onToggleStats(e.target.checked)}
              />
              <label htmlFor="nerd-stats" className="text-xs font-medium text-slate-300 cursor-pointer select-none">
                Stats for nerds
              </label>
            </div>
          )}
        </div>
      </div>
      
      <div style={{ width: '100%', height: 400 }} className="select-none">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <ComposedChart data={chartData} margin={{ top: 20, right: 45, left: 0, bottom: 30 }}>
            <CartesianGrid vertical={false} stroke="#334155" strokeDasharray="3 3" opacity={0.2} />
            <XAxis
              dataKey="hand"
              padding={{ right: 20 }}
              stroke="#64748b"
              tick={{ fill: '#64748b', fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              label={{ value: 'Hands played', position: 'insideBottom', offset: -5, fill: '#64748b', fontSize: 12 }}
            />
            <YAxis
              stroke="#64748b"
              tick={{ fill: '#64748b', fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              padding={{ top: 10, bottom: 10 }}
              domain={['dataMin', 'dataMax']}
              width={55}
            />
            <ReferenceLine y={10000} stroke="#475569" strokeDasharray="3 3" label={{ value: '$10k', position: 'right', fill: '#64748b', fontSize: 10 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#f8fafc',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
              formatter={(value: any, name: any) => {
                if (typeof name === 'string' && (name.endsWith('_range') || name.includes('_traj_'))) return null;
                return [`$${Math.round(Number(value || 0)).toLocaleString()}`, name];
              }}
              labelFormatter={(label) => `Hand: ${label}`}
              itemStyle={{ paddingBottom: 4 }}
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
            
            {players.map((player) => {
              const color = getModelColor(player);
              const dataKey = (canShowStats) ? `${player}_mean` : player;
              
              return (
                <g key={player}>
                  {actuallyShowStats && (
                    <Area
                      type="monotone"
                      dataKey={`${player}_range`}
                      stroke="none"
                      fill={color}
                      fillOpacity={0.25}
                      connectNulls
                      isAnimationActive={false}
                      legendType="none"
                      name={`${player}_range`}
                      dot={false}
                      activeDot={false}
                    />
                  )}
                  {actuallyShowStats && enrichedData?.[player]?.individual?.map((_, idx) => (
                    <Line
                      key={`${player}_traj_${idx}`}
                      name={`${player}_traj_${idx}`}
                      type="monotone"
                      dataKey={`${player}_traj_${idx}`}
                      stroke={color}
                      strokeWidth={1}
                      strokeOpacity={0.15}
                      dot={false}
                      activeDot={false}
                      isAnimationActive={false}
                      legendType="none"
                    />
                  ))}
                  <Line
                    name={formatModelName(player)}
                    type="monotone"
                    dataKey={dataKey}
                    stroke={color}
                    strokeWidth={3}
                    style={{ filter: `drop-shadow(0 0 3px ${color}44)` }}
                    dot={<ChartCustomDot lastPointIndex={totalHands - 1} modelName={player} />}
                    activeDot={(props) => <CustomActiveDot {...props} dataLength={totalHands} fill={color} />}
                    isAnimationActive={false}
                  />
                </g>
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
