import { PlayerStats } from '../lib/types';
import { formatModelName, getEffortSuffix } from '../lib/constants';

interface LeaderboardProps {
  data: PlayerStats[];
  showStats?: boolean;
}

export default function Leaderboard({ data, showStats = false }: LeaderboardProps) {
  // Sort by profit descending
  const sortedData = [...data].sort((a, b) => b.avg_profit - a.avg_profit);

  return (
    <div className="card mb-1">
      <h2 className="text-xl font-bold mb-4">Leaderboard</h2>
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Player</th>
              <th className="text-right">
                <span className="sm-visible">Win Rate</span>
                <span className="sm-hidden">WR</span>
              </th>
              <th className="text-right">Hands</th>
              <th className="text-right">
                <span className="sm-visible">Avg Profit</span>
                <span className="sm-hidden">Profit</span>
              </th>
              <th className="text-right">
                <span className="sm-visible">Cost/Dec</span>
                <span className="sm-hidden">Cost</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((player) => {
              let computedStdDev = player.std_dev;
              let computedCI = player.confidence_interval;

              if (player.profits && player.profits.length > 0) {
                const n = player.profits.length;
                const mean = player.profits.reduce((a, b) => a + b, 0) / n;
                const variance = player.profits.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
                computedStdDev = Math.sqrt(variance);
                const stderr = computedStdDev / Math.sqrt(n);
                computedCI = 1.96 * stderr;
              }

              return (
                <tr key={player.name}>
                  <td className="font-bold">
                    {formatModelName(player.name)}
                    {showStats && <span className="text-muted font-normal text-xs">{getEffortSuffix(player.name)}</span>}
                  </td>
                  <td className="text-right">{player.win_rate.toFixed(1)}%</td>
                  <td className="text-right">{player.total_hands}</td>
                  <td className={`text-right ${player.avg_profit >= 0 ? 'text-green' : 'text-red'}`}>
                    <div className="flex flex-col items-end">
                      <div className="font-bold">
                        {player.avg_profit > 0 ? '+' : ''}{player.avg_profit.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        {showStats && computedCI !== undefined && (
                          <span 
                            className="text-xs font-normal ml-1 opacity-80 cursor-help border-b border-dotted border-current"
                            title={`95% Confidence Interval of the Mean\n(±${(computedStdDev && player.profits ? (1.96 * (computedStdDev / Math.sqrt(player.profits.length))).toFixed(0) : "0")})\n\nIndicates that we are 95% confident the true average lies within this range used to rank the player.`}
                          >
                            ±{computedCI.toFixed(0)}
                          </span>
                        )}
                      </div>
                      {showStats && computedStdDev !== undefined && (
                        <div 
                          className="text-[10px] opacity-60 leading-none cursor-help"
                          title={`Standard Deviation (σ)\n(Measure of volatility in single game results)\n\nTypical swing per game: ±${computedStdDev.toFixed(0)}`}
                        >
                          σ: {computedStdDev.toFixed(0)}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="text-right">${player.avg_cost_per_decision.toFixed(4)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
