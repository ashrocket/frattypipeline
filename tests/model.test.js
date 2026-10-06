import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { GameModel, seededRandom } from '../src/model.js';
import { STEP, TUNING as T, SCORE, BEAT_S } from '../src/data/tuning.js';
import { HOUSES, SHOPS } from '../src/data/houses.js';
import { BONUS_SKATERS } from '../src/data/looks.js';
import { ROW, LAP, near, Z } from '../src/sim/row.js';
import {
  STATE,
  stateFor,
  igniteBro,
  houseIgnite,
  damage,
  updateHouse,
  beehive,
} from '../src/sim/house.js';
import { aim, release, targetOn } from '../src/sim/throw.js';
import { startLap } from '../src/sim/street.js';
import { startBonus } from '../src/sim/bonus.js';

function run(seed = 1, options = {}) {
  const m = new GameModel(seededRandom(seed), options);
  m.start();
  advance(m, 1.9);
  m.hazards = [];
  return m;
}
function advance(m, seconds, input = {}) {
  for (let i = 0; i < Math.round(seconds / STEP); i++) m.tick(STEP, input);
}
const events = (m, type) => m.drainEvents().filter((e) => e.type === type);
// Put the player in front of house h, rolling, in the given lane.
function approach(m, h, ahead = 9, z = -2.4, vx = T.roll) {
  m.player.x = near(h.s, m.player.x) - ahead;
  if (m.player.x < 0) m.player.x += LAP;
  m.player.z = z;
  m.player.vx = vx;
}
// Throw item at house h landing exactly at world x (bypasses timing for rule tests).
function throwAt(m, h, item, landX) {
  m.item = item;
  if (item !== 'bottle') m.items[item] = 3;
  const hx = near(h.s, m.player.x);
  const t = targetOn(m, h, hx, item, landX);
  m.projectiles.push({
    id: ++m.id,
    item,
    fromX: m.player.x,
    fromZ: m.player.z,
    fromY: 1.4,
    toX: landX,
    toZ: t?.z ?? -6.6,
    toY: t?.y ?? 0,
    t: 0,
    flight: 0.3,
    house: h.id,
    air: false,
    locked: true,
  });
  advance(m, 0.35);
}
const isolate = (m) => {
  for (const h of m.houses) h.bros = [];
};

test('the Row: twelve fictional houses, five shops after every second house, one loop', () => {
  const m = new GameModel();
  assert.equal(m.houses.length, 12);
  assert.equal(ROW.shops.length, 5);
  assert.equal(LAP, 298);
  assert.deepEqual(
    ROW.shops.map((s) => ROW.houses.findIndex((h) => h.lot[1] === s.lot[0])),
    [1, 3, 5, 7, 9],
  );
  assert.equal(HOUSES.filter((h) => h.couch).length, 5);
  for (const h of m.houses) assert.ok(h.bros.length >= 3 && h.bros.length <= 6);
});

test('owner rule: standing still gets you captured; neutral rolling never does', () => {
  const still = run();
  let captured = null;
  for (let i = 0; i < 60 * 8 && !captured; i++) {
    still.tick(STEP, { x: -1 });
    captured = still.drainEvents().find((e) => e.type === 'captured');
  }
  assert.ok(captured, 'braking to a stop must end in capture');
  assert.ok(captured.time < 1.9 + 6, `captured at ${captured.time}`);
  const rolling = run(2);
  for (let i = 0; i < 60 * 60; i++) {
    rolling.hazards = [];
    rolling.carts = [];
    for (const h of rolling.houses) h.fd = null;
    rolling.tick(STEP, {});
  }
  assert.equal(rolling.stats.captures, 0);
  assert.ok(rolling.player.vx >= T.roll - 1e-6);
});

test('the horde warns before it captures, and wipeouts let it close in', () => {
  const m = run(3);
  m.hazards = [{ id: 1, kind: 'keg', s: (m.player.x + 3) % LAP, z: m.player.z, hx: 0.35, hz: 0.35, h: 0.6, rolling: false }];
  advance(m, 1.5);
  assert.equal(m.stats.wipeouts, 1);
  assert.ok(m.horde.gap < T.hordeGap);
  const brake = run(4);
  const seen = [];
  for (let i = 0; i < 60 * 8 && brake.phase === 'playing'; i++) {
    brake.tick(STEP, { x: -1 });
    seen.push(...brake.drainEvents().map((e) => e.type));
  }
  assert.ok(seen.indexOf('warn') >= 0 && seen.indexOf('warn') < seen.indexOf('captured'));
});

