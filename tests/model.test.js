import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { GameModel, seededRandom } from '../src/model.js';
import { STEP, BEAT_S } from '../src/data/tuning.js';
import { spawnBro, telegraph, updateEnemies } from '../src/sim/enemies.js';
import { pushProtected, addMakeover } from '../src/sim/player.js';
import { impact, startCharge, release } from '../src/sim/throw.js';
import { judge } from '../src/sim/beat.js';
function run(seed = 1) {
  const m = new GameModel(seededRandom(seed));
  m.start();
  advance(m, 8 * BEAT_S + STEP);
  m.houses[0].state = 'open';
  m.houses[0].guard = false;
  m.enemies = [];
  m.attacks = [];
  m.houses[0].porchBeat = 10000;
  return m;
}
function advance(m, seconds, input = {}) {
  for (let i = 0; i < Math.round(seconds / STEP); i++) m.tick(STEP, input);
}
function press(m, action, down = true, beat = m.beat) {
  m.enqueue(action, down, beat);
  m.tick(STEP);
}
const near = (a, b, epsilon = 1e-7) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
test('run starts at x6; 12 arenas, three districts, authored A/C waves and boss bars', () => {
  const m = new GameModel();
  assert.equal(m.player.x, 6);
  assert.equal(m.houses.length, 12);
  assert.deepEqual(
    m.houses.filter((h) => h.bars > 1).map((h) => [h.id, h.bars]),
    [
      [3, 2],
      [7, 2],
      [11, 3],
    ],
  );
  assert.equal(m.houses[4].x, 164);
  assert.equal(m.houses[8].x, 314);
  for (const stand of m.coffeeStands.filter((s) => !s.boss))
    assert.ok(m.houses.every((h) => Math.abs(h.x - stand.x) > 9));
  m.start();
  advance(m, 2);
  assert.equal(m.phase, 'countin');
  assert.equal(m.player.x, 6);
  advance(m, 1);
  assert.equal(m.arena.id, 0);
});
test('neutral does not auto-scroll; exact coasting and bounded depth', () => {
  const m = run();
  const x = m.player.x;
  advance(m, 1);
  near(m.player.x, x);
  advance(m, 1, { x: 1 });
  assert.ok(m.player.vx > 6.49);
  const vx = m.player.vx;
  advance(m, 0.5, { x: 0 });
  near(m.player.vx, vx * Math.exp(-0.6 * 0.5));
  advance(m, 3, { x: -1, z: 1 });
  assert.ok(m.player.vx < 0);
  assert.equal(m.player.z, 4.3);
});
test('hold never repeats throws or pushes; overcharge costs exactly one bottle', () => {
  const m = run();
  m.player.x = 14;
  advance(m, 2, { throw: true, push: true });
  assert.equal(m.events.filter((e) => e.type === 'throw').length, 0);
  assert.equal(m.events.filter((e) => e.type === 'fizzle').length, 1);
  assert.equal(m.events.filter((e) => e.type === 'push').length, 1);
  assert.ok(m.ammo >= 4 && m.ammo < 4.5);
});
test('throws outside arena are silent and free; far toss visibly falls short', () => {
  const m = run();
  m.arena = null;
  const ammo = m.ammo;
  press(m, 'throw');
  press(m, 'throw', false);
  assert.equal(m.projectiles.length, 0);
  assert.equal(m.ammo, ammo);
  m.arena = m.houses[0];
  m.player.x = 14;
  m.player.z = 3;
  press(m, 'throw');
  press(m, 'throw', false);
  assert.equal(m.projectiles[0].toZ, -4.8);
  advance(m, 1);
  assert.equal(m.houses[0].hp, m.houses[0].maxHp);
  assert.ok(m.events.some((e) => e.type === 'miss'));
});
test('fixed aim lead does not move with beat phase; impact is on the beat during freezes', () => {
  const m = run();
  m.player.x = 12;
  m.player.vx = 2;
  press(m, 'throw');
  const target = m.aim().x;
  const playerX = m.player.x,
    velocity = m.player.vx;
  m.beat += 0.4;
  near(m.aim().x, target);
  press(m, 'throw', false);
  const b = m.projectiles[0];
  near(b.toX, playerX + velocity * 0.6);
  m.freeze(2);
  const x = m.player.x;
  while (m.projectiles.length) m.tick(STEP);
  near(m.player.x, x);
  const e = m.events.find((e) => ['impact', 'miss'].includes(e.type));
  assert.ok(Math.abs(e.atBeat - b.landBeat) * BEAT_S <= STEP + 1e-6);
});
test('lob and air mail have distinct charge, reach and guard contracts', () => {
  const m = run();
  m.player.x = 14;
  m.player.z = 3;
  press(m, 'throw');
  advance(m, 0.42);
  press(m, 'throw', false);
  assert.equal(m.projectiles[0].kind, 'lob');
  assert.equal(m.projectiles[0].damage, 2);
  m.houses[0].guard = true;
  const hp = m.houses[0].hp;
  impact(m, { houseId: 0, toX: 14, toZ: -6.6, kind: 'lob', damage: 2, timing: 1 });
  assert.equal(m.houses[0].hp, hp);
  impact(m, { houseId: 0, toX: 15, toZ: -6.6, kind: 'air', damage: 1.5, timing: 1 });
  near(m.houses[0].hp, hp - 1.5);
});
test('ollie preserves 8.4/24 arc, landing lag and permits throwing in lag', () => {
  const m = run();
  press(m, 'ollie');
  assert.equal(m.player.onBoard, false);
  advance(m, 19 / 60);
  near(m.player.jumpHeight, 8.4 / 3 - 12 / 9);
  advance(m, 22 / 60);
  assert.equal(m.player.jumpHeight, 0);
  assert.ok(m.player.landingLag > 0);
  press(m, 'throw');
  assert.ok(m.charge);
  advance(m, 0.12);
  press(m, 'ollie');
  assert.ok(m.player.jumpHeight > 0);
});
test('push has startup, protection and recovery; held input cannot repeat', () => {
  const m = run();
  press(m, 'push');
  assert.equal(pushProtected(m.player), false);
  advance(m, 0.083);
  assert.equal(pushProtected(m.player), true);
  advance(m, 0.26);
  assert.equal(pushProtected(m.player), false);
  assert.ok(m.player.pushCooldown > 1);
});
test('100ms input buffer and hit-stop retain presses until executable', () => {
  const m = run();
  m.player.landingLag = 0.075;
  press(m, 'ollie');
  assert.equal(m.player.jumpHeight, 0);
  advance(m, 0.1);
  assert.ok(m.player.jumpHeight > 0);
  const n = run();
  n.freeze(0.15);
  press(n, 'ollie');
  advance(n, 0.15);
  assert.ok(n.player.jumpHeight > 0);
  assert.equal(n.events.filter((e) => e.type === 'ollie').length, 1);
});
test('LOW parry takes precedence at 100ms, 15ms is a hit; MID push startup is vulnerable', () => {
  for (const [age, expected] of [
    [0.1, 'parry'],
    [0.015, 'hit'],
  ]) {
    const m = run();
    const e = spawnBro(m, 'lax');
    e.age = 2;
    e.state = 'active';
    e.x = m.player.x;
    e.z = m.player.z;
    const a = telegraph(m, e);
    Object.assign(a, {
      state: 'active',
      timer: 0.18,
      tellAge: 1,
      age: 1,
      visibleAge: 2,
      x: m.player.x,
      z: m.player.z,
    });
    m.player.jumpAt = m.motionTime - age;
    m.player.jumpHeight = 0.1;
    m.player.jumpVelocity = 8;
    updateEnemies(m, STEP);
    assert.ok(
      m.events.some((ev) => ev.type === expected),
      expected,
    );
  }
  const m = run();
  m.player.pushAge = 0.05;
  assert.equal(addMakeover(m, 15, { id: 1, age: 1, tellAge: 1 }), true);
});
test('invulnerability does not consume hazards; keg wipeout grants no invulnerability', () => {
  const m = run();
  const a = telegraph(m, { id: 30, x: m.player.x, z: m.player.z, age: 2 }, 'keg');
  Object.assign(a, {
    state: 'active',
    timer: 0.4,
    x: m.player.x,
    targetX: m.player.x,
    targetZ: m.player.z,
    tellAge: 2,
    age: 2,
  });
  m.player.invulnerable = 1;
  updateEnemies(m, STEP);
  assert.ok(m.attacks.includes(a));
  assert.equal(m.player.pipeline, 0);
  m.player.invulnerable = 0;
  assert.equal(addMakeover(m, 8, a, 'keg'), true);
  assert.equal(m.player.invulnerable, 0);
  assert.equal(m.player.wipeout, 0.7);
});
test('finance pitch keeps sprites apart; pong flees on release without bottle contact', () => {
  const m = run();
  const sniper = spawnBro(m, 'pong');
  m.player.x = 14;
  press(m, 'throw');
  press(m, 'throw', false);
  assert.equal(sniper.state, 'flee');
  const bro = spawnBro(m, 'vest');
  bro.state = 'active';
  bro.x = m.player.x;
  bro.z = m.player.z;
  m.player.pitchLock = 1;
  updateEnemies(m, STEP);
  assert.ok(Math.hypot(bro.x - m.player.x, bro.z - m.player.z) >= 1);
});
test('makeover ends on downbeat, comeback adds no damage and third makeover offers continue', () => {
  const m = run();
  for (let life = 3; life > 0; life--) {
    m.phase = 'playing';
    m.player.pipeline = 100;
    m.transform();
    const end = m.transformEnd;
    assert.equal(end % 4, 0);
    assert.ok(end - m.beat >= 6);
    while (m.phase === 'transform') m.tick(STEP);
    assert.equal(m.lives, life - 1);
    if (life > 1) {
      assert.equal(m.riot, 100);
      assert.equal(m.player.pipeline, 0);
      assert.equal(m.player.invulnerable, 2);
      assert.equal(m.maxAmmo, 6 + (3 - life));
    }
  }
  assert.equal(m.phase, 'continue');
  const end = m.continueEnd;
  advance(m, 4 * BEAT_S);
  assert.ok(m.continueEnd === end);
  m.continueRun();
  assert.equal(m.lives, 3);
  assert.equal(m.score, 0);
  assert.equal(m.continues, 1);
});
test('timer includes strips; TIME OVER heals only current chunk and resets to20', () => {
  const m = run();
  m.houses[0].timer = 0.01;
  m.houses[0].chunkHp = 1;
  m.houses[0].timerTell = { id: 88, age: 3, tellAge: 3 };
  m.tick(STEP);
  assert.equal(m.houses[0].timer, 20);
  assert.equal(m.player.pipeline, 30);
  near(m.houses[0].chunkHp, 1 + m.houses[0].chunkMax * 0.25);
});
test('coffee requires actual motion on ground and awards ammo once', () => {
  const m = run(),
    s = m.coffeeStands[0];
  m.arena = null;
  m.player.x = s.x;
  m.player.z = s.z;
  m.player.pipeline = 40;
  m.ammo = 1;
  m.updatePickups();
  assert.equal(s.served, false);
  m.player.vx = 1;
  m.updatePickups();
  assert.equal(s.served, true);
  assert.equal(m.player.pipeline, 22);
  assert.equal(m.ammo, 3);
  m.updatePickups();
  assert.equal(m.ammo, 3);
});
test('judging uses stamped input edges and groove rejects double presses', () => {
  const m = run();
  assert.equal(judge(m, 10 + 0.03 / BEAT_S).grade, 'tight');
  assert.equal(judge(m, 11 + 0.07 / BEAT_S).grade, 'onbeat');
  assert.equal(judge(m, 12 + 0.1 / BEAT_S).grade, 'off');
  m.beatAssist = true;
  assert.equal(judge(m, 13 + 0.1 / BEAT_S).grade, 'onbeat');
  for (let b = 14; b < 18; b++) judge(m, b);
  assert.ok(m.groove >= 4);
  judge(m, 17.1);
  assert.equal(m.groove, 0);
});
test('super emits six bottles but causes exactly five total damage and no Riot feedback', () => {
  const m = run();
  m.houses[0].chunkHp = m.houses[0].chunkMax = 20;
  m.houses[0].hp = m.houses[0].maxHp = 40;
  m.riot = 100;
  press(m, 'super');
  advance(m, 2);
  assert.equal(m.houses[0].hp, 35);
  assert.equal(m.riot, 0);
});
test('30/60/120 render rates and supplied ideal beats give byte-identical event logs for seeds1–20', () => {
  function replay(seed, fps, supplied) {
    const m = new GameModel(seededRandom(seed));
    m.start();
    let accumulator = 0,
      steps = 0,
      logs = [];
    for (let frame = 0; frame < fps * 360; frame++) {
      if (['won', 'lost', 'continue'].includes(m.phase)) break;
      accumulator += 1 / fps;
      while (accumulator >= STEP - 1e-9) {
        const input = {
          x: Math.sin(steps / 120),
          z: Math.cos(steps / 100),
          throw: steps % 60 < 25,
          ollie: steps % 54 === 0,
          push: steps % 130 === 0,
          pressBeat: m.beat,
        };
        if (supplied) input.beat = ((steps + 1) * STEP) / BEAT_S;
        m.tick(STEP, input);
        steps++;
        accumulator -= STEP;
        logs.push(...m.drainEvents());
      }
    }
    return createHash('sha256').update(JSON.stringify(logs)).digest('hex');
  }
  for (let seed = 1; seed <= 20; seed++) {
    const baseline = replay(seed, 60, false);
    for (const fps of [30, 60, 120])
      for (const beat of [false, true])
        assert.equal(replay(seed, fps, beat), baseline, `seed${seed}, fps${fps}, beat${beat}`);
  }
});

