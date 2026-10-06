import { P, FONT } from './palette.js';
export const TAU = Math.PI * 2;
export const easeOutCubic = (t) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
export const easeOutBack = (t, s = 1.7) => {
  t = Math.min(1, Math.max(0, t)) - 1;
  return 1 + (s + 1) * t ** 3 + s * t ** 2;
};
export const clamp01 = (t) => Math.min(1, Math.max(0, t));
// Critically damped spring toward target; stable for any dt.
export function spring(state, target, omega, dt) {
  const x = state.x - target,
    v = state.v,
    e = Math.exp(-omega * dt);
  state.x = target + (x + (v + omega * x) * dt) * e;
  state.v = (v - omega * (v + omega * x) * dt) * e;
  return state.x;
}
// Smooth 1D value noise in [-1, 1] for flicker and wobble.
const hash = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
export function noise(x) {
  const i = Math.floor(x),
    f = x - i,
    u = f * f * (3 - 2 * f);
  return (hash(i) * (1 - u) + hash(i + 1) * u) * 2 - 1;
}
export const rand = (seed) => hash(seed);
function parse(hex) {
  // mix()/lighten()/darken() return rgb() strings, and callers chain them.
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(hex);
  if (m) return [+m[1], +m[2], +m[3]];
  const v = hex.replace('#', '');
  const n = parseInt(v.length === 3 ? [...v].map((c) => c + c).join('') : v.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const cache = new Map();
export function mix(a, b, t) {
  const key = `${a}${b}${t.toFixed(3)}`;
  let out = cache.get(key);
  if (out) return out;
  const x = parse(a),
    y = parse(b);
  out = `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`;
  if (cache.size > 4000) cache.clear();
  cache.set(key, out);
  return out;
}
export const lighten = (c, t) => mix(c, '#FFFFFF', t);
export const darken = (c, t) => mix(c, P.ink, t);
export function alpha(hex, a) {
  const [r, g, b] = parse(hex);
  return `rgba(${r},${g},${b},${a})`;
}
export function rr(c, x, y, w, h, r) {
  r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
export function paint(c, fill, stroke, width = 2) {
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = width;
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.stroke();
  }
}
export function ellipse(c, x, y, rx, ry, rotation = 0) {
  c.beginPath();
  c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rotation, 0, TAU);
}
export function poly(c, points, close = true) {
  c.beginPath();
  c.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) c.lineTo(points[i][0], points[i][1]);
  if (close) c.closePath();
}
// Closed smooth curve through points (midpoint quadratic splines).
export function blob(c, points) {
  const n = points.length;
  c.beginPath();
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(points[n - 1], points[0]);
  c.moveTo(start[0], start[1]);
  for (let i = 0; i < n; i++) {
    const p = points[i],
      m = mid(p, points[(i + 1) % n]);
    c.quadraticCurveTo(p[0], p[1], m[0], m[1]);
  }
  c.closePath();
}
export function limb(c, x0, y0, x1, y1, width, color, outline = P.ink, ow = 2) {
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  if (outline) {
    c.strokeStyle = outline;
    c.lineWidth = width + ow * 2;
    c.stroke();
  }
  c.strokeStyle = color;
  c.lineWidth = width;
  c.stroke();
}
export function font(size, weight = 800, family = FONT.display, italic = true) {
  return `${italic ? 'italic ' : ''}${weight} ${Math.round(size)}px ${family}`;
}
export function text(c, str, x, y, size, color = P.ink, o = {}) {
  c.font = font(size, o.weight ?? 800, o.family ?? FONT.display, o.italic ?? true);
  c.textAlign = o.align ?? 'center';
  c.textBaseline = o.baseline ?? 'middle';
  if (o.shadow) {
    c.fillStyle = o.shadow;
    c.fillText(str, x + (o.shadowX ?? 3), y + (o.shadowY ?? 3));
  }
  if (o.stroke) {
    c.strokeStyle = o.stroke;
    c.lineWidth = o.strokeWidth ?? Math.max(2, size * 0.14);
    c.lineJoin = 'round';
    c.strokeText(str, x, y);
  }
  c.fillStyle = color;
  c.fillText(str, x, y);
  return c.measureText(str).width;
}
// Late-80s chrome: sky above a hard horizon, sunset below, ink outline, offset shadow.
export function chrome(c, str, x, y, size, o = {}) {
  c.save();
  c.font = font(size, 900, o.family ?? FONT.display, o.italic ?? true);
  c.textAlign = o.align ?? 'center';
  c.textBaseline = 'middle';
  const top = y - size * 0.42,
    bottom = y + size * 0.42;
  const g = c.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, '#FFFFFF');
  g.addColorStop(0.44, o.upper ?? '#8EEBFF');
  g.addColorStop(0.5, o.horizon ?? P.inkSoft);
  g.addColorStop(0.52, o.lower ?? '#FF7A3D');
  g.addColorStop(1, '#FFE27A');
  c.lineJoin = 'round';
  c.fillStyle = o.shadow ?? P.pink;
  c.fillText(str, x + size * 0.06, y + size * 0.07);
  c.strokeStyle = P.ink;
  c.lineWidth = Math.max(2, size * 0.12);
  c.strokeText(str, x, y);
  c.fillStyle = g;
  c.fillText(str, x, y);
  c.restore();
}
// Slanted arcade banner slab with text.
export function banner(c, str, x, y, size, o = {}) {
  c.save();
  c.translate(x, y);
  c.rotate(o.angle ?? -0.05);
  c.font = font(size, 900);
  const w = c.measureText(str).width + size * 1.1,
    h = size * 1.35;
  c.fillStyle = P.ink;
  c.beginPath();
  c.moveTo(-w / 2 + h * 0.25 + 5, -h / 2 + 6);
  c.lineTo(w / 2 + 5, -h / 2 + 6);
  c.lineTo(w / 2 - h * 0.25 + 5, h / 2 + 6);
  c.lineTo(-w / 2 + 5, h / 2 + 6);
  c.closePath();
  c.fill();
  c.beginPath();
  c.moveTo(-w / 2 + h * 0.25, -h / 2);
  c.lineTo(w / 2, -h / 2);
  c.lineTo(w / 2 - h * 0.25, h / 2);
  c.lineTo(-w / 2, h / 2);
  c.closePath();
  c.fillStyle = o.fill ?? P.sun;
  c.fill();
  c.strokeStyle = P.ink;
  c.lineWidth = 3;
  c.stroke();
  text(c, str, 0, 1, size, o.color ?? P.ink, { weight: 900 });
  c.restore();
  return w;
}
export function star(c, x, y, r, points = 5, inner = 0.45) {
  c.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points,
      rad = i % 2 ? r * inner : r;
    c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  c.closePath();
}
