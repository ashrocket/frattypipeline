import { P, FONT } from './palette.js';
import { rr, paint, text, ellipse, alpha, easeOutBack } from './draw.js';
import { project } from '../layout.js';
import { BUBBLES, KEYCAPS } from '../data/strings.js';
// Big hero thought bubbles: the skater thinks the move out loud, with the real keys.
// Training shows one per station; on the Row each one appears the first time it matters.
const FIRSTS = {
  miss: 'comeBack',
  broLit: 'firstFire',
  warn: 'horde',
  alleyEnter: 'beeAlley',
  flow: 'flow',
};
export class Bubbles {
  constructor() {
    this.current = null;
    this.queue = [];
    this.seen = new Set();
  }
  show(key, o = {}) {
    if (!BUBBLES[key]) return;
    if (!o.station && this.seen.has(key)) return;
    this.seen.add(key);
    const bubble = { key, age: 0, life: o.life ?? 5.5, station: Boolean(o.station), done: false };
    if (o.station || !this.current) {
      this.current = bubble;
      if (o.station) this.queue = [];
    } else if (this.queue.length < 2) this.queue.push(bubble);
  }
  event(e, m) {
    if (e.type === 'trainingStart') this.seen.clear();
    // A bubble frozen at the end of the last run must not open the next one.
    if (e.type === 'start' || e.type === 'trainingStart') {
      this.current = null;
      this.queue = [];
    }
    if (e.type === 'station') this.show(e.station, { station: true, life: Infinity });
    else if (e.type === 'stationDone' && this.current?.station) {
      this.current.done = true;
      this.current.life = this.current.age + 0.9;
    } else if (e.type === 'trainingDone' || e.type === 'captured') this.current = null;
    else if (e.type === 'unlock') this.show(e.kind);
    else if (e.type === 'combo' && e.parts.length >= 2) this.show('combo');
    else if (FIRSTS[e.type]) this.show(FIRSTS[e.type]);
  }
  draw(c, view, m, t, dt) {
    // The first ready can in reach on the Row gets the throw lesson again, in context.
    if (m.level === 'row' && m.phase === 'playing' && !this.seen.has('firstCan') && m.stats.cansLit === 0 && m.time > 3) {
      const a = m.aim();
      if (a.target && a.target.kind === 'can') this.show('firstCan', { life: 6 });
    }
    const b = this.current;
    if (!b) return;
    if (b.station && m.level !== 'training') {
      this.current = this.queue.shift() ?? null;
      return;
    }
    // Pause, the newspaper, count-ins and bonus freeze the bubble (hidden, not aged):
    // each one is shown only once, so dropping it here would lose it for good.
    if (!['playing', 'rescue', 'training'].includes(m.phase)) return;
    b.age += dt;
    if (b.age > b.life) {
      this.current = this.queue.shift() ?? null;
      return;
    }
    const spec = BUBBLES[b.key],
      device = m.inputDevice ?? 'keyboard',
      caps = KEYCAPS[device] ?? KEYCAPS.keyboard;
    const small = view.portrait || view.width < 700 || view.height < 520,
      tiny = !view.portrait && view.height < 420,
      titleSize = tiny ? 17 : small ? 22 : 34,
      lineSize = tiny ? 11.5 : small ? 14 : 19,
      padX = tiny ? 14 : small ? 18 : 28,
      maxW = Math.min(view.width - 24, small ? 380 : 560);
    c.save();
    c.font = `800 ${lineSize}px ${FONT.ui}`;
    const all = spec.lines.map((line) => layoutLine(c, line, caps, lineSize));
    // Very short screens (phone landscape) show one line at a time, rotating.
    const lines = tiny ? [all[Math.floor(b.age / 2.4) % all.length]] : all;
    const width = Math.min(maxW, Math.max(...all.map((l) => l.width), measureTitle(c, spec.title, titleSize)) + padX * 2);
    const height = titleSize * 1.35 + lines.length * lineSize * 1.85 + (tiny ? 16 : small ? 22 : 30);
    // Anchor up and to the LEFT of the skater's head: the road ahead (cans, rails,
    // hazards) stays clear. Clamped below the HUD.
    const p = m.player,
      head = project(view, p.x, p.z, p.y + 3.1);
    let x = head.x - width * 0.72,
      y = head.y - height - (small ? 34 : 64);
    x = Math.max(12, Math.min(view.width - width - 12, x));
    y = Math.max(view.hud + (tiny ? 54 : small ? 60 : 92), y);
    const appear = easeOutBack(Math.min(1, b.age / 0.3)),
      leave = Number.isFinite(b.life) ? Math.min(1, Math.max(0, (b.life - b.age) / 0.35)) : 1;
    c.globalAlpha = leave;
    c.translate(x + width / 2, y + height / 2);
    c.scale(appear, appear);
    c.translate(-(x + width / 2), -(y + height / 2));
    cloud(c, x, y, width, height);
    // Thought trail back to the head (only when there's room for it)
    const tail = Math.max(x + 30, Math.min(x + width - 30, head.x));
    if (head.y - (y + height) > 24)
      for (const [f, r] of [[0.35, 0.11], [0.62, 0.075], [0.85, 0.05]]) {
        const tx = tail + (head.x - tail) * f,
          ty = y + height + (head.y - (y + height)) * f;
        ellipse(c, tx, ty, height * r, height * r * 0.85);
        paint(c, '#FFFFFF', P.ink, 3);
      }
    const done = b.done;
    const top = tiny ? 12 : small ? 16 : 22;
    text(c, done ? 'NICE!' : spec.title, x + width / 2, y + top + titleSize * 0.5, titleSize, done ? P.mint : P.pink, { weight: 900, stroke: P.ink, strokeWidth: Math.max(3, titleSize * 0.16) });
    if (!done) {
      let ly = y + top + titleSize * 1.35 + lineSize * 0.8;
      for (const line of lines) {
        drawLine(c, line, x + width / 2 - line.width / 2, ly, lineSize, t);
        ly += lineSize * 1.85;
      }
    }
    c.restore();
  }
}
function measureTitle(c, str, size) {
  c.save();
  c.font = `italic 900 ${size}px ${FONT.display}`;
  const w = c.measureText(str).width;
  c.restore();
  return w;
}
// Split "HOLD [T]: flick the lighter" into text runs and keycaps.
function layoutLine(c, line, caps, size) {
  const parts = [];
  let width = 0;
  for (const piece of line.split(/(\[[^\]]+\])/)) {
    if (!piece) continue;
    const key = piece.startsWith('[') ? piece.slice(1, -1) : null;
    if (key) {
      const label = caps[key] ?? key;
      c.font = `900 ${size * 0.95}px ${FONT.ui}`;
      const w = Math.max(size * 1.7, c.measureText(label).width + size * 1.1);
      parts.push({ key: label, w });
      width += w + size * 0.3;
    } else {
      c.font = `800 ${size}px ${FONT.ui}`;
      const w = c.measureText(piece).width;
      parts.push({ str: piece, w });
      width += w;
    }
  }
  return { parts, width };
}
function drawLine(c, line, x, y, size, t) {
  for (const part of line.parts) {
    if (part.key) {
      // A chunky keycap: bright, with a 3D lip, bobbing gently so it reads as "press me".
      const bob = Math.sin(t * 6) * 1.5,
        h = size * 1.55,
        top = y - h / 2 + bob;
      rr(c, x, top + 4, part.w, h, 7);
      c.fillStyle = P.ink;
      c.fill();
      rr(c, x, top, part.w, h, 7);
      paint(c, P.sun, P.ink, 2.5);
      text(c, part.key, x + part.w / 2, top + h / 2 + 1, size * 0.95, P.ink, { weight: 900, italic: false, family: FONT.ui });
      x += part.w + size * 0.3;
    } else {
      text(c, part.str, x, y, size, P.ink, { align: 'left', weight: 800, italic: false, family: FONT.ui });
      x += part.w;
    }
  }
}
// Scalloped thought cloud: a rounded body plus bumps along the top and bottom. The
// outline is stroked double-width first and then filled, so only the silhouette shows.
function cloud(c, x, y, w, h) {
  const r = Math.min(h / 2, 34),
    bumps = Math.max(6, Math.round(w / 46)),
    shape = (dx = 0, dy = 0) => {
      c.beginPath();
      c.moveTo(x + dx + r, y + dy);
      c.arcTo(x + dx + w, y + dy, x + dx + w, y + dy + h, r);
      c.arcTo(x + dx + w, y + dy + h, x + dx, y + dy + h, r);
      c.arcTo(x + dx, y + dy + h, x + dx, y + dy, r);
      c.arcTo(x + dx, y + dy, x + dx + w, y + dy, r);
      c.closePath();
      for (let i = 0; i <= bumps; i++) {
        const bx = x + dx + r * 0.6 + ((w - r * 1.2) * i) / bumps;
        c.moveTo(bx + 16, y + dy + 2);
        c.arc(bx, y + dy + 2, 16, 0, Math.PI * 2);
        c.moveTo(bx + 16, y + dy + h - 2);
        c.arc(bx, y + dy + h - 2, 16, 0, Math.PI * 2);
      }
    };
  c.save();
  shape(6, 8);
  c.fillStyle = alpha(P.ink, 0.2);
  c.fill('nonzero');
  shape();
  c.lineWidth = 7;
  c.lineJoin = 'round';
  c.strokeStyle = P.ink;
  c.stroke();
  c.fillStyle = '#FFFFFF';
  c.fill('nonzero');
  c.restore();
}
