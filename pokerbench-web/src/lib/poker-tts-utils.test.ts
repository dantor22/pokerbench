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
    expect(transformPokerThoughts('Tc')).toBe('ten c');
    expect(transformPokerThoughts('8s')).toBe('8 s');
    expect(transformPokerThoughts('Ad')).toBe('ace d');
    expect(transformPokerThoughts('Kh')).toBe('king h');
  });

  test('adds commas between consecutive cards', () => {
    expect(transformPokerThoughts('Tc 8c')).toBe('ten c, 8 c');
    expect(transformPokerThoughts('As Kh Qd')).toBe('ace s, king h, queen d');
    expect(transformPokerThoughts('I have 8s 7s')).toBe('I have 8 s, 7 s');
  });

  test('transforms big blinds', () => {
    expect(transformPokerThoughts('3bb')).toBe('3 big blinds');
    expect(transformPokerThoughts('100bb')).toBe('100 big blinds');
  });

  test('handles complete sentences', () => {
    const input = "I have Tc 8c in the big blind with 20bb. The board is Q4s 2d. I think 32o is a fold.";
    const expected = "I have ten c, 8 c in the big blind with 20 big blinds. The board is queen 4 suited, 2 d. I think 3 2 offsuit is a fold.";
    expect(transformPokerThoughts(input)).toBe(expected);
  });

  test('transforms unicode suit symbols', () => {
    expect(transformPokerThoughts('9♣7♠')).toBe('9 c, 7 s');
    expect(transformPokerThoughts('A♦Q♥')).toBe('ace d, queen h');
  });

  test('handles joined card strings', () => {
    expect(transformPokerThoughts('Ad7c7d')).toBe('ace d, 7 c, 7 d');
    expect(transformPokerThoughts('Ks6c7s')).toBe('king s, 6 c, 7 s');
  });

  test('transforms rank ranges', () => {
    expect(transformPokerThoughts('Ax')).toBe('ace x');
    expect(transformPokerThoughts('Kx')).toBe('king x');
    expect(transformPokerThoughts('TT+')).toBe('tens plus');
    expect(transformPokerThoughts('JJ+')).toBe('jacks plus');
    expect(transformPokerThoughts('88+')).toBe('8s plus');
    expect(transformPokerThoughts('AQ+')).toBe('ace queen plus');
    expect(transformPokerThoughts('AK+')).toBe('ace king plus');
  });

  test('transforms multiplier notation', () => {
    expect(transformPokerThoughts('3xBB')).toBe('3 times the big blind');
    expect(transformPokerThoughts('2.5xBB')).toBe('2.5 times the big blind');
  });

  test('prevents redundant suited/offsuit', () => {
    expect(transformPokerThoughts('K8s suited')).toBe('king 8 suited');
    expect(transformPokerThoughts('AKo offsuit')).toBe('ace king offsuit');
  });

  test('handles casing for suited/offsuit', () => {
    expect(transformPokerThoughts('AK SUITED')).toBe('ace king suited');
    expect(transformPokerThoughts('QJ Offsuit')).toBe('queen jack offsuit');
  });

  test('returns empty string for empty input', () => {
    expect(transformPokerThoughts('')).toBe('');
  });
});
