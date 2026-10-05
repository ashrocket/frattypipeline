import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { policyRandom } from './bots/degenerate.mjs';
const dir = mkdtempSync(`${tmpdir()}/pipeline-baseline-`);
try {
  writeFileSync(`${dir}/model.mjs`, execFileSync('git', ['show', 'c302d60:src/model.js']));
  const { GameModel } = await import(pathToFileURL(`${dir}/model.mjs`));
  let wins = 0,
    total = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const model = new GameModel(policyRandom(seed));
    model.start();
    for (let i = 0; i < 18000 && !['won', 'lost'].includes(model.phase); i++) {
      model.tick(1 / 60, { fire: true });
      model.drainEvents();
    }
    if (model.phase === 'won') {
      wins++;
      total += model.time;
    }
  }
  console.log(
    `c302d60 fire adapter: ${wins}/100 hold-throw wins; mean ${(total / wins).toFixed(1)} s.`,
  );
  console.log(`Fun-floor gate: ${wins <= 5 ? 'PASS' : 'FAIL (expected)'} — maximum allowed 5/100.`);
  if (wins !== 100) process.exitCode = 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
