import assert from 'node:assert/strict';
import test from 'node:test';
import { IDLE_MS, Session } from '../src/session.js';
import { gamepadState, radial } from '../src/controls.js';
import { GameAudio } from '../src/audio.js';
const admission = {
  token: 'a'.repeat(64),
  status: 'active',
  activeCount: 1,
  capacity: 20,
  leaseSeconds: 75,
  heartbeatSeconds: 15,
  sessionSecondsRemaining: 1200,
};
function setup(options = {}) {
  let now = 0;
  const scheduled = [],
    calls = [];
  let expired = 0,
    admitted = 0,
    warnings = 0;
  const session = new Session({
    request: (action, data) =>
      new Promise((resolve, reject) => calls.push({ action, data, resolve, reject })),
    now: () => now,
    timer: (fn, ms) => {
      scheduled.push({ fn, ms });
      return scheduled.length;
    },
    clear: () => {},
    onExpired: () => expired++,
    onAdmitted: () => admitted++,
    onWarning: () => warnings++,
    ...options,
  });
  return {
    session,
    calls,
    scheduled,
    advance: (ms) => (now += ms),
    stats: () => ({ expired, admitted, warnings }),
  };
}
test('cancelled join releases late admission', async () => {
  const p = setup();
  const join = p.session.join();
  await p.session.leave();
  p.calls[0].resolve(admission);
  await new Promise((r) => setImmediate(r));
  assert.equal(p.calls[1].action, 'leave');
  p.calls[1].resolve({});
  await join;
  assert.equal(p.stats().admitted, 0);
});
test('heartbeat retries2/4/8s without pausing;410 and actual expiration pause', async () => {
  const p = setup();
  p.session.accept(admission, 0);
  for (const delay of [2000, 4000, 8000]) {
    const heartbeat = p.session.heartbeat();
    p.calls.at(-1).reject(new Error('network'));
    await heartbeat;
    assert.equal(p.scheduled.at(-1).ms, delay);
    assert.equal(p.stats().expired, 0);
  }
  const heartbeat = p.session.heartbeat();
  p.calls.at(-1).reject(Object.assign(new Error(), { status: 410 }));
  await heartbeat;
  assert.equal(p.stats().expired, 1);
});
test('lease uses request start, warns once at60 seconds', () => {
  const p = setup();
  p.advance(6000);
  p.session.accept({ ...admission, sessionSecondsRemaining: 59 }, 0);
  assert.equal(p.session.leaseUntil, 75000);
  assert.equal(p.stats().warnings, 1);
  p.session.accept({ ...admission, sessionSecondsRemaining: 50 }, 0);
  assert.equal(p.stats().warnings, 1);
  p.advance(69000);
  p.session.check();
  assert.equal(p.stats().expired, 1);
  p.session.check();
  assert.equal(p.stats().expired, 1);
  assert.equal(p.session.expired, true);
});
test('hidden-tab heartbeats release an idle seat instead of renewing it', async () => {
  let released = 0;
  const p = setup({
    releaseIfIdle: () => {
      if (!p.session.idle()) return false;
      released++;
      p.session.leave();
      return true;
    },
  });
  p.session.accept(admission, 0);
  p.advance(IDLE_MS);
  const renewal = p.session.heartbeat();
  assert.equal(p.calls.at(-1).action, 'heartbeat');
  p.calls.at(-1).resolve(admission);
  await renewal;
  p.advance(1);
  await p.session.heartbeat();
  assert.equal(released, 1);
  assert.equal(p.calls.at(-1).action, 'leave');
  assert.equal(p.calls.filter((call) => call.action === 'heartbeat').length, 1);
});
test('gamepad maps ollie, throw, push, item, pause, skip and trick directions; radial dead zone', () => {
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
  buttons[0].pressed = true;
  buttons[7].pressed = true;
  buttons[5].pressed = true;
  buttons[3].pressed = true;
  buttons[9].pressed = true;
  const state = gamepadState({ axes: [0.1, 0.1], buttons });
  assert.deepEqual(state, { x: 0, z: 0, ollie: true, throw: true, push: true, item: true, pause: true, skip: false, up: false, down: false, left: false, right: false });
  buttons[8].pressed = true;
  buttons[12].pressed = true;
  const flick = gamepadState({ axes: [0.9, 0], buttons });
  assert.equal(flick.skip, true);
  assert.equal(flick.up, true, 'd-pad up is a trick tap');
  assert.equal(flick.right, true, 'a hard stick flick is a trick tap');
  assert.deepEqual(radial(0.1, 0.02, 0.12), { x: 0, z: 0 });
  assert.ok(radial(0.8, 0.8).x < 1);
});
test('resume cancels old audio voices, clears stale cues and leads in four beats early', async () => {
  let stops = 0;
  const audio = Object.create(GameAudio.prototype);
  Object.assign(audio, {
    unlock: async () => {},
    ctx: { currentTime: 20 },
    available: false,
    voices: [{ source: { stop: () => stops++ } }],
    pending: [{ type: 'stale', beat: 1 }],
  });
  assert.equal(await audio.resume(40), 36);
  assert.equal(stops, 1);
  assert.deepEqual(audio.pending, []);
  assert.equal(audio.running, true);
});
test('the newspaper resumes on the beat it paused (no rewind); leaving stops every music source', async () => {
  const audio = Object.create(GameAudio.prototype);
  Object.assign(audio, { unlock: async () => {}, ctx: { currentTime: 20 }, available: false, voices: [], pending: [] });
  assert.equal(await audio.resume(40, { countIn: false }), 40);
  assert.ok(Math.abs(audio.beatAt() - 40) < 0.01, 'model.beat would stall while a rewound song caught up');
  let stopped = 0;
  const source = { stop: () => stopped++ };
  Object.assign(audio, { source, chipSource: { ...source }, pending: [{ type: 'stale', beat: 41 }], grinding: { kind: 'bench' } });
  audio.stop();
  assert.equal(stopped, 2, 'the song and the chip loop end instead of waiting in the suspended context');
  assert.equal(audio.running, false);
  assert.deepEqual(audio.pending, []);
  assert.equal(audio.grinding, null);
});
test('browser shortcuts never reach the game, letting go of ⌘ or Ctrl releases every key, play keys hold back browser defaults', async () => {
  const { PLAY_KEYS, shortcut, releasesAll } = await import('../src/controls.js');
  assert.equal(shortcut({ code: 'KeyF', metaKey: true }), true, '⌘F would leave THROW held');
  assert.equal(shortcut({ code: 'KeyS', ctrlKey: true }), true);
  assert.equal(shortcut({ code: 'KeyD', altKey: true }), true);
  assert.equal(shortcut({ code: 'ArrowRight', shiftKey: true }), false, 'Shift is the power kick, not a shortcut');
  for (const code of ['MetaLeft', 'MetaRight', 'OSLeft', 'ControlLeft', 'ControlRight']) assert.ok(releasesAll(code), code);
  for (const code of ['ShiftLeft', 'AltLeft', 'KeyT', 'Space']) assert.ok(!releasesAll(code), code);
  for (const code of ['Space', 'Enter', 'NumpadEnter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) assert.ok(PLAY_KEYS.includes(code), code);
});
test('keyboard: T throws (F and J too), Space ollies, Shift kicks, Enter skips; arrows double as trick taps', async () => {
  const { KEYMAP, DIRECTIONS } = await import('../src/controls.js');
  for (const key of ['KeyT', 'KeyF', 'KeyJ']) assert.equal(KEYMAP[key], 'throw');
  assert.equal(KEYMAP.Space, 'ollie');
  assert.equal(KEYMAP.ShiftLeft, 'push');
  assert.equal(KEYMAP.Enter, 'skip');
  assert.deepEqual([DIRECTIONS.ArrowUp, DIRECTIONS.ArrowDown, DIRECTIONS.ArrowLeft, DIRECTIONS.ArrowRight], ['up', 'down', 'left', 'right']);
});
