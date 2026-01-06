import { Summary, Game } from './types';
import manifest from '../data/manifest.json';

// Define the type for our manifest to help TS
type Manifest = {
  runs: string[];
  games: Record<string, string[]>;
};

const dataManifest = manifest as Manifest;

export async function getRuns(): Promise<string[]> {
  return dataManifest.runs;
}

export async function getSummary(runId?: string): Promise<Summary | null> {
  try {
    // Note: dynamic imports relative path must be constructed carefully or Webpack might miss them.
    // However, since runId is a string, we need to be careful.
    // In Next.js/Webpack, we can often import using a template string if the files exist at compile time.
    
    // We are looking for src/data/runs/[runId]/summary.json
    
    // NOTE: We cannot easily import from the 'root' of data if runId is undefined (meaning local root?)
    // In the original code, 'root' meant DATA_DIR.
    // Only runs have migrated to src/data/runs.
    // Check if there is a use case for root-level summary.
    
    if (!runId) return null; // We only support specific runs now

    // Using a switch or map is safer for bundlers than a purely dynamic string if the set is small,
    // but for 48MB of data, dynamic import with template string should work if the pattern is clear.
    
    // We explicitly point to the alias '@' or relative path.
    const summary = await import(`../data/runs/${runId}/summary.json`);
    return summary.default || summary;
  } catch (error) {
    console.error(`Error loading summary for ${runId}:`, error);
    return null;
  }
}

export async function getGameIds(runId?: string): Promise<string[]> {
  if (!runId) return [];
  return dataManifest.games[runId] || [];
}

export async function getGame(gameId: string, runId?: string): Promise<Game | null> {
  try {
    if (!runId) return null;
    
    const game = await import(`../data/runs/${runId}/game_${gameId}.json`);
    return game.default || game;
  } catch (error) {
    console.error(`Error loading game ${gameId} for run ${runId}:`, error);
    return null;
  }
}

export async function getTotalGamesAcrossRuns(): Promise<number> {
  const runs = await getRuns();
  let total = 0;
  for (const runId of runs) {
    const summary = await getSummary(runId);
    if (summary) {
      total += summary.total_games;
    }
  }
  return total;
}

export async function getTotalHandsAcrossRuns(): Promise<number> {
  const runs = await getRuns();
  let total = 0;
  for (const runId of runs) {
    const summary = await getSummary(runId);
    if (summary && summary.leaderboard.length > 0) {
      total += Math.max(...summary.leaderboard.map(p => p.total_hands));
    }
  }
  return total;
}
