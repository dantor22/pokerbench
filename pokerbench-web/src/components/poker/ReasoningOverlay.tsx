import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ReasoningOverlayProps {
  thought: string;
  isVisible: boolean;
  playerName?: string;
}

export default function ReasoningOverlay({ thought, isVisible, playerName }: ReasoningOverlayProps) {
  return (
    <AnimatePresence>
      {isVisible && thought && (
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 50 }}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            width: '380px',
            maxHeight: '80%',
            backgroundColor: 'rgba(0, 0, 0, 0.98)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '2px solid rgba(255, 255, 255, 0.4)',
            borderRadius: '1.5rem',
            padding: '1.5rem',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
            zIndex: 1000,
            overflowY: 'auto',
            pointerEvents: 'none'
          }}
        >
          <div style={{
            color: '#f59e0b',
            fontSize: '10px',
            fontWeight: '900',
            marginBottom: '0.75rem',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              backgroundColor: '#f59e0b',
              borderRadius: '50%',
              boxShadow: '0 0 8px #f59e0b'
            }} />
            AI THINKING {playerName ? `(${playerName})` : ''}...
          </div>
          <div style={{ 
            color: 'white', 
            lineHeight: '1.6',
            fontSize: '15px',
            fontWeight: '600',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
          }}>
            {thought}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
