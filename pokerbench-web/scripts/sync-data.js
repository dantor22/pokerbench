const fs = require('fs');
const path = require('path');

const SOURCE_DIR = path.resolve(__dirname, '../../runs');
const DEST_DIR = path.resolve(__dirname, '../src/data/runs');
const MANIFEST_PATH = path.resolve(__dirname, '../src/data/manifest.json');

// Ensure destination directory exists
if (!fs.existsSync(DEST_DIR)) {
  fs.mkdirSync(DEST_DIR, { recursive: true });
}

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('Syncing data from', SOURCE_DIR, 'to', DEST_DIR);

try {
  // 1. Copy all runs
  copyDir(SOURCE_DIR, DEST_DIR);

  // 2. Generate Manifest
  // We need a list of runs, for each run, maybe a list of games?
  // Actually getRuns() just returns top level directories.
  
  const runDirs = fs.readdirSync(DEST_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const manifest = {
    runs: runDirs,
    // We could pre-calculate game IDs here too to avoid fs entirely for listGames
    games: {}
  };

  // Populate game IDs for each run
  for (const runId of runDirs) {
    const runPath = path.join(DEST_DIR, runId);
    const files = fs.readdirSync(runPath);
    const gameIds = files
      .filter(f => f.startsWith('game_') && f.endsWith('.json'))
      .map(f => f.replace('game_', '').replace('.json', ''));
    
    manifest.games[runId] = gameIds;
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log('Manifest generated at', MANIFEST_PATH);
  console.log('Data sync complete.');

} catch (err) {
  console.error('Error syncing data:', err);
  process.exit(1);
}