test('calibration changes judging only, never charge class, aim lead or flight duration', () => {
  for (const offset of [-0.4, 0, 0.4]) {
    const m = run();
    m.player.x = 14;
    const raw = m.beat;
    startCharge(m, raw - offset / BEAT_S, raw);
    m.beat = raw + 0.39 / BEAT_S;
    release(m, raw + (0.39 - offset) / BEAT_S, raw + 0.39 / BEAT_S);
    assert.equal(m.projectiles[0].kind, 'toss');
    assert.equal(m.projectiles[0].landBeat, Math.ceil(raw + 0.39 / BEAT_S + 1.5));
  }
});
test('a timely release buffered during hitstop cannot fizzle while waiting', () => {
  const m = run();
  m.player.x = 14;
  press(m, 'throw');
  advance(m, 1.65);
  m.freeze(0.4);
  m.tick(STEP, { edges: [{ action: 'throw', down: false, beat: m.beat, rawBeat: m.beat }] });
  advance(m, 0.5);
  assert.equal(m.events.filter((e) => e.type === 'fizzle').length, 0);
  assert.equal(m.events.filter((e) => e.type === 'throw').length, 1);
});
test('media-element fallback widens judging without changing normal windows', () => {
  const m = run();
  assert.equal(judge(m, 10 + 0.1 / BEAT_S).grade, 'off');
  m.timingWindowExtra = 0.025;
  assert.equal(judge(m, 11 + 0.1 / BEAT_S).grade, 'onbeat');
});

