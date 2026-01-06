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
      <div className="flex items-center gap-4 mb-4">
        <Link href={`/run/${runId}`} className="back-link" prefetch={false}>
          <ArrowLeft className="w-5 h-5" />
          Back to Run Dashboard
        </Link>
        <span className="text-muted">|</span>
        <h1 className="text-xl font-bold">Game {game.game_id.replace(/_/g, ' ')} <span className="text-sm font-normal text-muted">({decodedRunId.replace(/_/g, ' ')})</span></h1>
      </div>

      <GameSimulator game={game} />
    </div>
  );
}
