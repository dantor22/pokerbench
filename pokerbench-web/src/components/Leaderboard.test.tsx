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

  it('shows effort suffix when showStats is true', () => {
    render(<Leaderboard data={mockData as any} showStats={true} />);
    expect(screen.getByText('(medium)')).toBeInTheDocument();
    expect(screen.getByText('(high)')).toBeInTheDocument();
  });
});
