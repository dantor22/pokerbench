import fs from 'fs/promises';
import path from 'path';
import { Summary, Game } from './types';

// Assuming data is in the parent directory of the pokerbench-web project
const DATA_DIR = path.resolve(process.cwd(), '..');
const RUNS_DIR = path.join(DATA_DIR, 'runs');

export async function getRuns(): Promise<string[]> {
  try {
    // Check if runs directory exists
    try {
      await fs.access(RUNS_DIR);
    } catch {
      return [];
    }
    
    const entries = await fs.readdir(RUNS_DIR, { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })); // Alphabetical order (A-Z)
  } catch (error) {
    console.error('Error listing runs:', error);
    return [];
  }
}

function getDataPath(runId?: string): string {
  if (runId) {
    return path.join(RUNS_DIR, runId);
  }
  return DATA_DIR;
}

export async function getSummary(runId?: string): Promise<Summary | null> {
  try {
    const dir = getDataPath(runId);
    const filePath = path.join(dir, 'summary.json');
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading summary.json for run ${runId || 'root'}:`, error);
    return null;
  }
}

export async function getGameIds(runId?: string): Promise<string[]> {
  try {
    const dir = getDataPath(runId);
    const files = await fs.readdir(dir);
    return files
      .filter(f => f.startsWith('game_') && f.endsWith('.json'))
      .map(f => f.replace('game_', '').replace('.json', ''));
  } catch (error) {
    console.error(`Error reading game files for run ${runId || 'root'}:`, error);
    return [];
  }
}

export async function getGame(gameId: string, runId?: string): Promise<Game | null> {
  try {
    const dir = getDataPath(runId);
    const filePath = path.join(dir, `game_${gameId}.json`);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading game_${gameId}.json for run ${runId || 'root'}:`, error);
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
