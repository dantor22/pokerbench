import { getSummary, getGameIds, getRuns, getTotalGamesAcrossRuns, getTotalHandsAcrossRuns } from '../../../lib/data';
import RunDashboard from '../../../components/RunDashboard';
import RunSelector from '../../../components/RunSelector';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface PageProps {
  params: Promise<{ runId: string }>;
}

export default async function RunPage({ params }: PageProps) {
  const { runId } = await params;
  const decodedRunId = decodeURIComponent(runId);
  const summary = await getSummary(decodedRunId);
  const gameIds = await getGameIds(decodedRunId);
  const runs = await getRuns();
  const totalGames = await getTotalGamesAcrossRuns();
  const totalHands = await getTotalHandsAcrossRuns();

  if (!summary) {
    return (
      <div className="container">
        <div className="flex justify-between items-center mb-8">
           <Link href="/" className="back-link">
            <ArrowLeft className="w-5 h-5" />
            Back to Home
          </Link>
           <RunSelector runs={runs} currentRunId={decodedRunId} />
        </div>
        <div className="card text-red">
          Error loading summary for run {decodedRunId}.
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <RunDashboard summary={summary} gameIds={gameIds} runs={runs} runId={decodedRunId} totalGames={totalGames} totalHands={totalHands} />
    </div>
  );
}
