import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Card from './Card';

// Mock Drei Text
vi.mock('@react-three/drei', () => ({
  Text: ({ children, position }: any) => <div data-testid="text" data-position={JSON.stringify(position)}>{children}</div>,
}));

describe('Card', () => {
  it('renders rank and suit symbol', () => {
    // Proptype card="Ah"
    render(<Card card="Ah" position={[0, 0, 0]} />);
    
    // Should render A (rank) and ♥ (symbol)
    expect(screen.getAllByText('A')).toHaveLength(2); // Top left and bottom right
    expect(screen.getByText('♥')).toBeInTheDocument();
  });

  it('parses long card names correctly', () => {
    render(<Card card="ACE OF HEARTS (Ah)" position={[0, 0, 0]} />);
    expect(screen.getAllByText('A')).toHaveLength(2);
    expect(screen.getByText('♥')).toBeInTheDocument();
  });

  it('renders card body (extrudeGeometry)', () => {
    const { container } = render(<Card card="Td" position={[0, 0, 0]} />);
    expect(container.querySelector('extrudeGeometry')).toBeInTheDocument();
  });
});
