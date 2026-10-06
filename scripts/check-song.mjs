import { existsSync, statSync } from 'node:fs';
const path = 'public/audio/fratty-pipeline.mp3';
if (!existsSync(path) || statSync(path).size < 1000) {
  console.warn(
    '\n!!! SONG FILE MISSING — run scripts/import-song.sh !!!\nBuild remains playable with SFX and the visual beat clock.\n',
  );
  if (!process.argv.includes('--warn')) process.exitCode = 1;
} else console.log('FRATTY PIPELINE: local song present (excluded from git).');
