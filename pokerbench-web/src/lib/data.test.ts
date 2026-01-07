import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRuns, getSummary, getGameIds, getGame, getTotalGamesAcrossRuns, getTotalHandsAcrossRuns } from './data';

// Mock manifest.json
vi.mock('../data/manifest.json', () => ({
  default: {
    runs: ['run1', 'run2'],
    games: {
      run1: ['game1', 'game2'],
      run2: ['game3'],
    },
  },
}));

describe('data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('getRuns', () => {
    it('should return runs from manifest', async () => {
      const runs = await getRuns();
      expect(runs).toEqual(['run1', 'run2']);
    });
  });

  describe('getSummary', () => {
    it('should return null if no runId', async () => {
      expect(await getSummary()).toBeNull();
    });

    it('should fetch and return summary data', async () => {
      const mockSummary = { total_games: 10, leaderboard: [] };
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockSummary,
      });

      const summary = await getSummary('run1');
      expect(summary).toEqual(mockSummary);
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/data/runs/run1/summary.json'));
    });

    it('should return null on fetch failure', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
      });

      const summary = await getSummary('run1');
      expect(summary).toBeNull();
    });
  });

  describe('getGameIds', () => {
    it('should return game IDs for a given run', async () => {
      expect(await getGameIds('run1')).toEqual(['game1', 'game2']);
      expect(await getGameIds('run2')).toEqual(['game3']);
    });

    it('should return empty array if runId not in manifest', async () => {
      expect(await getGameIds('unknown')).toEqual([]);
    });
  });

  describe('getGame', () => {
    it('should fetch and return game data', async () => {
      const mockGame = { game_id: 'game1' };
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockGame,
      });

      const game = await getGame('game1', 'run1');
      expect(game).toEqual(mockGame);
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/data/runs/run1/game_game1.json'));
    });
  });

  describe('getTotalGamesAcrossRuns', () => {
    it('should sum total games across all runs', async () => {
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('run1')) {
          return Promise.resolve({ ok: true, json: async () => ({ total_games: 10 }) });
        }
        if (url.includes('run2')) {
          return Promise.resolve({ ok: true, json: async () => ({ total_games: 5 }) });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      const total = await getTotalGamesAcrossRuns();
      expect(total).toBe(15);
    });
  });

  describe('getTotalHandsAcrossRuns', () => {
    it('should sum across runs based on max hands in leaderboard', async () => {
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('run1')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              leaderboard: [{ total_hands: 100 }, { total_hands: 50 }],
            }),
          });
        }
        if (url.includes('run2')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              leaderboard: [{ total_hands: 200 }],
            }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      const total = await getTotalHandsAcrossRuns();
      expect(total).toBe(300);
    });
  });
});
