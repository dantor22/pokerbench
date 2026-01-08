
const fs = require('fs');
const path = require('path');

function computeStats(runPath) {
  const summaryPath = path.join(runPath, 'summary.json');
  if (!fs.existsSync(summaryPath)) {
    console.warn(`No summary.json found in ${runPath}`);
    return null;
  }

  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  const files = fs.readdirSync(runPath);
  const gameFiles = files.filter(f => f.startsWith('game_') && f.endsWith('.json'));

  const profitsMap = {};
  const stacksMap = {};
  const finalRanksMap = {};

  // Initialize maps
  // Note: summary.leaderboard might not contain all players if new ones appeared? 
  // But usually it should.
  if (summary.leaderboard) {
    summary.leaderboard.forEach(p => {
      profitsMap[p.name] = [];
      stacksMap[p.name] = [];
      finalRanksMap[p.name] = [];
    });
  }

  gameFiles.forEach(gameFile => {
    const gamePath = path.join(runPath, gameFile);
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

    // Ensure players exist in maps (in case they weren't in summary leaderboard)
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
      playersInGame.forEach(p => {
        // We need to be careful with pre_hand_stacks. 
        // If it's undefined, we should use the tracked stack.
        
        let res = null;
        if (hand.results) {
            res = hand.results.find(r => r.player === p);
        }

        const prevStack = gameStacks[p][gameStacks[p].length - 1];
        if (res) {
          // If pre_hand_stacks provided, use it (simulation source of truth).
          // Fallback to prevStack if missing, NOT 0.
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
    // Use Sample Variance (n-1) if possible
    const variance = (n > 1)
      ? ranks.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1)
      : 0;
    const stdDev = Math.sqrt(variance);
    const stderr = (n > 0) ? stdDev / Math.sqrt(n) : 0;
    // 95% CI
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
        // Collect samples for hand i across all games
        // If a game ended early, use its last stack?
        // Original code: const values = gameHistories.map(h => h[i] ?? h[h.length - 1]);
        const values = gameHistories.map(h => (h[i] !== undefined) ? h[i] : h[h.length - 1]);
        
        const n = values.length;
        const mean = values.reduce((a, b) => a + b, 0) / n;
      // Use Sample Variance (n-1) if possible
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

  return {
    profits: profitsMap, // Just the profits map is needed for leaderboard enrichment, we can iterate in UI or pre-compute
    stacks: enrichedStacks,
    ranks: playerRanks
  };
}

module.exports = { computeStats };
