'use client';

import { useMemo } from 'react';
import { Game } from '../lib/types';
import { calculateGameStats } from '../lib/poker-stats';
import { formatModelName } from '../lib/constants';

interface GameStatsProps {
  game: Game;
  currentHandIndex?: number;
  runId?: string;
}

export default function GameStats({ game, currentHandIndex, runId }: GameStatsProps) {
  const stats = useMemo(() => calculateGameStats(game, currentHandIndex), [game, currentHandIndex]);
  const players = game.players;

  return (
    <div className="card mt-4">
      <h2 className="text-xl font-bold mb-4">Game Statistics</h2>
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Player</th>
              <th className="text-right">VPIP</th>
              <th className="text-right">PFR</th>
              <th className="text-right">3B%</th>
              <th className="text-right">CB%</th>
              <th className="text-right">Hands</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => {
              const s = stats[p];
              if (!s) return null;
              return (
                <tr key={p}>
                  <td className="font-bold">{formatModelName(p, runId)}</td>
                  <td className="text-right">{s.vpip.toFixed(1)}%</td>
                  <td className="text-right">{s.pfr.toFixed(1)}%</td>
                  <td className="text-right">{s.three_bet.toFixed(1)}%</td>
                  <td className="text-right">{s.c_bet.toFixed(1)}%</td>
                  <td className="text-right">{s.vpipOpp}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 text-xs text-muted italic">
        * VPIP: Voluntarily Put In Pot. PFR: Pre-Flop Raise. 3B: 3-Bet frequency. CB: Continuation Bet frequency.
      </div>
    </div>
  );
}
