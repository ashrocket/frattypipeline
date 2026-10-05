import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { GameModel, DISTRICTS } from '../src/model.js';

// Execute the actual client controller and game simulation. Only browser I/O is
// replaced, so delayed responses exercise the real event handlers and promises.
const clientSource = (await readFile(new URL('../src/main.js', import.meta.url), 'utf8'))
  .replace(/^import[^\n]*\n/gm, '');
const flush = () => new Promise(resolve => setImmediate(resolve));

function admission(token = 'a'.repeat(64), overrides = {}) {
  return {
    token, status: 'active', position: 0, activeCount: 20, capacity: 20,
    leaseSeconds: 75, heartbeatSeconds: 15, ...overrides,
  };
}

function browser() {
  let now = 0, nextTimer = 0;
  const timers = new Map(), frames = [], elements = new Map(), requests = [];
  const windowListeners = new Map(), documentListeners = new Map();
  const saved = new Map();
  const document = { hidden: false, activeElement: null, body: { dataset: {} } };
  const listen = (listeners, type, handler) => {
    if (!listeners.has(type)) listeners.set(type, []);
    listeners.get(type).push(handler);
  };
  const dispatch = (listeners, type, details = {}) => {
    const event = { preventDefault() {}, ...details };
    for (const handler of listeners.get(type) ?? []) handler(event);
  };
  function element(id) {
    if (elements.has(id)) return elements.get(id);
    const listeners = new Map();
    const attributes = new Map();
    const classes = new Set();
    const node = {
      id, hidden: ['dialog', 'transformation', 'fatal', 'hud', 'pause-btn', 'touch-controls'].includes(id),
      disabled: false, textContent: '', innerHTML: '', style: {}, dataset: id === 'app' ? { screen: 'title' } : {},
      classList: { add: name => classes.add(name), remove: name => classes.delete(name) },
      addEventListener: (type, handler) => listen(listeners, type, handler),
      setAttribute: (name, value) => attributes.set(name, value),
      getAttribute: name => attributes.get(name),
      setPointerCapture() {},
      focus() { document.activeElement = node; },
      querySelectorAll() { return ['dialog-primary', 'dialog-secondary'].map(element).filter(button => !button.hidden && !button.disabled); },
      emit(type, details = {}) { dispatch(listeners, type, { currentTarget: node, ...details }); },
    };
    elements.set(id, node);
    return node;
  }
  document.getElementById = element;
  document.addEventListener = (type, handler) => listen(documentListeners, type, handler);
  class WorldRenderer {
    resize() {} render() {} burst() {} stats() { return {}; }
  }
  class GameAudio {
    start() {} effect() {} tick() {} toggle() { return false; }
  }
  const window = {};
  const context = vm.createContext({
    GameModel, DISTRICTS, WorldRenderer, GameAudio, document, window,
    performance: { now: () => now },
    localStorage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) },
    innerWidth: 1280, innerHeight: 800, matchMedia: () => ({ matches: false }),
    navigator: { maxTouchPoints: 0, sendBeacon: () => true },
    AbortSignal: { timeout: () => ({}) }, Blob, console,
    addEventListener: (type, handler) => listen(windowListeners, type, handler),
    setTimeout(handler, delay) { const id = ++nextTimer; timers.set(id, { handler, due: now + delay }); return id; },
    clearTimeout: id => timers.delete(id),
    requestAnimationFrame: handler => { frames.push(handler); },
    fetch(path, options) {
      return new Promise((resolve, reject) => {
        const item = {
          action: path.split('/').at(-1), body: JSON.parse(options.body), settled: false,
          reply(value, status = 200) {
            assert.equal(item.settled, false, 'A test response must only complete once');
            item.settled = true;
            resolve({ ok: status >= 200 && status < 300, status, json: async () => value });
          },
          fail(error) { item.settled = true; reject(error); },
        };
        requests.push(item);
      });
    },
  });
  vm.runInContext(clientSource, context, { filename: 'src/main.js' });
  return {
    element, requests,
    snapshot: () => window.frattyDebug(),
    pending(action) {
      const item = requests.find(request => request.action === action && !request.settled);
      assert.ok(item, `Expected a pending ${action} request`);
      return item;
    },
    async reply(action, result, status = 200) { this.pending(action).reply(result, status); await flush(); },
    async click(id) {
      const node = element(id);
      assert.equal(node.hidden, false, `${id} must be visible`);
      assert.equal(node.disabled, false, `${id} must be enabled`);
      dispatch(windowListeners, 'pointerdown');
      node.emit('click');
      await flush();
    },
    async visibility(hidden) { document.hidden = hidden; dispatch(documentListeners, 'visibilitychange'); await flush(); },
    async key(code, down = true) { dispatch(windowListeners, down ? 'keydown' : 'keyup', { code, repeat: false }); await flush(); },
    async advance(milliseconds) {
      now += milliseconds;
      for (const [id, timer] of [...timers]) {
        if (timer.due <= now && timers.has(id)) { timers.delete(id); timer.handler(); }
      }
      // One rendered frame also tests the controller's admission/expiry guard.
      for (const handler of frames.splice(0)) handler(now);
      await flush();
    },
  };
}

async function start(page, result = admission()) {
  await page.click('start-btn');
  await page.reply('join', result);
}

