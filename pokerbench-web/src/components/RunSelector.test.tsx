import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RunSelector from './RunSelector';
import { useRouter } from 'next/navigation';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

describe('RunSelector', () => {
  const mockPush = vi.fn();
  const runs = ['Run_A', 'Run_B'];

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue({ push: mockPush });
  });

  it('renders all run options', () => {
    render(<RunSelector runs={runs} />);
    expect(screen.getByText('Run A')).toBeInTheDocument();
    expect(screen.getByText('Run B')).toBeInTheDocument();
  });

  it('shows the current run as selected', () => {
    render(<RunSelector runs={runs} currentRunId="Run_B" />);
    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('Run_B');
  });

  it('navigates to the selected run on change', () => {
    render(<RunSelector runs={runs} />);
    const select = screen.getByRole('combobox');
    
    fireEvent.change(select, { target: { value: 'Run_A' } });
    expect(mockPush).toHaveBeenCalledWith('/run/Run_A');
  });

  it('navigates to home if no run is selected', () => {
    render(<RunSelector runs={runs} currentRunId="Run_A" />);
    const select = screen.getByRole('combobox');
    
    fireEvent.change(select, { target: { value: '' } });
    expect(mockPush).toHaveBeenCalledWith('/');
  });
});
