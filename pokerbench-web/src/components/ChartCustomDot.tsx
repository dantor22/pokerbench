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
        {/* White background circle to make logo pop */}
        <circle cx={shiftedCx} cy={cy} r={r} fill="white" stroke={stroke} strokeWidth={2} />
        {/* Use foreignObject and img for better filter support on mobile Safari */}
        <foreignObject 
          x={shiftedCx - offset} 
          y={cy - offset} 
          width={size} 
          height={size}
        >
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <img
              src={config.logo}
              alt=""
              style={{ 
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                filter: config.logoInvert ? 'brightness(0)' : 'none',
                WebkitFilter: config.logoInvert ? 'brightness(0)' : 'none'
              }}
            />
          </div>
        </foreignObject>
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
