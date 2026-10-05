import { GameModel, seededRandom } from './model.js';
import { WorldRenderer } from './renderer-flat.js';
import { GameAudio } from './audio.js';
import { Session } from './session.js';
import { KEYMAP, gamepadState, radial } from './controls.js';
import { STEP, BEAT_S } from './data/tuning.js';
import { S } from './data/strings.js';
import { LOOKS, HAIR_COLORS } from './data/looks.js';
const $ = (id) => document.getElementById(id);
const storage = {
  get(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(`pipeline:${key}`)) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`pipeline:${key}`, JSON.stringify(value));
    } catch {
      /* Storage is optional. */
    }
  },
};
for (const node of document.querySelectorAll('[data-copy]'))
  node.textContent = S[node.dataset.copy] ?? S.art[node.dataset.copy];
for (const node of document.querySelectorAll('[data-aria]'))
  node.setAttribute('aria-label', S.aria[node.dataset.aria]);
const settings = storage.get('settings', {
  music: 1,
  sfx: 0.8,
  offset: 0,
  muted: false,
  reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
  beatAssist: false,
});
const model = new GameModel(
  seededRandom(Number(new URLSearchParams(location.search).get('seed')) || Date.now()),
  { look: storage.get('look', 4), hair: storage.get('hair', 0) },
);
const world = new WorldRenderer($('world'));
world.reduced = settings.reduced;
model.beatAssist = settings.beatAssist;
const audio = new GameAudio((label) => {
  $('track-label').textContent = label;
  $('track-label').classList.toggle('missing', label === S.missing);
}, settings);
const keys = new Set(),
  deviceHeld = { keyboard: {}, touch: {}, gamepad: {} },
  edges = [];
let activeDevice = 'keyboard',
  touchMove = { x: 0, z: 0 },
  pad = {},
  lastPad = {},
  lastTime = performance.now(),
  accumulator = 0,
  tickStamp = lastTime;
let count = { activeCount: 0, waitingCount: 0, capacity: 20 },
  dialogAction = null,
  secondaryAction = null,
  previousFocus = null,
  lastAria = 0,
  lastPhase = 'title',
  lastPoll = 0,
  resumePhase = 'playing',
  resumeAt = null,
  queuedHidden = false,
  calibration = false;
let sessionEnded = false,
  lateErrors = [],
  pendingJoin = false;
const touch = () =>
  matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 0 || innerWidth < 900;
