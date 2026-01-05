import { getSummary, getGameIds } from '../lib/data';
import AggregatedProgressChart from '../components/AggregatedProgressChart';
import Leaderboard from '../components/Leaderboard';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

// Revalidate data every hour
export const revalidate = 3600;

export default async function Home() {
  const summary = await getSummary();
  const gameIds = await getGameIds();

  if (!summary) {
    return (
      <div className="container">
        <h1 className="text-4xl font-bold mb-8">PokerBench Dashboard</h1>
        <div className="card text-red">
          Error loading summary.json. Please ensure the file exists in the parent directory.
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-gradient">
            PokerBench
          </h1>
          <p className="text-muted">AI Poker Tournament Analysis</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">{summary.total_games}</div>
          <div className="text-muted text-sm uppercase" style={{ letterSpacing: '0.05em' }}>Games Played</div>
        </div>
      </header>

      <div className="grid grid-cols-2 mb-8">
        <Leaderboard data={summary.leaderboard} />
        <AggregatedProgressChart data={summary.aggregated_stacks} />
      </div>

      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Recent Games</h2>
          <span className="text-muted text-sm">{gameIds.length} games found</span>
        </div>
        <div className="grid grid-cols-2">
          {gameIds.map((gameId) => (
            <Link
              key={gameId}
              href={`/game/${gameId}`}
              className="game-card group"
            >
              <div className="flex justify-between items-center">
                <span className="font-mono text-lg">{gameId}</span>
                <ArrowRight className="w-5 h-5 arrow-icon" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
