import { PlayerStats } from '../lib/types';
import { formatModelName } from '../lib/constants';

interface LeaderboardProps {
  data: PlayerStats[];
}

export default function Leaderboard({ data }: LeaderboardProps) {
  // Sort by profit descending
  const sortedData = [...data].sort((a, b) => b.avg_profit - a.avg_profit);

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4">Leaderboard</h2>
      <table className="table">
        <thead>
          <tr>
            <th>Player</th>
            <th className="text-right">Win Rate</th>
            <th className="text-right">Hands</th>
            <th className="text-right">Avg Profit</th>
            <th className="text-right">Cost/Dec</th>
          </tr>
        </thead>
        <tbody>
          {sortedData.map((player) => (
            <tr key={player.name}>
              <td className="font-bold">{formatModelName(player.name)}</td>
              <td className="text-right">{player.win_rate.toFixed(1)}%</td>
              <td className="text-right">{player.total_hands}</td>
              <td className={`text-right ${player.avg_profit >= 0 ? 'text-green' : 'text-red'}`}>
                {player.avg_profit >= 0 ? '+' : ''}{player.avg_profit.toFixed(0)}
              </td>
              <td className="text-right">${player.avg_cost_per_decision.toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
