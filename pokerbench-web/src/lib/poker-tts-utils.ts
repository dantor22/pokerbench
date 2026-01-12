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
    'c': 'clubs',
    'd': 'diamonds',
    'h': 'hearts',
    's': 'spades'
  };

  let processed = thought;

  // 0. Pre-processing: Unicode suits, hyphens, and multiplier notation
  const unicodeToLetter: Record<string, string> = { '♣': 'c', '♦': 'd', '♥': 'h', '♠': 's' };
  processed = processed.replace(/[♣♦♥♠]/g, (match) => unicodeToLetter[match] || match);

  // 0.1 Handle hyphenated ranks (e.g., A-J-J -> ace jack jack, K-Q -> king queen)
  // Must be done before hyphen normalization
  processed = processed.replace(/\b([2-9TJQKA])(?:-([2-9TJQKA]))+\b/g, (match) => {
    return match.split('-').map(r => rankMap[r] || r).join(' ');
  });

  // Normalize hyphens to spaces (e.g., Jd-As-Js -> Jd As Js)
  processed = processed.replace(/-/g, ' ');

  // 0.2 Handle bare rank pairs (e.g., AJ -> ace jack, KQ -> king queen)
  // Only matches 2 capitalized ranks. Avoids "At" (word) since T is capitalized.
  // Also avoids if followed by "s", "o", "suited", "offsuit", "+", "%", or units like "bb"/"big blind"
  // Note: '+' and '%' are not word chars, so \b won't work after them if followed by space/end.
  // Also looks behind to avoid matching hashtags (e.g., #87)
  processed = processed.replace(/(?<!#)\b([2-9TJQKA])([2-9TJQKA])\b(?!\s*(?:s\b|o\b|suited\b|offsuit\b|\+|%|bb\b|bbs\b|big\s+blind))/gi, (match, r1, r2) => {
    // Basic check for things that look like words (though regex requires digits/uppercase)
    if (match === 'AT' && processed.includes('AT&T')) return match;

    // We only want to match strict Uppercase/Digit for the ranks themselves to avoid "At"
    if (!r1.match(/[2-9TJQKA]/) || !r2.match(/[2-9TJQKA]/)) return match;

    const rank1 = rankMap[r1] || r1;
    const rank2 = rankMap[r2] || r2;
    return `${rank1} ${rank2}`;
  });

  processed = processed.replace(/(\b\d+(?:\.\d+)?|\b)xBB/gi, (match, amount) => {
    return `${amount || ''} times the big blind`;
  });

  // 0.1 Identify and separate joined cards like "Ad7c7d"
  // Case sensitive rank to avoid matching "ac" in "Jacks"
  const joinedCardRegex = /([2-9TJQKA])([cdhs])(?=[2-9TJQKA][cdhs])/g;
  processed = processed.replace(joinedCardRegex, '$1$2 ');
  // Run twice if needed for triple overlaps
  processed = processed.replace(joinedCardRegex, '$1$2 ');

  // 1. Hand notation: e.g., 32o, 52o, T9s, AKo, Q4s
  // Case sensitive rank to avoid matching words
  processed = processed.replace(/\b([2-9TJQKA])([2-9TJQKA])([os])\b/g, (match, r1, r2, suitType) => {
    const rank1 = rankMap[r1] || r1;
    const rank2 = rankMap[r2] || r2;
    const type = suitType === 's' ? 'suited' : 'offsuit';
    return `${rank1} ${rank2} ${type}`;
  });

  // 2. Hand notation with explicit "offsuit": e.g., 52 offsuit, T9 suited
  processed = processed.replace(/\b([2-9TJQKA])([2-9TJQKA])\s+(offsuit|suited)\b/gi, (match, r1, r2, type) => {
    // Only transform if ranks are uppercase or digits
    if (!r1.match(/[2-9TJQKA]/) || !r2.match(/[2-9TJQKA]/)) return match;
    const rank1 = rankMap[r1] || r1;
    const rank2 = rankMap[r2] || r2;
    return `${rank1} ${rank2} ${type.toLowerCase()}`;
  });

  // 3. Card notation: e.g., Tc, 8c, Ad, Kh, 2s
  // Case sensitive rank to avoid matching words like "As" or "In" (if n was a suit)
  processed = processed.replace(/\b([2-9TJQKA])([cdhs])\b/g, (match, r, s, offset) => {
    // Special protection for the word "As" (capital A followed by space and lowercase word)
    if (match === 'As') {
      const rest = processed.substring(offset + match.length);
      if (rest.match(/^\s+[a-z]/)) {
        return match;
      }
    }

    const rank = rankMap[r] || r;
    const suit = suitMap[s] || s;
    return `${rank} of ${suit}`;
  });

  // 3.1 Support rank ranges: Ax, Kx, TT+, AK+
  processed = processed.replace(/\b([2-9TJQKA])x\b/g, (match, r) => {
    const rank = rankMap[r] || r;
    return `${rank} ex`;
  });

  // General numeric multipliers: e.g., 3x, 5.5x
  processed = processed.replace(/\b(\d+(?:\.\d+)?)x\b/gi, '$1 ex');

  processed = processed.replace(/\b([2-9TJQKA]{1,2})\+(?!\w)/g, (match, rr) => {
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
  const suitPattern = '(?:clubs|diamonds|hearts|spades)';

  const cardUnit = `(?:${rankPattern}\\s+of\\s+${suitPattern})`;
  const handUnit = `(?:${rankPattern}\\s+${rankPattern}\\s+(?:suited|offsuit))`;
  const rangeUnit = `(?:(?:${rankPattern}\\s+${rankPattern}|${rankPattern}|${rankPluralPattern})\\s+plus)`;
  const anyUnit = `(?:${cardUnit}|${handUnit}|${rangeUnit})`;

  const unitRegex = new RegExp(`(${anyUnit})\\s+(${anyUnit})`, 'g');

  // Apply twice to handle overlapping units like "Tc 8c 4d"
  processed = processed.replace(unitRegex, '$1, $2');
  processed = processed.replace(unitRegex, '$1, $2');

  // 5. Big Blinds: e.g., 3bb, 10bb, bb, BBs
  processed = processed.replace(/\b(\d+)\s*(bb|bbs)\b/gi, (match, amount) => {
    if (amount === '1') return '1 big blind';
    return `${amount} big blinds`;
  });
  processed = processed.replace(/\b(bb|bbs)\b/gi, 'big blinds');

  return processed;
}
