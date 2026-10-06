import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { AdmissionQueue, memoryStore, QUEUE_CONFIG } from '../server/queue.mjs';
import { handleQueueRequest } from '../server/http.mjs';
import { createQueueServer } from '../server/dev.mjs';
import { IDLE_MS } from '../src/session.js';

function room(options = {}) {
  let timestamp = 1_000_000;
  let sequence = 0;
  const queue = new AdmissionQueue({
    now: () => timestamp,
    tokenFactory: () => (++sequence).toString(16).padStart(64, '0'),
    ...options,
  });
  return { queue, advance: ms => { timestamp += ms; } };
}

function request(action, body = {}, init = {}) {
  return new Request(`https://fratty.example/api/queue/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://fratty.example', ...init.headers },
    body: JSON.stringify(body),
  });
}

test('100 simultaneous arrivals grant exactly 20 seats with unique FIFO positions', async () => {
  const { queue } = room();
  const players = await Promise.all(Array.from({ length: 100 }, () => queue.perform('join')));
  assert.equal(players.filter(player => player.status === 'active').length, 20);
  assert.equal(new Set(players.map(player => player.token)).size, 100);
  assert.deepEqual(players.slice(20).map(player => player.position), Array.from({ length: 80 }, (_, i) => i + 1));
  assert.ok(players.every(player => player.activeCount <= 20));
  assert.equal(players[0].heartbeatSeconds, QUEUE_CONFIG.heartbeatSeconds);
});

test('leaving promotes the oldest waiting player; resuming never adds a seat', async () => {
  const { queue } = room({ config: { capacity: 2 } });
  const first = await queue.perform('join');
  const second = await queue.perform('join');
  const third = await queue.perform('join');
  const fourth = await queue.perform('join');
  const resumed = await queue.perform('join', { token: first.token });
  assert.equal(resumed.token, first.token);
  assert.equal(resumed.activeCount, 2);
  await queue.perform('leave', { token: second.token });
  assert.equal((await queue.perform('heartbeat', { token: third.token })).status, 'active');
  assert.equal((await queue.perform('heartbeat', { token: fourth.token })).position, 1);
  const newcomer = await queue.perform('join');
  assert.equal(newcomer.position, 2);
});

test('mixed concurrent leaves, joins, and heartbeats cannot overbook or skip waiters', async () => {
  const { queue } = room();
  const players = await Promise.all(Array.from({ length: 40 }, () => queue.perform('join')));
  await Promise.all([
    ...players.slice(0, 10).map(player => queue.perform('leave', { token: player.token })),
    ...Array.from({ length: 20 }, () => queue.perform('join')),
    ...players.slice(10).map(player => queue.perform('heartbeat', { token: player.token })),
  ]);
  const promoted = await Promise.all(players.slice(20, 30).map(player => queue.perform('heartbeat', { token: player.token })));
  assert.ok(promoted.every(player => player.status === 'active' && player.activeCount === 20));
  assert.equal((await queue.perform('heartbeat', { token: players[30].token })).position, 1);
});

test('an active lease survives the client idle grace while a phone cannot heartbeat', () => {
  // The last heartbeat may land a full interval before the tab is hidden.
  assert.ok(QUEUE_CONFIG.activeLeaseSeconds * 1000 >= IDLE_MS + QUEUE_CONFIG.heartbeatSeconds * 1000);
});

test('stale active leases expire and live waiters are promoted at the lease boundary', async () => {
  const { queue, advance } = room({ config: { capacity: 1, activeLeaseSeconds: 75 } });
  const active = await queue.perform('join');
  const waiting = await queue.perform('join');
  advance(75_000);
  const promoted = await queue.perform('heartbeat', { token: waiting.token });
  assert.equal(promoted.status, 'active');
  assert.equal(promoted.leaseSeconds, 75);
  await assert.rejects(queue.perform('heartbeat', { token: active.token }), { status: 410, code: 'SESSION_EXPIRED' });
});

test('silent waiters keep their place but are skipped for seats until they return', async () => {
  const { queue, advance } = room({ config: { capacity: 1 } });
  const active = await queue.perform('join');
  const away = await queue.perform('join');
  advance(60_000);
  await queue.perform('heartbeat', { token: active.token });
  const live = await queue.perform('join');
  advance(30_000);
  await queue.perform('leave', { token: active.token });
  assert.equal((await queue.perform('heartbeat', { token: live.token })).status, 'active');
  const back = await queue.perform('heartbeat', { token: away.token });
  assert.equal(back.status, 'waiting');
  assert.equal(back.position, 1);
});

test('a returning waiter takes a seat that opened while they were away', async () => {
  const { queue, advance } = room({ config: { capacity: 1 } });
  const active = await queue.perform('join');
  const away = await queue.perform('join');
  advance(100_000);
  await queue.perform('leave', { token: active.token });
  assert.equal((await queue.status()).activeCount, 0);
  assert.equal((await queue.perform('heartbeat', { token: away.token })).status, 'active');
});

test('a place in line expires only after the full waiting lease', async () => {
  const { queue, advance } = room({
    config: { capacity: 1, activeLeaseSeconds: 3600, maxSessionSeconds: 3600 },
  });
  await queue.perform('join');
  const away = await queue.perform('join');
  advance(QUEUE_CONFIG.waitingLeaseSeconds * 1000 - 1000);
  assert.equal((await queue.perform('heartbeat', { token: away.token })).position, 1);
  advance(QUEUE_CONFIG.waitingLeaseSeconds * 1000);
  await assert.rejects(queue.perform('heartbeat', { token: away.token }), { status: 410 });
});

test('waiters saved before presence tracking are still seated', async () => {
  const token = 'a'.repeat(64);
  const { queue } = room({
    config: { capacity: 1 },
    store: memoryStore({
      version: 1,
      players: [{ token, status: 'waiting', joinedAt: 990_000, expiresAt: 1_050_000 }],
    }),
  });
  assert.deepEqual(await queue.perform('sweep'), { activeCount: 1, waitingCount: 0 });
});

test('continuous heartbeats cannot extend a reservation beyond the fairness limit', async () => {
  const { queue, advance } = room({ config: { capacity: 1, maxSessionSeconds: 100 } });
  const active = await queue.perform('join');
  advance(50_000);
  const renewed = await queue.perform('heartbeat', { token: active.token });
  assert.equal(renewed.leaseSeconds, 50);
  const waiting = await queue.perform('join');
  advance(50_000);
  assert.equal((await queue.perform('heartbeat', { token: waiting.token })).status, 'active');
  await assert.rejects(queue.perform('heartbeat', { token: active.token }), { status: 410 });
});

test('saved admissions and FIFO order survive an engine restart', async () => {
  const store = memoryStore();
  const first = room({ store, config: { capacity: 1 } });
  const active = await first.queue.perform('join');
  const waiting = await first.queue.perform('join');
  const restarted = room({ store, config: { capacity: 1 } });
  assert.equal((await restarted.queue.perform('heartbeat', { token: waiting.token })).position, 1);
  await restarted.queue.perform('leave', { token: active.token });
  assert.equal((await restarted.queue.perform('heartbeat', { token: waiting.token })).status, 'active');
});

test('a failed or ambiguous persistence write never returns admission and recovers from storage', async () => {
  const store = memoryStore();
  let fail = true;
  const { queue } = room({
    config: { capacity: 1 },
    store: {
      load: () => store.load(),
      save: async state => {
        await store.save(state);
        if (fail) { fail = false; throw new Error('Lost storage acknowledgement'); }
      },
    },
  });
  await assert.rejects(queue.perform('join'), /Lost storage acknowledgement/);
  const next = await queue.perform('join');
  assert.equal(next.status, 'waiting');
  assert.equal(next.activeCount, 1);
});

test('corrupt storage fails closed instead of creating a replacement room', async () => {
  const { queue } = room({ store: memoryStore({ version: 99, players: [] }) });
  const response = await handleQueueRequest(request('join'), queue);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'QUEUE_UNAVAILABLE');
});

test('waiting capacity is bounded and an expired client can safely rejoin', async () => {
  const { queue, advance } = room({ config: { capacity: 1, maxWaiting: 1 } });
  const active = await queue.perform('join');
  await queue.perform('join');
  await assert.rejects(queue.perform('join'), { status: 429, code: 'QUEUE_FULL' });
  advance(Math.max(QUEUE_CONFIG.activeLeaseSeconds, QUEUE_CONFIG.waitingLeaseSeconds) * 1000 + 10_000);
  const rejoined = await queue.perform('join', { token: active.token });
  assert.equal(rejoined.status, 'active');
  assert.notEqual(rejoined.token, active.token);
});

test('HTTP rejects cross-origin, malformed, oversized and non-JSON requests', async () => {
  const { queue } = room();
  const cases = [
    [request('join', {}, { headers: { Origin: 'https://unrelated.example' } }), 403],
    [request('join', {}, { headers: { Origin: 'null' } }), 403],
    [request('join', {}, { headers: { 'Sec-Fetch-Site': 'cross-site' } }), 403],
    [request('join', {}, { headers: { 'Content-Type': 'text/plain' } }), 415],
    [request('join', { note: 'a'.repeat(4097) }), 413],
    [request('heartbeat', { token: 'guessed' }), 400],
    [request('join', []), 400],
    [request('join', { token: ['a'.repeat(64)] }), 400],
    [new Request('https://fratty.example/api/queue/join'), 405],
  ];
  for (const [input, status] of cases) {
    const response = await handleQueueRequest(input, queue);
    assert.equal(response.status, status);
    assert.equal(response.headers.get('Cache-Control'), 'no-store, max-age=0');
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  }
  const malformed = new Request('https://fratty.example/api/queue/join', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
  });
  assert.equal((await handleQueueRequest(malformed, queue)).status, 400);
});

test('real local HTTP server enforces capacity and releases a seat through the API', async t => {
  const server = createQueueServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  async function call(action, body = {}) {
    const response = await fetch(`${origin}/api/queue/${action}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body),
    });
    assert.equal(response.status, 200);
    return response.json();
  }
  const players = await Promise.all(Array.from({ length: 24 }, () => call('join')));
  const active = players.filter(player => player.status === 'active');
  const waiting = players.filter(player => player.status === 'waiting').sort((a, b) => a.position - b.position);
  assert.equal(active.length, 20);
  const status = await fetch(`${origin}/api/queue/status`);
  assert.equal(status.headers.get('cache-control'), 'max-age=5');
  assert.deepEqual(await status.json(), { activeCount: 20, waitingCount: 4, capacity: 20 });
  assert.deepEqual(waiting.map(player => player.position), [1, 2, 3, 4]);
  await call('leave', { token: active[0].token });
  assert.equal((await call('heartbeat', { token: waiting[0].token })).status, 'active');
  assert.equal((await call('heartbeat', { token: waiting[1].token })).position, 1);
});
