import { getGame, getRuns } from '../../../../../lib/data';
import GameSimulator from '../../../../../components/GameSimulator';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const runtime = 'edge';

interface PageProps {
  params: Promise<{ runId: string; gameId: string }>;
}

export default async function RunGamePage({ params }: PageProps) {
  const { runId, gameId } = await params;
  const decodedRunId = decodeURIComponent(runId);
  const game = await getGame(gameId, decodedRunId);

  if (!game) {
    return (
      <div className="container">
        <h1 className="text-4xl font-bold mb-8">Game Not Found</h1>
        <Link href={`/run/${runId}`} className="text-blue-600 hover:text-white transition-colors">Return to Run Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: '100%', padding: '1rem' }}>
      <div className="flex-responsive mb-6 !gap-2">
        <Link href={`/run/${runId}`} className="back-link" prefetch={false}>
          <ArrowLeft className="w-5 h-5" />
          <span className="sm-visible">Back to Run Dashboard</span>
          <span className="sm-hidden">Back</span>
        </Link>
        <h1 className="text-xl font-bold">
          Game <span className="font-mono">{game.game_id.replace(/_/g, ' ')}</span>
          <span className="text-sm font-normal text-muted block sm-visible sm-ml-2">({decodedRunId.replace(/_/g, ' ')})</span>
        </h1>
      </div>

      <GameSimulator game={game} runId={decodedRunId} />
    </div>
  );
}
