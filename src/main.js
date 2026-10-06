import { GameModel, seededRandom } from './model.js';
import { WorldRenderer } from './renderer-flat.js';
import { GameAudio } from './audio.js';
import { Session } from './session.js';
import { KEYMAP, DIRECTIONS, SCROLL_KEYS, PLAY_KEYS, shortcut, releasesAll, gamepadState, radial } from './controls.js';
import { STEP, DIFFICULTY } from './data/tuning.js';
import { CAMPUSES, DISCLAIMER } from './data/campuses.js';
import { S } from './data/strings.js';
import { LOOKS, HAIR_COLORS, SKIN_TONES, crewFor } from './data/looks.js';
import { continueRun } from './sim/crew.js';
const $ = (id) => document.getElementById(id);
const ITEM_LABELS = { bottle: 'BOTTLE', bees: 'HIVE', sub: 'SUB', fryer: 'FRYER', raccoons: 'PANDAS', balloons: 'BALLOON' };
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
for (const node of document.querySelectorAll('[data-copy]')) node.textContent = S[node.dataset.copy] ?? '';
for (const node of document.querySelectorAll('[data-aria]')) node.setAttribute('aria-label', S.aria[node.dataset.aria]);
const settings = {
  music: 1,
  sfx: 0.8,
  muted: false,
  reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
  assist: true,
  scanlines: false,
  ...storage.get('settings', {}),
};
const params = new URLSearchParams(location.search);
const model = new GameModel(seededRandom(Number(params.get('seed')) || Date.now()), {
  look: storage.get('look', 0),
  hair: storage.get('hair', 0),
  skin: storage.get('skin', 1),
  assist: settings.assist,
  difficulty: params.get('route') ?? storage.get('difficulty', 'easy'),
  campus: params.get('campus') ?? storage.get('campus', 'harvard'),
  // Skate school is on until you've finished it once; after that it's your call.
  training: storage.get('training', true),
});
const world = new WorldRenderer($('world'));
world.reduced = settings.reduced;
world.scanlines = settings.scanlines;
const audio = new GameAudio((label) => {
  $('track-label').textContent = label;
  $('track-label').classList.toggle('missing', label === S.missing);
}, settings);
// A saved mute must show on ♫ from the first frame, not only after the first toggle.
$('sound-btn').setAttribute('aria-pressed', String(settings.muted));
const keys = new Set(),
  deviceHeld = { keyboard: {}, touch: {}, gamepad: {} },
  edges = [];
let activeDevice = matchMedia('(pointer:coarse)').matches ? 'touch' : 'keyboard',
  touchMove = { x: 0, z: 0 },
  pad = {},
  lastPad = {},
  lastTime = performance.now(),
  accumulator = 0;
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
  resultsShownAt = 0;
let sessionEnded = false,
  pendingJoin = false;
