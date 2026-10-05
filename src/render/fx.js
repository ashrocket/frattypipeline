import { COLORS as P } from './draw.js';
const PRIORITY = {
  won: 90,
  lost: 90,
  burn: 80,
  reborn: 85,
  timeover: 85,
  perfect: 75,
  streak: 70,
  district: 65,
  super: 85,
  parry: 60,
  school: 55,
  trick: 50,
  impact: 45,
  beat: 40,
  coffee: 30,
  pickup: 30,
  hint: 10,
};
export class Effects {
  constructor(touch = false) {
    this.pool = Array.from({ length: touch ? 96 : 192 }, () => ({ life: 0 }));
    this.trauma = 0;
    this.queue = [];
    this.current = null;
    this.lastBig = -9;
    this.lastHint = -9;
    this.flashTimes = [];
    this.flash = 0;
    this.responses = new Set();
    this.props = [];
  }
  event(e, now, reduced, charging, transform) {
    this.responses.add(e.type);
    if (e.type === 'empty') return;
    if (e.type === 'reborn') this.shockwave = { x: e.x, z: e.z, life: 0.8 };
    if (e.prop)
      this.props.push({
        kind: e.prop,
        x: e.x,
        z: e.z,
        life: 2.5,
        age: 0,
        bottles: e.type === 'school' ? (e.prop === 'vest' ? 2 : 1) : 0,
      });
    this.props = this.props.slice(-12);
    this.trauma = Math.min(
      1,
      this.trauma +
        (['burn', 'super', 'reborn'].includes(e.type) ? 0.8 : e.type === 'hit' ? 0.4 : 0.12),
    );
    let count = ['burn', 'super', 'reborn'].includes(e.type) ? 32 : 8;
    if (reduced) count = Math.floor(count * 0.3);
    let n = 0;
    for (const p of this.pool) {
      if (p.life <= 0 && n < count) {
        Object.assign(p, {
          life: 0.45 + n * 0.008,
          x: e.x,
          z: e.z,
          vx: Math.sin(n * 2.4) * 3,
          vz: Math.cos(n * 2.4) * 2,
          color: e.type === 'hit' ? P.pink : e.type === 'burn' ? P.orange : P.yellow,
        });
        n++;
      }
    }
    this.flashTimes = this.flashTimes.filter((t) => now - t < 1);
    if (['burn', 'parry', 'reborn', 'super'].includes(e.type) && this.flashTimes.length < 3) {
      this.flash = 0.07;
      this.flashTimes.push(now);
    }
    if (transform) {
      this.current = null;
      this.queue = [];
      return;
    }
    const priority = PRIORITY[e.type];
    if (!priority) return;
    if (e.type === 'hint' && (charging || now - this.lastHint < 4)) return;
    if (e.type === 'hint') this.lastHint = now;
    this.queue.push({
      ...e,
      sub: e.sub ?? e.bark,
      priority,
      queued: now,
      hold: ['burn', 'district', 'won'].includes(e.type) ? 1.6 : 1,
    });
    this.queue.sort((a, b) => b.priority - a.priority);
  }
  tick(dt, now, transform = false, charging = false) {
    if (this.shockwave) this.shockwave.life -= dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.8);
    for (const prop of this.props) {
      prop.life -= dt;
      prop.age += dt;
    }
    this.props = this.props.filter((prop) => prop.life > 0);
    this.flash = Math.max(0, this.flash - dt);
    for (const p of this.pool)
      if (p.life > 0) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.z += p.vz * dt;
      }
    if (transform) {
      this.current = null;
      this.queue = [];
      return;
    }
    if (this.current && now >= this.current.until) this.current = null;
    this.queue = this.queue.filter((e) => now - e.queued < 5 && !(e.type === 'hint' && charging));
    if (!this.current && this.queue.length && now - this.lastBig >= 0.9) {
      this.current = this.queue.shift();
      this.current.until = now + this.current.hold;
      this.lastBig = now;
    }
  }
}
