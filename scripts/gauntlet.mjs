// Balance gauntlet: seeded runs of every bot policy through the real simulation.
// node scripts/gauntlet.mjs [--seeds=100] [--minutes=15] [--policy=skilled]
import { GameModel, seededRandom } from '../src/model.js';
import { perceive } from '../src/layout.js';
import { STEP } from '../src/data/tuning.js';
import { POLICIES } from './bots/policies.mjs';
import { pathToFileURL } from 'node:url';
export function runBot(name, seed, { minutes = 15, look = seed % 5, difficulty = 'easy' } = {}) {
  const m = new GameModel(seededRandom(seed), { look, difficulty });
  const policy = POLICIES[name](seed);
  m.start();
  let firstCapture = null;
  const limit = minutes * 60 * 60;
  for (let step = 0; step < limit && !['won', 'lost'].includes(m.phase); step++) {
    m.tick(STEP, policy(perceive(m)));
    for (const e of m.drainEvents()) if (e.type === 'captured' && firstCapture === null) firstCapture = m.time;
  }
  return {
    name,
    seed,
    won: m.phase === 'won',
    lost: m.phase === 'lost',
    time: m.time,
    score: m.score,
    destroyed: m.destroyed,
    lap: m.lap,
    lives: m.lives,
    continues: m.continues,
    firstCapture,
    stats: { ...m.stats },
  };
}
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
export function summarize(runs) {
  const s = (f) => mean(runs.map(f));
  return {
    runs: runs.length,
    winRate: s((r) => (r.won ? 1 : 0)),
    destroyed: s((r) => r.destroyed),
    score: s((r) => r.score),
    minutes: s((r) => r.time / 60),
    captures: s((r) => r.stats.captures),
    brosLit: s((r) => r.stats.brosLit),
    misses: s((r) => r.stats.misses),
    cansLit: s((r) => r.stats.cansLit),
    bonusHits: s((r) => r.stats.bonusHits),
    fdRescues: s((r) => r.stats.fdRescues),
    wipeouts: s((r) => r.stats.wipeouts),
    stumbles: s((r) => r.stats.stumbles),
    tricks: s((r) => r.stats.tricks),
    hives: s((r) => r.stats.hives),
    firstCapture: s((r) => r.firstCapture ?? r.time),
  };
}
// Gates: do-nothing and mashing must lose to deliberate play; braking must be caught.
export function gates(table) {
  const failures = [];
  const { idle, brake, masher, novice, skilled } = table;
  if (brake && brake.firstCapture > 8) failures.push(`brake captured too late (${brake.firstCapture.toFixed(1)} s)`);
  if (idle && idle.winRate > 0) failures.push('idle won a run');
  if (idle && idle.destroyed > 0.5) failures.push('idle destroys houses');
  if (masher && skilled && masher.score > skilled.score * 0.35) failures.push('masher scores too close to skilled');
  if (masher && masher.winRate > 0.05) failures.push('masher wins');
  if (skilled && skilled.winRate < 0.6) failures.push(`skilled win rate ${skilled.winRate}`);
  if (skilled && (skilled.minutes < 3 || skilled.minutes > 11)) failures.push(`skilled run length ${skilled.minutes.toFixed(1)} min`);
  if (novice && skilled && novice.score > skilled.score) failures.push('novice outscores skilled');
  if (novice && novice.destroyed < 2) failures.push(`novice destroys too little (${novice.destroyed.toFixed(1)})`);
  return failures;
}
export function runSuite({ seeds = 20, minutes = 15, policies = Object.keys(POLICIES), quiet = false, offset = 1, difficulty = 'easy' } = {}) {
  const table = {};
  for (const name of policies) {
    const runs = [];
    for (let i = 0; i < seeds; i++) runs.push(runBot(name, offset + i, { minutes: name === 'brake' ? 1 : minutes, difficulty }));
    table[name] = summarize(runs);
    if (!quiet) {
      const r = table[name];
      console.log(
        `${name.padEnd(8)} win ${(r.winRate * 100).toFixed(0).padStart(3)}%  gone ${r.destroyed.toFixed(1).padStart(4)}/12  score ${Math.round(r.score).toString().padStart(7)}  ${r.minutes.toFixed(1).padStart(4)} min  lit ${r.brosLit.toFixed(1).padStart(5)}  cans ${r.cansLit.toFixed(1).padStart(5)}  miss ${r.misses.toFixed(1).padStart(4)}  caught ${r.captures.toFixed(2)}  first ${r.firstCapture.toFixed(1)} s  bonus ${r.bonusHits.toFixed(1)}  fd ${r.fdRescues.toFixed(2)}  wipe ${r.wipeouts.toFixed(1)}  stumble ${r.stumbles.toFixed(1)}  tricks ${r.tricks.toFixed(0)}  hives ${r.hives.toFixed(1)}`,
      );
    }
  }
  return { table, failures: gates(table) };
}
export async function main() {
  const arg = (name, fallback) => {
    const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.split('=')[1] : fallback;
  };
  const policies = arg('policy', null)?.split(',') ?? Object.keys(POLICIES);
  const difficulty = arg('route', 'easy');
  console.log(`route: ${difficulty}`);
  const result = runSuite({ seeds: Number(arg('seeds', 20)), minutes: Number(arg('minutes', 15)), policies, offset: Number(arg('offset', 1)), difficulty });
  if (result.failures.length) {
    console.log(`GATES FAILED:\n- ${result.failures.join('\n- ')}`);
    process.exitCode = 1;
  } else console.log('Gates: PASS');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
