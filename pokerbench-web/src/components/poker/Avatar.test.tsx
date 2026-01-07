import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Avatar from './Avatar';

// Mock R3F and Drei
vi.mock('@react-three/fiber', () => ({
  useFrame: vi.fn(),
}));

vi.mock('@react-three/drei', () => ({
  useTexture: () => ({ name: 'mocked-texture' }),
  Decal: ({ children }: any) => <div data-testid="decal">{children}</div>,
}));

describe('Avatar', () => {
  it('renders a sphere for the head', () => {
    const { container } = render(<Avatar name="Pro" isActive={true} isAction={false} isDealer={false} />);
    // Sphere geometry should be present
    expect(container.querySelector('sphereGeometry')).toBeInTheDocument();
  });

  it('renders a decal when a known model name is provided', () => {
    const { getAllByTestId } = render(<Avatar name="Gemini" isActive={true} isAction={false} isDealer={false} />);
    // Avatar.tsx maps "Gemini" to a logo and renders 3 decals
    expect(getAllByTestId('decal')).toHaveLength(3);
  });

  it('renders a torus for the action indicator when isAction is true', () => {
    const { getByTestId } = render(<Avatar name="Pro" isActive={true} isAction={true} isDealer={false} />);
    expect(getByTestId('action-halo')).toBeInTheDocument();
  });

  it('does not render the action halo when isAction is false', () => {
    const { queryByTestId } = render(<Avatar name="Pro" isActive={true} isAction={false} isDealer={false} />);
    expect(queryByTestId('action-halo')).not.toBeInTheDocument();
  });
});
