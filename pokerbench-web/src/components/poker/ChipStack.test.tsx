import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ChipStack from './ChipStack';

// Mock Text from Drei
vi.mock('@react-three/drei', () => ({
  Text: ({ children }: any) => <div data-testid="text">{children}</div>,
}));

describe('ChipStack', () => {
  it('renders nothing if amount is 0', () => {
    const { container } = render(<ChipStack amount={0} position={[0, 0, 0]} />);
    expect(container.firstChild).toBeNull();
  });

  it('calculates chip piles correctly for a given amount', () => {
    // 1000 + 500 + 5 = 1505
    render(<ChipStack amount={1505} position={[0, 0, 0]} />);
    
    // There should be a 1000, 500, and 5 chip
    expect(screen.getByText('1000')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders multiple chips for larger amounts', () => {
    // 2 chips of 1000
    render(<ChipStack amount={2000} position={[0, 0, 0]} />);
    expect(screen.getAllByText('1000')).toHaveLength(2);
  });
});
