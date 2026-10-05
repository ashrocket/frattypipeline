// Admission transport is independent from presentation and testable with a fake clock.
// An admitted player idle this long gives their seat back to the queue.
export const IDLE_MS = 120_000;
export class Session {
  constructor({
    request,
    now = () => performance.now(),
    timer = (fn, ms) => setTimeout(fn, ms),
    clear = (id) => clearTimeout(id),
    onCount = () => {},
    onAdmitted = () => {},
    onWaiting = () => {},
    onExpired = () => {},
    onWarning = () => {},
    releaseIfIdle = () => false,
  }) {
    Object.assign(this, {
      request,
      now,
      timer,
      clear,
      onCount,
      onAdmitted,
      onWaiting,
      onExpired,
      onWarning,
      releaseIfIdle,
    });
    this.generation = 0;
    this.token = null;
    this.result = null;
    this.leaseUntil = 0;
    this.retry = 0;
    this.lastActivity = now();
  }
  accept(result, started) {
    this.result = result;
    this.token = result.token;
    this.leaseUntil = started + result.leaseSeconds * 1000;
    this.expired = false;
    this.retry = 0;
    this.onCount(result);
    this.clear(this.timeout);
    this.timeout = this.timer(() => this.heartbeat(), result.heartbeatSeconds * 1000);
    if (result.sessionSecondsRemaining <= 60 && result.status === 'active' && !this.warned) {
      this.warned = true;
      this.onWarning();
    }
  }
  async join() {
    this.lastActivity = this.now();
    const generation = ++this.generation,
      started = this.now();
    const result = await this.request('join', this.token ? { token: this.token } : {});
    if (generation !== this.generation) {
      await this.request('leave', { token: result.token });
      return;
    }
    this.accept(result, started);
    if (result.status === 'active') this.onAdmitted();
    else this.onWaiting(result);
  }
  idle() {
    return this.result?.status === 'active' && this.now() - this.lastActivity > IDLE_MS;
  }
  async heartbeat() {
    // Timers still fire in a hidden tab, where the frame loop's idle check never runs.
    if (!this.token || this.pending || this.releaseIfIdle()) return;
    this.pending = true;
    const generation = this.generation,
      started = this.now();
    try {
      const result = await this.request('heartbeat', { token: this.token });
      if (generation !== this.generation) return;
      const waiting = this.result?.status === 'waiting';
      this.accept(result, started);
      if (result.status === 'waiting') this.onWaiting(result);
      else if (waiting) this.onAdmitted();
      return true;
    } catch (error) {
      if (generation !== this.generation) return;
      if (error.status === 410 || this.now() >= this.leaseUntil) {
        this.expired = true;
        this.onExpired();
        return;
      }
      const delay = [2000, 4000, 8000][Math.min(this.retry++, 2)];
      this.timeout = this.timer(
        () => this.heartbeat(),
        Math.min(delay, Math.max(0, this.leaseUntil - this.now())),
      );
    } finally {
      this.pending = false;
    }
  }
  check() {
    if (this.token && !this.expired && this.now() >= this.leaseUntil) {
      this.clear(this.timeout);
      this.onExpired();
      this.expired = true;
    }
  }
  async leave() {
    ++this.generation;
    const token = this.token;
    this.token = null;
    this.result = null;
    this.clear(this.timeout);
    this.warned = false;
    if (token)
      try {
        await this.request('leave', { token });
      } catch {
        /* Lease expires on server. */
      }
  }
}
