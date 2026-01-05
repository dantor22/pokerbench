import { MODEL_CONFIG } from '../lib/constants';

export const ChartCustomDot = (props: any) => {
  const { cx, cy, stroke, index, lastPointIndex, modelName } = props;
  
  // Only render for the specified last point
  if (index !== lastPointIndex) return null;

  const config = MODEL_CONFIG[modelName] || { color: stroke, logo: '' };
  
  if (config.logo) {
    const scale = config.logoScale || 1;
    const size = 16 * scale;
    const offset = size / 2;
    
    return (
      <g>
        {/* White background circle to make logo pop */}
        <circle cx={cx} cy={cy} r={12} fill="white" stroke={stroke} strokeWidth={2} />
        {/* The SVG Logo */}
        <image 
          x={cx - offset} 
          y={cy - offset} 
          width={size} 
          height={size} 
          href={config.logo} 
          style={{ 
            pointerEvents: 'none',
            filter: config.logoInvert ? 'invert(1)' : 'none'
          }}
        />
      </g>
    );
  }

  // Fallback if no logo found
  return (
    <circle cx={cx} cy={cy} r={6} fill="white" stroke={stroke} strokeWidth={2} />
  );
};
