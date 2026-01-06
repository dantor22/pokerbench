'use client'; // Client component for interactivity if needed, though mostly static display
// Actually, this can be a server component if we just pass data. 
// But RunSelector will need client state potentially or just navigation.
// Let's make it a Server Component wrapper that renders Client parts if needed.
// For now, simple display component.

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import RunSelector from './RunSelector';
import { Summary } from '../lib/types';
import AggregatedProgressChart from './AggregatedProgressChart';
import Leaderboard from './Leaderboard';

interface RunDashboardProps {
  summary: Summary;
  gameIds: string[];
  runs: string[];
  runId?: string;
  totalGames: number;
  totalHands: number;
}

export default function RunDashboard({ summary, gameIds, runs, runId, totalGames, totalHands }: RunDashboardProps) {
  const basePath = runId ? `/run/${runId}` : '';

  return (
    <div>
       <header className="mb-4 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-gradient">
            PokerBench
          </h1>
          <div className="mt-1">
            <RunSelector runs={runs} currentRunId={runId} />
          </div>
        </div>
        <div className="flex gap-8 text-right">
          <div>
            <div className="text-2xl font-bold">{totalGames}</div>
            <div className="text-muted text-sm uppercase" style={{ letterSpacing: '0.05em' }}>Total Games</div>
          </div>
          <div className="ml-4">
            <div className="text-2xl font-bold">{totalHands}</div>
            <div className="text-muted text-sm uppercase" style={{ letterSpacing: '0.05em' }}>Total Hands</div>
          </div>
        </div>
      </header>

      <div className="mb-4">
        <AggregatedProgressChart data={summary.aggregated_stacks} />
      </div>

      <div className="dashboard-lower-grid mb-4">
        <Leaderboard data={summary.leaderboard} />
        
        <div className="card games-panel">
          <div className="flex justify-between items-center mb-4 flex-no-shrink">
            <h2 className="text-xl font-bold">Games</h2>
            <span className="text-muted text-sm">{gameIds.length} games found</span>
          </div>
          <div className="games-scroll-container custom-scrollbar">
            <div className="games-list">
              {[...gameIds].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map((gameId) => (
                <Link
                  key={gameId}
                  href={`${basePath}/game/${gameId}`}
                  className="game-card group block"
                  prefetch={false}
                >
                  <div className="flex justify-between items-center p-2">
                    <span className="font-mono text-lg">{gameId.replace(/_/g, ' ')}</span>
                    <ArrowRight className="w-5 h-5 arrow-icon" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
