import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Room from './Room';

// Mock Drei components
vi.mock('@react-three/drei', () => ({
  Environment: () => <div data-testid="environment" />,
  MeshReflectorMaterial: () => <div data-testid="mesh-reflector" />,
  Instance: () => <div data-testid="instance" />,
  Instances: ({ children }: any) => <div data-testid="instances">{children}</div>,
  Float: ({ children }: any) => <div data-testid="float">{children}</div>,
}));

// Set up JSDOM canvas mock for procedural textures
if (typeof document !== 'undefined') {
  const originalCreateElement = document.createElement.bind(document);
  document.createElement = vi.fn().mockImplementation((tagName) => {
    if (tagName === 'canvas') {
      return {
        getContext: () => ({
          fillRect: vi.fn(),
          beginPath: vi.fn(),
          arc: vi.fn(),
          fill: vi.fn(),
        }),
        width: 512,
        height: 512,
      };
    }
    return originalCreateElement(tagName);
  });
}

describe('Room', () => {
  it('renders the environment and lights', () => {
    const { container } = render(<Room />);
    expect(container.querySelector('ambientLight')).toBeInTheDocument();
    expect(container.querySelector('spotLight')).toBeInTheDocument();
  });

  it('renders architecture components (pillars, floor)', () => {
    const { container } = render(<Room />);
    // Pillars use cylinderGeometry and boxGeometry
    expect(container.querySelectorAll('cylinderGeometry').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('boxGeometry').length).toBeGreaterThan(0);
  });

  it('renders decor (chandeliers) by default', () => {
    const { getByTestId } = render(<Room />);
    expect(getByTestId('float')).toBeInTheDocument();
  });

  it('hides decor (chandeliers) in YouTube mode', () => {
    const { queryByTestId } = render(<Room isYouTubeMode={true} />);
    expect(queryByTestId('float')).not.toBeInTheDocument();
  });
});
