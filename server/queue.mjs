/** Shared admission rules for the local server and the global Durable Object. */
export const QUEUE_CONFIG = Object.freeze({
  capacity: 20,
  heartbeatSeconds: 15,
  // Outlasts the client's two-minute idle grace (src/session.js IDLE_MS) plus one
  // heartbeat, because a backgrounded or locked phone cannot heartbeat at all.
  activeLeaseSeconds: 150,
  waitingLeaseSeconds: 90,
  maxSessionSeconds: 20 * 60,
  maxWaiting: 500,
});

const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

export class QueueError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'QueueError';
    this.status = status;
    this.code = code;
  }
}

function newToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

export function memoryStore(initial) {
  let state = initial === undefined ? undefined : structuredClone(initial);
  return {
    async load() {
      return state === undefined ? undefined : structuredClone(state);
    },
    async save(next) {
      state = structuredClone(next);
    },
  };
}

function validateState(state, config) {
  if (
    !state ||
    state.version !== 1 ||
    !Array.isArray(state.players) ||
    state.players.length > config.capacity + config.maxWaiting
  ) {
    throw new Error('Invalid saved queue state');
  }
  const seen = new Set();
  let active = 0;
  for (const player of state.players) {
    if (
      !TOKEN_PATTERN.test(player.token) ||
      seen.has(player.token) ||
      !['active', 'waiting'].includes(player.status) ||
      !Number.isFinite(player.expiresAt) ||
      !Number.isFinite(player.joinedAt) ||
      (player.status === 'active' && !Number.isFinite(player.startedAt))
    ) {
      throw new Error('Invalid saved queue player');
    }
    seen.add(player.token);
    if (player.status === 'active') active++;
  }
  if (active > config.capacity) throw new Error('Saved queue exceeds capacity');
}

/**
 * All state transitions, including persistence, share one serial chain. A failed
 * write never grants admission. The next request reloads authoritative storage.
 * Production must route every caller to ONE named Durable Object instance.
 */
export class AdmissionQueue {
  constructor({
    store = memoryStore(),
    now = Date.now,
    tokenFactory = newToken,
    config = {},
  } = {}) {
    this.config = { ...QUEUE_CONFIG, ...config };
    this.store = store;
    this.now = now;
    this.tokenFactory = tokenFactory;
    this.state = undefined;
    this.tail = Promise.resolve();
  }

  status() {
    // Serialized read, no token creation, renewals, promotion, or storage writes.
    const operation = this.tail.then(async () => {
      if (!this.state) {
        this.state = (await this.store.load()) ?? { version: 1, players: [] };
        validateState(this.state, this.config);
      }
      const now = this.now();
      const players = this.state.players.filter(
        (p) =>
          p.expiresAt > now &&
          (p.status !== 'active' || p.startedAt + this.config.maxSessionSeconds * 1000 > now),
      );
      return {
        activeCount: players.filter((p) => p.status === 'active').length,
        waitingCount: players.filter((p) => p.status === 'waiting').length,
        capacity: this.config.capacity,
      };
    });
    this.tail = operation.catch(() => {});
    return operation;
  }

  perform(action, input = {}) {
    const operation = this.tail.then(() => this.transition(action, input));
    this.tail = operation.catch(() => {});
    return operation;
  }

  async transition(action, input) {
    if (!['join', 'heartbeat', 'leave', 'sweep'].includes(action)) {
      throw new QueueError(404, 'NOT_FOUND', 'Queue route not found.');
    }
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new QueueError(400, 'INVALID_REQUEST', 'Send a JSON object.');
    }
    const token = input.token;
    if (
      (token !== undefined && (typeof token !== 'string' || !TOKEN_PATTERN.test(token))) ||
      (['heartbeat', 'leave'].includes(action) && typeof token !== 'string')
    ) {
      throw new QueueError(400, 'INVALID_TOKEN', 'A valid admission token is required.');
    }

    try {
      if (this.state === undefined) {
        const saved = await this.store.load();
        this.state = saved ?? { version: 1, players: [] };
        validateState(this.state, this.config);
      }
      const next = structuredClone(this.state);
      const now = this.now();
      next.players = next.players.filter(
        (player) =>
          player.expiresAt > now &&
          (player.status !== 'active' ||
            player.startedAt + this.config.maxSessionSeconds * 1000 > now),
      );
      this.promote(next, now);

      let player = next.players.find((candidate) => candidate.token === token);
      let problem;
      if (action === 'join') {
        if (!player) {
          if (
            next.players.filter((candidate) => candidate.status === 'waiting').length >=
            this.config.maxWaiting
          ) {
            problem = new QueueError(
              429,
              'QUEUE_FULL',
              'The waiting room is full. Please try again shortly.',
            );
          } else {
            let freshToken;
            do {
              freshToken = this.tokenFactory();
            } while (next.players.some((candidate) => candidate.token === freshToken));
            player = {
              token: freshToken,
              status: 'waiting',
              joinedAt: now,
              expiresAt: now + this.config.waitingLeaseSeconds * 1000,
            };
            next.players.push(player);
            this.promote(next, now);
          }
        }
        if (player) this.renew(player, now);
      } else if (action === 'heartbeat') {
        if (!player)
          problem = new QueueError(
            410,
            'SESSION_EXPIRED',
            'Your spot expired. Rejoin the waiting room.',
          );
        else this.renew(player, now);
      } else if (action === 'leave') {
        next.players = next.players.filter((candidate) => candidate.token !== token);
        this.promote(next, now);
        player = undefined;
      }

      await this.store.save(next, this.nextExpiry(next));
      this.state = next;
      if (problem) throw problem;
      const activeCount = next.players.filter((candidate) => candidate.status === 'active').length;
      if (action === 'sweep')
        return { activeCount, waitingCount: next.players.length - activeCount };
      if (action === 'leave')
        return { status: 'left', activeCount, capacity: this.config.capacity };
      return {
        token: player.token,
        status: player.status,
        position:
          player.status === 'active'
            ? 0
            : next.players.filter((candidate) => candidate.status === 'waiting').indexOf(player) +
              1,
        activeCount,
        capacity: this.config.capacity,
        leaseSeconds: Math.max(0, Math.ceil((player.expiresAt - now) / 1000)),
        heartbeatSeconds: this.config.heartbeatSeconds,
        expiresAt: player.expiresAt,
        serverTime: now,
        sessionSecondsRemaining:
          player.status === 'active'
            ? Math.max(
                0,
                Math.ceil((player.startedAt + this.config.maxSessionSeconds * 1000 - now) / 1000),
              )
            : null,
      };
    } catch (error) {
      // Storage errors can have ambiguous commit outcomes. Reload, never assume.
      if (!(error instanceof QueueError)) this.state = undefined;
      throw error;
    }
  }

  renew(player, now) {
    player.expiresAt =
      player.status === 'active'
        ? Math.min(
            now + this.config.activeLeaseSeconds * 1000,
            player.startedAt + this.config.maxSessionSeconds * 1000,
          )
        : now + this.config.waitingLeaseSeconds * 1000;
  }

  promote(state, now) {
    let vacancies =
      this.config.capacity - state.players.filter((player) => player.status === 'active').length;
    for (const player of state.players) {
      if (vacancies <= 0) break;
      if (player.status !== 'waiting') continue;
      player.status = 'active';
      player.startedAt = now;
      this.renew(player, now);
      vacancies--;
    }
  }

  nextExpiry(state) {
    return state.players.length
      ? Math.min(...state.players.map((player) => player.expiresAt))
      : null;
  }
}
