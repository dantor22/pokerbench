import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RunDashboard from './RunDashboard';
import { getGame } from '../lib/data';

// Mock dependencies
vi.mock('../lib/data', () => ({
  getGame: vi.fn(),
}));

vi.mock('./AggregatedProgressChart', () => ({
  default: (props: any) => (
    <div data-testid="chart">
      {props.showRank ? 'Rank View' : 'Stack View'}
      <button onClick={() => props.onToggleRank?.(!props.showRank)}>Toggle Rank</button>
    </div>
  )
}));

vi.mock('./Leaderboard', () => ({
  default: (props: any) => (
    <div data-testid="leaderboard">
      {props.showRank ? 'Rank Leaderboard' : 'Profit Leaderboard'}
      {props.ranks && <div data-testid="ranks-data">{JSON.stringify(props.ranks)}</div>}
    </div>
  )
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

  it('toggles rank view through the chart component', () => {
    render(
      <RunDashboard
        summary={mockSummary as any}
        gameIds={mockGameIds}
        runs={mockRuns}
        totalGames={10}
        totalHands={200}
      />
    );

    expect(screen.getByText('Stack View')).toBeInTheDocument();
    expect(screen.getByText('Profit Leaderboard')).toBeInTheDocument();

    const toggleButton = screen.getByText('Toggle Rank');
    fireEvent.click(toggleButton);

    expect(screen.getByText('Rank View')).toBeInTheDocument();
    expect(screen.getByText('Rank Leaderboard')).toBeInTheDocument();
  });

  it('calculates ranks correctly during enrichment', async () => {
    const mockGame = {
      config: { start_stack: 10000 },
      players: ['Player1', 'Player2'],
      hands: [
        {
          results: [
            { player: 'Player1', net_gain: 500 },
            { player: 'Player2', net_gain: -500 }
          ],
          pre_hand_stacks: { Player1: 10000, Player2: 10000 }
        }
      ]
    };
    (getGame as any).mockResolvedValue(mockGame);

    render(
      <RunDashboard
        summary={{
          ...mockSummary,
          leaderboard: [
            { name: 'Player1', total_hands: 1, avg_profit: 500 },
            { name: 'Player2', total_hands: 1, avg_profit: -500 },
          ]
        } as any}
        gameIds={['1']}
        runs={mockRuns}
        runId="Run1"
        totalGames={1}
        totalHands={1}
      />
    );

    await waitFor(() => {
      expect(screen.queryByText(/Computing high-fidelity stats/i)).not.toBeInTheDocument();
    });

    const ranksData = JSON.parse(screen.getByTestId('ranks-data').textContent!);
    // Player1 has more chips, so should be Rank 1
    expect(ranksData['Player1'].avg).toBe(1);
    // Player2 has fewer chips, so should be Rank 2
    expect(ranksData['Player2'].avg).toBe(2);
  });
});
