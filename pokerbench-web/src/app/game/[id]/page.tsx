import { getGame } from '../../../lib/data';
import GameSimulator from '../../../components/GameSimulator';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function GamePage({ params }: PageProps) {
  const { id } = await params;
  const game = await getGame(id);

  if (!game) {
    return (
      <div className="container">
        <h1 className="text-4xl font-bold mb-8">Game Not Found</h1>
        <Link href="/" className="text-blue-600 hover:text-white transition-colors">Return to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: '100%', padding: '1rem' }}>
      <div className="flex items-center gap-4 mb-4">
        <Link href="/" className="back-link">
          <ArrowLeft className="w-5 h-5" />
          Back to Dashboard
        </Link>
        <span className="text-muted">|</span>
        <h1 className="text-xl font-bold">Game {game.game_id}</h1>
      </div>

      <GameSimulator game={game} />
    </div>
  );
}
