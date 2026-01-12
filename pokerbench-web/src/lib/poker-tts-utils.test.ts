import { describe, test, expect } from 'vitest';
import { transformPokerThoughts } from './poker-tts-utils';

describe('transformPokerThoughts', () => {
  test('transforms basic hand notation', () => {
    expect(transformPokerThoughts('32o')).toBe('3 2 offsuit');
    expect(transformPokerThoughts('Q4s')).toBe('queen 4 suited');
    expect(transformPokerThoughts('AKo')).toBe('ace king offsuit');
    expect(transformPokerThoughts('T9s')).toBe('ten 9 suited');
  });

  test('transforms hand notation with explicit offsuit/suited', () => {
    expect(transformPokerThoughts('52 offsuit')).toBe('5 2 offsuit');
    expect(transformPokerThoughts('AK suited')).toBe('ace king suited');
  });

  test('transforms card notation', () => {
    expect(transformPokerThoughts('Tc')).toBe('ten of clubs');
    expect(transformPokerThoughts('8s')).toBe('8 of spades');
    expect(transformPokerThoughts('Ad')).toBe('ace of diamonds');
    expect(transformPokerThoughts('Kh')).toBe('king of hearts');
  });

  test('adds commas between consecutive cards', () => {
    expect(transformPokerThoughts('Tc 8c')).toBe('ten of clubs, 8 of clubs');
    expect(transformPokerThoughts('As Kh Qd')).toBe('ace of spades, king of hearts, queen of diamonds');
    expect(transformPokerThoughts('I have 8s 7s')).toBe('I have 8 of spades, 7 of spades');
  });

  test('transforms big blinds', () => {
    expect(transformPokerThoughts('3bb')).toBe('3 big blinds');
    expect(transformPokerThoughts('1bb')).toBe('1 big blind');
    expect(transformPokerThoughts('1 BB')).toBe('1 big blind');
    expect(transformPokerThoughts('0bb')).toBe('0 big blinds');
    expect(transformPokerThoughts('100bb')).toBe('100 big blinds');
    expect(transformPokerThoughts('20 BBs')).toBe('20 big blinds');
  });

  test('handles complete sentences', () => {
    const input = "I have Tc 8c in the big blind with 20bb. The board is Q4s 2d. I think 32o is a fold.";
    const expected = "I have ten of clubs, 8 of clubs in the big blind with 20 big blinds. The board is queen 4 suited, 2 of diamonds. I think 3 2 offsuit is a fold.";
    expect(transformPokerThoughts(input)).toBe(expected);
  });

  test('transforms unicode suit symbols', () => {
    expect(transformPokerThoughts('9♣7♠')).toBe('9 of clubs, 7 of spades');
    expect(transformPokerThoughts('A♦Q♥')).toBe('ace of diamonds, queen of hearts');
  });

  test('handles joined card strings', () => {
    expect(transformPokerThoughts('Ad7c7d')).toBe('ace of diamonds, 7 of clubs, 7 of diamonds');
    expect(transformPokerThoughts('Ks6c7s')).toBe('king of spades, 6 of clubs, 7 of spades');
  });

  test('transforms rank ranges', () => {
    expect(transformPokerThoughts('Ax')).toBe('ace ex');
    expect(transformPokerThoughts('Kx')).toBe('king ex');
    expect(transformPokerThoughts('TT+')).toBe('tens plus');
    expect(transformPokerThoughts('JJ+')).toBe('jacks plus');
    expect(transformPokerThoughts('88+')).toBe('8s plus');
    expect(transformPokerThoughts('AQ+')).toBe('ace queen plus');
    expect(transformPokerThoughts('AK+')).toBe('ace king plus');
  });

  test('transforms multiplier notation', () => {
    expect(transformPokerThoughts('3xBB')).toBe('3 times the big blind');
    expect(transformPokerThoughts('2.5xBB')).toBe('2.5 times the big blind');
    expect(transformPokerThoughts('xBB')).toBe(' times the big blind');
    expect(transformPokerThoughts('3x')).toBe('3 ex');
    expect(transformPokerThoughts('5.5x')).toBe('5.5 ex');
  });

  test('transforms standalone bb', () => {
    expect(transformPokerThoughts('bb')).toBe('big blinds');
    expect(transformPokerThoughts('I am in the bb.')).toBe('I am in the big blinds.');
    expect(transformPokerThoughts('BBs')).toBe('big blinds');
  });

  test('preserves whole words like Jacks', () => {
    expect(transformPokerThoughts('I have Jacks.')).toBe('I have Jacks.');
    expect(transformPokerThoughts('Queens are good.')).toBe('Queens are good.');
  });

  test('distinguishes As the word from Ace of Spades', () => {
    expect(transformPokerThoughts('As a result, I fold.')).toBe('As a result, I fold.');
    expect(transformPokerThoughts('I have As.')).toBe('I have ace of spades.');
    expect(transformPokerThoughts('My hand is AsKs.')).toBe('My hand is ace of spades, king of spades.');
    expect(transformPokerThoughts('As a result, the board is Jd-As-Js.')).toBe('As a result, the board is jack of diamonds, ace of spades, jack of spades.');
  });

  test('prevents redundant suited/offsuit', () => {
    expect(transformPokerThoughts('K8s suited')).toBe('king 8 suited');
    expect(transformPokerThoughts('AKo offsuit')).toBe('ace king offsuit');
  });

  test('handles casing for suited/offsuit', () => {
    expect(transformPokerThoughts('AK SUITED')).toBe('ace king suited');
    expect(transformPokerThoughts('QJ Offsuit')).toBe('queen jack offsuit');
  });

  test('handles hyphenated ranks and bare rank pairs', () => {
    expect(transformPokerThoughts('A-J-J')).toBe('ace jack jack');
    expect(transformPokerThoughts('K-Q')).toBe('king queen');
    expect(transformPokerThoughts('AJ')).toBe('ace jack');
    expect(transformPokerThoughts('KQ')).toBe('king queen');
    expect(transformPokerThoughts('AT')).toBe('ace ten');
    expect(transformPokerThoughts('At the table')).toBe('At the table'); // "At" should not be transformed
  });

  test('preserves percentages', () => {
    expect(transformPokerThoughts('25%')).toBe('25%');
    expect(transformPokerThoughts('100%')).toBe('100%');
    expect(transformPokerThoughts('Top 10% range')).toBe('Top 10% range');
  });

  test('preserves numbers before units', () => {
    expect(transformPokerThoughts('48 BB')).toBe('48 big blinds');
    expect(transformPokerThoughts('48 big blinds')).toBe('48 big blinds');
    expect(transformPokerThoughts('99 big blinds')).toBe('99 big blinds');
    expect(transformPokerThoughts('T9')).toBe('ten 9'); // Should still transform bare pair without unit
  });

  test('preserves hashtagged numbers', () => {
    expect(transformPokerThoughts('#87')).toBe('#87');
    expect(transformPokerThoughts('Hand #4')).toBe('Hand #4');
    expect(transformPokerThoughts('#25')).toBe('#25');
  });

  test('returns empty string for empty input', () => {
    expect(transformPokerThoughts('')).toBe('');
  });
});
