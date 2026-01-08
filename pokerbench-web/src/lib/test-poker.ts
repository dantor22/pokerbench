import { Action, CardGroup, OddsCalculator } from 'poker-odds-calc';

const player1Cards = CardGroup.fromString('AhAd');
const player2Cards = CardGroup.fromString('KsKh');
const board = CardGroup.fromString('7h8h9h');

const result = OddsCalculator.calculate([player1Cards, player2Cards], board);

console.log(`Player 1 Win: ${result.getEquity(0)}%`);
console.log(`Player 2 Win: ${result.getEquity(1)}%`);
console.log(`Tie: ${result.getTiePercentage()}%`);
