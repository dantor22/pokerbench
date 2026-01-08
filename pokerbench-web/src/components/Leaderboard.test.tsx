import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Leaderboard from './Leaderboard';

describe('Leaderboard', () => {
  const mockData = [
    { name: 'Pro', win_rate: 60.5, total_hands: 100, avg_profit: 500, avg_cost_per_decision: 0.01, profits: [500] },
    { name: 'Claude', win_rate: 40.2, total_hands: 100, avg_profit: -200, avg_cost_per_decision: 0.05, profits: [-200] },
  ];

  it('renders the leaderboard title', () => {
    render(<Leaderboard data={mockData as any} />);
    expect(screen.getByText('Leaderboard')).toBeInTheDocument();
  });

  it('renders player names and stats', () => {
    render(<Leaderboard data={mockData as any} />);
    expect(screen.getByText('Gemini 3 Pro')).toBeInTheDocument();
    expect(screen.getByText('Opus 4.5')).toBeInTheDocument();
    expect(screen.getByText('60.5%')).toBeInTheDocument();
    expect(screen.getByText('40.2%')).toBeInTheDocument();
    expect(screen.getByText(/\$500/)).toBeInTheDocument();
    expect(screen.getByText(/-\$200/)).toBeInTheDocument();
  });

  it('sorts players by avg_profit descending', () => {
    const data = [
      { name: 'Claude', avg_profit: -200, win_rate: 40, total_hands: 100, avg_cost_per_decision: 0 },
      { name: 'Pro', avg_profit: 500, win_rate: 60, total_hands: 100, avg_cost_per_decision: 0 },
    ];
    render(<Leaderboard data={data as any} />);
    const rows = screen.getAllByRole('row');
    // Row 0 is header, Row 1 should be Pro, Row 2 should be Claude
    expect(rows[1]).toHaveTextContent('Gemini 3 Pro');
    expect(rows[2]).toHaveTextContent('Opus 4.5');
  });

  it('shows effort suffix and new poker stats when showStats is true', () => {
    const dataWithStats = [
      { ...mockData[0], vpip: 25.5, pfr: 18.2, three_bet: 8.5, c_bet: 70.0 },
      { ...mockData[1], vpip: 30.0, pfr: 20.0, three_bet: 10.0, c_bet: 60.0 },
    ];
    render(<Leaderboard data={dataWithStats as any} showStats={true} />);
    expect(screen.getByText(/high/)).toBeInTheDocument();
    expect(screen.getByText(/medium/)).toBeInTheDocument();

    // Check headers
    expect(screen.getByText('VPIP')).toBeInTheDocument();
    expect(screen.getByText('PFR')).toBeInTheDocument();
    expect(screen.getByText('3B')).toBeInTheDocument();
    expect(screen.getByText('CB')).toBeInTheDocument();

    // Check values
    expect(screen.getByText('25.5%')).toBeInTheDocument();
    expect(screen.getByText('18.2%')).toBeInTheDocument();
    expect(screen.getByText('8.5%')).toBeInTheDocument();
    expect(screen.getByText('70.0%')).toBeInTheDocument();
  });

  it('renders win rate tooltip', () => {
    render(<Leaderboard data={mockData as any} />);
    const winRateHeader = screen.getByText('Win Rate');
    expect(winRateHeader).toHaveAttribute('title', 'Percentage of hands where the player won some chips, calculated over the hands they participated in (Hands Won / Hands Played)');

    const winRateValue = screen.getByText('60.5%');
    expect(winRateValue).toHaveAttribute('title', 'Percentage of hands where the player won some chips, calculated over the hands they participated in (Hands Won / Hands Played)');
  });

  it('renders rank values and header when showRank is true', () => {
    const ranks = {
      'Pro': { avg: 1.5, stdDev: 0.5, ci: 0.1 },
      'Claude': { avg: 2.5, stdDev: 0.5, ci: 0.1 },
    };
    render(<Leaderboard data={mockData as any} showRank={true} ranks={ranks} />);

    expect(screen.getByText('Avg Rank')).toBeInTheDocument();
    expect(screen.getByText('Rank 1.50')).toBeInTheDocument();
    expect(screen.getByText('Rank 2.50')).toBeInTheDocument();
  });

  it('sorts players by rank ascending when showRank is true', () => {
    const data = [
      { name: 'Claude', avg_profit: 500, win_rate: 50, total_hands: 100, avg_cost_per_decision: 0 },
      { name: 'Pro', avg_profit: -200, win_rate: 50, total_hands: 100, avg_cost_per_decision: 0 },
    ];
    const ranks = {
      'Pro': { avg: 1.0, stdDev: 0, ci: 0 },
      'Claude': { avg: 2.0, stdDev: 0, ci: 0 },
    };
    render(<Leaderboard data={data as any} showRank={true} ranks={ranks} />);
    const rows = screen.getAllByRole('row');
    // Rank 1.0 (Pro) should be first, even though profit is lower
    expect(rows[1]).toHaveTextContent('Gemini 3 Pro');
    expect(rows[2]).toHaveTextContent('Opus 4.5');
  });
});
