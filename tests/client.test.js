import assert from 'node:assert/strict';
import test from 'node:test';
import { IDLE_MS, Session } from '../src/session.js';
import { gamepadState, radial } from '../src/controls.js';
import { calibrate, GameAudio } from '../src/audio.js';
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
test('gamepad maps all requested buttons and radial dead zone', () => {
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
  buttons[0].pressed = true;
  buttons[7].pressed = true;
  buttons[5].pressed = true;
  buttons[3].pressed = true;
  buttons[9].pressed = true;
  const state = gamepadState({ axes: [0.1, 0.1], buttons });
  assert.deepEqual(state, {
    x: 0,
    z: 0,
    ollie: true,
    throw: true,
    push: true,
    super: true,
    pause: true,
  });
  assert.deepEqual(radial(0.1, 0.02, 0.12), { x: 0, z: 0 });
  assert.ok(radial(0.8, 0.8).x < 1);
});
test('8-tap calibration measures180ms with jitter and rejects scattered taps', () => {
  const valid = calibrate([0.16, 0.18, 0.2, 0.17, 0.19, 0.18, 0.175, 0.185]);
  assert.equal(valid.accepted, true);
  assert.ok(Math.abs(valid.offset - 0.18) < 0.01);
  assert.equal(calibrate([-0.2, 0.3, -0.3, 0.2, -0.1, 0.1, -0.4, 0.4]).accepted, false);
});

test('resume cancels old audio voices and requeues all in-flight smashes on their original beats', async () => {
  let stops = 0;
  const audio = Object.create(GameAudio.prototype);
  Object.assign(audio, {
    unlock: async () => {},
    ctx: { currentTime: 20 },
    available: false,
    voices: [{ source: { stop: () => stops++ } }],
    pending: [{ type: 'stale', beat: 1 }],
  });
  assert.equal(
    await audio.resume(40, [{ landBeat: 42 }, { landBeat: 43 }, { landBeat: 44, dead: true }]),
    36,
  );
  assert.equal(stops, 1);
  assert.deepEqual(audio.pending, [
    { type: 'smash', beat: 42 },
    { type: 'smash', beat: 43 },
  ]);
  assert.equal(audio.running, true);
});
