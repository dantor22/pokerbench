import { getSummary, getGameIds, getRuns, getTotalGamesAcrossRuns, getTotalHandsAcrossRuns } from '../lib/data';
import RunDashboard from '../components/RunDashboard';
import RunSelector from '../components/RunSelector';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { redirect } from 'next/navigation';

// Revalidate data every hour
export const revalidate = 3600;

export default async function Home() {
  const summary = await getSummary();
  const gameIds = await getGameIds();
  const runs = await getRuns();
  const totalGames = await getTotalGamesAcrossRuns();
  const totalHands = await getTotalHandsAcrossRuns();

  if (!summary && runs.length > 0) {
    redirect(`/run/${runs[0]}`);
  }

  if (!summary) {
    return (
      <div className="container">
        <h1 className="text-4xl font-bold mb-8">PokerBench Dashboard</h1>
        
        {runs.length > 0 ? (
          <div className="card">
             <h2 className="text-xl font-bold mb-4">Select a Run</h2>
             <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {runs.map(run => (
                  <Link 
                    key={run} 
                    href={`/run/${run}`}
                    className="block p-4 bg-white/5 hover:bg-white/10 rounded border border-white/10 transition-colors"
                  >
                    <span className="font-mono text-lg">{run}</span>
                  </Link>
                ))}
             </div>
          </div>
        ) : (
          <div className="card text-red">
            Error loading summary.json. Please ensure the file exists in the parent directory or in a 'runs' subdirectory.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="container">
      <RunDashboard summary={summary} gameIds={gameIds} runs={runs} totalGames={totalGames} totalHands={totalHands} />
    </div>
  );
}
