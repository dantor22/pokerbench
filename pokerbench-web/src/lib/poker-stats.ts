import { Game, Hand } from './types';

export interface PlayerGameStats {
  vpip: number;
  pfr: number;
  three_bet: number;
  c_bet: number;
  vpipCount: number;
  vpipOpp: number;
  pfrCount: number;
  pfrOpp: number;
  threeBetCount: number;
  threeBetOpp: number;
  cBetCount: number;
  cBetOpp: number;
}

export function calculateGameStats(game: Game, currentHandIndex?: number): Record<string, PlayerGameStats> {
  const playerStats: Record<string, {
    vpipCount: number; vpipOpp: number;
    pfrCount: number; pfrOpp: number;
    threeBetCount: number; threeBetOpp: number;
    cBetCount: number; cBetOpp: number;
  }> = {};

  game.players.forEach(p => {
    playerStats[p] = {
      vpipCount: 0, vpipOpp: 0,
      pfrCount: 0, pfrOpp: 0,
      threeBetCount: 0, threeBetOpp: 0,
      cBetCount: 0, cBetOpp: 0
    };
  });

  const handsToProcess = currentHandIndex !== undefined
    ? game.hands.slice(0, currentHandIndex + 1)
    : game.hands;

  handsToProcess.forEach(hand => {
    const players = Object.keys(hand.pre_hand_stacks || {});
    players.forEach(p => {
      if (!playerStats[p]) return;
      playerStats[p].vpipOpp++;
      playerStats[p].pfrOpp++;
    });

    let street = 'PRE-FLOP';
    let pfrAggressor: string | null = null;
    let preflopRaises = 0;
    const foldedPlayers = new Set<string>();
    const vpiped = new Set<string>();
    const pfred = new Set<string>();
    const threeBeted = new Set<string>();
    const threeBetOpps = new Set<string>();
    const cBeted = new Set<string>();
    const cBetOpps = new Set<string>();

    for (const action of hand.actions) {
      if (action.type === 'street_event') {
        street = action.street || 'PRE-FLOP';
        if (street === 'FLOP' && pfrAggressor) {
          cBetOpps.add(pfrAggressor);
        }
        continue;
      }

      if (action.type === 'player_action') {
        const p = action.player!;
        if (street === 'PRE-FLOP') {
          if (action.action === 'call') {
            vpiped.add(p);
          } else if (action.action === 'raise') {
            vpiped.add(p);
            pfred.add(p);
            preflopRaises++;
            pfrAggressor = p;
            if (preflopRaises === 1) {
              players.forEach(pl => {
                if (pl !== p && !foldedPlayers.has(pl)) {
                  threeBetOpps.add(pl);
                }
              });
            } else if (preflopRaises === 2) {
              threeBeted.add(p);
            }
          } else if (action.action === 'fold') {
            foldedPlayers.add(p);
          }
        } else if (street === 'FLOP') {
          if (p === pfrAggressor && (action.action === 'bet' || action.action === 'raise')) {
            if (cBetOpps.has(p)) {
              cBeted.add(p);
            }
          }
        }
      }
    }

    vpiped.forEach(p => playerStats[p].vpipCount++);
    pfred.forEach(p => playerStats[p].pfrCount++);
    threeBeted.forEach(p => playerStats[p].threeBetCount++);
    threeBetOpps.forEach(p => playerStats[p].threeBetOpp++);
    cBeted.forEach(p => playerStats[p].cBetCount++);
    cBetOpps.forEach(p => playerStats[p].cBetOpp++);
  });

  const finalStats: Record<string, PlayerGameStats> = {};
  Object.keys(playerStats).forEach(p => {
    const s = playerStats[p];
    finalStats[p] = {
      ...s,
      vpip: s.vpipOpp > 0 ? (s.vpipCount / s.vpipOpp) * 100 : 0,
      pfr: s.pfrOpp > 0 ? (s.pfrCount / s.pfrOpp) * 100 : 0,
      three_bet: s.threeBetOpp > 0 ? (s.threeBetCount / s.threeBetOpp) * 100 : 0,
      c_bet: s.cBetOpp > 0 ? (s.cBetCount / s.cBetOpp) * 100 : 0
    };
  });

  return finalStats;
}
