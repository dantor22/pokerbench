import { calculateWinProbabilities } from '../poker-engine';

self.onmessage = (e: MessageEvent) => {
  const { players, board } = e.data;
  
  try {
    const result = calculateWinProbabilities(players, board);
    self.postMessage({ type: 'success', result });
  } catch (error) {
    self.postMessage({ type: 'error', error: String(error) });
  }
};
