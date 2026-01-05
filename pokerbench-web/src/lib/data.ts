import fs from 'fs/promises';
import path from 'path';
import { Summary, Game } from './types';

// Assuming data is in the parent directory of the pokerbench-web project
const DATA_DIR = path.resolve(process.cwd(), '..');

export async function getSummary(): Promise<Summary | null> {
  try {
    const filePath = path.join(DATA_DIR, 'summary.json');
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error reading summary.json:', error);
    return null;
  }
}

export async function getGameIds(): Promise<string[]> {
  try {
    const files = await fs.readdir(DATA_DIR);
    return files
      .filter(f => f.startsWith('game_') && f.endsWith('.json'))
      .map(f => f.replace('game_', '').replace('.json', ''));
  } catch (error) {
    console.error('Error reading game files:', error);
    return [];
  }
}

export async function getGame(gameId: string): Promise<Game | null> {
  try {
    const filePath = path.join(DATA_DIR, `game_${gameId}.json`);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading game_${gameId}.json:`, error);
    return null;
  }
}
