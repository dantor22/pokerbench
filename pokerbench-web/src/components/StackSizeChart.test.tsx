import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StackSizeChart from './StackSizeChart';

// Mock ResponsiveContainer
vi.mock('recharts', async () => {
  const original = await vi.importActual('recharts');
  return {
    ...original,
    ResponsiveContainer: ({ children }: any) => <div style={{ width: 800, height: 400 }}>{children}</div>,
  };
});

describe('StackSizeChart', () => {
  const mockGame = {
    players: ['Pro', 'Claude'],
    hands: [
      {
        hand_number: 1,
        pre_hand_stacks: { Pro: 10000, Claude: 10000 },
        results: [{ player: 'Pro', net_gain: 100 }, { player: 'Claude', net_gain: -100 }]
      }
    ],
    config: { start_stack: 10000 }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing if no data', () => {
    const { container } = render(<StackSizeChart game={{ hands: [] } as any} currentHandIndex={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders chart title', () => {
    render(<StackSizeChart game={mockGame as any} currentHandIndex={0} />);
    expect(screen.getByText('Stack History')).toBeInTheDocument();
  });
});