test('cancelled join releases its late admission and stays on the title screen', async () => {
  const page = browser();
  await page.click('start-btn');
  const delayed = page.pending('join');
  await page.click('dialog-secondary');
  assert.equal(page.element('app').dataset.screen, 'title');
  delayed.reply(admission());
  await flush();
  assert.equal(page.pending('leave').body.token, admission().token);
  await page.reply('leave', { status: 'left' });
  assert.equal(page.snapshot().phase, 'title');
  assert.equal(page.snapshot().queue, null);
  assert.equal(page.element('dialog').hidden, true);
  // A cancelled operation must not leave the request lock stuck.
  await page.click('start-btn');
  assert.ok(page.pending('join'));
});

test('admission received while hidden enters only after a visible heartbeat confirms it', async () => {
  const page = browser();
  await page.click('start-btn');
  await page.visibility(true);
  await page.reply('join', admission());
  assert.equal(page.snapshot().phase, 'title');
  await page.visibility(false);
  assert.equal(page.snapshot().phase, 'title', 'Visibility alone cannot grant play');
  await page.reply('heartbeat', admission());
  assert.equal(page.snapshot().phase, 'playing');
  assert.equal(page.element('app').dataset.screen, 'game');
  assert.equal(page.element('dialog').hidden, true);
});

test('a delayed leave response cannot reset a subsequent admitted run', async () => {
  const page = browser();
  await start(page);
  await page.click('pause-btn');
  await page.click('dialog-secondary');
  const oldLeave = page.pending('leave');
  assert.equal(page.snapshot().phase, 'title', 'Leaving resets the screen before the network responds');
  await start(page, admission('b'.repeat(64)));
  oldLeave.reply({ status: 'left' });
  await flush();
  assert.equal(page.snapshot().phase, 'playing');
  assert.equal(page.snapshot().queue.status, 'active');
  assert.equal(page.element('app').dataset.screen, 'game');
});

test('visible waiting clients keep their place beyond the active-player idle timeout', async () => {
  const page = browser();
  const waiting = admission('c'.repeat(64), { status: 'waiting', position: 3, leaseSeconds: 90 });
  await start(page, waiting);
  for (let elapsed = 0; elapsed < 135_000; elapsed += 15_000) {
    await page.advance(15_000);
    assert.equal(page.pending('heartbeat').body.token, waiting.token);
    await page.reply('heartbeat', waiting);
  }
  assert.equal(page.requests.some(request => request.action === 'leave'), false);
  assert.equal(page.snapshot().queue.status, 'waiting');
  assert.equal(page.snapshot().queue.position, 3);
  assert.equal(page.element('dialog-title').textContent, 'HOLD YOUR SPOT.');
});

test('slow admission responses do not extend the lease past the server deadline', async () => {
  const page = browser();
  await page.click('start-btn');
  await page.advance(6_000);
  await page.reply('join', admission());
  assert.equal(page.snapshot().phase, 'playing');
  await page.advance(68_000);
  // The heartbeat remains unanswered, simulating a disconnected client. At 74s
  // the original 75s lease's conservative 73s deadline has already elapsed.
  assert.equal(page.snapshot().phase, 'paused');
  assert.equal(page.element('dialog-title').textContent, 'BACK TO THE LINE.');
});

test('a paused transformation resumes its remaining animation before spending one life', async (t) => {
  // Deterministic rush swag spawns in the upper skating lane. The model captures
  // this random source at creation; subsequent play uses normal client input.
  const random = t.mock.method(Math, 'random', () => .01);
  const page = browser();
  random.mock.restore();
  await start(page);
  await page.key('KeyW');
  // Skating into actual rush swag triggers the first makeover.
  // Keeping a movement key held also exercises active-input idle renewal.
  for (let elapsed = 0; elapsed < 180_000 && page.snapshot().phase === 'playing'; elapsed += 50) {
    await page.advance(50);
    const heartbeat = page.requests.find(request => request.action === 'heartbeat' && !request.settled);
    if (heartbeat) { heartbeat.reply(admission()); await flush(); }
  }
  assert.equal(page.snapshot().phase, 'transform');
  assert.equal(page.snapshot().lives, 3);
  await page.advance(500);
  await page.click('pause-btn');
  assert.equal(page.snapshot().phase, 'paused');
  assert.equal(page.element('transformation').hidden, true);
  await page.advance(5_000);
  assert.equal(page.snapshot().lives, 3, 'A paused animation must not spend a life');
  const pausedHeartbeat = page.requests.find(request => request.action === 'heartbeat' && !request.settled);
  if (pausedHeartbeat) { pausedHeartbeat.reply(admission()); await flush(); }
  await page.click('dialog-primary');
  await page.reply('heartbeat', admission());
  assert.equal(page.snapshot().phase, 'transform');
  assert.equal(page.element('transformation').hidden, false);
  for (let elapsed = 0; elapsed < 3_000 && page.snapshot().phase === 'transform'; elapsed += 50) await page.advance(50);
  assert.equal(page.snapshot().phase, 'playing');
  assert.equal(page.snapshot().lives, 2);
  assert.equal(page.snapshot().level, 1);
  assert.equal(page.element('transformation').hidden, true);
});
