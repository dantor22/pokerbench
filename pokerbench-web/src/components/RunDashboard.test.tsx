import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RunDashboard from './RunDashboard';
import { getGame } from '../lib/data';

// Mock dependencies
vi.mock('../lib/data', () => ({
  getGame: vi.fn(),
}));

vi.mock('./AggregatedProgressChart', () => ({
  default: () => <div data-testid="chart" />
}));

vi.mock('./Leaderboard', () => ({
  default: () => <div data-testid="leaderboard" />
}));

vi.mock('./RunSelector', () => ({
  default: () => <div data-testid="run-selector" />
}));

describe('RunDashboard', () => {
  const mockSummary = {
    total_games: 10,
    leaderboard: [
      { name: 'Player1', total_hands: 100, avg_profit: 50 },
    ],
    aggregated_stacks: {},
  };
  const mockGameIds = ['1', '2'];
  const mockRuns = ['Run1'];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dashboard with basic info', () => {
    render(
      <RunDashboard 
        summary={mockSummary as any} 
        gameIds={mockGameIds} 
        runs={mockRuns} 
        totalGames={10} 
        totalHands={200} 
      />
    );

    expect(screen.getByText('PokerBench')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByTestId('run-selector')).toBeInTheDocument();
    expect(screen.getByTestId('chart')).toBeInTheDocument();
    expect(screen.getByTestId('leaderboard')).toBeInTheDocument();
  });

  it('enriches data on mount', async () => {
    const mockGame = {
      config: { start_stack: 10000 },
      players: ['Player1'],
      hands: [
        { 
          results: [{ player: 'Player1', net_gain: 100 }],
          pre_hand_stacks: { Player1: 10000 }
        }
      ]
    };
    (getGame as any).mockResolvedValue(mockGame);

    render(
      <RunDashboard 
        summary={mockSummary as any} 
        gameIds={['1']} 
        runs={mockRuns} 
        runId="Run1"
        totalGames={1} 
        totalHands={1} 
      />
    );

    // Should show loader while enriching
    expect(screen.getByText(/Computing high-fidelity stats/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(getGame).toHaveBeenCalledWith('1', 'Run1');
    });

    // Loader should disappear
    await waitFor(() => {
      expect(screen.queryByText(/Computing high-fidelity stats/i)).not.toBeInTheDocument();
    });
  });

  it('renders the games list correctly', () => {
    render(
      <RunDashboard 
        summary={mockSummary as any} 
        gameIds={['game_1', 'game_2']} 
        runs={mockRuns} 
        totalGames={2} 
        totalHands={20} 
      />
    );

    expect(screen.getByText('game 1')).toBeInTheDocument();
    expect(screen.getByText('game 2')).toBeInTheDocument();
    expect(screen.getByText('2 games found')).toBeInTheDocument();
  });
});
