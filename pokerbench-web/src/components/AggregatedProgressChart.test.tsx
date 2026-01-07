import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AggregatedProgressChart from './AggregatedProgressChart';

// Mock ResponsiveContainer as it doesn't work well in JSDOM
vi.mock('recharts', async () => {
  const original = await vi.importActual('recharts');
  return {
    ...original,
    ResponsiveContainer: ({ children }: any) => <div style={{ width: 800, height: 400 }}>{children}</div>,
  };
});

describe('AggregatedProgressChart', () => {
  const mockData = {
    'Pro': [10000, 10100, 10200],
    'Claude': [10000, 9900, 9800],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "No data" message when data is empty', () => {
    render(<AggregatedProgressChart data={{}} />);
    expect(screen.getByText(/No data available/i)).toBeInTheDocument();
  });

  it('renders the chart title and description', () => {
    render(<AggregatedProgressChart data={mockData} />);
    expect(screen.getByText('Stack size over time')).toBeInTheDocument();
    expect(screen.getByText(/Average across aggregated runs/i)).toBeInTheDocument();
  });

  it('renders "Stats for nerds" checkbox when canShowStats is true', () => {
    const enrichedData = {
      'Pro': { mean: [10000, 10100], low: [9000, 9100], high: [11000, 11100] }
    };
    const onToggleStats = vi.fn();
    render(
      <AggregatedProgressChart 
        data={mockData} 
        enrichedData={enrichedData as any} 
        onToggleStats={onToggleStats} 
      />
    );
    
    const checkbox = screen.getByLabelText(/Stats for nerds/i);
    expect(checkbox).toBeInTheDocument();
    
    fireEvent.click(checkbox);
    expect(onToggleStats).toHaveBeenCalledWith(true);
  });
});
