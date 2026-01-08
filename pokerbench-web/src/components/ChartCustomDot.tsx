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
    const r = 12;
    const shiftedCx = cx + r;
    
    return (
      <g style={{ pointerEvents: 'none' }}>
        <defs>
          <filter id="pb-logo-blacken">
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0"
            />
          </filter>
        </defs>
        {/* White background circle to make logo pop */}
        <circle cx={shiftedCx} cy={cy} r={r} fill="white" stroke={stroke} strokeWidth={2} />
        {/* The SVG Logo - using native SVG filter for best z-index support */}
        <image 
          x={shiftedCx - offset} 
          y={cy - offset} 
          width={size} 
          height={size} 
          href={config.logo}
          filter={config.logoInvert ? 'url(#pb-logo-blacken)' : 'none'}
        />
      </g>
    );
  }

  // Fallback if no logo found
  const r = 6;
  const shiftedCx = cx + r;
  return (
    <circle cx={shiftedCx} cy={cy} r={r} fill="white" stroke={stroke} strokeWidth={2} style={{ pointerEvents: 'none' }} />
  );
};
