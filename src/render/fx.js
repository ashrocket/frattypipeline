import { P } from './palette.js';
import { ellipse, rr, text, banner, alpha, easeOutBack, easeOutCubic, noise, TAU } from './draw.js';
// Event-driven feedback. Cosmetic randomness lives here, never in the simulation.
const COLORS = {
  fire: P.fire,
  confetti: [P.pink, P.cyan, P.sun, P.mint, P.grape, P.tangerine, '#FFFFFF'],
};
export class Effects {
  constructor(touch = false) {
    this.cap = touch ? 260 : 620;
    this.pool = [];
    this.trauma = 0;
    this.flash = 0;
    this.flashColor = '#FFFFFF';
    this.popups = [];
    this.callout = null;
    this.danger = 0;
    this.slow = 0;
  }
  spawn(kind, x, z, y, o = {}) {
    let p = this.pool.find((q) => q.life <= 0);
    if (!p) {
      if (this.pool.length >= this.cap) return null;
      p = {};
      this.pool.push(p);
    }
    const r = Math.random;
    Object.assign(p, {
      kind,
      x,
      z,
      y,
      vx: o.vx ?? (r() - 0.5) * 2,
      vz: o.vz ?? (r() - 0.5) * 0.6,
      vy: o.vy ?? r() * 2,
      life: o.life ?? 0.6 + r() * 0.4,
      max: 0,
      size: o.size ?? 0.15,
      color: o.color ?? '#FFFFFF',
      spin: (r() - 0.5) * 12,
      angle: r() * TAU,
      grav: o.grav ?? 0,
      grow: o.grow ?? 0,
      drag: o.drag ?? 0.5,
      screen: Boolean(o.screen),
    });
    p.max = p.life;
    return p;
  }
  burst(kind, x, z, y, n, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU,
        sp = (o.speed ?? 2) * (0.4 + Math.random() * 0.8);
      this.spawn(kind, x, z, y, {
        ...o,
        vx: Math.cos(a) * sp + (o.dx ?? 0),
        vz: Math.sin(a) * sp * 0.4,
        vy: (o.up ?? 2) * (0.5 + Math.random()),
        color: o.colors ? o.colors[Math.floor(Math.random() * o.colors.length)] : o.color,
        size: (o.size ?? 0.15) * (0.6 + Math.random() * 0.8),
        life: (o.life ?? 0.7) * (0.6 + Math.random() * 0.7),
      });
    }
  }
  fireBurst(x, z, y, scale = 1) {
    this.burst('fire', x, z, y, Math.round(14 * scale), { speed: 1.6 * scale, up: 2.4 * scale, size: 0.28 * scale, life: 0.6, colors: COLORS.fire, drag: 1.5 });
    this.burst('ember', x, z, y, Math.round(10 * scale), { speed: 2.4 * scale, up: 3.5, size: 0.05, life: 1.1, colors: [P.sun, '#FFF8C2', P.tangerine], grav: -0.6 });
    this.burst('smoke', x, z, y + 0.4, Math.round(4 * scale), { speed: 0.5, up: 1.1, size: 0.3 * scale, life: 1.4, color: P.smoke, grow: 0.9 });
  }
  popup(x, z, y, str, color = P.ink, size = 1, o = {}) {
    this.popups.push({ x, z, y, str, color, size, age: 0, life: o.life ?? 1.2, sub: o.sub, fill: o.fill });
    if (this.popups.length > 14) this.popups.shift();
  }
  // One banner at a time: a new one only replaces a lower-priority banner, or one that
  // has mostly played out. Small stuff goes to world popups instead (see feedback()).
  call(str, o = {}) {
    const cur = this.callout;
    if (cur && cur.age < cur.life * 0.8 && (o.priority ?? 1) <= cur.priority) return;
    this.callout = { str, sub: o.sub ?? null, fill: o.fill ?? P.sun, color: o.color ?? P.ink, age: 0, life: o.life ?? 1.3, priority: o.priority ?? 1, angle: (Math.random() - 0.5) * 0.08 - 0.03 };
  }
  shake(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }
  flashOnce(alphaValue = 0.35, color = '#FFFFFF') {
    this.flash = Math.max(this.flash, alphaValue);
    this.flashColor = color;
  }
  update(dt) {
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    this.flash = Math.max(0, this.flash - dt * 2.2);
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      const drag = Math.exp(-p.drag * dt);
      p.vx *= drag;
      p.vz *= drag;
      p.vy = p.vy * drag - p.grav * 9.8 * dt;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
      p.size += p.grow * dt;
      if (p.kind === 'debris' || p.kind === 'confetti' || p.kind === 'water' || p.kind === 'shard') {
        if (p.y < 0) {
          p.y = 0;
          p.vy = Math.abs(p.vy) * 0.35;
          p.vx *= 0.6;
          if (p.kind === 'water') p.life = Math.min(p.life, 0.1);
        }
      }
    }
    for (const q of this.popups) q.age += dt;
    this.popups = this.popups.filter((q) => q.age < q.life);
    if (this.callout) {
      this.callout.age += dt;
      if (this.callout.age > this.callout.life) this.callout = null;
    }
  }
  // Two passes keep additive glow on top of normal particles.
  draw(c, project, k, reduced) {
    c.save();
    for (const pass of ['normal', 'lighter']) {
      c.globalCompositeOperation = pass === 'lighter' ? 'lighter' : 'source-over';
      for (const p of this.pool) {
        if (p.life <= 0) continue;
        const additive = p.kind === 'fire' || p.kind === 'ember' || p.kind === 'spark';
        if ((pass === 'lighter') !== additive) continue;
        const s = project(p.x, p.z, p.y),
          t = p.life / p.max,
          size = Math.max(0.5, p.size * k);
        c.globalAlpha = Math.min(1, t * 1.6);
        if (p.kind === 'fire') {
          c.fillStyle = P.fire[Math.min(3, Math.floor((1 - t) * 4))];
          ellipse(c, s.x, s.y, size * (0.5 + t * 0.6), size * (0.7 + t * 0.8));
          c.fill();
        } else if (p.kind === 'ember' || p.kind === 'spark') {
          c.fillStyle = p.color;
          const flick = 0.6 + 0.4 * Math.abs(noise(p.angle * 3 + t * 9));
          ellipse(c, s.x, s.y, size * flick + 1, size * flick + 1);
          c.fill();
        } else if (p.kind === 'smoke' || p.kind === 'dust' || p.kind === 'foam') {
          const base = Math.min(1, t) * (p.kind === 'smoke' ? 0.42 : 0.6);
          c.fillStyle = p.color;
          c.globalAlpha = base * 0.5;
          ellipse(c, s.x, s.y, size * 1.25, size * 1.05);
          c.fill();
          c.globalAlpha = base;
          ellipse(c, s.x, s.y, size * 0.8, size * 0.7);
          c.fill();
        } else if (p.kind === 'water') {
          c.fillStyle = P.water;
          ellipse(c, s.x, s.y, size * 0.6, size);
          c.fill();
        } else {
          c.save();
          c.translate(s.x, s.y);
          c.rotate(p.angle);
          c.fillStyle = p.color;
          const w = size * (p.kind === 'confetti' ? 1 : 1.6),
            h = size * (p.kind === 'confetti' ? 0.55 * Math.abs(Math.cos(p.angle * 2)) + 0.1 : 0.6);
          c.fillRect(-w / 2, -h / 2, w, h);
          if (p.kind === 'debris') {
            c.strokeStyle = P.ink;
            c.lineWidth = 1;
            c.strokeRect(-w / 2, -h / 2, w, h);
          }
          c.restore();
        }
      }
    }
    c.restore();
    c.globalAlpha = 1;
    // World-anchored score popups
    for (const q of this.popups) {
      const s = project(q.x, q.z, q.y + easeOutCubic(q.age / q.life) * 1.4),
        a = q.age < 0.15 ? q.age / 0.15 : 1 - Math.max(0, (q.age - q.life * 0.6) / (q.life * 0.4));
      c.globalAlpha = Math.max(0, a);
      const size = Math.max(12, k * 0.42) * q.size * (q.age < 0.2 ? easeOutBack(q.age / 0.2) : 1);
      text(c, q.str, s.x, s.y, size, q.color, { stroke: q.fill ?? '#FFFFFF', strokeWidth: Math.max(3, size * 0.22), weight: 900 });
      if (q.sub) text(c, q.sub, s.x, s.y + size * 0.85, size * 0.5, P.inkSoft, { stroke: '#FFFFFF', strokeWidth: 3 });
    }
    c.globalAlpha = 1;
  }
  drawCallout(c, view) {
    const q = this.callout;
    if (!q) return;
    const t = q.age,
      appear = easeOutBack(Math.min(1, t / 0.22)),
      leave = t > q.life - 0.25 ? 1 - (t - (q.life - 0.25)) / 0.25 : 1;
    const size = Math.min(view.portrait ? 30 : 46, view.width * (view.portrait ? 0.075 : 0.045), view.height * 0.075);
    const y = view.portrait ? view.hud + view.height * 0.12 : view.hud + view.height * 0.16;
    c.save();
    c.globalAlpha = Math.max(0, leave);
    c.translate(view.width / 2, y);
    c.scale(appear, appear);
    banner(c, q.str, 0, 0, size, { fill: q.fill, color: q.color, angle: q.angle });
    if (q.sub) {
      c.font = `italic 800 ${size * 0.42}px sans-serif`;
      const w = Math.min(view.width * 0.9, c.measureText(q.sub).width + size * 0.8);
      rr(c, -w / 2, size * 0.78, w, size * 0.62, size * 0.31);
      c.fillStyle = P.ink;
      c.fill();
      text(c, q.sub, 0, size * 1.09, size * 0.38, '#FFFFFF', { weight: 800 });
    }
    c.restore();
  }
}
// Event → feedback recipes (see .claude/skills/arcade-game-feel).
export function feedback(fx, e, ctx) {
  const { houseX, model, reduced } = ctx;
  const hx = e.house !== undefined && e.house !== null ? houseX(e.house) : null;
  // Row houses keep simulating while the skater is in Bee Alley (houseX is null there):
  // keep the callout and shake, drop the world-space bursts and popups.
  if (e.house != null && hx === null) fx = offRow(fx);
  const at = (dx = 0) => (hx !== null ? hx + dx : e.x);
  const k = reduced ? 0.3 : 1;
  switch (e.type) {
    case 'throw':
      fx.burst('dust', e.x, e.z, 0.1, 3, { speed: 0.6, up: 0.2, size: 0.2, color: '#E8DFF7', life: 0.4, grow: 0.5 });
      break;
    case 'hit':
      fx.fireBurst(at(e.dx), e.z, 1.1, 1.2);
      fx.shake(0.16 * k);
      fx.popup(at(e.dx), e.z, 1.9, `+${e.points ?? 100}`, P.ink, 1.1, { fill: P.sun, sub: e.text });
      break;
    case 'practiceHit':
      fx.fireBurst(e.x, e.z, 1.1, 1);
      fx.popup(e.x, e.z, 1.9, e.text ?? 'LIT!', P.ink, 1, { fill: P.sun });
      break;
    case 'practiceMiss':
      fx.burst('dust', e.x, e.z, 0.1, 4, { speed: 0.8, up: 0.3, size: 0.25, color: '#E8DFF7', life: 0.6, grow: 0.6 });
      fx.popup(e.x, e.z, 1.2, 'MISS', P.inkSoft, 0.9, { sub: e.sub });
      break;
    case 'miss':
      fx.burst('shard', e.x, e.z, 0.2, 8, { speed: 2, up: 2, size: 0.07, colors: ['#7FE0A0', '#C8F7D8'], grav: 1, life: 0.7 });
      fx.burst('fire', e.x, e.z, 0.2, 5, { speed: 0.6, up: 1.2, size: 0.18, life: 0.35 });
      fx.burst('dust', e.x, e.z, 0.1, 4, { speed: 0.8, up: 0.3, size: 0.25, color: '#E8DFF7', life: 0.6, grow: 0.6 });
      fx.popup(e.x, e.z, 1.2, 'MISS', P.inkSoft, 1, { sub: 'LID’S ON · COME BACK TOMORROW', life: 1.6 });
      break;
    case 'wasted':
    case 'itemMiss':
      fx.burst('dust', e.x, e.z, 0.1, 5, { speed: 0.9, up: 0.4, size: 0.25, color: '#E8DFF7', life: 0.6, grow: 0.6 });
      fx.popup(e.x, e.z, 1, e.text ?? 'WIDE', P.inkSoft, 0.8);
      break;
    case 'broLit': {
      const x = at(e.dx);
      fx.fireBurst(x, e.z, 1, 0.9);
      fx.popup(x, e.z, 2.4, `+${(e.points ?? 250 * e.chain * (model.diff?.points ?? 1)).toLocaleString()}`, P.ink, 1 + Math.min(0.6, e.chain * 0.1), { fill: P.tangerine, sub: e.bark });
      fx.shake(0.1 * k);
      if (e.chain >= 3) fx.call(`${e.text} ×${e.chain}`, { fill: P.tangerine, priority: 2, life: 1 });
      break;
    }
    case 'houseFire':
      fx.fireBurst(at(e.dx), -10, 1.5, 1.4);
      fx.shake(0.2 * k);
      fx.call(e.text, { fill: P.tangerine, sub: model.houses[e.house]?.name, priority: 2 });
      break;
    case 'harmed':
    case 'reallyHarmed':
      fx.burst('debris', at(), -10.4, 3, e.type === 'harmed' ? 8 : 14, { speed: 3, up: 3, size: 0.18, colors: [model.houses[e.house].wall, model.houses[e.house].roof, '#E8C08A'], grav: 1, life: 1.2 });
      fx.shake((e.type === 'harmed' ? 0.25 : 0.4) * k);
      fx.call(e.text, { fill: e.type === 'harmed' ? '#FFE69A' : P.tangerine, sub: e.sub, priority: 3 });
      break;
    case 'houseGone': {
      const x = at();
      for (let i = 0; i < 3; i++) fx.burst('dust', x + (i - 1) * 3, -10.4, 1, 10, { speed: 2.5, up: 1.5, size: 0.9, color: '#E2D9F2', life: 1.8, grow: 1.4, drag: 1.2 });
      fx.burst('debris', x, -10.4, 3, 26, { speed: 5, up: 5, size: 0.24, colors: [model.houses[e.house].wall, model.houses[e.house].roof, '#E8C08A', '#FFFFFF'], grav: 1, life: 1.6 });
      fx.burst('confetti', x, -9, 5, 30, { speed: 4, up: 4, size: 0.14, colors: COLORS.confetti, grav: 0.25, life: 2.4, drag: 1 });
      fx.shake(0.7 * k);
      fx.flashOnce(0.4 * k);
      fx.popup(x, -9, 5.5, `+${(e.points ?? 0).toLocaleString()}`, P.ink, 1.7, { fill: P.mint, life: 1.8, sub: `HOUSE #${e.n}` });
      fx.call(e.text, { fill: P.mint, sub: e.sub, priority: 4, life: 1.8 });
      break;
    }
    case 'fdRoll':
      if (e.success) fx.call(e.text, { fill: '#FFE0E6', sub: e.sub, priority: 3, life: 1.6 });
      else fx.popup(at(), -9.6, 6.6, 'NO TRUCK', P.inkSoft, 0.7, { sub: '15% ROLL MISSED' });
      break;
    case 'fdRescue':
      fx.call(e.text, { fill: '#BFEFFF', sub: e.sub, priority: 3 });
      break;
    case 'fdArrive':
      fx.burst('water', at(), -10, 4, 20, { speed: 2, up: 2, size: 0.12, grav: 0.6, life: 1 });
      break;
    case 'doused':
      if (hx !== null) fx.burst('foam', at(e.dx), e.z, 1, 10, { speed: 1.2, up: 1, size: 0.22, color: '#FFFFFF', life: 0.8, grow: 0.4 });
      if (e.text && hx !== null) fx.popup(at(e.dx), e.z, 2.3, e.text, P.inkSoft, 0.7);
      break;
    case 'fumble':
      fx.popup(at(e.dx), e.z, 2.6, e.text, P.inkSoft, 0.75);
      fx.burst('foam', at(e.dx), e.z, 0.4, 8, { speed: 1, up: 0.6, size: 0.2, color: '#FFFFFF', life: 0.7, grow: 0.3 });
      break;
    case 'gawk':
      if (Math.random() < 0.5) fx.popup(at(), -7, 2.6, ['WOOO!', 'BONFIRE!', 'SEND IT!'][Math.floor(Math.random() * 3)], P.ink, 0.6, { life: 0.9 });
      break;
    case 'bees':
      fx.call(e.text, { fill: P.sun, sub: e.bark, priority: 3 });
      fx.shake(0.15 * k);
      break;
    case 'rot':
      fx.popup(at(), -10, 5, e.text, '#4F8A2B', 0.8, { life: 1.6 });
      break;
    case 'sub':
      fx.popup(at(e.dx), -7, 2.2, e.text, P.ink, 0.9, { fill: P.cyan });
      break;
    case 'subBeat':
      fx.shake(0.06 * k);
      fx.burst('dust', at(), -10.6, 2, 3, { speed: 1, up: 0.6, size: 0.25, color: '#EDE6FA', life: 0.5, grow: 0.5 });
      break;
    case 'fryer':
      fx.popup(at(e.dx), -9.6, 2, e.text, P.ink, 0.8, { fill: P.tangerine });
      break;
    case 'fireball': {
      const x = at(e.dx);
      fx.fireBurst(x, -9.6, 1, 3);
      fx.burst('smoke', x, -9.6, 2.5, 10, { speed: 2, up: 2, size: 0.9, color: P.smoke, life: 2, grow: 1.2 });
      fx.shake(0.65 * k);
      fx.flashOnce(0.5 * k, '#FFE7B0');
      fx.call(e.text, { fill: P.tangerine, priority: 4, life: 1.5 });
      break;
    }
    case 'raccoons':
    case 'raccoonsIn':
    case 'lidOff':
      fx.popup(at(e.dx), -8, 2, e.text, P.ink, 0.85, { fill: '#D7BBFF' });
      break;
    case 'balloon':
      fx.popup(at(e.dx), -11, 7.5, `${e.count} / ${e.need}`, P.pink, 0.9, { sub: 'BALLOONS' });
      break;
    case 'liftoff':
      fx.call(e.text, { fill: P.pink, color: '#FFFFFF', sub: e.sub, priority: 3, life: 1.6 });
      break;
    case 'unlock':
      fx.burst('confetti', e.x, -4, 2, 30, { speed: 3, up: 4, size: 0.12, colors: COLORS.confetti, grav: 0.3, life: 1.8, drag: 1 });
      break;
    case 'restock':
    case 'crate':
      fx.popup(e.x, e.z ?? -4, 1.4, e.text, P.ink, 0.8, { fill: P.mint, sub: e.sub });
      break;
    case 'empty':
      // Out of ammo pops at the skater; an older sim also sent the beehive's house 'empty'.
      if (hx !== null) fx.popup(at(), -9, 3, e.text, P.ink, 0.8, { fill: P.sun });
      else fx.popup(model.player.x, model.player.z, 2.6, e.text, P.inkSoft, 0.8);
      break;
    case 'houseEmpty':
      fx.popup(at(), -9, 3, e.text, P.ink, 0.8, { fill: P.sun });
      break;
    case 'noThrow':
      fx.popup(model.player.x, model.player.z, 2.6, e.text, P.inkSoft, 0.8);
      break;
    case 'wipeout':
      fx.burst('dust', e.x, e.z, 0.2, 12, { speed: 2, up: 1, size: 0.35, color: '#EDE6FA', life: 0.9, grow: 0.8 });
      fx.burst('spark', e.x, e.z, 0.3, 8, { speed: 3, up: 2, size: 0.05, colors: [P.sun, '#FFFFFF'], life: 0.4 });
      fx.shake(0.3 * k);
      fx.call(e.text, { fill: '#FFE0E6', priority: 2, life: 0.9 });
      break;
    case 'stumble':
      fx.burst('dust', e.x, e.z, 0.1, 6, { speed: 1.2, up: 0.5, size: 0.25, color: '#EDE6FA', life: 0.6, grow: 0.6 });
      fx.popup(e.x, e.z, 2.6, e.text, P.inkSoft, 0.7, { life: 0.8 });
      fx.shake(0.08 * k);
      break;
    case 'land':
      fx.burst('dust', e.x, e.z, 0.05, e.big ? 10 : 4, { speed: e.big ? 2 : 1, up: 0.3, size: 0.2, color: '#EDE6FA', life: 0.5, grow: 0.6 });
      if (e.big) fx.burst('spark', e.x, e.z, 0.1, 10, { speed: 3, up: 1, size: 0.05, colors: [P.sun, '#FFFFFF'], life: 0.35 });
      if (e.big) fx.shake(0.1 * k);
      if (e.clean === false) fx.popup(e.x, e.z, 2.8, e.text ?? 'SKETCHY', P.inkSoft, 0.7, { life: 0.8 });
      break;
    case 'ollie':
      if (e.perfect) fx.popup(e.x, e.z, 2.8, 'PERFECT!', P.ink, 0.75, { fill: P.mint, life: 0.8 });
      break;
    case 'push':
      fx.burst('dust', e.x - 0.6, e.z, 0.05, 3, { speed: 0.6, up: 0.2, size: 0.18, color: '#EDE6FA', life: 0.4, grow: 0.4, dx: -1.5 });
      fx.burst('spark', e.x - 0.5, e.z, 0.1, 4, { speed: 1.5, up: 0.4, size: 0.04, colors: ['#FFFFFF', P.cyan], life: 0.25, dx: -2 });
      break;
    case 'kick':
      if (!e.lazy) fx.burst('dust', e.x - 0.7, e.z, 0.05, 2, { speed: 0.4, up: 0.15, size: 0.14, color: '#EDE6FA', life: 0.35, grow: 0.4, dx: -1 });
      break;
    case 'slide':
      fx.burst('dust', e.x - 0.4, e.z, 0.05, 6, { speed: 1, up: 0.3, size: 0.22, color: '#EDE6FA', life: 0.5, grow: 0.6, dx: 1 });
      break;
    case 'grind':
      fx.burst('spark', e.x, e.z, 0.5, 10, { speed: 2.5, up: 1.5, size: 0.05, colors: [P.sun, '#FFFFFF'], life: 0.35 });
      break;
    case 'light':
      fx.burst('spark', e.x + 0.4, e.z, 1.9, 6, { speed: 1.2, up: 1.2, size: 0.04, colors: [P.sun, '#FFF8C2'], life: 0.3 });
      break;
    case 'combo':
      fx.popup(e.x, e.z, 3.2, `+${e.points.toLocaleString()}`, P.ink, 1.2, { fill: P.mint, sub: `×${e.mult} COMBO`, life: 1.3 });
      if (e.mult >= 3) fx.burst('confetti', e.x, e.z, 2.5, 14, { speed: 3, up: 3, size: 0.1, colors: COLORS.confetti, grav: 0.3, life: 1.2, drag: 1 });
      break;
    case 'flow':
      fx.call(e.text, { fill: P.mint, sub: 'SHIELD UP · SMASH THROUGH', priority: 3, life: 1.4 });
      fx.flashOnce(0.25 * k, '#C8FFE9');
      fx.burst('spark', e.x, e.z, 1.5, 24, { speed: 4, up: 3, size: 0.06, colors: [P.mint, P.cyan, '#FFFFFF'], life: 0.6 });
      break;
    case 'smash':
      fx.burst('debris', e.x, e.z, 0.6, 10, { speed: 3, up: 3, size: 0.14, colors: ['#FF7AA8', '#FFFFFF', P.sun, '#D9E3F2'], grav: 1, life: 0.9 });
      fx.popup(e.x, e.z, 1.8, e.text, P.ink, 0.8, { fill: P.mint, life: 0.8 });
      fx.shake(0.12 * k);
      break;
    case 'hive':
      fx.burst('confetti', e.x, e.z, 1 + (e.y ?? 0), 10, { speed: 2, up: 2, size: 0.08, colors: [P.sun, '#FFE07A', P.ink], grav: 0.3, life: 0.9, drag: 1 });
      fx.popup(e.x, e.z, 2.2 + (e.y ?? 0), e.text, P.ink, 0.9, { fill: P.sun, life: 1 });
      break;
    case 'noticed':
      fx.call(e.text, { fill: '#FFE0E6', sub: 'CHASED OUT OF BEE ALLEY', priority: 4, life: 1.4 });
      fx.shake(0.25 * k);
      break;
    case 'alleyEnter':
      fx.call(e.text, { fill: P.sun, sub: e.sub, priority: 3, life: 1.6 });
      break;
    case 'alleyExit':
      if (e.how !== 'chased') fx.call(e.text, { fill: P.sun, sub: `${e.got} HIVE${e.got === 1 ? '' : 'S'}`, priority: 3, life: 1.2 });
      break;
    case 'stationDone':
      fx.burst('confetti', e.x, e.z, 2, 18, { speed: 3, up: 3, size: 0.1, colors: COLORS.confetti, grav: 0.3, life: 1.2, drag: 1 });
      break;
    case 'stationRetry':
      fx.popup(e.x, e.z, 3, e.text, P.ink, 1, { fill: P.sun, life: 1.2 });
      break;
    case 'trainingDone':
      fx.call(e.text, { fill: P.mint, priority: 5, life: 1.6 });
      break;
    case 'warn':
      fx.call(e.text, { fill: '#FFE0E6', color: P.ink, priority: 3, life: 1 });
      break;
    case 'captured':
      fx.shake(0.5 * k);
      fx.flashOnce(0.45 * k, '#E8DCC4');
      fx.call(e.text, { fill: '#E8DCC4', sub: e.sub, priority: 5, life: 2 });
      break;
    case 'rescueStart':
      fx.call(e.text, { fill: P.mint, sub: e.sub, priority: 5, life: 2 });
      break;
    case 'freed':
      fx.burst('confetti', e.x, e.z, 1.5, 24, { speed: 3, up: 3, size: 0.12, colors: COLORS.confetti, grav: 0.3, life: 1.5, drag: 1 });
      fx.call(e.text, { fill: P.mint, sub: e.sub, priority: 4 });
      break;
    case 'rescued':
      fx.burst('confetti', e.x, e.z, 2, 40, { speed: 4, up: 4, size: 0.12, colors: COLORS.confetti, grav: 0.3, life: 2, drag: 1 });
      fx.call(e.text, { fill: P.mint, sub: e.sub, priority: 5 });
      break;
    case 'lap':
      if (model.phase !== 'newspaper') fx.call(e.text, { fill: P.cyan, sub: ctx.lapName, priority: 4, life: 1.8 });
      break;
    case 'go':
    case 'continued':
      fx.call(e.text, { fill: P.mint, priority: 3, life: 0.9 });
      break;
    case 'victory':
      fx.call(e.text, { fill: P.mint, priority: 6, life: 2.5 });
      break;
    case 'honk':
      fx.popup(e.x, e.z, 2.2, 'HONK!', P.ink, 0.7, { fill: P.sun, life: 0.8 });
      break;
    case 'keg':
      fx.popup(e.x, e.z, 1.6, 'KEG!', P.ink, 0.75, { fill: '#D9E3F2', life: 0.9 });
      break;
    case 'saved':
      fx.popup(at(), -10, 5.2, e.text, P.inkSoft, 0.8);
      break;
  }
}
// Screen-space feedback only, for house events fired while the Row is off screen.
const offRow = (fx) => ({ call: (...a) => fx.call(...a), shake: (a) => fx.shake(a), flashOnce() {}, burst() {}, fireBurst() {}, popup() {}, spawn() {} });
export { alpha };
