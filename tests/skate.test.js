import assert from 'node:assert/strict';
import test from 'node:test';
import { GameModel, seededRandom } from '../src/model.js';
import { STEP, TUNING as T, TRICKS, DIFFICULTY } from '../src/data/tuning.js';
import { LAP, near, ROW } from '../src/sim/row.js';
import { CAMPUSES, DISCLAIMER } from '../src/data/campuses.js';
import { STATIONS, startTraining, finishTraining } from '../src/sim/training.js';
import { ALLEY_LENGTH } from '../src/sim/alley.js';
import { capture } from '../src/sim/crew.js';

function run(seed = 1, options = {}) {
  const m = new GameModel(seededRandom(seed), options);
  m.start();
  for (let i = 0; i < Math.round(1.9 / STEP); i++) m.tick(STEP, {});
  m.hazards = [];
  m.rails = [];
  for (const h of m.houses) h.bros = [];
  return m;
}
function advance(m, seconds, input = {}) {
  const events = [];
  for (let i = 0; i < Math.round(seconds / STEP); i++) {
    m.tick(STEP, input);
    events.push(...m.drainEvents());
  }
  return events;
}
const press = (m, action, down = true) => m.enqueue(action, down);
// A quick key tap: press and release land in the same tick.
const tap = (m, action) => {
  m.enqueue(action, true);
  m.enqueue(action, false);
};
// Fly until the skater is back on the ground (or a rail, or down).
function airborne(m, each = () => {}) {
  const events = [];
  for (let i = 0; i < 600 && (i === 0 || !(m.player.grounded || m.player.grind || m.player.wipeout > 0)); i++) {
    each(m);
    m.tick(STEP, {});
    events.push(...m.drainEvents());
  }
  return events;
}
const types = (events, type) => events.filter((e) => e.type === type);