test('owner rule: a hit lights the can; a miss lids it and the house must be revisited next lap', () => {
  const m = run(5);
  isolate(m);
  const h = m.houses[1];
  approach(m, h);
  const canX = near(h.s, m.player.x) + h.can.dx;
  throwAt(m, h, 'bottle', canX + 3);
  assert.equal(h.can.state, 'lidded');
  assert.equal(h.comeBack, true);
  assert.equal(events(m, 'miss').length, 1);
  // A lidded can is no longer a target this lap.
  m.item = 'bottle';
  assert.notEqual(aim(m).house, 1);
  startLap(m, 2);
  assert.equal(h.can.state, 'ready');
  assert.equal(h.comeBack, false);
  throwAt(m, h, 'bottle', near(h.s, m.player.x) + h.can.dx);
  assert.equal(h.can.state, 'burning');
  assert.equal(m.stats.cansLit, 1);
});

test('throw release lands where the reticle said, leading with your speed', () => {
  const m = run(6);
  isolate(m);
  const h = m.houses[2];
  approach(m, h, 12, -2.4, 6);
  m.item = 'bottle';
  m.enqueue('throw', true);
  advance(m, STEP);
  const a = aim(m);
  assert.equal(a.house, 2);
  const predicted = m.player.x + m.player.vx * a.flight;
  assert.ok(Math.abs(a.landX - predicted) < 1e-6);
  m.enqueue('throw', false);
  advance(m, STEP);
  assert.equal(m.projectiles.length, 1);
  assert.equal(m.bottles, T.bottles - 1);
});

function ignitionRate(drunk, trials = 400) {
  let lit = 0;
  for (let seed = 1; seed <= trials; seed++) {
    const m = new GameModel(seededRandom(seed));
    const h = m.houses[0];
    h.bros = h.bros.slice(0, 1);
    const b = h.bros[0];
    Object.assign(b, { drunk, ext: 0, state: 'gawk', dx: h.can.dx + 0.5, z: h.can.z, t: 99 });
    b.tx = b.dx;
    b.tz = b.z;
    h.can.state = 'burning';
    h.can.fuel = 99;
    for (let i = 0; i < 60; i++) updateHouse(m, h, STEP);
    if (b.state === 'burning' || b.state === 'inside') lit++;
  }
  return lit / trials;
}
test('owner rule: bros near burning cans catch fire, drunk ones far more readily', () => {
  const drunk = ignitionRate(1),
    sober = ignitionRate(0);
  // One second next to the fire: 1 - e^-0.8 ≈ 0.55 drunk, 1 - e^-0.25 ≈ 0.22 sober.
  assert.ok(drunk > 0.45 && drunk < 0.65, `drunk ${drunk}`);
  assert.ok(sober > 0.14 && sober < 0.3, `sober ${sober}`);
});

test('owner rule: burning bros take the fire into the Greek house', () => {
  const m = new GameModel(seededRandom(9));
  const h = m.houses[3];
  const b = h.bros[0];
  for (const other of h.bros) other.ext = 0; // isolate the rule from extinguishers
  igniteBro(m, h, b);
  b.mode = 'door';
  b.burn = 10;
  let fire = false;
  for (let i = 0; i < 60 * 6 && !fire; i++) {
    updateHouse(m, h, STEP);
    fire = h.fire > 0;
  }
  assert.ok(fire);
  assert.equal(b.state, 'inside');
});

