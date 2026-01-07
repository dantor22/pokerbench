import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Table from './Table';

// Mock Text from Drei
vi.mock('@react-three/drei', () => ({
  useTexture: () => ({ name: 'mocked-texture' }),
  Text: ({ children }: any) => <div data-testid="text">{children}</div>,
}));

describe('Table', () => {
  it('renders the core table geometries', () => {
    const { container } = render(<Table />);
    // Central felt area
    expect(container.querySelector('circleGeometry')).toBeInTheDocument();
    // Racetrack
    expect(container.querySelectorAll('ringGeometry').length).toBeGreaterThan(0);
    // Rail
    expect(container.querySelector('torusGeometry')).toBeInTheDocument();
  });

  it('renders the watermark text on the felt', () => {
    render(<Table />);
    // CurvedText splits string into letters.
    // In Table.tsx: text="pokerbench.adfontes.io" (2 calls)
    // Each string has 2 'p's (one in poker, one in .adfontes.io - wait no, only one 'p' in "pokerbench.adfontes.io")
    expect(screen.getAllByText('p')).toHaveLength(2);
    expect(screen.getAllByText('.')).toHaveLength(4); // 2 dots per string, 2 strings = 4
  });

  it('renders the table base', () => {
    const { container } = render(<Table />);
    expect(container.querySelectorAll('cylinderGeometry').length).toBeGreaterThan(0);
  });
});