test('kick to go: holding → kick-pushes every half second up to cruise; letting go glides', () => {
  const m = run(1);
  m.player.vx = 0;
  const events = advance(m, 4, { x: 1 });
  const kicks = types(events, 'kick').filter((e) => !e.lazy);
  assert.equal(kicks.length, Math.ceil(T.cruise / T.kickImpulse));
  assert.ok(Math.abs(m.player.vx - T.cruise) < 1e-6);
  advance(m, 2, { x: 0 });
  assert.ok(m.player.vx < T.cruise && m.player.vx >= T.roll);
  m.player.vx = 1;
  const lazy = types(advance(m, 2.5, { x: 0 }), 'kick').filter((e) => e.lazy);
  assert.ok(lazy.length >= 2 && m.player.vx > 3, 'gliding never stops on its own');
  advance(m, 4, { x: 0 });
  assert.ok(m.player.vx >= T.roll - 0.2);
});
test('slow down: ← drags a foot, and above 5 m/s it is a powerslide', () => {
  const m = run(2);
  m.player.vx = 8;
  const events = advance(m, 0.2, { x: -1 });
  assert.equal(types(events, 'slide').length, 1);
  assert.ok(m.player.vx < 8 - T.slideDecel * 0.15);
  m.player.vx = 3;
  advance(m, 0.1, { x: -1 });
  assert.equal(m.player.dragging, true);
});
test('Alto backflip: a tap is a plain ollie; holding Space in the air rotates; land upright or bail', () => {
  const tap = run(3);
  press(tap, 'ollie', true);
  advance(tap, 0.05);
  press(tap, 'ollie', false);
  const tapEvents = advance(tap, 1);
  assert.equal(types(tapEvents, 'trick').length, 0);
  assert.equal(tap.stats.wipeouts, 0);
  // Ramp-height air with the button held long enough for one full rotation.
  const flip = run(4);
  flip.player.vy = T.rampVelocity;
  flip.player.grounded = false;
  flip.held.ollie = true;
  let events = [];
  for (let i = 0; i < 600 && !flip.player.grounded && flip.player.wipeout <= 0; i++) {
    if (Math.abs(flip.player.rotTotal) >= Math.PI * 2 - 0.05) flip.held.ollie = false;
    flip.tick(STEP, {});
    events.push(...flip.drainEvents());
  }
  assert.equal(flip.stats.wipeouts, 0, 'landed upright');
  assert.ok(types(events, 'trick').some((e) => e.text === 'BACKFLIP'));
  // Holding through all of a ramp's air over-rotates into a bail.
  const bail = run(5);
  bail.player.vy = T.rampVelocity;
  bail.player.grounded = false;
  bail.held.ollie = true;
  airborne(bail);
  assert.equal(bail.stats.wipeouts, 1);
});
test('holding Space through a flat-ground ollie is exactly one clean backflip; a short hold rights itself', () => {
  const m = run(18);
  press(m, 'ollie', true);
  const events = airborne(m);
  press(m, 'ollie', false);
  assert.equal(m.stats.wipeouts, 0);
  assert.ok(types(events, 'trick').some((e) => e.text === 'BACKFLIP'));
  assert.equal(types(events, 'land')[0].clean, true);
  // A sloppy 0.25 s "tap": the skater starts to rotate, lets go, and spots the landing.
  const s = run(19);
  press(s, 'ollie', true);
  const sloppy = airborne(s, (mm) => {
    if (mm.player.airAge > 0.25 && mm.held.ollie) press(mm, 'ollie', false);
  });
  assert.equal(s.stats.wipeouts, 0);
  assert.equal(types(sloppy, 'trick').length, 0);
});
test('a tap buffered during landing lag still releases, so the next ollie does not spin', () => {
  const m = run(20);
  m.player.landingLag = T.landingLag;
  tap(m, 'ollie');
  advance(m, 0.2);
  assert.equal(m.held.ollie, false);
  assert.equal(m.stats.ollies, 1);
  const events = airborne(m);
  assert.equal(types(events, 'trick').length, 0);
});
test('flip tricks: an arrow tap in the air flips the board; landing mid-flip is a bail', () => {
  const m = run(6);
  tap(m, 'ollie');
  advance(m, 0.08);
  press(m, 'up');
  const events = advance(m, 1);
  assert.ok(types(events, 'trick').some((e) => e.text === 'KICKFLIP'));
  assert.equal(m.stats.wipeouts, 0);
  const late = run(7);
  tap(late, 'ollie');
  advance(late, 0.5);
  press(late, 'right');
  advance(late, 1);
  assert.equal(late.stats.wipeouts, 1, '360 flip started too late');
});
test('grinds: come down onto a rail to grind; it holds speed and scores by the second', () => {
  const m = run(8);
  const x = m.player.x;
  m.rails = [{ id: 1, kind: 'rail', s0: (x + 2) % LAP, s1: (x + 12) % LAP, z: m.player.z, h: 0.45 }];
  tap(m, 'ollie');
  const events = advance(m, 3);
  const grind = types(events, 'grind')[0],
    end = types(events, 'grindEnd')[0];
  assert.ok(grind, 'caught the rail');
  assert.ok(end.seconds > 0.8, `ground ${end.seconds}s`);
  assert.ok(types(events, 'trick').some((e) => e.text === 'BOARDSLIDE' && e.points > TRICKS.grind));
});
test('small hazards stumble you, big ones wipe you out', () => {
  const m = run(9);
  const x = m.player.x;
  m.hazards = [{ id: 1, kind: 'cone', s: (x + 2) % LAP, z: m.player.z, hx: 0.3, hz: 0.3, h: 0.7 }];
  advance(m, 1);
  assert.equal(m.stats.stumbles, 1);
  assert.equal(m.stats.wipeouts, 0);
  m.hazards = [{ id: 2, kind: 'keg', s: (m.player.x + 2) % LAP, z: m.player.z, hx: 0.35, hz: 0.35, h: 0.6 }];
  advance(m, 1);
  assert.equal(m.stats.wipeouts, 1);
});
test('brushing the side of a ledge nudges you off it; only a head-on hit trips you', () => {
  const m = run(21);
  const x = m.player.x,
    z = m.player.z;
  m.hazards = [{ id: 1, kind: 'flatbar', s: (x + 3) % LAP, z: z + 1, hx: 4, hz: 0.22, h: 0.45, rail: true }];
  advance(m, 1, { x: 0, z: 1 });
  assert.equal(m.stats.stumbles, 0);
  assert.ok(m.player.z < z + 1 - 0.4, 'held off the side');
  m.hazards = [{ id: 2, kind: 'flatbar', s: (m.player.x + 3) % LAP, z: m.player.z, hx: 2, hz: 0.22, h: 0.45, rail: true }];
  advance(m, 1, { x: 0, z: 0 });
  assert.equal(m.stats.stumbles, 1);
});
test('combos bank after landing, multiply by variety, fill FLOW, and FLOW smashes hazards', () => {
  const m = run(10);
  m.player.vy = T.rampVelocity;
  m.player.grounded = false;
  m.held.ollie = true;
  press(m, 'up');
  let events = [];
  for (let i = 0; i < 600 && !m.player.grounded; i++) {
    if (Math.abs(m.player.rotTotal) >= Math.PI * 2 - 0.05) m.held.ollie = false;
    m.tick(STEP, {});
    events.push(...m.drainEvents());
  }
  events.push(...advance(m, 1.2));
  const banked = types(events, 'combo')[0];
  assert.ok(banked, 'combo banked');
  assert.equal(banked.mult, 2);
  assert.equal(banked.points, (TRICKS.backflip + 150) * 2);
  assert.ok(m.flow > 0);
  m.flow = 100;
  m.flowTime = T.flowTime;
  m.hazards = [{ id: 3, kind: 'cone', s: (m.player.x + 2) % LAP, z: m.player.z, hx: 0.3, hz: 0.3, h: 0.7 }];
  const smashed = advance(m, 1);
  assert.equal(types(smashed, 'smash').length, 1);
  assert.equal(m.stats.stumbles, 0);
});
test('perfect pop: ollie again right after a clean landing keeps the combo alive', () => {
  const m = run(11);
  tap(m, 'ollie');
  press(m, 'up');
  const landed = airborne(m);
  assert.equal(types(landed, 'land')[0]?.clean, true);
  tap(m, 'ollie');
  const events = advance(m, 0.1);
  assert.ok(types(events, 'trick').some((e) => e.text === 'PERFECT'));
});
test('throwing off a rail or mid-trick is worth more (style multipliers)', () => {
  const m = run(12);
  const h = m.houses[2];
  m.player.x = near(h.s, m.player.x) - 9;
  m.player.z = -2.4;
  m.player.grind = { rail: { h: 0.45, z: -2.4, kind: 'rail' }, x1: m.player.x + 50, t: 0, name: 'BOARDSLIDE' };
  m.player.grounded = false;
  press(m, 'throw', true);
  advance(m, 0.05);
  press(m, 'throw', false);
  advance(m, 0.05);
  assert.equal(m.projectiles[0]?.style, 1.5);
});
test('training course: stations teach kick, glide, slow, ollie, throw, backflip, grind and flip; Enter skips', () => {
  assert.deepEqual(STATIONS.map((s) => s.id), ['kick', 'glide', 'slow', 'ollie', 'throw', 'backflip', 'grind', 'flip', 'pipeline']);
  const m = new GameModel(seededRandom(13), { training: true });
  m.start();
  assert.equal(m.phase, 'training');
  assert.equal(m.level, 'training');
  const events = advance(m, 3, { x: 1 });
  assert.ok(types(events, 'stationDone').some((e) => e.station === 'kick'));
  press(m, 'skip');
  const after = advance(m, 0.05);
  assert.ok(types(after, 'trainingDone').length === 1);
  assert.equal(m.phase, 'countin');
  assert.equal(m.level, 'row');
  assert.ok(m.hazards.length > 0, 'Row hazards restored');
});
test('training: the throw lesson is a slow zone; lighting all three practice cans completes it', () => {
  const m = new GameModel(seededRandom(14), { training: true });
  m.start();
  m.course.station = STATIONS.findIndex((s) => s.id === 'throw') - 1;
  m.course.done = true;
  m.player.x = STATIONS[m.course.station].x1 - 0.1;
  advance(m, 0.1, { x: 1 });
  assert.equal(STATIONS[m.course.station].id, 'throw');
  m.player.z = -2.6;
  m.player.vx = 7;
  advance(m, 1.5, { x: 1 });
  assert.ok(m.player.vx <= 3.6 + 1e-6, `slow zone holds ${m.player.vx}`);
  let holding = false,
    done = false;
  const lit = [];
  for (let i = 0; i < 60 * 40 && !done; i++) {
    const a = m.aim();
    if (!holding && a.target) {
      press(m, 'throw', true);
      holding = true;
    } else if (holding && (a.locked || !a.target)) {
      press(m, 'throw', false);
      holding = false;
    }
    m.tick(STEP, { x: 1 });
    for (const e of m.drainEvents()) {
      if (e.type === 'practiceHit') lit.push(e.text);
      if (e.type === 'stationDone' && e.station === 'throw') done = true;
    }
  }
  assert.deepEqual(lit, ['1 / 3 LIT!', '2 / 3 LIT!', '3 / 3 LIT!']);
  assert.ok(done);
});
test('Bee Alley: the apiary pad opens a side run; grab hives; standing still gets you noticed', () => {
  const m = run(15);
  m.player.x = near(ROW.shops[0].s, m.player.x) - 3;
  m.player.z = -3.6;
  advance(m, 1.2);
  assert.equal(m.level, 'alley');
  // Steer toward the next hive; ollie up to the ones on fence posts.
  const events = [];
  for (let i = 0; i < 40 / STEP && m.level === 'alley'; i++) {
    const p = m.player,
      next = m.alley.hives.find((h) => !h.taken && h.x > p.x - 0.5);
    let z = 0;
    if (next) {
      z = Math.max(-1, Math.min(1, (next.z - p.z) * 3));
      if (next.h > 0 && p.grounded && next.x - p.x < 1.6 && next.x - p.x > 0.4) tap(m, 'ollie');
    }
    m.tick(STEP, { x: 1, z });
    events.push(...m.drainEvents());
  }
  assert.equal(types(events, 'hive').length, 6, 'all six hives (extras over the cap are honey)');
  assert.ok(types(events, 'grind').some((e) => e.text === 'SMITH GRIND'), 'the fence-post hive leads onto the ledge');
  assert.ok(types(events, 'hive').some((e) => e.full && e.text === 'HIVES FULL: +HONEY'));
  assert.equal(types(events, 'alleyExit')[0].how, 'done');
  assert.equal(m.level, 'row');
  assert.equal(m.unlocked.bees, true);
  assert.ok(m.items.bees >= 2);
  const slow = run(16);
  slow.player.x = near(ROW.shops[0].s, slow.player.x) - 3;
  slow.player.z = -3.6;
  advance(slow, 1.2);
  const stalled = advance(slow, DIFFICULTY.easy.notice + 2, { x: -1 });
  const noticed = types(stalled, 'noticed')[0];
  assert.ok(noticed, 'a bro noticed');
  assert.equal(slow.level, 'row');
  assert.equal(slow.stats.captures, 0, 'the Pipeline waits while you are in the alley');
  assert.ok(ALLEY_LENGTH > 60);
});
test('days: each new lap opens THE DAILY PIPELINE with a headline; any key skips it', () => {
  const m = run(17);
  m.player.x = LAP - 1;
  const events = advance(m, 0.3, { x: 1 });
  const paper = types(events, 'newspaper')[0];
  assert.ok(paper, 'newspaper shown');
  assert.equal(paper.day, 'TUESDAY');
  assert.ok(paper.headline.length > 5);
  assert.equal(m.phase, 'newspaper');
  press(m, 'ollie');
  advance(m, 0.05);
  assert.equal(m.phase, 'newspaper', 'too-early presses are ignored (no accidental skips)');
  advance(m, 0.3);
  press(m, 'ollie');
  advance(m, 0.05);
  assert.equal(m.phase, 'playing');
});
test('difficulty: Easy Street is the default; points multiply ×1/×2/×3; the Pipeline is slower on easy', () => {
  assert.equal(new GameModel().difficulty, 'easy');
  for (const [id, mult] of [['easy', 1], ['medium', 2], ['hard', 3]]) {
    const m = new GameModel(seededRandom(1), { difficulty: id });
    m.award(100);
    assert.equal(m.score, 100 * mult);
  }
  assert.ok(DIFFICULTY.easy.hordeSpeed < DIFFICULTY.medium.hordeSpeed);
  assert.equal(DIFFICULTY.easy.notice, 3);
});
// A broad list of real Greek-letter organizations. Fictional chapters must never match one.
const REAL = ['ΑΓΡ', 'ΑΔΦ', 'ΑΕΠ', 'ΑΚΛ', 'ΑΣΦ', 'ΑΤΩ', 'ΑΧΡ', 'ΒΘΠ', 'ΒΥΧ', 'ΧΦ', 'ΧΨ', 'ΔΚΕ', 'ΔΦ', 'ΔΣΦ', 'ΔΤΔ', 'ΔΥ', 'ΔΧ', 'ΚΑ', 'ΚΔΡ', 'ΚΣ', 'ΚΚΨ', 'ΛΧΑ', 'ΛΦΕ', 'ΦΓΔ', 'ΦΚΨ', 'ΦΚΣ', 'ΦΚΤ', 'ΦΣΚ', 'ΦΜΔ', 'ΠΚΑ', 'ΠΚΦ', 'ΨΥ', 'ΣΑΕ', 'ΣΑΜ', 'ΣΒΡ', 'ΣΧ', 'ΣΝ', 'ΣΦΕ', 'ΣΠ', 'ΣΤΓ', 'ΤΔΦ', 'ΤΚΕ', 'ΘΔΧ', 'ΘΧ', 'ΘΞ', 'ΤΕΦ', 'ΖΒΤ', 'ΖΨ', 'ΑΔ', 'ΣΦ', 'ΔΨ', 'ΑΦ', 'ΑΦΑ', 'ΑΧΩ', 'ΑΟΠ', 'ΑΞΔ', 'ΑΓΔ', 'ΑΔΠ', 'ΑΕΦ', 'ΑΚΑ', 'ΔΔΔ', 'ΔΓ', 'ΔΖ', 'ΓΦΒ', 'ΚΔ', 'ΚΚΓ', 'ΚΑΘ', 'ΦΜ', 'ΦΣΣ', 'ΠΒΦ', 'ΣΚ', 'ΣΔΤ', 'ΖΤΑ', 'ΚΚΚ', 'ΨΚ', 'ΘΔ'];
test('campuses: eight Ivy League settings, twelve FICTIONAL chapters each, never a real organization', () => {
  assert.deepEqual(CAMPUSES.map((c) => c.id).sort(), ['brown', 'columbia', 'cornell', 'dartmouth', 'harvard', 'penn', 'princeton', 'yale']);
  assert.match(DISCLAIMER, /Fictional chapters/);
  const greekOnly = /^[Α-Ω]+$/;
  for (const c of CAMPUSES) {
    assert.equal(c.chapters.length, 12);
    assert.equal(c.styles.length, 12);
    assert.equal(c.chapters[11].name, 'THE PIPELINE');
    for (const ch of c.chapters) {
      assert.ok(ch.name && ch.letters && ch.motto && ch.ko);
      assert.ok(ch.ko.length <= 24, ch.ko);
      assert.ok(!REAL.includes(ch.letters), `${c.id} ${ch.letters}`);
      // Pure-Greek letter sets must be 4+ letters (English words), never a 2–3 letter real-style name.
      if (greekOnly.test(ch.letters)) assert.ok(ch.letters.length >= 4, `${c.id} ${ch.letters}`);
    }
    const m = new GameModel(seededRandom(1), { campus: c.id });
    assert.equal(m.houses[0].name, c.chapters[0].name);
  }
});
test('the skate-school course is solvable by following the bubbles (trainer bot, no retries)', async () => {
  const { trainer } = await import('../scripts/bots/policies.mjs');
  const { perceive } = await import('../src/layout.js');
  const m = new GameModel(seededRandom(31), { training: true });
  const policy = trainer();
  m.start();
  const done = [],
    retries = [];
  for (let i = 0; i < 90 / STEP && m.level === 'training'; i++) {
    m.tick(STEP, policy(perceive(m)));
    for (const e of m.drainEvents()) {
      if (e.type === 'stationDone') done.push(e.station);
      if (e.type === 'stationRetry') retries.push(e.station);
    }
  }
  assert.deepEqual(done, ['kick', 'glide', 'slow', 'ollie', 'throw', 'backflip', 'grind', 'flip']);
  assert.deepEqual(retries, []);
  assert.equal(m.phase, 'countin');
  assert.equal(m.score, 0, 'practice points stay on the quad');
  assert.ok(m.time < 80, `training took ${m.time.toFixed(1)} s`);
});