function extinguishRate(drunk, difficulty = 'medium', trials = 300) {
  let out = 0;
  for (let seed = 1; seed <= trials; seed++) {
    const m = new GameModel(seededRandom(seed), { difficulty });
    const h = m.houses[5];
    const [sprayer, victim] = h.bros;
    h.bros = [sprayer, victim];
    h.couch = false;
    Object.assign(sprayer, { drunk, ext: 6, state: 'spray', dx: 0, z: -7 });
    igniteBro(m, h, victim);
    Object.assign(victim, { mode: 'roll', burn: 99, dx: 1.4, z: -7 });
    victim.immune = 0;
    const rollOut = T.rollOut;
    for (let i = 0; i < 60; i++) {
      // Isolate the extinguisher: no self-rolling out.
      if (victim.state === 'burning') victim.mode = 'zig';
      victim.dx = 1.4;
      victim.z = -7;
      victim.t = 99;
      updateHouse(m, h, STEP);
    }
    void rollOut;
    if (victim.state === 'charred') out++;
  }
  return out / trials;
}
test('owner rule: drunk party frats are much worse with fire extinguishers', () => {
  const sober = extinguishRate(0),
    drunk = extinguishRate(1);
  assert.ok(sober > 0.6, `sober ${sober}`);
  assert.ok(drunk < sober / 2, `drunk ${drunk} vs sober ${sober}`);
  // Easy Street makes everyone clumsier, and the drunk/sober gap still holds.
  const easySober = extinguishRate(0, 'easy'),
    easyDrunk = extinguishRate(1, 'easy');
  assert.ok(easySober < sober, `easy sober ${easySober} vs ${sober}`);
  assert.ok(easyDrunk < easySober / 2, `easy drunk ${easyDrunk} vs sober ${easySober}`);
});

test('owner rule: couch houses get the fire department exactly 15% of the time; others never', () => {
  let rescues = 0;
  const trials = 2000;
  for (let seed = 1; seed <= trials; seed++) {
    const m = new GameModel(seededRandom(seed));
    const couch = m.houses.find((h) => h.couch);
    houseIgnite(m, couch, 'test');
    if (couch.fd) rescues++;
    const plain = m.houses.find((h) => !h.couch);
    houseIgnite(m, plain, 'test');
    assert.equal(plain.fd, null);
  }
  const rate = rescues / trials;
  // Binomial(2000, 0.15): sd ≈ 0.008; allow 4 sd.
  assert.ok(Math.abs(rate - 0.15) < 0.032, `fire department rate ${rate}`);
});

test('the fire department rescues the house: fire out, bros doused, damage kept', () => {
  const m = new GameModel(seededRandom(11));
  const h = m.houses.find((x) => x.couch);
  h.fd = null;
  damage(m, h, 30, 'test');
  h.fire = 0.5;
  h.fd = { stage: 'coming', t: T.fdDelay };
  igniteBro(m, h, h.bros[0]);
  h.bros[0].mode = 'zig';
  for (let i = 0; i < 60 * 6; i++) updateHouse(m, h, STEP);
  assert.equal(h.fire, 0);
  assert.notEqual(h.bros[0].state, 'burning');
  assert.ok(h.integrity < 70 && h.integrity > 0);
  assert.ok(m.drainEvents().some((e) => e.type === 'fdRescue'));
});

test('owner rule: four destruction states and escalating points per destroyed house', () => {
  assert.equal(stateFor(100), STATE.untouched);
  assert.equal(stateFor(75), STATE.harmed);
  assert.equal(stateFor(40), STATE.reallyHarmed);
  assert.equal(stateFor(0), STATE.gone);
  const m = new GameModel(seededRandom(12));
  const scores = [];
  for (const id of [4, 0, 7]) {
    const before = m.score;
    damage(m, m.houses[id], 100, 'test');
    scores.push(m.score - before);
  }
  const levels = SCORE.harmed + SCORE.reallyHarmed;
  assert.deepEqual(scores, [1, 2, 3].map((n) => levels + SCORE.gone * n));
  // Events carry what was actually scored, route multiplier included.
  const hard = new GameModel(seededRandom(12), { difficulty: 'hard' });
  damage(hard, hard.houses[4], 100, 'test');
  igniteBro(hard, hard.houses[0], hard.houses[0].bros[0]);
  const scored = hard.drainEvents();
  assert.equal(scored.find((e) => e.type === 'houseGone').points, SCORE.gone * 3);
  assert.equal(scored.find((e) => e.type === 'broLit').points, SCORE.bro * 3);
  assert.deepEqual(
    m.drainEvents()
      .filter((e) => ['harmed', 'reallyHarmed', 'houseGone'].includes(e.type))
      .map((e) => e.type)
      .slice(0, 3),
    ['harmed', 'reallyHarmed', 'houseGone'],
  );
});

