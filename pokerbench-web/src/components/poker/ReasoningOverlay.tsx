import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ReasoningOverlayProps {
  thought: string;
  isVisible: boolean;
  playerName?: string;
  currentCharIndex?: number;
}


export default function ReasoningOverlay({ thought, isVisible, playerName, currentCharIndex = 0 }: ReasoningOverlayProps) {
  // Logic to split text into chunks of ~2 lines
  // This is a heuristic: split by sentences and then group them
  const chunks = React.useMemo(() => {
    if (!thought) return [];

    // Split into sentences (simple regex)
    const sentences = thought.match(/[^.!?]+[.!?]+(?:\s|$)/g) || [thought];

    const result: { text: string; start: number; end: number }[] = [];
    let currentText = '';
    let currentStart = 0;

    for (let i = 0; i < sentences.length; i++) {
      const s = sentences[i];
      const nextText = currentText + s;

      // If nextText is too long (roughly > 350 chars for 2 lines CC style with wider box), push current and start new
      if (nextText.length > 350 && currentText.length > 0) {
        result.push({
          text: currentText.trim(),
          start: currentStart,
          end: currentStart + currentText.length
        });
        currentStart += currentText.length;
        currentText = s;
      } else {
        currentText += s;
      }
    }

    // Push last chunk
    if (currentText) {
      result.push({
        text: currentText.trim(),
        start: currentStart,
        end: thought.length
      });
    }

    return result;
  }, [thought]);

  const currentChunk = chunks.find(c => currentCharIndex >= c.start && currentCharIndex <= c.end) || chunks[0];

  return (
    <AnimatePresence mode="wait">
      {isVisible && thought && (
        <motion.div
          key={currentChunk?.text} // Key on text to trigger animation between chunks
          initial={{ opacity: 0, y: -10, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 10, x: '-50%' }}
          className="cc-overlay"
        >

          <div className="cc-text">
            {currentChunk?.text || thought}
          </div>
        </motion.div>

      )}
    </AnimatePresence>
  );
}