// Browser-style key edges (main.js passes these; held state follows them).
const keys = (...pairs) => ({ edges: pairs.map(([action, down]) => ({ action, down })) });
test('jump buffer: Space tapped just before landing pops a PERFECT ollie on touchdown, and never spins', () => {
  const probe = run(22);
  probe.tick(STEP, keys(['ollie', true], ['ollie', false]));
  let landTick = 0;
  for (let i = 1; !landTick && i < 200; i++) {
    probe.tick(STEP, {});
    if (types(probe.drainEvents(), 'land').length) landTick = i;
  }
  for (let early = 1; early <= 4; early++) {
    const m = run(22);
    m.tick(STEP, keys(['ollie', true], ['ollie', false]));
    m.drainEvents();
    const events = [];
    let rot = 0;
    for (let i = 1; i < landTick + 60; i++) {
      // A one-frame tap: down `early` ticks before touchdown, up on the next tick.
      m.tick(STEP, i === landTick - early ? keys(['ollie', true]) : i === landTick - early + 1 ? keys(['ollie', false]) : {});
      events.push(...m.drainEvents());
      if (i > landTick) rot = Math.min(rot, m.player.rot);
    }
    const pop = types(events, 'ollie');
    assert.equal(pop.length, 1, `pressed ${early} ticks early`);
    assert.equal(pop[0].perfect, true, `pressed ${early} ticks early`);
    assert.deepEqual(types(events, 'trick').map((e) => e.text), ['PERFECT']);
    assert.ok(types(events, 'land').every((e) => e.clean));
    assert.equal(m.stats.wipeouts, 0);
    assert.equal(rot, 0, 'the tap let go, so the second ollie does not backflip');
  }
});
test('a bail while shielded (after a get-up, rescue or continue) is a sketchy landing that drops the trick', () => {
  const m = run(23);
  tap(m, 'ollie');
  advance(m, 0.1);
  press(m, 'push'); // grab
  advance(m, 0.25);
  m.player.invulnerable = 2;
  press(m, 'right'); // a 360 flip, far too late
  const events = airborne(m);
  press(m, 'push', false);
  assert.equal(m.stats.wipeouts, 0);
  assert.equal(m.player.flip, null, 'no board left mid-flip on the ground');
  assert.equal(m.player.grab, 0);
  assert.equal(types(events, 'trick').length, 0, 'the flip and grab are lost');
  assert.equal(types(events, 'land')[0]?.clean, false);
  // Onto a rail: a sketchy catch, no hovering at rail height, no flip points.
  const r = run(4);
  r.player.vx = 6;
  r.player.z = 0.2;
  r.rails = [{ id: 1, kind: 'rail', s0: r.player.x + 3, s1: r.player.x + 12, z: 0.2, h: 0.45, abs: true }];
  tap(r, 'ollie');
  advance(r, 0.32);
  r.player.invulnerable = 2;
  press(r, 'right');
  const caught = airborne(r);
  assert.ok(r.player.grind, 'caught the rail');
  assert.equal(r.stats.wipeouts, 0);
  assert.equal(r.player.flip, null);
  assert.ok(!types(caught, 'trick').some((e) => e.text === '360 FLIP'));
});
test('a wipeout in mid-air knocks the skater down to the street: no hovering, no landing or BIG AIR after', () => {
  for (const ramp of [false, true]) {
    const m = run(24);
    m.player.vx = 7;
    if (ramp) m.hazards = [{ id: 1, kind: 'ramp', s: m.player.x + 1.5, z: m.player.z, z0: m.player.z, hx: 0.9, hz: 0.7, h: 0, abs: true, taken: false }];
    else tap(m, 'ollie');
    advance(m, 0.2);
    assert.equal(m.player.grounded, false);
    m.carts.push({ id: 99, x: m.player.x + 0.8, z: m.player.z, vx: 0, hx: 1.3, hz: 0.7, h: 1.6, honked: true });
    const events = advance(m, 0.5);
    m.carts = [];
    assert.equal(m.stats.wipeouts, 1);
    assert.equal(m.player.grounded, true, 'fell to the street while down');
    assert.equal(m.player.y, 0);
    events.push(...advance(m, 1.5));
    assert.equal(types(events, 'land').length, 0, 'no clean landing after getting up');
    assert.equal(types(events, 'trick').length, 0);
  }
});
test('↑/↓ hopping off a rail is the jump: Space right after it is not a second ollie', () => {
  const m = run(8);
  const x = m.player.x;
  m.player.z = 0;
  m.rails = [{ id: 1, kind: 'rail', s0: x - 1, s1: x + 30, z: 0, h: 0.45, abs: true }];
  m.player.grind = { rail: m.rails[0], x1: x + 30, t: 0, name: 'BOARDSLIDE' };
  m.player.grounded = false;
  m.player.y = 0.45;
  press(m, 'up');
  advance(m, 1 / 60);
  tap(m, 'ollie');
  const events = advance(m, 1 / 60);
  assert.equal(types(events, 'ollie').length, 0);
});
test('a PERFECT pop or a power kick never slows a skater who is already faster (FLOW)', () => {
  const m = run(25);
  m.flowTime = T.flowTime;
  m.player.vx = 12;
  m.player.landClean = true;
  m.player.landAt = m.time;
  tap(m, 'ollie');
  const events = advance(m, 1 / 60);
  assert.equal(types(events, 'ollie')[0]?.perfect, true);
  assert.ok(m.player.vx >= 12 - 1e-9, `${m.player.vx}`);
  const k = run(26);
  k.player.vx = 11.8;
  press(k, 'push');
  advance(k, 1 / 60);
  assert.ok(k.player.vx >= 11.8 - 0.1, `${k.player.vx}`);
});
test('grinding the curb across the apiary pad ends the grind at the gate (no phantom grind in Bee Alley)', () => {
  const m = new GameModel(seededRandom(15));
  m.start();
  advance(m, 1.9);
  m.hazards = [];
  for (const h of m.houses) h.bros = [];
  const shop = ROW.shops[0].s,
    curb = m.rails.find((r) => r.kind === 'curb' && r.s0 < shop && r.s1 > shop);
  assert.ok(curb, 'a curb runs across the apiary pad');
  Object.assign(m.player, { x: shop - 12, z: curb.z, y: 0.5, vy: -1, grounded: false, vx: 7 });
  const events = [];
  for (let i = 0; i < 300 && m.level !== 'alley'; i++) {
    m.tick(STEP, {});
    events.push(...m.drainEvents());
  }
  assert.ok(types(events, 'grind').length === 1, 'grinding the curb');
  assert.equal(m.level, 'alley');
  assert.equal(m.player.grind, null);
  assert.equal(m.player.grounded, true);
  assert.equal(m.player.y, 0);
  assert.ok(types(events, 'grindEnd').length === 1 && types(events, 'trick').some((e) => e.text === '5-0 GRIND'), 'the curb grind banked at the gate');
  advance(m, 1, { x: 1, z: -1 });
  assert.ok(m.player.z < -0.5, 'free to carve for the hives');
});
test('mid-rescue the apiary pad hands out nothing: beehives only come from Bee Alley (owner rule 8)', () => {
  const m = run(21);
  m.player.x = ROW.shops[0].s - 30;
  capture(m);
  for (let i = 0; i < 6 / STEP && m.phase !== 'rescue'; i++) m.tick(STEP, {});
  assert.equal(m.phase, 'rescue');
  const events = [];
  for (let i = 0; i < 12 / STEP && m.phase === 'rescue' && m.player.x < near(ROW.shops[0].s, m.player.x) + 6; i++) {
    m.tick(STEP, { x: 1, z: -1 });
    events.push(...m.drainEvents());
  }
  assert.ok(m.player.x > ROW.shops[0].s + 4, 'rolled over the pad');
  assert.equal(m.level, 'row');
  assert.equal(m.unlocked.bees, undefined);
  assert.equal(m.items.bees, undefined);
  assert.equal(m.shopVisits[0], 0, "today's alley visit is still open");
  assert.equal(types(events, 'unlock').length, 0);
});
test('skate-school points, FLOW and stats do not carry into the run or its first newspaper', () => {
  const m = new GameModel(seededRandom(27), { training: true });
  m.start();
  Object.assign(m, { score: 1822, flow: 45, flowTime: 3, dayBestCombo: 1000 });
  Object.assign(m.stats, { tricks: 5, backflips: 3, ollies: 4, bestCombo: 1000 });
  press(m, 'skip');
  advance(m, 1 / 60);
  assert.equal(m.phase, 'countin');
  assert.equal(m.score, 0);
  assert.equal(m.flow, 0);
  assert.equal(m.flowTime, 0);
  assert.equal(m.stats.tricks + m.stats.backflips + m.stats.ollies + m.stats.bestCombo, 0);
  assert.equal(m.dayStart.backflips, 0);
  assert.equal(m.dayBestCombo, 0);
});
test("the newspaper's BEST COMBO is yesterday's, and combo points include the route multiplier", () => {
  const m = run(28, { difficulty: 'medium' });
  m.player.vy = T.jumpVelocity;
  m.player.grounded = false;
  press(m, 'up');
  airborne(m);
  const banked = types(advance(m, 1.2), 'combo')[0];
  assert.equal(banked.points, 150 * 2, 'popup = what the score gained (Middle Road ×2)');
  assert.equal(m.stats.bestCombo, 300);
  m.player.x = LAP - 1;
  const paper = types(advance(m, 0.3, { x: 1 }), 'newspaper')[0];
  assert.deepEqual(paper.stats.at(-1), ['BEST COMBO', '300']);
  for (let i = 0; i < 4 && m.phase === 'newspaper'; i++) {
    press(m, 'ollie');
    advance(m, 0.2);
  }
  m.player.x = 2 * LAP - 1;
  const quiet = types(advance(m, 0.3, { x: 1 }), 'newspaper')[0];
  assert.deepEqual(quiet.stats.at(-1), ['BEST COMBO', '0'], 'a quiet day reports no combo');
});
test('reset() drops the parked Row street: a new run never reuses an abandoned skate-school stash', () => {
  const m = new GameModel(seededRandom(29), { training: true });
  m.start();
  assert.ok(m.rowHazards);
  m.difficulty = 'hard';
  m.trainingOn = false;
  m.reset();
  assert.equal(m.rowHazards, null);
  assert.equal(m.rowRails, null);
  const fresh = m.hazards,
    rails = m.rails;
  m.start();
  assert.equal(m.hazards, fresh);
  assert.equal(m.rails, rails);
  // Dev ?scene=training starts the course directly; finishing still restores the Row.
  const d = new GameModel(seededRandom(30));
  const row = d.hazards,
    rowRails = d.rails;
  startTraining(d);
  finishTraining(d);
  assert.equal(d.hazards, row);
  assert.equal(d.rails, rowRails);
});
test('releases dropped by phases that clear the input queue still let go of held keys', () => {
  const m = run(9);
  m.tick(STEP, keys(['push', true], ['ollie', true]));
  capture(m);
  m.tick(STEP, keys(['push', false], ['ollie', false]));
  for (let i = 0; i < 400 && m.phase !== 'rescue'; i++) m.tick(STEP, {});
  assert.equal(m.phase, 'rescue');
  assert.equal(Boolean(m.held.push), false);
  assert.equal(Boolean(m.held.ollie), false);
  for (const phase of ['rescued', 'resume', 'victory']) {
    const p = run(9);
    p.phase = phase;
    p.phaseTime = 0;
    p.tick(STEP, keys(['push', true], ['ollie', true], ['throw', true]));
    p.tick(STEP, keys(['push', false], ['ollie', false], ['throw', false]));
    assert.deepEqual([p.held.push, p.held.ollie, p.held.throw], [false, false, false], phase);
  }
});