test('a throw buffered across a long freeze launches after thaw and still lands on its beat', () => {
  const m = run();
  m.player.x = 14;
  press(m, 'throw');
  advance(m, 0.1);
  m.freeze(1.2);
  m.tick(STEP, { edges: [{ action: 'throw', down: false, beat: m.beat, rawBeat: m.beat }] });
  advance(m, 1.3);
  const bottle = m.projectiles[0];
  assert.ok(bottle && bottle.landBeat > m.beat);
  while (m.projectiles.length) m.tick(STEP);
  const event = m.events.find((e) => e.type === 'impact');
  assert.ok(event && Math.abs(event.atBeat - bottle.landBeat) * BEAT_S <= STEP + 1e-6);
});

test('new runs and continues clear transformation, super and final-phase residue', () => {
  const m = run();
  m.ripped = true;
  m.bannerUntil = 999;
  m.superPending = true;
  m.reset();
  assert.equal(m.ripped, false);
  assert.equal(m.bannerUntil, 0);
  assert.equal(m.superPending, false);
  m.houses.slice(0, 11).forEach((h) => (h.burned = true));
  m.burned = 11;
  m.phase = 'continue';
  m.arena = m.houses[11];
  m.arena.phase = 2;
  m.arena.timer = 1;
  m.arena.deadAir = 30;
  m.conveyor = { age: 10 };
  m.superPending = true;
  m.continueRun();
  assert.equal(m.arena.phase, 0);
  assert.equal(m.arena.timer, 90);
  assert.equal(m.arena.deadAir, 0);
  assert.equal(m.conveyor, null);
  assert.equal(m.superPending, false);
});

test('final KO finishes its400ms freeze and900ms slow-motion before the win screen', () => {
  const m = run();
  m.houses.slice(0, 11).forEach((h) => (h.burned = true));
  m.burned = 11;
  const h = m.houses[11];
  h.chunk = 5;
  h.chunkHp = 1;
  h.lockAt = m.time;
  m.arena = h;
  m.damageHouse(h, 1);
  assert.equal(m.phase, 'ko');
  advance(m, 1.25);
  assert.equal(m.phase, 'ko');
  advance(m, 0.1);
  assert.equal(m.phase, 'won');
  assert.equal(m.burned, 12);
});
