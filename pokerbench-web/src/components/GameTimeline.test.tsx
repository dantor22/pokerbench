import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import GameTimeline from './GameTimeline';

describe('GameTimeline', () => {
  const mockHands = [
    { hand_number: 1, actions: [{ pot_before: 1000 }] },
    { hand_number: 2, actions: [{ pot_before: 5000 }] },
    { hand_number: 3, actions: [{ pot_before: 2000 }] },
  ];
  const onHandSelect = vi.fn();

  it('renders the title', () => {
    render(<GameTimeline hands={mockHands as any} currentHandIndex={0} onHandSelect={onHandSelect} />);
    expect(screen.getByText('Game Timeline')).toBeInTheDocument();
  });

  it('renders the correct number of hand bars', () => {
    render(<GameTimeline hands={mockHands as any} currentHandIndex={0} onHandSelect={onHandSelect} />);
    const bars = screen.getAllByRole('button');
    expect(bars).toHaveLength(3);
  });

  it('calls onHandSelect when a hand bar is clicked', () => {
    render(<GameTimeline hands={mockHands as any} currentHandIndex={0} onHandSelect={onHandSelect} />);
    const bars = screen.getAllByRole('button');
    fireEvent.click(bars[1]);
    expect(onHandSelect).toHaveBeenCalledWith(1);
  });

  it('highlights the current hand', () => {
    render(<GameTimeline hands={mockHands as any} currentHandIndex={1} onHandSelect={onHandSelect} />);
    const bars = screen.getAllByRole('button');
    // We can check background color or a specific class if added
    expect(bars[1]).toHaveStyle('background-color: #3b82f6');
    expect(bars[0]).toHaveStyle('background-color: #334155');
  });
});