test('bees through a window empty the house, and an empty house rots away', () => {
  const m = run(13);
  const h = m.houses[5];
  approach(m, h);
  const w = h.facade.windows[0];
  throwAt(m, h, 'bees', near(h.s, m.player.x) + w.dx);
  assert.equal(h.empty, true);
  const fired = m.drainEvents();
  assert.ok(fired.some((e) => e.type === 'houseEmpty' && e.house === h.id), 'the house emptying is its own event');
  assert.ok(!fired.some((e) => e.type === 'empty'), "'empty' means out of bottles (a dud at the skater)");
  advance(m, 3);
  assert.ok(h.bros.every((b) => ['flee', 'away'].includes(b.state)));
  let seconds = 0;
  while (!h.gone && seconds < 60) {
    for (let i = 0; i < 60; i++) updateHouse(m, h, STEP);
    seconds++;
  }
  assert.ok(h.gone, 'rot must finish the house');
  assert.equal(h.cause, 'rot');
  assert.ok(seconds >= 30 && seconds <= 50, `rotted in ${seconds}s`);
});

test('each shop unlocks its own bonus destruction method when you roll through it (beehives via Bee Alley)', () => {
  const m = run(14);
  isolate(m);
  for (const place of ROW.shops.slice(1)) {
    m.player.x = near(place.s, m.player.x) - 3;
    m.player.z = -3.6;
    advance(m, 1.2);
  }
  assert.deepEqual(Object.keys(m.unlocked).sort(), ['balloons', 'fryer', 'raccoons', 'sub']);
  for (const shop of SHOPS.slice(1)) assert.equal(m.items[shop.kind], shop.stock);
  m.player.x = near(ROW.shops[0].s, m.player.x) - 3;
  m.player.z = -3.6;
  advance(m, 1.2);
  assert.equal(m.level, 'alley');
});

test('subwoofer: sixteen beats of bass damage; turkey fryer: fireball when fire comes close', () => {
  const m = run(15);
  isolate(m);
  const h = m.houses[6];
  approach(m, h);
  throwAt(m, h, 'sub', near(h.s, m.player.x));
  assert.ok(h.sub);
  advance(m, 17 * BEAT_S + 0.5);
  assert.equal(h.sub, null);
  assert.ok(Math.abs(h.integrity - (100 - 16 * T.subDamage)) < 1e-6);
  const g = m.houses[8];
  approach(m, g);
  throwAt(m, g, 'fryer', near(g.s, m.player.x) + g.facade.door.dx);
  assert.ok(g.fryer);
  const before = g.integrity;
  houseIgnite(m, g, 'test', 0.1);
  updateHouse(m, g, STEP);
  assert.equal(g.fryer, null);
  assert.ok(before - g.integrity >= T.fryerDamage);
  assert.ok(g.fire >= 0.6);
});

test('raccoons pop a slammed lid (undo a miss) and drag burning trash inside', () => {
  const m = run(16);
  isolate(m);
  const h = m.houses[2];
  h.couch = false;
  approach(m, h);
  const canX = near(h.s, m.player.x) + h.can.dx;
  throwAt(m, h, 'bottle', canX + 3);
  assert.equal(h.can.state, 'lidded');
  throwAt(m, h, 'raccoons', canX);
  assert.equal(h.can.state, 'ready');
  assert.equal(h.comeBack, false);
  throwAt(m, h, 'bottle', canX);
  assert.equal(h.can.state, 'burning');
  for (let i = 0; i < 60 * 3; i++) updateHouse(m, h, STEP);
  assert.ok(h.fire > 0);
  assert.equal(h.raccoons, null);
});

test('balloons: three bundles float an untouched house away; one is enough when really harmed', () => {
  const m = run(17);
  isolate(m);
  const h = m.houses[9];
  approach(m, h);
  for (let i = 0; i < 3; i++) throwAt(m, h, 'balloons', near(h.s, m.player.x));
  assert.equal(h.lifting, true);
  for (let i = 0; i < 60 * (T.liftTime + 0.2); i++) updateHouse(m, h, STEP);
  assert.equal(h.gone, true);
  assert.equal(h.cause, 'airlift');
  const g = m.houses[10];
  damage(m, g, 65, 'test');
  approach(m, g);
  throwAt(m, g, 'balloons', near(g.s, m.player.x));
  assert.equal(g.lifting, true);
});

