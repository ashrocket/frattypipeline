import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { S, C, BIG_CALLOUTS } from '../src/data/strings.js';
import { HOUSES, SHOPS, FLEE, LIT, BEES } from '../src/data/houses.js';
import { LOOKS, BONUS_SKATERS } from '../src/data/looks.js';
import { handleQueueRequest } from '../server/http.mjs';
import { AdmissionQueue } from '../server/queue.mjs';
test('public queue status is read-only, cached and contains no tokens', async () => {
  let saves = 0;
  const queue = new AdmissionQueue({
    store: { load: async () => undefined, save: async () => saves++ },
  });
  const player = await queue.perform('join');
  const before = saves;
  const response = await handleQueueRequest(
    new Request('http://localhost/api/queue/status'),
    queue,
  );
  assert.equal(response.headers.get('cache-control'), 'max-age=5');
  assert.deepEqual(await response.json(), { activeCount: 1, waitingCount: 0, capacity: 20 });
  assert.equal(saves, before);
  assert.ok(player.token);
});
test('copy lint rejects retired terms, real Greek pairs, artist and long big callouts', () => {
  const copy = JSON.stringify({ S, C, HOUSES, SHOPS, FLEE, LIT, BEES, BONUS_SKATERS });
  const banned =
    /groucho|sorority girl|one of the sisters|delta daddy|\bbasic\b|demure|girl dinner|tradwife|mob wife|pick-me|Karen|gyatt|skibidi|\bOhio\b|fanum tax|6-7|Stanley|Labubu|\bbrat\b|Patagonia|Venmo|LinkedIn|White Claw/i;
  assert.doesNotMatch(copy, banned);
  const letters = ['Κ$', 'ΕΓΩ', 'ΒΩΑΤ', 'ΔΑΔ', 'ΤF', 'ΣF', 'ΩΒ', 'ΤΟΓΑ', 'ΧΜ', 'GΣ', 'ΟΒ', 'ΠΙΠΕ'];
  assert.deepEqual(
    HOUSES.map((h) => h.letters),
    letters,
  );
  for (const text of [...BIG_CALLOUTS, ...HOUSES.map((h) => h.ko), ...SHOPS.map((s) => `UNLOCKED: ${s.item}`)])
    assert.ok(text.length <= 24, text);
  // The game is PIPELINE; Greek Row is only the street.
  assert.equal(S.brand, 'PIPELINE');
  assert.match(readFileSync('index.html', 'utf8'), /<title>PIPELINE<\/title>/);
  for (const pair of [
    'ΑΕ',
    'ΒΥ',
    'ΔΔ',
    'ΑΚΑ',
    'ΔΣΘ',
    'ΖΦΒ',
    'ΣΓΡ',
    'ΑΦΑ',
    'ΚΑΨ',
    'ΩΨΦ',
    'ΦΒΣ',
    'ΙΦΘ',
  ])
    assert.ok(!HOUSES.some((h) => h.letters.includes(pair)));
  assert.doesNotMatch(readFileSync('index.html', 'utf8'), banned);
});
test('beatmap has corrected grid and is under1KB; recording remains ignored', () => {
  const bytes = readFileSync('src/data/fratty-pipeline.beatmap.json');
  assert.ok(bytes.length < 1024);
  const map = JSON.parse(bytes);
  assert.equal(map.beatS, 0.32616);
  assert.equal(map.bpm, 183.96);
  assert.equal(map.firstBeatS, 0.305);
  assert.deepEqual(map.loops.run, [8, 744]);
  assert.match(readFileSync('.gitignore', 'utf8'), /public\/audio\/\*\.mp3/);
});
test('chosen looks exclude uniform colors and preserve five names', () => {
  assert.equal(LOOKS.length, 5);
  for (const look of LOOKS)
    for (const color of [look.outfit, look.trim])
      assert.ok(!['#E8DCC4', '#CDBB8E', '#1F2A44'].includes(color));
});
test('built dist contains no banned artist references', () => {
  if (!existsSync('dist')) return;
  const walk = (dir) => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const path = `${dir}/${name.name}`;
      if (name.isDirectory()) walk(path);
      else assert.doesNotMatch(readFileSync(path).toString('latin1'), /groucho/i, path);
    }
  };
  walk('dist');
});

test('status filters expired leases without renewing, promoting, or saving them', async () => {
  let now = 0,
    saves = 0;
  const queue = new AdmissionQueue({
    now: () => now,
    config: { capacity: 1, activeLeaseSeconds: 75, waitingLeaseSeconds: 90 },
    store: { load: async () => undefined, save: async () => saves++ },
  });
  await queue.perform('join');
  await queue.perform('join');
  const before = saves;
  now = 76000;
  assert.deepEqual(await queue.status(), { activeCount: 0, waitingCount: 1, capacity: 1 });
  assert.equal(saves, before);
  const response = await handleQueueRequest(
    new Request('http://localhost/api/queue/status', { method: 'POST' }),
    queue,
  );
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET');
});
