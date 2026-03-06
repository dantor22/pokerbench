const fs = require('fs');
const path = require('path');
const { computeStats } = require('./compute-stats');


const SOURCE_DIR = path.resolve(__dirname, '../../runs');
const DEST_DIR = path.resolve(__dirname, '../public/data/runs');
const MANIFEST_PATH = path.resolve(__dirname, '../src/data/manifest.json');
const PUBLIC_MANIFEST_PATH = path.resolve(__dirname, '../public/data/manifest.json');

// Ensure destination directories exist
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

ensureDir(DEST_DIR);
ensureDir(path.dirname(MANIFEST_PATH));
ensureDir(path.dirname(PUBLIC_MANIFEST_PATH));

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

function copyDir(src, dest) {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      // Only copy relevant files
      if (entry.name.endsWith('.json') || entry.name.endsWith('.png') || entry.name.endsWith('.jpg') || entry.name === 'README.md') {
          fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

console.log('Syncing data from', SOURCE_DIR, 'to', DEST_DIR);

try {
  // Clear destination first to avoid stale data issues
  if (fs.existsSync(DEST_DIR)) {
      fs.rmSync(DEST_DIR, { recursive: true, force: true });
  }
  
  copyDir(SOURCE_DIR, DEST_DIR);

  const runDirs = fs.readdirSync(DEST_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const manifest = {
    runs: runDirs,
    games: {}
  };


  // Populate game IDs for each run
  for (const runId of runDirs) {
    const runPath = path.join(DEST_DIR, runId);

    // Compute stats
    try {
      console.log(`Computing stats for ${runId}...`);
      const stats = computeStats(runPath);
      if (stats) {
        fs.writeFileSync(path.join(runPath, 'stats.json'), JSON.stringify(stats));
      }
    } catch (e) {
      console.error(`Failed to compute stats for ${runId}:`, e);
    }

    const gameFiles = findGameFiles(runPath);
    const gameIds = gameFiles.map(f => {
      const basename = path.basename(f);
      const gameId = basename.replace('game_', '').replace('.json', '');

      // Flattening: If the file is not already in the runPath root, move/copy it there
      const destPath = path.join(runPath, basename);
      if (f !== destPath) {
        fs.copyFileSync(f, destPath);
        // We leave the original nested file there as it was already copied by copyDir, 
        // but it doesn't hurt. The key is it's now also in the root.
      }

      return gameId;
    });
    
    manifest.games[runId] = gameIds;
  }

  const jsonContent = JSON.stringify(manifest, null, 2);
  fs.writeFileSync(MANIFEST_PATH, jsonContent);
  fs.writeFileSync(PUBLIC_MANIFEST_PATH, jsonContent);
  
  console.log('Manifest generated at', MANIFEST_PATH);
  console.log('Data sync complete.');

} catch (err) {
  console.error('Error syncing data:', err);
  process.exit(1);
}
