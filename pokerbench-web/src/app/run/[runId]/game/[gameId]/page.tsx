import { getGame, getRuns } from '../../../../../lib/data';
import GameSimulator from '../../../../../components/GameSimulator';
import Link from 'next/link';
import { ArrowLeft, Youtube } from 'lucide-react';
import { YOUTUBE_LINKS } from '../../../../../lib/youtube-links';

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

  const youtubeKey = `${decodedRunId}/game/${gameId}`;
  const youtubeLink = YOUTUBE_LINKS[youtubeKey];

  return (
    <div className="container" style={{ maxWidth: '100%', padding: '1rem' }}>
      <div className="flex-responsive mb-6 !gap-2">
        <Link href={`/run/${runId}`} className="back-link" prefetch={false}>
          <ArrowLeft className="w-5 h-5" />
          <span className="sm-visible">Back to Run Dashboard</span>
          <span className="sm-hidden">Back</span>
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">
            Game <span className="font-mono">{game.game_id.replace(/_/g, ' ')}</span>
            <span className="text-sm font-normal text-muted block sm-visible sm-ml-2">({decodedRunId.replace(/_/g, ' ')})</span>
          </h1>
          {youtubeLink && (
            <a
              href={youtubeLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1 transition-all group"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                borderRadius: '9999px',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                textDecoration: 'none',
                display: 'inline-flex'
              }}
              title="Watch on YouTube"
            >
              <Youtube size={16} style={{ fill: 'rgba(239, 68, 68, 0.2)' }} strokeWidth={2.5} />
              <span style={{ fontSize: '0.7rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>watch</span>
            </a>
          )}
        </div>
      </div>

      <GameSimulator game={game} runId={decodedRunId} />
    </div>
  );
}
