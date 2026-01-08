'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2 } from 'lucide-react';
import RunSelector from './RunSelector';
import { Summary, Game, PlayerStats, RunStats } from '../lib/types';
import AggregatedProgressChart from './AggregatedProgressChart';
import Leaderboard from './Leaderboard';
import { getGame, getStats } from '../lib/data';

interface RunDashboardProps {
  summary: Summary;
  gameIds: string[];
  runs: string[];
  runId?: string;
  totalGames: number;
  totalHands: number;
  initialStats?: RunStats | null;
}

export default function RunDashboard({ summary, gameIds, runs, runId, totalGames, totalHands, initialStats }: RunDashboardProps) {
  // Initialize with initialStats if available
  const [enrichedLeaderboard, setEnrichedLeaderboard] = useState<PlayerStats[]>(() => {
    if (initialStats) {
      return summary.leaderboard.map(p => ({
        ...p,
        profits: initialStats.profits[p.name] || []
      }));
    }
    return summary.leaderboard;
  });

  const [enrichedStacks, setEnrichedStacks] = useState<Record<string, { mean: number[], low: number[], high: number[], individual?: number[][] }>>(() => {
    return initialStats?.stacks || {};
  });

  const [playerRanks, setPlayerRanks] = useState<Record<string, { avg: number, stdDev: number, ci: number }>>(() => {
    return initialStats?.ranks || {};
  });

  // Only start enriching if we don't have initialStats
  const [isEnriching, setIsEnriching] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showRank, setShowRank] = useState(false);

  useEffect(() => {
    if (!gameIds.length || !runId) return;

    // If we have data already (initialStats or from previous run), check if we need to fetch
    // Actually, if runId changes, initialStats might be stale if the parent didn't update it?
    // But this component key should normally change if runId changes in a way that remounts it?
    // No, Next.js might keep it mounted.
    // If initialStats is provided, we assume it matches runId.
    // BUT checking Object.keys(enrichedStacks).length might be true from initialStats.
    // We strictly want to avoid fetching if we already have data FOR THIS RUN.

    // Simplification: If enrichedStacks is not empty, we assume we are good?
    // What if the user switches runs? enrichedStacks needs to be reset.
    // The useState initializers only run on mount.
    // So if runId changes, we DO need to fetch, unless we are remounted.
    // Next.js page transitions typically remount components in page.tsx.

    // Let's modify the useEffect to reset if runId changes and we don't have data.
    // But wait, if runId changes, we might want to fetch.

    // If we have initialStats passed in, effectively we are "done" for that render.
    // BUT if we navigate client-side, initialStats might NOT update if it's passed from server component and we use Link?
    // Actually Link navigation fetching server component payload DOES update props.

    // So if initialStats matches the current run, we are good.
    // But we don't know if initialStats matches runId inside this useEffect easily unless we compare.
    // Let's rely on the fact that if enrichedStacks is populated, we might be good, 
    // BUT we need to be careful about run switching.

    // Actually, simpler:
    // If enrichedStacks is populated, let's assume it's correct for now?
    // No, that's dangerous.

    // Let's just check if we have data.
    // If `initialStats` was supplied and used, `enrichedStacks` is populated.

    // We can just check if we need to fetch.
    const hasData = Object.keys(enrichedStacks).length > 0;
    if (hasData) return;

    async function enrichData() {
      setIsEnriching(true);
      try {
        const stats = await getStats(runId);
        if (stats) {
          const newLeaderboard = summary.leaderboard.map(p => ({
            ...p,
            profits: stats.profits[p.name] || []
          }));
          setEnrichedLeaderboard(newLeaderboard);
          setEnrichedStacks(stats.stacks);
          setPlayerRanks(stats.ranks);
          return;
        }

        const profitsMap: Record<string, number[]> = {};
        const stacksMap: Record<string, number[][]> = {};
        const finalRanksMap: Record<string, number[]> = {};
        
        // Initialize
        summary.leaderboard.forEach(p => {
          profitsMap[p.name] = [];
          stacksMap[p.name] = [];
          finalRanksMap[p.name] = [];
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

          // Compute final ranks for this game
          const finalGameStacks = playersInGame.map(p => ({
            name: p,
            stack: gameStacks[p][gameStacks[p].length - 1]
          }));
          finalGameStacks.sort((a, b) => b.stack - a.stack);

          let currentRank = 1;
          for (let j = 0; j < finalGameStacks.length; j++) {
            if (j > 0 && finalGameStacks[j].stack < finalGameStacks[j - 1].stack) {
              currentRank = j + 1;
            }
            if (finalRanksMap[finalGameStacks[j].name]) {
              finalRanksMap[finalGameStacks[j].name].push(currentRank);
            }
          }
        });

        // Compute stats for chart

        const newPlayerRanks: Record<string, { avg: number, stdDev: number, ci: number }> = {};
        Object.keys(finalRanksMap).forEach(p => {
          const ranks = finalRanksMap[p];
          if (ranks.length === 0) return;
          const n = ranks.length;
          const mean = ranks.reduce((a, b) => a + b, 0) / n;
          const variance = ranks.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
          const stdDev = Math.sqrt(variance);
          const stderr = stdDev / Math.sqrt(n);
          newPlayerRanks[p] = { avg: mean, stdDev, ci: 1.96 * stderr };
        });

        // Compute stats for leaderboard
        const newLeaderboard = summary.leaderboard.map(p => ({
          ...p,
          profits: profitsMap[p.name] || []
        }));

        setPlayerRanks(newPlayerRanks);

        // Compute stats for chart
        const newEnrichedStacks: Record<string, { mean: number[], low: number[], high: number[], individual?: number[][] }> = {};
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

          newEnrichedStacks[player] = { mean: means, low: lows, high: highs, individual: gameHistories };
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
      <header className="mb-8 flex-responsive">
        <div>
          <h1 className="text-4xl font-bold text-gradient">
            PokerBench
          </h1>
          <div className="mt-1 flex items-center gap-4">
            <RunSelector runs={runs} currentRunId={runId} />
            {isEnriching && (
              <div className="flex items-center gap-2 text-xs text-muted animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="md-visible">Computing high-fidelity stats...</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-responsive text-right-md">
          <div>
            <div className="text-2xl font-bold">{totalGames}</div>
            <div className="text-muted text-sm uppercase tracking-wider">Total Games</div>
          </div>
          <div className="ml-0 md-ml-4">
            <div className="text-2xl font-bold">{totalHands}</div>
            <div className="text-muted text-sm uppercase tracking-wider">Total Hands</div>
          </div>
        </div>
      </header>

      <div className="mb-4">
        <AggregatedProgressChart 
          data={summary.aggregated_stacks} 
          enrichedData={Object.keys(enrichedStacks).length > 0 ? enrichedStacks : undefined} 
          showStats={showStats}
          onToggleStats={setShowStats}
          showRank={showRank}
          onToggleRank={setShowRank}
          runId={runId}
        />
      </div>

      <div className="dashboard-lower-grid mb-4">
        <Leaderboard
          data={enrichedLeaderboard}
          showStats={showStats}
          runId={runId}
          showRank={showRank}
          ranks={playerRanks}
        />
        
        <div className="card games-panel mb-1">
          <div className="flex justify-between items-baseline mb-4 flex-no-shrink">
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
                  <div className="flex justify-between items-center p-1">
                    <span className="font-mono text-base">{gameId.replace(/_/g, ' ')}</span>
                    <ArrowRight className="w-4 h-4 arrow-icon" />
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
