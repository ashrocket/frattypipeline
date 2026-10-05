import { GameModel, seededRandom } from '../src/model.js';
import { perceive, layout, visible } from '../src/layout.js';
import { STEP, BEAT_S, TUNING } from '../src/data/tuning.js';
import { reader } from './bots/reader.mjs';
import { degenerate, DEGENERATE_NAMES } from './bots/degenerate.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
export const median = (values) => {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
};
export function runBot(name, seed, look = 0, { audit = true, limit = 360 } = {}) {
  const m = new GameModel(seededRandom(seed), { look }),
    smart = reader(seed, { novice: name === 'Novice' });
  const policy = ['Skilled', 'Novice'].includes(name) ? smart : degenerate(name, seed, smart);
  const issues = new Set(),
    logs = [],
    tells = new Map(),
    visibility = new Map();
  let maxCaps = 0,
    lastInput = {};
  m.start();
  for (let step = 0; step < limit * 60 && !['won', 'lost', 'continue'].includes(m.phase); step++) {
    // All decisions use the same projected, unoccluded entities as the renderer.
    if (audit) {
      const motion = m.hitstop > 1e-8 ? 0 : STEP * (m.slowmo > 0 ? 0.35 : 1);
      for (const [width, height] of [
        [390, 844],
        [844, 390],
      ]) {
        const view = layout(width, height, m);
        for (const e of m.enemies) {
          const key = `${width}:${e.id}`;
          visibility.set(key, visible(view, e) ? (visibility.get(key) ?? 0) + motion : 0);
        }
        for (const a of m.attacks) {
          const key = `${width}:${a.id}`;
          const before = visibility.get(key) ?? visibility.get(`${width}:${a.owner}`) ?? 0;
          visibility.set(key, visible(view, { x: a.targetX, z: a.targetZ }) ? before + motion : 0);
        }
      }
    }
    lastInput = policy(perceive(m));
    m.tick(STEP, { ...lastInput, pressBeat: m.beat });
    for (const e of m.drainEvents()) {
      if (e.type === 'telegraph') tells.set(e.source, e);
      if (e.type === 'hit' && audit && e.kind !== 'conveyor') {
        const tell = tells.get(e.source);
        if (!tell || e.motionTime - tell.motionTime < 0.4 - STEP - 1e-7) issues.add('unfair tell');
        if (e.kind !== 'timeout')
          for (const [width, required] of [
            [390, 0.9],
            [844, 0.8],
          ])
            if ((visibility.get(`${width}:${e.source}`) ?? 0) < required - STEP)
              issues.add(`hidden threat ${width}`);
      }
      if (e.type === 'impact' && audit && Math.abs(m.beat - e.landBeat) * BEAT_S > STEP + 1e-6)
        issues.add('late impact');
      if (['burn', 'hit', 'parry', 'vs', 'school'].includes(e.type)) logs.push(e);
    }
    const alive = m.enemies.filter((e) => e.state !== 'flee'),
      h = m.arena;
    maxCaps = Math.max(maxCaps, alive.length);
    if (audit && h) {
      if (alive.length > (h.bars > 1 ? 6 : TUNING.caps[h.district])) issues.add('enemy cap');
      if (
        alive.filter((e) => ['telegraph', 'active'].includes(e.state)).length >
        TUNING.tokens[h.district]
      )
        issues.add('token cap');
    }
  }
  if (!['won', 'lost', 'continue'].includes(m.phase)) issues.add('timeout');
  // Failed locks are still lock time; excluding them would hide dead air on losses.
  const fights = [...m.fights];
  if (m.arena)
    fights.push({
      id: m.arena.id,
      seconds: m.time - m.arena.lockAt,
      hits: m.fightHits,
      deadAir: m.arena.deadAir ?? 0,
    });
  return {
    name,
    seed,
    look,
    won: m.phase === 'won',
    time: m.time,
    burned: m.burned,
    score: m.score,
    hits: m.hits,
    lives: m.lives,
    issues: [...issues],
    fights,
    logs,
    phase: m.phase,
    maxCaps,
    deadAir:
      fights.reduce((sum, f) => sum + f.deadAir, 0) /
      Math.max(
        1,
        fights.reduce((sum, f) => sum + f.seconds, 0),
      ),
  };
}
export function summarize(name, runs) {
  const wins = runs.filter((r) => r.won);
  return {
    name,
    runs: runs.length,
    win: (100 * wins.length) / runs.length,
    seconds: median(wins.length ? wins.map((r) => r.time) : runs.map((r) => r.time)),
    longest: Math.max(...runs.map((r) => r.time)),
    houses: runs.reduce((s, r) => s + r.burned, 0) / runs.length,
    score: runs.reduce((s, r) => s + r.score, 0) / runs.length,
    hit: (100 * runs.filter((r) => r.hits > 0).length) / runs.length,
    d3: (100 * runs.filter((r) => r.burned >= 8).length) / runs.length,
    maxDeadAir: Math.max(...runs.map((r) => r.deadAir * 100)),
    deadAir: (100 * runs.reduce((sum, r) => sum + r.deadAir, 0)) / runs.length,
    locks: [0, 1, 2].map((d) =>
      median(
        runs.flatMap((r) =>
          r.fights
            .filter((f) => Math.floor(f.id / 4) === d && f.id % 4 !== 3)
            .map((f) => f.seconds),
        ),
      ),
    ),
    bossLocks: [3, 7, 11].map((id) =>
      median(runs.flatMap((r) => r.fights.filter((f) => f.id === id).map((f) => f.seconds))),
    ),
    issues: [...new Set(runs.flatMap((r) => r.issues))],
  };
}
export function gate(rows) {
  const failures = [],
    by = Object.fromEntries(rows.map((r) => [r.name, r]));
  const check = (ok, label) => {
    if (!ok) failures.push(label);
  };
  for (const r of rows) check(!r.issues.length, `${r.name}: ${r.issues.join(', ')}`);
  const s = by.Skilled,
    n = by.Novice;
  if (by.Idle) check(by.Idle.win === 0 && by.Idle.seconds <= 150, 'Idle');
  for (const r of rows.filter((r) => r.name.startsWith('Spam')))
    check(r.win <= 5 && r.houses <= 6, r.name);
  for (const name of ['Mash', 'Throw+ollie']) if (by[name]) check(by[name].win <= 10, name);
  if (by.Pacifist) check(by.Pacifist.win === 0 && by.Pacifist.longest <= 300, 'Pacifist');
  if (s) {
    check(s.maxDeadAir <= 25, 'Skilled dead air');
    for (const [i, [min, max]] of [
      [8, 13],
      [10, 15],
      [12, 18],
    ].entries())
      check(s.locks[i] >= min - STEP && s.locks[i] <= max + STEP, `District ${i + 1} lock pacing`);
    for (const [i, [min, max]] of [
      [22, 35],
      [22, 35],
      [35, 55],
    ].entries())
      check(
        s.bossLocks[i] >= min - STEP && s.bossLocks[i] <= max + STEP,
        `Boss ${i + 1} lock pacing`,
      );
    check(s.win >= 85, 'Skilled wins');
    check(s.seconds >= 200 && s.seconds <= 270, 'Skilled duration');
    check(s.hit >= 50, 'Skilled hits');
    check(
      s.score >=
        3 * Math.max(0, ...rows.filter((r) => r.name.startsWith('Spam')).map((r) => r.score)),
      'Skilled score',
    );
  }
  if (n) {
    check(n.maxDeadAir <= 35, 'Novice dead air');
    check(n.win >= 25 && n.win <= 50, 'Novice wins');
    check(n.d3 >= 60, 'Novice district 3');
  }
  if (by.Suicide && s) {
    check(
      by.Suicide.win <= s.win &&
        by.Suicide.score <= s.score * 0.5 &&
        by.Suicide.seconds >= s.seconds,
      'Suicide',
    );
  }
  return failures;
}
export function printTable(rows) {
  console.log('| Bot | Runs | Wins | Median s | Houses | Mean score | Hit runs | D3 |');
  console.log('|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const r of rows)
    console.log(
      `| ${r.name} | ${r.runs} | ${r.win.toFixed(1)}% | ${r.seconds.toFixed(1)} | ${r.houses.toFixed(2)} | ${Math.round(r.score)} | ${r.hit.toFixed(1)}% | ${r.d3.toFixed(1)}% |`,
    );
}
export function frozenPolicyHash() {
  const hash = createHash('sha256')
    .update(readFileSync('scripts/bots/degenerate.mjs'))
    .digest('hex');
  if (hash !== readFileSync('scripts/bots/degenerate.sha256', 'utf8').split(' ')[0])
    throw Error('Frozen policies changed');
  return hash;
}
export function runSuite({
  count = 200,
  start = 1,
  looks = 5,
  names = [...DEGENERATE_NAMES, 'Novice', 'Skilled'],
  quiet = false,
} = {}) {
  frozenPolicyHash();
  const rows = [];
  let cosmeticFailures = 0;
  for (const name of names) {
    const runs = [];
    for (let seed = start; seed < start + count; seed++) {
      let first;
      for (let look = 0; look < looks; look++) {
        const run = runBot(name, seed, look);
        const signature = createHash('sha256')
          .update(JSON.stringify([run.won, run.time, run.burned, run.score, run.hits, run.logs]))
          .digest('hex');
        if (first && signature !== first) cosmeticFailures++;
        first = signature;
        runs.push({ ...run, logs: undefined });
      }
    }
    const row = summarize(name, runs);
    rows.push(row);
    if (!quiet) {
      console.log(
        `Checked ${name}: ${runs.length} runs, ${row.issues.length ? row.issues.join(', ') : 'fairness/termination OK'}.`,
      );
      for (const run of runs.filter((r) => r.issues.length && r.look === 0))
        console.log(
          `  seed ${run.seed}: ${run.issues.join(', ')} (${run.time.toFixed(1)} s, ${run.burned} houses)`,
        );
    }
  }
  const failures = gate(rows);
  if (cosmeticFailures) failures.push('Cosmetic parity');
  return { rows, failures, cosmeticFailures };
}
function report(suite) {
  printTable(suite.rows);
  for (const r of suite.rows.filter((r) => ['Skilled', 'Novice'].includes(r.name)))
    console.log(
      `${r.name}: dead air ${r.deadAir.toFixed(1)}%; district lock medians ${r.locks.map((n) => n.toFixed(1)).join('/')} s; bosses ${r.bossLocks.map((n) => n.toFixed(1)).join('/')} s.`,
    );
  console.log(suite.failures.length ? `FAIL: ${suite.failures.join('; ')}` : 'PASS');
}
export async function main() {
  const arg = (key) => process.argv.find((a) => a.startsWith(`--${key}=`))?.split('=')[1];
  const options = {
    count: Number(arg('seeds') ?? 200),
    start: Number(arg('start') ?? 1),
    looks: Number(arg('looks') ?? 5),
  };
  if (arg('bots')) options.names = arg('bots').split(',');
  const train = runSuite(options);
  console.log(
    `Seeds ${options.start}–${options.start + options.count - 1}; ${options.looks} cosmetic looks.`,
  );
  report(train);
  if (process.argv.includes('--holdout')) {
    const holdout = runSuite({ ...options, start: 10001 });
    console.log(`Hold-out seeds 10001–${10000 + options.count}; ${options.looks} cosmetic looks.`);
    report(holdout);
    for (const row of holdout.rows) {
      const original = train.rows.find((r) => r.name === row.name);
      if (Math.abs(row.win - original.win) > 5 + 1e-8)
        holdout.failures.push(`${row.name}: hold-out win-rate drift exceeds 5 percentage points`);
    }
    train.failures.push(...holdout.failures);
    console.log(
      train.failures.length
        ? `FULL GATE FAIL: ${train.failures.join('; ')}`
        : 'FULL GATE PASS: all thresholds, hold-out drift and cosmetic parity.',
    );
  }
  if (arg('json')) writeFileSync(arg('json'), JSON.stringify(train, null, 2));
  if (train.failures.length) process.exitCode = 1;
  return train.rows;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
