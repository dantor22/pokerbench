import { Hand } from '../lib/types';
import { useMemo } from 'react';

interface GameTimelineProps {
  hands: Hand[];
  currentHandIndex: number;
  onHandSelect: (index: number) => void;
}

export default function GameTimeline({ hands, currentHandIndex, onHandSelect }: GameTimelineProps) {
  // Calculate max pot for scaling
  const maxPot = useMemo(() => {
    return Math.max(...hands.map(h => {
      return h.actions.reduce((max, a) => Math.max(max, a.pot_before || 0), 0);
    }));
  }, [hands]);

  return (
    <div className="card mb-0" style={{ width: '100%', maxWidth: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <h3 className="text-sm font-bold mb-2 text-muted uppercase" style={{ letterSpacing: '0.05em' }}>Game Timeline</h3>
      <div style={{ overflowX: 'auto', width: '100%', paddingBottom: '0.5rem' }}>
        <div className="flex items-end gap-1 pt-4 pb-2" style={{ height: '128px', minWidth: '100%' }}>
          {hands.map((hand, index) => {
            // Estimate pot for this hand
            const pot = hand.actions.reduce((max, a) => Math.max(max, a.pot_before || 0), 0);
            const heightPercent = maxPot > 0 ? (pot / maxPot) * 100 : 0;
            const isSelected = index === currentHandIndex;

            return (
              <button
                key={hand.hand_number}
                onClick={() => onHandSelect(index)}
                className="relative"
                style={{
                  flex: 1, minWidth: '8px',
                  height: `${Math.max(10, heightPercent)}%`,
                  backgroundColor: isSelected ? '#3b82f6' : '#334155',
                  borderTopLeftRadius: '2px', borderTopRightRadius: '2px',
                  transition: 'background-color 0.2s'
                }}
                title={`Hand #${hand.hand_number} - Pot: ~${pot}`}
              >
                {pot > maxPot * 0.7 && (
                  <div style={{
                    position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
                    width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#facc15',
                    boxShadow: '0 0 8px rgba(250,204,21,0.8)'
                  }} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
