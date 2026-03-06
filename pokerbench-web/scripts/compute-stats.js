
const fs = require('fs');
const path = require('path');

function calculateHandStats(hand, playerStats) {
  const players = Object.keys(hand.pre_hand_stacks || {});
  players.forEach(p => {
    if (!playerStats[p]) {
      playerStats[p] = {
        vpipCount: 0, vpipOpp: 0,
        pfrCount: 0, pfrOpp: 0,
        threeBetCount: 0, threeBetOpp: 0,
        cBetCount: 0, cBetOpp: 0
      };
    }
    playerStats[p].vpipOpp++;
    playerStats[p].pfrOpp++;
  });

  let street = 'PRE-FLOP';
  let pfrAggressor = null;
  let preflopRaises = 0;
  const foldedPlayers = new Set();
  const vpiped = new Set();
  const pfred = new Set();
  const threeBeted = new Set();
  const threeBetOpps = new Set();
  const cBeted = new Set();
  const cBetOpps = new Set();

  for (const action of hand.actions) {
    if (action.type === 'street_event') {
      street = action.street;
      if (street === 'FLOP' && pfrAggressor) {
        cBetOpps.add(pfrAggressor);
      }
      continue;
    }

    if (action.type === 'player_action') {
      const p = action.player;
      if (street === 'PRE-FLOP') {
        if (action.action === 'call') {
          vpiped.add(p);
        } else if (action.action === 'raise') {
          vpiped.add(p);
          pfred.add(p);
          preflopRaises++;
          pfrAggressor = p;
          if (preflopRaises === 1) {
            // First raiser (2-bet). Everyone else still in who hasn't folded faces a raise.
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
}

function findGameFiles(dir, allFiles = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findGameFiles(fullPath, allFiles);
    } else if (entry.name.startsWith('game_') && entry.name.endsWith('.json')) {
      allFiles.push(fullPath);
    }
  }
  return allFiles;
}

function computeStats(runPath) {
  const summaryPath = path.join(runPath, 'summary.json');
  if (!fs.existsSync(summaryPath)) {
    console.warn(`No summary.json found in ${runPath}`);
    return null;
  }

  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  const gameFiles = findGameFiles(runPath);

  const profitsMap = {};
  const stacksMap = {};
  const finalRanksMap = {};
  const playerStatsMap = {};

  // Initialize maps
  if (summary.leaderboard) {
    summary.leaderboard.forEach(p => {
      profitsMap[p.name] = [];
      stacksMap[p.name] = [];
      finalRanksMap[p.name] = [];
    });
  }

  gameFiles.forEach(gamePath => {
    const gameFile = path.basename(gamePath);
    let game;
    try {
      game = JSON.parse(fs.readFileSync(gamePath, 'utf8'));
    } catch (e) {
      console.error(`Error reading ${gameFile}: ${e.message}`);
      return;
    }

    if (!game || !game.hands || game.hands.length === 0) return;

    const startStack = game.config.start_stack || 10000;
    const playersInGame = game.players;

    // Ensure players exist in maps
    playersInGame.forEach(p => {
      if (!profitsMap[p]) profitsMap[p] = [];
      if (!stacksMap[p]) stacksMap[p] = [];
      if (!finalRanksMap[p]) finalRanksMap[p] = [];
    });

    const gameStacks = {};
    playersInGame.forEach(p => {
      gameStacks[p] = [startStack];
    });

    game.hands.forEach(hand => {
      calculateHandStats(hand, playerStatsMap);
      playersInGame.forEach(p => {
        let res = null;
        if (hand.results) {
          res = hand.results.find(r => r.player === p);
        }

        const prevStack = gameStacks[p][gameStacks[p].length - 1];
        if (res) {
          const preStack = (hand.pre_hand_stacks && hand.pre_hand_stacks[p] !== undefined)
            ? hand.pre_hand_stacks[p]
            : prevStack;
          gameStacks[p].push(preStack + res.net_gain);
        } else {
          gameStacks[p].push(prevStack);
        }
      });
    });

    // Add to global maps
    playersInGame.forEach(p => {
      if (stacksMap[p]) {
        stacksMap[p].push(gameStacks[p]);
        const finalStack = gameStacks[p][gameStacks[p].length - 1];
        const finalShift = finalStack - startStack;
        profitsMap[p].push(finalShift);
      }
    });

    // Compute final ranks for this game
    const finalGameStacks = playersInGame.map(p => ({
      name: p,
      stack: gameStacks[p][gameStacks[p].length - 1]
    }));
    finalGameStacks.sort((a, b) => b.stack - a.stack);

    let currentRank = 1;
    for (let j = 0; j < finalGameStacks.length; j++) {
      if (j > 0 && finalGameStacks[j].stack < finalGameStacks[j - 1].stack) {
        currentRank = j + 1;
      }
      if (finalRanksMap[finalGameStacks[j].name]) {
        finalRanksMap[finalGameStacks[j].name].push(currentRank);
      }
    }
  });

  // Compute stats for chart
  const playerRanks = {};
  Object.keys(finalRanksMap).forEach(p => {
    const ranks = finalRanksMap[p];
    if (ranks.length === 0) return;
    const n = ranks.length;
    const mean = ranks.reduce((a, b) => a + b, 0) / n;
    const variance = (n > 1)
      ? ranks.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1)
      : 0;
    const stdDev = Math.sqrt(variance);
    const stderr = (n > 0) ? stdDev / Math.sqrt(n) : 0;
    playerRanks[p] = { avg: mean, stdDev, ci: 1.96 * stderr };
  });

  const enrichedStacks = {};
  Object.keys(stacksMap).forEach(player => {
    const gameHistories = stacksMap[player];
    if (gameHistories.length === 0) return;

    const numHands = Math.max(...gameHistories.map(h => h.length));
    const means = [];
    const lows = [];
    const highs = [];

    for (let i = 0; i < numHands; i++) {
      const values = gameHistories.map(h => (h[i] !== undefined) ? h[i] : h[h.length - 1]);
      const n = values.length;
      const mean = values.reduce((a, b) => a + b, 0) / n;
      const variance = (n > 1)
        ? values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1)
        : 0;
      const stdDev = Math.sqrt(variance);
      const stderr = (n > 0) ? stdDev / Math.sqrt(n) : 0;
      const ci = 1.96 * stderr;

      means.push(mean);
      lows.push(mean - ci);
      highs.push(mean + ci);
    }

    enrichedStacks[player] = {
      mean: means,
      low: lows,
      high: highs,
      individual: gameHistories
    };
  });

  // Format playerStats for output
  const statsByPlayer = {};
  Object.keys(playerStatsMap).forEach(p => {
    const s = playerStatsMap[p];
    statsByPlayer[p] = {
      vpip: s.vpipOpp > 0 ? (s.vpipCount / s.vpipOpp) * 100 : 0,
      pfr: s.pfrOpp > 0 ? (s.pfrCount / s.pfrOpp) * 100 : 0,
      three_bet: s.threeBetOpp > 0 ? (s.threeBetCount / s.threeBetOpp) * 100 : 0,
      c_bet: s.cBetOpp > 10 ? (s.cBetCount / s.cBetOpp) * 100 : 0 // Require some minimum opps for c-bet confidence
    };
    // If c-bet opps are very low, maybe return 0 or null? Let's stay with 0 for now but maybe UI handles it.
  });

  return {
    profits: profitsMap,
    stacks: enrichedStacks,
    ranks: playerRanks,
    playerStats: statsByPlayer
  };
}

module.exports = { computeStats };
