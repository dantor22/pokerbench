import { TexasHoldem } from 'poker-odds-calc';

/**
 * Normalizes card strings from formats like "KING OF DIAMONDS (Kd)" to "Kd".
 */
export function normalizeCard(card: string): string {
  if (card.includes('(')) {
    return card.split('(')[1]?.replace(')', '') || card;
  }
  return card;
}

/**
 * Calculates the win probability (equity) for each active player.
 * @param players List of players with their current hand and active status.
 * @param board Current board cards.
 * @returns An array of probabilities (0-100) or null for each player.
 */
export function calculateWinProbabilities(
  players: { cards: string[]; isActive: boolean }[],
  board: string[]
): (number | null)[] {
  try {
    const table = new TexasHoldem();
    let activePlayerCount = 0;

    // Filter players who have a full hand (2 cards) and are active
    const activeWithCards = players.map((p, index) => ({
      ...p,
      originalIndex: index
    })).filter(p => p.isActive && p.cards.length === 2);

    if (activeWithCards.length < 2) {
      return players.map(() => null);
    }

    activeWithCards.forEach(p => {
      const normalizedCards = p.cards.map(normalizeCard);
      table.addPlayer(normalizedCards as any);
    });

    if (board.length > 0) {
      const normalizedBoard = board.map(normalizeCard);
      table.setBoard(normalizedBoard);
    }

    const result = table.calculate();
    const resultPlayers = result.getPlayers();

    const equities: (number | null)[] = players.map(() => null);

    activeWithCards.forEach((p, i) => {
      const playerResult = resultPlayers[i];
      if (playerResult) {
        equities[p.originalIndex] = playerResult.getWinsPercentage();
      }
    });

    return equities;
  } catch (error) {
    console.error('Error calculating win probabilities:', error);
    return players.map(() => null);
  }
}
