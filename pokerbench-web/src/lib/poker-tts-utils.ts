/**
 * Transforms poker thoughts into natural terminology for text-to-speech.
 * Examples:
 * - 32o -> three two offsuit
 * - 52 offsuit -> five two offsuit
 * - Tc 8c -> ten c, 8 c
 * - 8s -> 8 s
 * - 3bb -> 3 big blinds
 * - Q4s -> queen four suited
 */
export function transformPokerThoughts(thought: string): string {
  if (!thought) return '';

  const rankMap: Record<string, string> = {
    'T': 'ten',
    'J': 'jack',
    'Q': 'queen',
    'K': 'king',
    'A': 'ace'
  };

  const pluralRankMap: Record<string, string> = {
    'T': 'tens',
    'J': 'jacks',
    'Q': 'queens',
    'K': 'kings',
    'A': 'aces'
  };

  const suitMap: Record<string, string> = {
    'c': 'c',
    'd': 'd',
    'h': 'h',
    's': 's',
    '♣': 'c',
    '♦': 'd',
    '♥': 'h',
    '♠': 's'
  };

  let processed = thought;

  // 0. Pre-processing: Unicode suits and multiplier notation
  processed = processed.replace(/[♣♦♥♠]/g, (match) => suitMap[match] || match);

  processed = processed.replace(/(\d+(?:\.\d+)?)xBB/gi, (match, amount) => {
    return `${amount} times the big blind`;
  });

  // 0.1 Identify and separate joined cards like "Ad7c7d"
  const joinedCardRegex = /([2-9TJQKA])([cdhs])(?=[2-9TJQKA][cdhs])/gi;
  processed = processed.replace(joinedCardRegex, '$1$2 ');
  // Run twice if needed for triple overlaps
  processed = processed.replace(joinedCardRegex, '$1$2 ');

  // 1. Hand notation: e.g., 32o, 52o, T9s, AKo, Q4s
  // Pattern: [2-9TJQKA][2-9TJQKA][os]
  processed = processed.replace(/\b([2-9TJQKA])([2-9TJQKA])([os])\b/g, (match, r1, r2, suitType) => {
    const rank1 = rankMap[r1] || r1;
    const rank2 = rankMap[r2] || r2;
    const type = suitType === 's' ? 'suited' : 'offsuit';
    return `${rank1} ${rank2} ${type}`;
  });

  // 2. Hand notation with explicit "offsuit": e.g., 52 offsuit, T9 suited
  // Pattern: [2-9TJQKA]{2} (offsuit|suited)
  processed = processed.replace(/\b([2-9TJQKA])([2-9TJQKA])\s+(offsuit|suited)\b/gi, (match, r1, r2, type) => {
    const rank1 = rankMap[r1] || r1;
    const rank2 = rankMap[r2] || r2;
    return `${rank1} ${rank2} ${type.toLowerCase()}`;
  });

  // 3. Card notation: e.g., Tc, 8c, Ad, Kh, 2s
  // Pattern: [2-9TJQKA][cdhs]
  // We want to turn "Tc 8c" into "ten c, 8 c"
  processed = processed.replace(/\b([2-9TJQKA])([cdhs])\b/g, (match, r, s) => {
    const rank = rankMap[r] || r;
    const suit = suitMap[s] || s;
    return `${rank} ${suit}`;
  });

  // 3.1 Support rank ranges: Ax, Kx, TT+, AK+
  processed = processed.replace(/\b([2-9TJQKA])x\b/gi, (match, r) => {
    const rank = rankMap[r] || r;
    return `${rank} x`;
  });

  processed = processed.replace(/\b([2-9TJQKA]{1,2})\+(?!\w)/gi, (match, rr) => {
    if (rr.length === 2 && rr[0] === rr[1]) {
      const rankPlural = pluralRankMap[rr[0]] || (rr[0] + 's');
      return `${rankPlural} plus`;
    }
    const r1 = rankMap[rr[0]] || rr[0];
    const r2 = rr[1] ? (rankMap[rr[1]] || rr[1]) : '';
    return `${r1}${r2 ? ' ' + r2 : ''} plus`;
  });

  // 3.2 Prevent redundant "suited suited" (happens if input was "K8s suited")
  processed = processed.replace(/\b(suited|offsuit)\s+(suited|offsuit)\b/gi, '$1');

  // 4. Add commas between consecutive card/hand notations
  // This looks for something that looks like a card/hand "unit" followed by another one.
  // Units are: 
  // - "rank suit" (e.g., "ten c")
  // - "rank rank suited/offsuit" (e.g., "queen 4 suited")

  const rankPattern = '(?:ten|jack|queen|king|ace|[2-9])';
  const rankPluralPattern = '(?:tens|jacks|queens|kings|aces|[2-9]s)';
  const suitPattern = '(?:c|d|h|s)';

  const cardUnit = `(?:${rankPattern}\\s+${suitPattern})`;
  const handUnit = `(?:${rankPattern}\\s+${rankPattern}\\s+(?:suited|offsuit))`;
  const rangeUnit = `(?:(?:${rankPattern}\\s+${rankPattern}|${rankPattern}|${rankPluralPattern})\\s+plus)`;
  const anyUnit = `(?:${cardUnit}|${handUnit}|${rangeUnit})`;

  const unitRegex = new RegExp(`(${anyUnit})\\s+(${anyUnit})`, 'g');

  // Apply twice to handle overlapping units like "Tc 8c 4d"
  processed = processed.replace(unitRegex, '$1, $2');
  processed = processed.replace(unitRegex, '$1, $2');

  // 5. Big Blinds: e.g., 3bb, 10bb
  // Pattern: \d+bb
  processed = processed.replace(/\b(\d+)bb\b/gi, (match, amount) => {
    return `${amount} big blinds`;
  });

  return processed;
}
