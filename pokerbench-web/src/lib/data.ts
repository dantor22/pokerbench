import { Summary, Game } from './types';
import manifest from '../data/manifest.json';

// Define the type for our manifest to help TS
type Manifest = {
  runs: string[];
  games: Record<string, string[]>;
};

const dataManifest = manifest as Manifest;

// In dev, we can use localhost. In prod, we use relative or configured URL.
// But fetch needs absolute URL in server components usually, unless we have a helper.
// Actually, 'fetch' in Next.js Server Components needs an absolute URL if calling an API route, 
// but for static public files, we can't fetch relative paths like '/data/...' directly in some envs?
// In Edge, 'fetch' works for external URLs. 
// If we deploy to Cloudflare Pages, the data will be served at domain.com/data/...
// We need to know the host.
// A safe bet for Cloudflare Pages is to use the requested URL origin if available, 
// but we are in a data fetching function, not a request handler.
//
// Workaround: We will use a known env var or let the client verify.
// BUT this is running at build time / request time. 
//
// Let's assume for now we can fetch from the provided URL.
// Since we are standardizing on "public" assets, we don't *need* to import them.


export async function getRuns(): Promise<string[]> {
  return dataManifest.runs;
}

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  // Fallback for local development
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  // In production, if variable is not set, we might be in trouble if we need absolute URL.
  // But often in Edge context with relative fetch might work if supported, but Next.js usually demands absolute.
  // We'll return empty string and hope, or we could throw a clearer error.
  return '';
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

    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/data/runs/${encodeURIComponent(runId)}/summary.json`;
    
    // Check if URL is absolute if required
    if (!url.startsWith('http') && !url.startsWith('/')) {
        // If baseUrl is empty and we have a relative path, it effectively starts with / if we added it,
        // but let's be safe.
    }

    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
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
    
    // In Edge Runtime, 'import' sometimes bundles everything.
    // By keeping it as a 'fetch' to our own public folder, we might bypass the bundling limit.
    // BUT we are using standard Next.js, not yet a separate worker.
    // The previous implementation was using 'import' which caused Webpack to bundle ALL json files into the edge function.
    
    // Strategy: We can't actually 'fetch' file:// in edge. 
    // But if we put data in 'public/', we CAN fetch it via URL.
    // Let's change the sync strategy to put data in 'public/data' instead.
    
    // For now, if we must stick to src/data, we have to find a way to not bundle all of them.
    // The error says "Exceeds maximum edge function size".
    
    // If we move to public/, we can use fetch.
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/data/runs/${encodeURIComponent(runId)}/game_${gameId}.json`);
    if (!response.ok) return null;
    return await response.json();
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