const touch = () => matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 0 || innerWidth < 900;
function updateCount(result) {
  count = { ...count, activeCount: result.activeCount, capacity: result.capacity };
  const label = `${count.activeCount} / ${count.capacity} ${S.hud.playing}`;
  for (const id of ['server-status', 'title-count'])
    if ($(id) && $(id).textContent !== label) $(id).textContent = label;
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
    showDialog(S.queue, `${S.queueBody}\n${r.position} ${S.inLine} · ${r.activeCount} / ${r.capacity ?? 20} ${S.hud.playing}`, S.wait, null, S.leave, leave),
  onExpired: () => {
    pause();
    showDialog(S.expired, S.queueBody, S.retry, join, S.leave, leave);
  },
  onWarning: () => world.fx.call(S.capWarning, { sub: S.capSub, priority: 6, life: 3 }),
  releaseIfIdle,
});
function clearInput() {
  keys.clear();
  edges.length = 0;
  for (const source of Object.values(deviceHeld)) for (const key of Object.keys(source)) source[key] = false;
  model.move = { x: 0, z: 0 };
  model.held = {};
  model.aiming = false;
  touchMove = { x: 0, z: 0 };
  $('stick').style.transform = '';
}
function setScreen() {
  const playing = model.phase !== 'title';
  document.body.dataset.playing = String(playing);
  document.body.dataset.phase = model.phase;
  $('app').dataset.screen = playing ? 'game' : 'title';
  $('title-screen').hidden = playing;
  $('pause-btn').hidden = !playing;
  $('touch-controls').hidden = !playing || !touch() || ['won', 'lost', 'continue', 'paused'].includes(model.phase);
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
  $('results').hidden = true;
  dialogAction = action;
  secondaryAction = back;
  $('dialog').hidden = false;
  // With no main action (3·2·1, checking, waiting) the card takes focus, so Space or Enter can't hit BACK TO TITLE.
  (action ? $('dialog-primary') : $('dialog-card')).focus({ preventScroll: true });
  clearInput();
}
function hideDialog() {
  $('dialog').hidden = true;
  // Focus goes back on the title only; in play a focused Ⅱ or ♫ would be clicked by the next Space or Enter.
  if (model.phase === 'title') previousFocus?.focus?.({ preventScroll: true });
  else document.activeElement?.blur?.();
}
// Back in play after CONTINUE?, from the button or from the sim (a bot or gamepad throw continues there).
function continued() {
  hideDialog();
  sessionEnded = false;
  setScreen();
}
// Results dialogs ignore activation for a moment so a held ollie key can't skip them.
$('dialog-primary').onclick = () => {
  if (performance.now() - resultsShownAt < 900) return;
  dialogAction?.();
};
$('dialog-secondary').onclick = () => {
  if (performance.now() - resultsShownAt < 900) return;
  secondaryAction?.();
};
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
  resumeAt = null;
  model.reset();
  model.pausedFrom = null;
  model.assist = settings.assist;
  // The music follows the sim: 'trainingStart' loops the song's instrumental intro for skate school, 'start' plays the song.
  model.start();
  hideDialog();
  if (import.meta.env.DEV && params.has('scene'))
    import('./dev/scenes.js').then(({ applyScene }) => {
      if (model.phase === 'title') return;
      applyScene(model, params);
      // applyScene drains the sim's 'start'/'trainingStart', so start the matching music here.
      if (model.level === 'training') audio.startTraining();
      else audio.startRun();
    });
  lastTime = performance.now();
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
async function leave() {
  const leaving = session.leave();
  resumeAt = null;
  model.reset();
  model.pausedFrom = null;
  clearInput();
  // Suspending alone would bring the abandoned run's song or intro loop back on the next unlock (♫ or START).
  audio.stop();
  audio.pause(0);
  hideDialog();
  setScreen();
  await leaving;
  pollCount();
}
const PAUSABLE = ['playing', 'countin', 'captured', 'rescue', 'rescued', 'bonus', 'resume', 'victory', 'continue', 'training', 'newspaper'];
// Skate school has no song clock and the newspaper is a still page, so both resume at once; the newspaper's song
// picks up exactly where it paused (audio.resume with countIn false skips the four-beat rewind).
const NO_COUNTIN = ['training', 'newspaper'];
function pause() {
  // A pending 3·2·1 (tab hidden, audio interrupted, Esc again, seat expired) falls back to the pause menu.
  if (resumeAt !== null) {
    resumeAt = null;
    audio.pause(model.beat);
    showDialog(S.pause, S.controls, S.resume, resume, S.leave, leave);
    renderSettings();
    return;
  }
  if (!PAUSABLE.includes(model.phase)) return;
  // The renderer keeps drawing the paused scene (bonus, newspaper) from pausedFrom.
  resumePhase = model.pausedFrom = model.phase;
  model.phase = 'paused';
  audio.pause(model.beat);
  showDialog(S.pause, S.controls, S.resume, resume, S.leave, leave);
  renderSettings();
  setScreen();
}
function releaseIfIdle() {
  if (!session.token || !session.idle() || ['won', 'lost', 'continue'].includes(model.phase)) return false;
  session.leave();
  pause();
  showDialog(S.expired, S.queueBody, S.retry, join, S.leave, leave);
  return true;
}
async function resume() {
  if (resumeAt !== null) return;
  if (!session.token || session.expired || performance.now() >= session.leaseUntil) {
    join();
    return;
  }
  const countIn = !NO_COUNTIN.includes(resumePhase);
  await audio.resume(model.beat, { countIn });
  // Left the run, hid the tab, lost the seat or already resumed while the audio was waking up.
  if (model.phase === 'title') {
    audio.stop();
    audio.pause(0);
    return;
  }
  if (model.phase !== 'paused' || resumeAt !== null) return;
  if (document.hidden || !session.token || session.expired) {
    audio.pause(model.beat);
    return;
  }
  if (!countIn) {
    model.phase = resumePhase;
    model.pausedFrom = null;
    hideDialog();
    lastTime = performance.now();
    accumulator = 0;
    setScreen();
    return;
  }
  resumeAt = model.beat;
  showDialog(S.brand, '3 · 2 · 1', S.resume, null, S.leave, leave);
}
function persistSettings() {
  audio.settings = { ...audio.settings, ...settings };
  audio.applySettings();
  $('sound-btn').setAttribute('aria-pressed', String(settings.muted));
  world.reduced = settings.reduced;
  world.scanlines = settings.scanlines;
  model.assist = settings.assist;
  storage.set('settings', settings);
}
function renderSettings() {
  const root = $('settings');
  root.replaceChildren();
  root.hidden = false;
  for (const key of ['music', 'sfx']) {
    const label = document.createElement('label');
    label.textContent = S[key];
    const input = document.createElement('input');
    input.type = 'range';
    input.min = 0;
    input.max = 1;
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
    ['assist', S.assist],
    ['reduced', S.reduced],
    ['scanlines', S.scanlines],
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
}
function start() {
  audio.unlock();
  join();
}
$('start-btn').onclick = start;
$('pause-btn').onclick = pause;
$('sound-btn').onclick = () => {
  audio.unlock();
  settings.muted = !settings.muted;
  persistSettings();
};
$('how-btn').onclick = () => showDialog(S.how, S.howBody, S.start, start, S.leave, () => hideDialog());
function picker() {
  for (const [id, list, selected, storeKey, kind] of [
    ['look-options', LOOKS, model.look, 'look', 'look'],
    ['hair-options', HAIR_COLORS, model.hair, 'hair', 'swatch'],
    ['skin-options', SKIN_TONES, model.skin, 'skin', 'swatch'],
  ]) {
    $(id).replaceChildren();
    list.forEach((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-pressed', String(index === selected));
      if (kind === 'look') {
        button.textContent = item.name;
        button.style.setProperty('--swatch', item.outfit);
        button.setAttribute('aria-label', item.name);
      } else {
        button.style.background = item;
        button.setAttribute('aria-label', `${storeKey === 'hair' ? S.aria.hair : S.aria.skin} ${index + 1}`);
      }
      button.onclick = () => {
        model[storeKey] = index;
        storage.set(storeKey, index);
        model.crew = crewFor(model.look, model.hair, model.skin);
        picker();
      };
      $(id).append(button);
    });
  }
}
picker();
// Campus, route and skate school: chosen on the title screen, applied on the next drop-in.
function runSetup() {
  $('campus-options').replaceChildren();
  for (const campus of CAMPUSES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = campus.name;
    button.title = campus.place;
    button.style.setProperty('--pennant', campus.colors.primary);
    button.setAttribute('aria-pressed', String(campus.id === model.campusId));
    button.onclick = () => {
      model.campusId = campus.id;
      storage.set('campus', campus.id);
      model.reset();
      runSetup();
    };
    $('campus-options').append(button);
  }
  $('route-options').replaceChildren();
  for (const [id, route] of Object.entries(DIFFICULTY)) {
    const button = document.createElement('button');
    button.type = 'button';
    const name = document.createElement('span'),
      blurb = document.createElement('small');
    name.textContent = route.name;
    blurb.textContent = S.routes[id];
    button.append(name, blurb);
    button.setAttribute('aria-pressed', String(id === model.difficulty));
    button.onclick = () => {
      model.difficulty = id;
      storage.set('difficulty', id);
      model.reset();
      runSetup();
    };
    $('route-options').append(button);
  }
  $('training-toggle').checked = model.trainingOn;
  $('campus-disclaimer').textContent = DISCLAIMER;
}
$('training-toggle').onchange = () => {
  model.trainingOn = $('training-toggle').checked;
  storage.set('training', model.trainingOn);
};
runSetup();
function edge(source, action, down) {
  const before = Object.values(deviceHeld).some((s) => s[action]);
  deviceHeld[source][action] = down;
  const after = Object.values(deviceHeld).some((s) => s[action]);
  if (before === after) return;
  activeDevice = source;
  session.lastActivity = performance.now();
  edges.push({ action, down: after });
}
// Every keyboard action still held is let go (with its release edge), for when keyups can't be trusted to arrive.
function releaseKeys() {
  keys.clear();
  for (const [action, down] of Object.entries(deviceHeld.keyboard)) if (down) edge('keyboard', action, false);
}
addEventListener('keydown', (e) => {
  if (shortcut(e)) return;
  if ($('dialog').hidden && model.phase !== 'title') {
    // In play nothing keeps focus or scrolls: a clicked Ⅱ or ♫ would otherwise re-pause or toggle mute on every ollie.
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur?.();
    if (PLAY_KEYS.includes(e.code)) e.preventDefault();
  } else if (SCROLL_KEYS.includes(e.code) && !['INPUT', 'BUTTON', 'SELECT'].includes(document.activeElement?.tagName)) e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'Escape' || e.code === 'KeyP') {
    // During the 3·2·1, Esc goes back to the pause menu.
    if (model.phase === 'paused' && resumeAt === null) resume();
    else pause();
    return;
  }
  if (!$('dialog').hidden) {
    // Gameplay keys never activate a dialog button by accident: during the 3·2·1 or just after results appear.
    if (['Space', 'Enter'].includes(e.code) && (resumeAt !== null || performance.now() - resultsShownAt < 900)) e.preventDefault();
    return;
  }
  keys.add(e.code);
  session.lastActivity = performance.now();
  if (KEYMAP[e.code]) edge('keyboard', KEYMAP[e.code], true);
  if (DIRECTIONS[e.code]) edge('keyboard', DIRECTIONS[e.code], true);
});
// Leaving the window (⌘Tab, a click into devtools) swallows keyups, so nothing stays held.
addEventListener('blur', () => clearInput());
addEventListener('keyup', (e) => {
  if (releasesAll(e.code)) {
    releaseKeys();
    return;
  }
  keys.delete(e.code);
  for (const map of [KEYMAP, DIRECTIONS])
    if (map[e.code]) {
      const action = map[e.code];
      edge('keyboard', action, [...keys].some((key) => map[key] === action));
    }
});
for (const [id, action] of [
  ['fire-touch', 'throw'],
  ['ollie-touch', 'ollie'],
  ['push-touch', 'push'],
  ['item-touch', 'item'],
  ['skip-touch', 'skip'],
]) {
  const node = $(id),
    pointers = new Set();
  node.onpointerdown = (e) => {
    e.preventDefault();
    node.setPointerCapture(e.pointerId);
    pointers.add(e.pointerId);
    edge('touch', action, true);
  };
  const release = (e) => {
    pointers.delete(e.pointerId);
    edge('touch', action, pointers.size > 0);
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
  touchMove = radial(dx / 38, dy / 38, 0.15);
  $('stick').style.transform = `translate(${Math.max(-30, Math.min(30, dx))}px,${Math.max(-30, Math.min(30, dy))}px)`;
  session.lastActivity = performance.now();
  activeDevice = 'touch';
  if (!stickStart.pushed && e.timeStamp - stickStart.time < 220 && dx > 26) {
    edge('touch', 'push', true);
    edge('touch', 'push', false);
    stickStart.pushed = true;
  }
  // A quick flick is a direction tap (flip tricks in the air). Re-centering re-arms it.
  const far = Math.hypot(dx, dy);
  if (far < 14) stickStart.flicked = false;
  else if (!stickStart.flicked && far > 30) {
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    edge('touch', dir, true);
    edge('touch', dir, false);
    stickStart.flicked = true;
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
  const dialog = !$('dialog').hidden;
  for (const action of ['throw', 'ollie', 'push', 'item', 'skip', 'up', 'down', 'left', 'right'])
    if (Boolean(pad[action]) !== Boolean(lastPad[action])) {
      // A dialog takes the pad as it takes the keyboard: A presses its main button (the 900 ms results guard still
      // applies) and nothing queues up for the sim underneath.
      if (!dialog) edge('gamepad', action, Boolean(pad[action]));
      else if (action === 'ollie' && pad.ollie) $('dialog-primary').click();
    }
  if (pad.pause && !lastPad.pause) {
    if (model.phase === 'paused' && resumeAt === null) resume();
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
    // pause() also cancels a pending 3·2·1, so coming back takes a RESUME, which wakes the suspended audio.
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
    navigator.sendBeacon('/api/queue/leave', new Blob([JSON.stringify({ token: session.token })], { type: 'application/json' }));
});
async function pollCount() {
  if (!['title', 'won', 'lost', 'continue'].includes(model.phase) && session.result?.status !== 'waiting') return;
  try {
    const r = await fetch('/api/queue/status');
    if (r.ok) updateCount(await r.json());
  } catch {
    /* Retain the last confirmed count. */
  }
}
function results(won) {
  const st = model.stats,
    root = $('results');
  root.replaceChildren();
  for (const [label, value] of [
    [S.results.score, model.score.toLocaleString()],
    [S.results.houses, `${model.destroyed} / 12`],
    [S.results.bros, st.brosLit],
    [S.results.chain, `×${st.bestChain}`],
    [S.results.bonus, st.bonusHits],
    [S.results.combo, st.bestCombo.toLocaleString()],
    [S.results.tricks, st.tricks],
    [S.results.laps, model.lap],
    [S.results.time, `${Math.round(model.time)} s`],
  ]) {
    const cell = document.createElement('div');
    const b = document.createElement('b');
    b.textContent = value;
    const span = document.createElement('span');
    span.textContent = label;
    cell.append(b, span);
    root.append(cell);
  }
  root.hidden = false;
  if (won && model.continues === 0) {
    const badge = document.createElement('div');
    badge.className = 'one-credit';
    badge.textContent = S.hud.oneCredit;
    root.append(badge);
  }
}
function resultScreen() {
  sessionEnded = true;
  resultsShownAt = performance.now();
  const won = model.phase === 'won';
  const best = storage.get('best', 0),
    record = model.score > best && model.continues === 0;
  if (record) {
    storage.set('best', model.score);
    showBest();
  }
  // A continue refills lives, so after one the lives-based copy would claim the crew was never caught.
  const copy = won ? (model.continues > 0 ? S.winContinue : S.winCopy[Math.max(0, model.lives - 1)]) : [S.lossKicker, ''];
  showDialog(won ? S.win : S.loss, copy[0] + (copy[1] ? `\n${copy[1]}` : '') + (record ? `\n${S.newBest}` : ''), S.runBack, enterRun, S.leave, leave);
  results(won);
}
function continueScreen() {
  sessionEnded = true;
  resultsShownAt = performance.now();
  showDialog(S.continuePrompt, S.continueHelp, S.continue, () => {
    if (continueRun(model)) continued();
  }, S.leave, leave);
}
function frame(now) {
  const elapsed = Math.min(0.25, (now - lastTime) / 1000);
  lastTime = now;
  pollGamepad(now);
  audio.tick();
  session.check();
  if (resumeAt !== null) {
    const beat = audio.beatAt(now);
    const left = resumeAt - beat;
    $('dialog-body').textContent = left > 3 ? '3 · 2 · 1' : String(Math.max(1, Math.ceil(left)));
    // Anything that stops the audio mid-count (leave, hidden tab, interruption) cancels the count-in itself.
    if (beat >= resumeAt) {
      model.phase = resumePhase;
      model.pausedFrom = null;
      resumeAt = null;
      // The pause menu replaced CONTINUE?, so let continueScreen bring it back.
      if (resumePhase === 'continue') sessionEnded = false;
      hideDialog();
      lastTime = now;
      accumulator = 0;
      setScreen();
    }
  }
  releaseIfIdle();
  if (!['title', 'paused', 'won', 'lost'].includes(model.phase)) {
    accumulator += elapsed;
    while (accumulator + 1e-9 >= STEP) {
      const x = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
      const z = (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0);
      const beat = audio.running && audio.available && model.level !== 'training' && model.phase !== 'training' ? audio.beatAt(now) : undefined;
      model.inputDevice = activeDevice;
      model.tick(STEP, { x: x || touchMove.x || pad.x || 0, z: z || touchMove.z || pad.z || 0, edges: edges.splice(0), beat });
      accumulator -= STEP;
      for (const e of model.drainEvents()) {
        world.event(e, model);
        audio.event(e);
        if (e.type === 'trainingStart') audio.startTraining?.();
        else if (e.type === 'start') audio.startRun();
        else if (e.type === 'continued') continued();
        else if (e.type === 'trainingDone') {
          storage.set('training', false);
          model.trainingOn = false;
          $('training-toggle').checked = false;
        }
      }
    }
  } else accumulator = 0;
  world.draw(model, elapsed);
  document.documentElement.style.setProperty('--beat', model.beatPulse.toFixed(3));
  // Held keys and an active stick are activity too, not just new presses.
  if (keys.size || touchMove.x || touchMove.z) session.lastActivity = now;
  if ($('item-touch').dataset.item !== model.item) {
    $('item-touch').dataset.item = model.item;
    $('item-touch').textContent = ITEM_LABELS[model.item] ?? 'ITEM';
  }
  if (now - lastAria >= 600) {
    const value = `${S.brand}. ${model.destroyed} of 12 houses gone. ${model.lives} ${S.lives}. ${S.hud.pipeline} ${Math.max(0, model.horde.gap).toFixed(0)} meters behind. ${count.activeCount} of ${count.capacity} ${S.hud.playing}.`;
    if ($('live-status').textContent !== value) $('live-status').textContent = value;
    lastAria = now;
  }
  if (now - lastPoll > 10000) {
    pollCount();
    lastPoll = now;
  }
  if (model.phase === 'continue' && !sessionEnded) continueScreen();
  if (model.phase === 'continue' && !$('dialog').hidden)
    $('dialog-primary').textContent = `${S.continue} · ${Math.max(0, Math.ceil(10 - model.phaseTime))}`;
  if ((model.phase === 'won' || model.phase === 'lost') && lastPhase !== model.phase) resultScreen();
  if (model.phase !== lastPhase) {
    lastPhase = model.phase;
    document.body.dataset.phase = model.phase;
    $('touch-controls').hidden = !touch() || !['playing', 'countin', 'rescue', 'rescued', 'bonus', 'captured', 'resume', 'training', 'newspaper'].includes(model.phase);
  }
  requestAnimationFrame(frame);
}
// Read-only review surface: never expose session tokens or mutation hooks.
window.frattyDebug = () => ({
  phase: model.phase,
  level: model.level,
  campus: model.campusId,
  difficulty: model.difficulty,
  time: model.time,
  lap: model.lap,
  station: model.course ? model.course.station : null,
  alley: model.alley ? { x: model.alley.t, still: model.alley.still, got: model.alley.got } : null,
  combo: { active: model.combo.active, points: model.combo.points, parts: model.combo.parts.length },
  flow: model.flow,
  flowTime: model.flowTime,
  score: model.score,
  lives: model.lives,
  destroyed: model.destroyed,
  look: model.look,
  item: model.item,
  bottles: model.bottles,
  horde: { ...model.horde },
  player: { ...model.player },
  houses: model.houses.map((h) => ({ id: h.id, name: h.name, state: h.state, integrity: Math.round(h.integrity), fire: h.fire, can: h.can.state, empty: h.empty, gone: h.gone })),
  bonus: model.bonus ? { pass: model.bonus.pass, stage: model.bonus.stage, hits: model.bonus.hits, x: model.bonus.x, thrown: Boolean(model.bonus.thrown) } : null,
  aim: model.aiming && ['playing', 'rescue', 'training'].includes(model.phase) ? (({ locked, house, target }) => ({ locked, house, kind: target?.kind ?? null }))(model.aim()) : null,
  zombie: model.zombie ? { x: model.zombie.x, z: model.zombie.z, state: model.zombie.state } : null,
  ambulance: model.ambulance ? { x: model.ambulance.x, z: model.ambulance.z } : null,
  stats: { ...model.stats, render: world.stats() },
  queue: session.result ? { status: session.result.status, position: session.result.position } : null,
  count,
  audio: { available: audio.available, state: audio.ctx?.state, mode: audio.musicMode ?? null, chipReady: Boolean(audio.chipReady) },
  inputDevice: activeDevice,
});
function showBest() {
  const best = storage.get('best', 0);
  $('title-best').textContent = best ? `${S.hiScore} ${best.toLocaleString()}` : '';
  $('title-best').hidden = !best;
}
showBest();
pollCount();
setScreen();
requestAnimationFrame(frame);
if (import.meta.env.DEV && params.has('scene') && params.get('scene') !== 'title') start();
