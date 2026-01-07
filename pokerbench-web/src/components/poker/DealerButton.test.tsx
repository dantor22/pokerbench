import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DealerButton from './DealerButton';

// Mock Text from Drei
vi.mock('@react-three/drei', () => ({
  Text: ({ children }: any) => <div data-testid="text">{children}</div>,
}));

describe('DealerButton', () => {
  it('renders the dealer button text', () => {
    render(<DealerButton position={[0, 0, 0]} />);
    expect(screen.getByText('DEALER')).toBeInTheDocument();
  });

  it('renders the correct geometry', () => {
    const { container } = render(<DealerButton position={[0, 0, 0]} />);
    expect(container.querySelector('cylinderGeometry')).toBeInTheDocument();
    expect(container.querySelector('ringGeometry')).toBeInTheDocument();
  });
});