test('owner rule: capture → next skater frees and tows the zombie to the ambulance → 10× bonus → resume', () => {
  const m = run(18);
  isolate(m);
  for (let i = 0; i < 60 * 8 && m.phase === 'playing'; i++) m.tick(STEP, { x: -1 });
  assert.equal(m.phase, 'captured');
  const zombie = m.zombie;
  advance(m, T.captureTime + STEP);
  assert.equal(m.phase, 'rescue');
  assert.equal(m.lives, 2);
  assert.equal(m.player.crew, 1);
  assert.ok(m.player.x < zombie.x);
  // No throwing until the rescue is done.
  m.enqueue('throw', true);
  m.enqueue('throw', false);
  advance(m, STEP * 2);
  assert.equal(m.projectiles.length, 0);
  assert.ok(m.drainEvents().some((e) => e.type === 'noThrow'));
  // Steer onto the zombie, then into the ambulance.
  for (let i = 0; i < 60 * 30 && m.phase === 'rescue'; i++) {
    m.hazards = [];
    m.carts = [];
    const target = m.zombie.state === 'waiting' ? m.zombie : m.ambulance;
    m.tick(STEP, { x: 1, z: Math.sign(target.z - m.player.z) * Math.min(1, Math.abs(target.z - m.player.z) * 2) });
  }
  assert.equal(m.stats.rescues, 1);
  assert.equal(m.phase, 'rescued');
  advance(m, 1.5);
  assert.equal(m.phase, 'bonus');
});

test('owner rule: the 10× bonus is ten passes by ten different skaters from ten points of view', () => {
  assert.equal(BONUS_SKATERS.length, 10);
  assert.equal(new Set(BONUS_SKATERS.map((s) => s.name)).size, 10);
  assert.equal(new Set(BONUS_SKATERS.map((s) => s.pov)).size, 10);
  const m = run(19);
  startBonus(m);
  const before = m.score;
  const seen = [];
  for (let i = 0; i < 60 * 80 && m.phase === 'bonus'; i++) {
    const b = m.bonus;
    const release = b.stage === 'run' && !b.thrown && b.x >= -T.bonusSpeed * T.bonusFlight - 0.05;
    m.tick(STEP, { throw: b.stage === 'run' && !release && !b.thrown ? true : false });
    if (b.stage === 'card' && !seen.includes(b.pass)) seen.push(b.pass);
  }
  assert.equal(m.phase, 'resume');
  assert.deepEqual(seen, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(m.bonus.hits, 10);
  assert.equal(m.score - before, 10 * SCORE.bonusHit * SCORE.bonusMultiplier + SCORE.bonusPerfect);
  advance(m, 1.5);
  assert.equal(m.phase, 'playing');
});

test('last capture offers a continue that resets score and keeps the Row', () => {
  const m = run(20);
  damage(m, m.houses[0], 100, 'test');
  m.lives = 1;
  for (let i = 0; i < 60 * 8 && m.phase === 'playing'; i++) m.tick(STEP, { x: -1 });
  advance(m, T.captureTime + STEP);
  assert.equal(m.phase, 'continue');
  m.enqueue('throw', true);
  advance(m, STEP);
  assert.equal(m.phase, 'playing');
  assert.equal(m.score, 0);
  assert.equal(m.continues, 1);
  assert.equal(m.lives, 3);
  assert.equal(m.houses[0].gone, true);
});

function journal(seed, frameDt) {
  const m = new GameModel(seededRandom(seed));
  m.start();
  const hash = createHash('sha256');
  let acc = 0,
    ticks = 0;
  while (ticks < 40 * 60) {
    acc += frameDt;
    while (acc + 1e-9 >= STEP && ticks < 40 * 60) {
      const phase = Math.floor(m.time * 2) % 6;
      m.tick(STEP, { x: phase < 4 ? 1 : 0, z: phase % 2 ? -1 : 0.4, throw: phase === 1 });
      acc -= STEP;
      ticks++;
    }
    for (const e of m.drainEvents()) hash.update(JSON.stringify(e));
  }
  return hash.digest('hex');
}
test('seeded runs are deterministic and identical at 30, 60 and 120 Hz displays', () => {
  const a = journal(21, 1 / 60);
  assert.equal(a, journal(21, 1 / 60));
  assert.equal(a, journal(21, 1 / 30));
  assert.equal(a, journal(21, 1 / 120));
  assert.notEqual(a, journal(22, 1 / 60));
});
