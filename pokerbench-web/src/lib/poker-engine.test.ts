import { describe, it, expect } from 'vitest';
import { calculateWinProbabilities, normalizeCard } from './poker-engine';

describe('normalizeCard', () => {
  it('should normalize full card names', () => {
    expect(normalizeCard('KING OF DIAMONDS (Kd)')).toBe('Kd');
    expect(normalizeCard('ACE OF SPADES (As)')).toBe('As');
    expect(normalizeCard('TEN OF CLUBS (Tc)')).toBe('Tc');
  });

  it('should handle already normalized codes', () => {
    expect(normalizeCard('Kd')).toBe('Kd');
    expect(normalizeCard('As')).toBe('As');
  });

  it('should handle cards without parentheses', () => {
    expect(normalizeCard('King of Hearts Jh')).toBe('King of Hearts Jh'); // Just returns as is if no (
  });
});

describe('calculateWinProbabilities', () => {
  it('should calculate basic equity: AA vs KK pre-flop', () => {
    const players = [
      { cards: ['Ah', 'Ad'], isActive: true },
      { cards: ['Kh', 'Kd'], isActive: true },
    ];
    const board: string[] = [];

    const equities = calculateWinProbabilities(players, board);

    expect(equities[0]).toBeGreaterThan(80);
    expect(equities[1]).toBeLessThan(20);
  });

  it('should return null for folded players', () => {
    const players = [
      { cards: ['Ah', 'Ad'], isActive: true },
      { cards: ['7h', '2d'], isActive: false },
      { cards: ['Kh', 'Kd'], isActive: true },
    ];
    const board: string[] = [];

    const equities = calculateWinProbabilities(players, board);

    expect(equities[0]).toBeGreaterThan(80);
    expect(equities[1]).toBeNull();
    expect(equities[2]).toBeLessThan(20);
  });

  it('should calculate flop equity: flush draw vs top pair', () => {
    const players = [
      { cards: ['Ah', '2h'], isActive: true }, // Nut flush draw
      { cards: ['Ks', 'Qd'], isActive: true }, // Top pair
    ];
    const board = ['Kh', '8h', '2s'];

    const equities = calculateWinProbabilities(players, board);

    // flush draw + bottom pair has decent equity (~48%)
    expect(equities[0]).toBeGreaterThan(45);
    expect(equities[1]).toBeGreaterThan(45);
  });

  it('should return nulls if fewer than 2 active players with cards', () => {
    const players = [
      { cards: ['Ah', 'Ad'], isActive: true },
      { cards: ['Kh', 'Kd'], isActive: false },
    ];
    const board: string[] = [];

    const equities = calculateWinProbabilities(players, board);

    expect(equities).toEqual([null, null]);
  });


  it('should handle full card names format', () => {
    const players = [
      { cards: ['ACE OF SPADES (As)', 'ACE OF HEARTS (Ah)'], isActive: true },
      { cards: ['KING OF DIAMONDS (Kd)', 'KING OF CLUBS (Kc)'], isActive: true }
    ];

    const equities = calculateWinProbabilities(players, []);

    expect(equities[0]).toBeGreaterThan(80);
    expect(equities[1]).toBeLessThan(20);
  });
});
