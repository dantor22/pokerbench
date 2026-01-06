'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2 } from 'lucide-react';
import RunSelector from './RunSelector';
import { Summary, Game, PlayerStats } from '../lib/types';
import AggregatedProgressChart from './AggregatedProgressChart';
import Leaderboard from './Leaderboard';
import { getGame } from '../lib/data';

interface RunDashboardProps {
  summary: Summary;
  gameIds: string[];
  runs: string[];
  runId?: string;
  totalGames: number;
  totalHands: number;
}

export default function RunDashboard({ summary, gameIds, runs, runId, totalGames, totalHands }: RunDashboardProps) {
  const [enrichedLeaderboard, setEnrichedLeaderboard] = useState<PlayerStats[]>(summary.leaderboard);
  const [enrichedStacks, setEnrichedStacks] = useState<Record<string, { mean: number[], low: number[], high: number[] }>>({});
  const [isEnriching, setIsEnriching] = useState(false);
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    if (!gameIds.length || !runId) return;

    async function enrichData() {
      setIsEnriching(true);
      try {
        const profitsMap: Record<string, number[]> = {};
        const stacksMap: Record<string, number[][]> = {};
        
        // Initialize
        summary.leaderboard.forEach(p => {
          profitsMap[p.name] = [];
          stacksMap[p.name] = [];
        });

        // Fetch all games
        const gameData = await Promise.all(
          gameIds.map(id => getGame(id, runId))
        );

        gameData.forEach(game => {
          if (!game || !game.hands || game.hands.length === 0) return;
          
          const startStack = game.config.start_stack || 10000;
          
          // Reconstruct per-game stack history for each player
          // We need to sync players who might have been eliminated
          const playersInGame = game.players;
          const gameStacks: Record<string, number[]> = {};
          playersInGame.forEach(p => {
             gameStacks[p] = [startStack];
          });

          game.hands.forEach(hand => {
            playersInGame.forEach(p => {
              const res = hand.results.find(r => r.player === p);
              const prevStack = gameStacks[p][gameStacks[p].length - 1];
              if (res) {
                gameStacks[p].push((hand.pre_hand_stacks[p] ?? 0) + res.net_gain);
              } else {
                gameStacks[p].push(prevStack);
              }
            });
          });

          // Add to global maps
          playersInGame.forEach(p => {
            if (stacksMap[p]) {
              stacksMap[p].push(gameStacks[p]);
              const finalShift = gameStacks[p][gameStacks[p].length - 1] - startStack;
              profitsMap[p].push(finalShift);
            }
          });
        });

        // Compute stats for leaderboard
        const newLeaderboard = summary.leaderboard.map(p => ({
          ...p,
          profits: profitsMap[p.name] || []
        }));

        // Compute stats for chart
        const newEnrichedStacks: Record<string, { mean: number[], low: number[], high: number[] }> = {};
        Object.keys(stacksMap).forEach(player => {
          const gameHistories = stacksMap[player];
          if (gameHistories.length === 0) return;

          const numHands = Math.max(...gameHistories.map(h => h.length));
          const means: number[] = [];
          const lows: number[] = [];
          const highs: number[] = [];

          for (let i = 0; i < numHands; i++) {
            const values = gameHistories.map(h => h[i] ?? h[h.length - 1]);
            const n = values.length;
            const mean = values.reduce((a, b) => a + b, 0) / n;
            const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
            const stdDev = Math.sqrt(variance);
            const stderr = stdDev / Math.sqrt(n);
            const ci = 1.96 * stderr;

            means.push(mean);
            lows.push(mean - ci);
            highs.push(mean + ci);
          }

          newEnrichedStacks[player] = { mean: means, low: lows, high: highs };
        });

        setEnrichedLeaderboard(newLeaderboard);
        setEnrichedStacks(newEnrichedStacks);
      } catch (err) {
        console.error("Failed to enrich stats:", err);
      } finally {
        setIsEnriching(false);
      }
    }

    enrichData();
  }, [gameIds, runId, summary.leaderboard]);

  const basePath = runId ? `/run/${runId}` : '';

  return (
    <div>
       <header className="mb-4 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-gradient">
            PokerBench
          </h1>
          <div className="mt-1 flex items-center gap-4">
            <RunSelector runs={runs} currentRunId={runId} />
            {isEnriching && (
              <div className="flex items-center gap-2 text-xs text-muted animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                Computing high-fidelity stats...
              </div>
            )}
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
        <AggregatedProgressChart 
          data={summary.aggregated_stacks} 
          enrichedData={Object.keys(enrichedStacks).length > 0 ? enrichedStacks : undefined} 
          showStats={showStats}
          onToggleStats={setShowStats}
        />
      </div>

      <div className="dashboard-lower-grid mb-4">
        <Leaderboard data={enrichedLeaderboard} showStats={showStats} />
        
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
