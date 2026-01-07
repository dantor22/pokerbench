import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ChartCustomDot } from './ChartCustomDot';

describe('ChartCustomDot', () => {
  const defaultProps = {
    cx: 100,
    cy: 100,
    stroke: '#3b82f6',
    index: 5,
    lastPointIndex: 5,
    modelName: 'Pro'
  };

  it('renders a logo for a known model at the last point', () => {
    const { container } = render(<svg><ChartCustomDot {...defaultProps} /></svg>);
    // Should render an <image> tag for 'Pro' (Gemini)
    const image = container.querySelector('image');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('href', '/logos/gemini_2025.svg');
    
    // Should have white circle background
    const circle = container.querySelector('circle');
    expect(circle).toBeInTheDocument();
    expect(circle).toHaveAttribute('fill', 'white');
  });

  it('returns null if index is not lastPointIndex', () => {
    const props = { ...defaultProps, index: 4 };
    const { container } = render(<svg><ChartCustomDot {...props} /></svg>);
    expect(container.querySelector('g')).toBeNull();
    expect(container.querySelector('circle')).toBeNull();
  });

  it('renders a simple circle if model is unknown', () => {
    const props = { ...defaultProps, modelName: 'Unknown' };
    const { container } = render(<svg><ChartCustomDot {...props} /></svg>);
    const circle = container.querySelector('circle');
    expect(circle).toBeInTheDocument();
    expect(circle).toHaveAttribute('fill', 'white');
    expect(container.querySelector('image')).toBeNull();
  });
});