function updateCount(result) {
  count = { ...count, activeCount: result.activeCount, capacity: result.capacity };
  const label = `${count.activeCount} / ${count.capacity} ${S.hud.playing}`;
  if ($('server-status').textContent !== label) $('server-status').textContent = label;
  world.count = count;
}
async function request(action, data) {
  const response = await fetch(`/api/queue/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(7000),
  });
  const result = await response.json();
  if (!response.ok) {
    const e = new Error(result.message);
    e.status = response.status;
    throw e;
  }
  return result;
}
const session = new Session({
  request,
  onCount: updateCount,
  onAdmitted: enterRun,
  onWaiting: (r) =>
    showDialog(
      S.queue,
      `${S.queueBody}\n${r.position} ${S.inLine} · ${r.activeCount} / 20 ${S.hud.playing}`,
      S.wait,
      null,
      S.leave,
      leave,
    ),
  onExpired: () => {
    pause();
    showDialog(S.expired, S.queueBody, S.retry, join, S.leave, leave);
  },
  onWarning: () =>
    world.event(
      { type: 'timeover', text: S.capWarning, sub: S.capSub, x: model.player.x, z: model.player.z },
      model,
    ),
  releaseIfIdle,
});
function clearInput() {
  keys.clear();
  edges.length = 0;
  for (const source of Object.values(deviceHeld))
    for (const key of Object.keys(source)) source[key] = false;
  model.move = { x: 0, z: 0 };
  model.held = {};
  model.charge = null;
  touchMove = { x: 0, z: 0 };
  $('stick').style.transform = '';
}
function setScreen() {
  const playing = model.phase !== 'title';
  document.body.dataset.playing = String(playing);
  $('app').dataset.screen = playing ? 'game' : 'title';
  $('title-screen').hidden = playing;
  $('pause-btn').hidden = !playing;
  $('mobile-pause').hidden = !playing || !touch();
  $('touch-controls').hidden =
    !playing || !touch() || ['won', 'lost', 'continue', 'paused'].includes(model.phase);
  world.resize();
}
function showDialog(title, body, primary, action, secondary = S.leave, back = leave) {
  if ($('dialog').hidden) previousFocus = document.activeElement;
  $('dialog-title').textContent = title;
  $('dialog-body').textContent = body;
  $('dialog-primary').textContent = primary;
  $('dialog-primary').disabled = !action;
  $('dialog-secondary').textContent = secondary;
  $('dialog-secondary').hidden = !back;
  $('settings').hidden = true;
  dialogAction = action;
  secondaryAction = back;
  $('dialog').hidden = false;
  (action ? $('dialog-primary') : $('dialog-secondary')).focus();
  clearInput();
}
function hideDialog() {
  $('dialog').hidden = true;
  previousFocus?.focus?.();
}
$('dialog-primary').onclick = () => dialogAction?.();
$('dialog-secondary').onclick = () => secondaryAction?.();
function enterRun() {
  if (document.hidden) {
    queuedHidden = true;
    return;
  }
  queuedHidden = false;
  audio.unlock();
  sessionEnded = false;
  if (model.phase === 'paused' && model.time > 0) {
    resume();
    return;
  }
  hideDialog();
  model.reset();
  model.beatAssist = settings.beatAssist;
  model.start();
  audio.startRun();
  lastTime = performance.now();
  tickStamp = lastTime;
  accumulator = 0;
  setScreen();
}
async function join() {
  if (pendingJoin) return;
  pendingJoin = true;
  audio.unlock();
  showDialog(S.checking, S.queueBody, S.connecting, null, S.leave, leave);
  try {
    await session.join();
  } catch (error) {
    console.error('Admission:', error);
    showDialog(S.offline, S.queueBody, S.retry, join, S.leave, leave);
  } finally {
    pendingJoin = false;
  }
}
function start() {
  audio.unlock();
  if (!storage.get('soundChecked', false)) {
    soundCheck(join);
  } else join();
}
async function leave() {
  const leaving = session.leave();
  model.reset();
  clearInput();
  audio.pause(0);
  hideDialog();
  setScreen();
  await leaving;
  pollCount();
}
function pause() {
  if (!['playing', 'transform', 'countin', 'vs', 'ko', 'continue'].includes(model.phase)) return;
  resumePhase = model.phase;
  model.phase = 'paused';
  audio.pause(model.beat);
  showDialog(S.pause, S.controls, S.resume, resume, S.leave, leave);
  renderSettings();
  setScreen();
}
// Runs from the frame loop and before every heartbeat, so hidden tabs release too.
function releaseIfIdle() {
  if (!session.token || !session.idle() || ['won', 'lost', 'continue'].includes(model.phase))
    return false;
  session.leave();
  pause();
  showDialog(S.expired, S.queueBody, S.retry, join, S.leave, leave);
  return true;
}
async function resume() {
  if (!session.token || session.expired || performance.now() >= session.leaseUntil) {
    join();
    return;
  }
  await audio.resume(model.beat, model.projectiles);
  resumeAt = model.beat;
  // Remain paused while the four-beat musical lead-in plays.
  showDialog(S.brand, S.hud.count, S.resume, null, S.leave, leave);
}
function persistSettings() {
  audio.settings = { ...audio.settings, ...settings };
  audio.applySettings();
  $('sound-btn').setAttribute('aria-pressed', String(settings.muted));
  world.reduced = settings.reduced;
  model.beatAssist = settings.beatAssist;
  storage.set('settings', settings);
}
function renderSettings() {
  const root = $('settings');
  root.replaceChildren();
  root.hidden = false;
  for (const key of ['music', 'sfx', 'offset']) {
    const label = document.createElement('label');
    label.textContent = S[key];
    const input = document.createElement('input');
    input.type = 'range';
    input.min = key === 'offset' ? -0.4 : 0;
    input.max = key === 'offset' ? 0.4 : 1;
    input.step = 0.01;
    input.value = settings[key];
    input.setAttribute('aria-label', S[key]);
    input.oninput = () => {
      settings[key] = Number(input.value);
      persistSettings();
    };
    label.append(input);
    root.append(label);
  }
  for (const [key, title] of [
    ['muted', S.mute],
    ['reduced', S.reduced],
    ['beatAssist', S.assist],
  ]) {
    const label = document.createElement('label');
    label.textContent = title;
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = settings[key];
    input.onchange = () => {
      settings[key] = input.checked;
      persistSettings();
    };
    label.append(input);
    root.append(label);
  }
  const check = document.createElement('button');
  check.textContent = S.soundCheck;
  check.onclick = () =>
    soundCheck(() => {
      showDialog(S.pause, S.controls, S.resume, resume, S.leave, leave);
      renderSettings();
    });
  root.append(check);
}
function soundCheck(done) {
  audio.unlock();
  calibration = true;
  showDialog(
    S.soundCheck,
    S.calibrationHelp,
    S.tap,
    () => {},
    S.skip,
    () => {
      calibration = false;
      storage.set('soundChecked', true);
      done();
    },
  );
  audio.beginCalibration();
  dialogAction = () => {
    const result = audio.tapCalibration(performance.now());
    const n = audio.calibrationErrors.length;
    $('dialog-body').textContent = `${S.calibrationHelp}\n${n} / 8`;
    if (result) {
      calibration = false;
      if (result.accepted) {
        settings.offset = result.offset;
        persistSettings();
        storage.set('soundChecked', true);
        showDialog(
          S.soundCheck,
          `${S.calibrationSaved} ${Math.round(result.offset * 1000)} ms`,
          S.start,
          done,
          S.soundCheck,
          () => soundCheck(done),
        );
      } else
        showDialog(
          S.soundCheck,
          S.calibrationReject,
          S.soundCheck,
          () => soundCheck(done),
          S.skip,
          done,
        );
    }
  };
}
$('start-btn').onclick = start;
$('pause-btn').onclick = pause;
$('mobile-pause').onclick = pause;
$('sound-btn').onclick = () => {
  audio.unlock();
  settings.muted = !settings.muted;
  persistSettings();
  $('sound-btn').setAttribute('aria-pressed', String(settings.muted));
};
$('how-btn').onclick = () =>
  showDialog(S.how, S.howBody, S.start, start, S.leave, () => hideDialog());
function picker() {
  for (const [id, list, selected, storeKey] of [
    ['look-options', LOOKS, model.look, 'look'],
    ['hair-options', HAIR_COLORS, model.hair, 'hair'],
  ]) {
    $(id).replaceChildren();
    list.forEach((item, index) => {
      const button = document.createElement('button');
      button.setAttribute('aria-pressed', String(index === selected));
      button.setAttribute(
        'aria-label',
        id === 'look-options' ? item.name : `${S.aria.hair} ${index + 1}`,
      );
      if (id === 'look-options') button.textContent = item.name;
      else button.style.background = item;
      button.onclick = () => {
        model[storeKey] = index;
        storage.set(storeKey, index);
        picker();
      };
      $(id).append(button);
    });
  }
}
picker();
function edge(source, action, down, stamp = performance.now()) {
  const before = Object.values(deviceHeld).some((s) => s[action]);
  deviceHeld[source][action] = down;
  const after = Object.values(deviceHeld).some((s) => s[action]);
  if (before === after) return;
  activeDevice = source;
  session.lastActivity = performance.now();
  const beat = audio.beatAt(stamp, true);
  if (model.phase === 'vs' && after) {
    edges.push({ action: 'skip', down: true, beat });
    return;
  }
  edges.push({ action, down: after, beat, rawBeat: audio.beatAt(stamp) });
  if (action === 'throw' && !after) {
    const error = (beat - Math.round(beat)) * BEAT_S;
    lateErrors.push(error);
    lateErrors = lateErrors.slice(-8);
    if (lateErrors.length === 8 && lateErrors.every((x) => x > 0.07))
      world.event(
        {
          type: 'hint',
          text: S.soundCheck,
          sub: S.bluetooth,
          x: model.player.x,
          z: model.player.z,
        },
        model,
      );
  }
}
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (
    !['INPUT', 'BUTTON'].includes(document.activeElement?.tagName) &&
    ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)
  )
    e.preventDefault();
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (model.phase === 'paused') resume();
    else pause();
    return;
  }
  if (!$('dialog').hidden) return;
  keys.add(e.code);
  session.lastActivity = performance.now();
  if (KEYMAP[e.code]) edge('keyboard', KEYMAP[e.code], true, e.timeStamp);
});
addEventListener('keyup', (e) => {
  keys.delete(e.code);
  if (KEYMAP[e.code]) {
    const action = KEYMAP[e.code];
    const still = [...keys].some((key) => KEYMAP[key] === action);
    edge('keyboard', action, still, e.timeStamp);
  }
});
for (const [id, action] of [
  ['fire-touch', 'throw'],
  ['ollie-touch', 'ollie'],
  ['super-touch', 'super'],
]) {
  const node = $(id),
    pointers = new Set();
  node.onpointerdown = (e) => {
    e.preventDefault();
    node.setPointerCapture(e.pointerId);
    pointers.add(e.pointerId);
    edge('touch', action, true, e.timeStamp);
  };
  const release = (e) => {
    pointers.delete(e.pointerId);
    edge('touch', action, pointers.size > 0, e.timeStamp);
  };
  node.onpointerup = release;
  node.onpointercancel = release;
  node.onlostpointercapture = release;
}
let stickPointer = null,
  stickStart = null;
$('joystick').onpointerdown = (e) => {
  e.preventDefault();
  stickPointer = e.pointerId;
  stickStart = { x: e.clientX, y: e.clientY, time: e.timeStamp, pushed: false };
  $('joystick').setPointerCapture(e.pointerId);
};
$('joystick').onpointermove = (e) => {
  if (e.pointerId !== stickPointer) return;
  const dx = e.clientX - stickStart.x,
    dy = e.clientY - stickStart.y;
  const portrait = innerHeight > innerWidth;
  touchMove = radial((portrait ? -dy : dx) / 35, (portrait ? dx : dy) / 35, 0.12);
  $('stick').style.transform =
    `translate(${Math.max(-28, Math.min(28, dx))}px,${Math.max(-28, Math.min(28, dy))}px)`;
  session.lastActivity = performance.now();
  activeDevice = 'touch';
  if (!stickStart.pushed && e.timeStamp - stickStart.time < 220 && (portrait ? -dy : dx) > 24) {
    edge('touch', 'push', true, e.timeStamp);
    edge('touch', 'push', false, e.timeStamp + 1);
    stickStart.pushed = true;
  }
};
const releaseStick = (e) => {
  if (e.pointerId === stickPointer) {
    stickPointer = null;
    touchMove = { x: 0, z: 0 };
    $('stick').style.transform = '';
  }
};
$('joystick').onpointerup = releaseStick;
$('joystick').onpointercancel = releaseStick;
function pollGamepad(now) {
  pad = gamepadState([...(navigator.getGamepads?.() ?? [])].find(Boolean));
  for (const action of ['throw', 'ollie', 'push', 'super'])
    if (pad[action] !== lastPad[action]) edge('gamepad', action, pad[action], now);
  if (pad.pause && !lastPad.pause) {
    if (model.phase === 'paused') resume();
    else pause();
  }
  if (Math.abs(pad.x) + Math.abs(pad.z) > 0) session.lastActivity = now;
  lastPad = pad;
}
let portrait = innerHeight > innerWidth;
addEventListener('resize', () => {
  const next = innerHeight > innerWidth;
  if (next !== portrait) pause();
  portrait = next;
  world.resize();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pause();
    audio.pause(model.beat);
  } else if (queuedHidden) {
    session.heartbeat().then((confirmed) => {
      if (confirmed && session.result?.status === 'active') enterRun();
    });
  }
});
audio.onInterrupted = pause;
addEventListener('pagehide', () => {
  if (session.token)
    navigator.sendBeacon(
      '/api/queue/leave',
      new Blob([JSON.stringify({ token: session.token })], { type: 'application/json' }),
    );
});
async function pollCount() {
  if (
    !['title', 'won', 'lost', 'continue'].includes(model.phase) ||
    session.result?.status === 'waiting'
  )
    return;
  try {
    const r = await fetch('/api/queue/status');
    if (r.ok) updateCount(await r.json());
  } catch {
    /* Retain last confirmed count. */
  }
}
function resultScreen() {
  sessionEnded = true;
  const won = model.phase === 'won',
    copy = won
      ? S.winCopy[model.lives - 1]
      : [S.lossKicker, `${model.burned} / 12 · ${model.score} · ${S.loss}`];
  showDialog(
    won ? S.win : S.loss,
    `${copy[0]}\n${copy[1]}\n${Math.round(model.time)} s · ${model.score}`,
    won ? S.runBack : S.continue,
    won
      ? enterRun
      : () => {
          model.continueRun();
          hideDialog();
          sessionEnded = false;
          setScreen();
        },
    S.leave,
    leave,
  );
  if (won && model.continues === 0) {
    const badge = document.createElement('span');
    badge.className = 'one-credit';
    badge.textContent = S.hud.oneCredit;
    $('dialog-body').append(badge);
  }
}
function frame(now) {
  const elapsed = Math.min(0.25, (now - lastTime) / 1000);
  lastTime = now;
  pollGamepad(now);
  audio.tick();
  session.check();
  if (resumeAt !== null) {
    const beat = audio.beatAt(now);
    $('dialog-body').textContent =
      resumeAt - beat > 3 ? S.hud.count : String(Math.max(1, Math.ceil(resumeAt - beat)));
    if (beat >= resumeAt) {
      model.phase = resumePhase;
      if (resumePhase === 'continue') sessionEnded = false;
      resumeAt = null;
      hideDialog();
      lastTime = now;
      accumulator = 0;
      tickStamp = now;
      setScreen();
    }
  }
  releaseIfIdle();
  if (!['title', 'paused', 'won', 'lost'].includes(model.phase)) {
    accumulator += elapsed;
    while (accumulator + 1e-9 >= STEP) {
      tickStamp = now - (accumulator - STEP) * 1000;
      const x =
        (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) -
        (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
      const z =
        (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0) -
        (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0);
      const beat = audio.running ? Math.max(model.beat, audio.beatAt(tickStamp)) : undefined;
      model.inputDevice = activeDevice;
      model.timingWindowExtra = audio.fallback ? 0.025 : 0;
      model.tick(STEP, {
        x: x || touchMove.x || pad.x || 0,
        z: z || touchMove.z || pad.z || 0,
        edges: edges.splice(0),
        beat,
      });
      accumulator -= STEP;
      for (const e of model.drainEvents()) {
        world.event(e, model);
        audio.event(e);
      }
    }
  } else accumulator = 0;
  world.draw(model, elapsed);
  document.documentElement.style.setProperty('--beat', model.beatPulse);
  $('super-touch').hidden = model.riot < 100;
  if (now - lastAria >= 500) {
    const value = `${S.brand}. ${model.burned}/12. ${model.lives} ${S.lives}. ${Math.round(model.player.pipeline)} ${S.percent} ${S.hud.pipeline}. ${count.activeCount}/${count.capacity} ${S.hud.playing}.`;
    if ($('live-status').textContent !== value) $('live-status').textContent = value;
    lastAria = now;
  }
  if (now - lastPoll > 10000) {
    pollCount();
    lastPoll = now;
  }
  if (['won', 'continue'].includes(model.phase) && !sessionEnded) resultScreen();
  if (model.phase === 'continue' && !$('dialog').hidden)
    $('dialog-primary').textContent =
      `${S.continuePrompt} ${Math.max(0, Math.ceil((model.continueEnd - model.beat) / 4) - 1)}…`;
  if (model.phase === 'lost' && lastPhase === 'continue')
    showDialog(
      S.loss,
      `${model.burned} / 12 · ${model.score}`,
      S.runBack,
      enterRun,
      S.leave,
      leave,
    );
  if (model.phase !== lastPhase) {
    lastPhase = model.phase;
    $('touch-controls').hidden =
      !touch() || !['playing', 'countin', 'vs', 'transform'].includes(model.phase);
  }
  requestAnimationFrame(frame);
}
// Read-only review surface: never expose session tokens or mutation hooks.
window.frattyDebug = () => ({
  phase: model.phase,
  time: model.time,
  beat: model.beat,
  burned: model.burned,
  lives: model.lives,
  score: model.score,
  look: model.look,
  pipeline: model.player.pipeline,
  player: { ...model.player },
  queue: session.result
    ? { status: session.result.status, position: session.result.position }
    : null,
  count,
  arena: model.arena?.id,
  enemies: model.enemies.map((e) => ({ kind: e.kind, state: e.state, x: e.x, z: e.z })),
  stats: world.stats(),
  audio: {
    available: audio.available,
    fallback: audio.fallback ?? false,
    state: audio.ctx?.state,
    beat: audio.beatAt(),
    scheduled: audio.scheduled.slice(-5),
  },
  inputDevice: activeDevice,
});
pollCount();
setScreen();
requestAnimationFrame(frame);
