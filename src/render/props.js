import { P } from './palette.js';
import { TAU, ellipse, paint, rr, poly, text, darken, lighten, alpha, noise, star, blob } from './draw.js';
import { flames, raccoon, bee } from './characters.js';
// All props draw with their ground-contact point at the origin; k = pixels per meter.
const lw = (k) => Math.max(1.2, k * 0.045);
export function shadow(c, k, rx, ry = rx * 0.28, a = 0.22) {
  c.fillStyle = `rgba(42,30,79,${a})`;
  ellipse(c, 0, 0, rx * k, ry * k);
  c.fill();
}
export function trashCan(c, k, state, t, glow = 0) {
  shadow(c, k, 0.55);
  const w = 0.82 * k,
    h = 1.05 * k;
  const body = state === 'burnt' ? '#8F86B0' : '#BFD4EC';
  if (glow > 0) {
    c.save();
    c.globalAlpha = glow;
    ellipse(c, 0, -h * 0.5, w * 1.05, h * 0.85);
    c.strokeStyle = P.cyan;
    c.lineWidth = Math.max(2, k * 0.08);
    c.stroke();
    c.restore();
  }
  c.beginPath();
  c.moveTo(-w / 2, -h);
  c.lineTo(w / 2, -h);
  c.lineTo(w * 0.43, 0);
  c.lineTo(-w * 0.43, 0);
  c.closePath();
  paint(c, body, P.ink, lw(k));
  c.strokeStyle = darken(body, 0.25);
  c.lineWidth = lw(k) * 0.8;
  for (const f of [-0.25, 0, 0.25]) {
    c.beginPath();
    c.moveTo(f * w, -h * 0.9);
    c.lineTo(f * w * 0.88, -h * 0.1);
    c.stroke();
  }
  c.fillStyle = 'rgba(255,255,255,0.55)';
  c.fillRect(-w * 0.36, -h * 0.92, w * 0.1, h * 0.8);
  ellipse(c, 0, -h, w * 0.52, w * 0.16);
  paint(c, state === 'burnt' ? '#5B4D78' : '#E8F2FF', P.ink, lw(k));
  if (state === 'ready') {
    // Trash peeking out: an open target.
    c.fillStyle = '#7A6AB8';
    ellipse(c, 0, -h, w * 0.42, w * 0.11);
    c.fill();
    for (const [x, col] of [[-0.18, '#FFE69A'], [0.15, '#A6F0D2'], [0.02, '#FFB8AD']]) {
      rr(c, (x - 0.08) * k, -h - 0.16 * k, 0.17 * k, 0.15 * k, 0.03 * k);
      paint(c, col, P.ink, lw(k) * 0.6);
    }
  } else if (state === 'lidded') {
    ellipse(c, 0, -h - 0.06 * k, w * 0.58, w * 0.2);
    paint(c, '#9FB6D6', P.ink, lw(k));
    rr(c, -0.12 * k, -h - 0.24 * k, 0.24 * k, 0.12 * k, 0.05 * k);
    paint(c, '#9FB6D6', P.ink, lw(k) * 0.8);
  } else if (state === 'burning') {
    flames(c, 0, -h + 0.05 * k, w * 0.95, 1.25 * k, t, 3.1);
  } else if (state === 'burnt') {
    c.fillStyle = alpha(P.smoke, 0.5 + 0.2 * Math.sin(t * 3));
    for (let i = 0; i < 3; i++) {
      const tt = (t * 0.5 + i / 3) % 1;
      ellipse(c, Math.sin(tt * 6 + i) * 0.15 * k, -h - tt * 1.4 * k, (0.12 + tt * 0.25) * k, (0.1 + tt * 0.2) * k);
      c.fill();
    }
  }
}
export function couch(c, k, t, burning = true) {
  shadow(c, k, 1.3);
  rr(c, -1.25 * k, -0.95 * k, 2.5 * k, 0.65 * k, 0.18 * k);
  paint(c, '#FFB3DA', P.ink, lw(k));
  rr(c, -1.15 * k, -1.45 * k, 2.3 * k, 0.6 * k, 0.2 * k);
  paint(c, '#FF9AC8', P.ink, lw(k));
  for (const x of [-1.35, 1.05]) {
    rr(c, x * k, -1.15 * k, 0.32 * k, 0.75 * k, 0.12 * k);
    paint(c, '#FF8ABF', P.ink, lw(k));
  }
  c.fillStyle = '#FFFFFF';
  for (const [x, y] of [[-0.7, -1.2], [0.1, -1.25], [0.75, -1.15], [-0.3, -0.65], [0.5, -0.62]]) {
    star(c, x * k, y * k, 0.09 * k, 5, 0.5);
    c.fill();
  }
  for (const x of [-1.05, 1.05]) {
    c.fillStyle = P.ink;
    c.fillRect(x * k - 0.05 * k, -0.32 * k, 0.1 * k, 0.32 * k);
  }
  if (burning) flames(c, 0, -0.9 * k, 2.2 * k, 1.5 * k, t, 7.7);
}
export function cone(c, k) {
  shadow(c, k, 0.35);
  rr(c, -0.32 * k, -0.08 * k, 0.64 * k, 0.1 * k, 0.03 * k);
  paint(c, '#FF7AA8', P.ink, lw(k));
  poly(c, [
    [-0.24 * k, -0.06 * k],
    [-0.06 * k, -0.72 * k],
    [0.06 * k, -0.72 * k],
    [0.24 * k, -0.06 * k],
  ]);
  paint(c, '#FF7AA8', P.ink, lw(k));
  c.fillStyle = '#FFFFFF';
  poly(c, [
    [-0.16 * k, -0.3 * k],
    [-0.11 * k, -0.45 * k],
    [0.11 * k, -0.45 * k],
    [0.16 * k, -0.3 * k],
  ]);
  c.fill();
}
export function pothole(c, k) {
  ellipse(c, 0, 0, 0.62 * k, 0.2 * k);
  paint(c, '#6E64A8', P.inkSoft, lw(k));
  ellipse(c, 0.05 * k, 0.02 * k, 0.45 * k, 0.12 * k);
  c.fillStyle = '#5A5095';
  c.fill();
  c.strokeStyle = '#7C73B5';
  c.lineWidth = lw(k) * 0.8;
  c.beginPath();
  c.moveTo(0.55 * k, -0.05 * k);
  c.lineTo(0.85 * k, -0.12 * k);
  c.moveTo(-0.58 * k, 0.04 * k);
  c.lineTo(-0.9 * k, 0.1 * k);
  c.stroke();
}
export function keg(c, k, t, rolling) {
  shadow(c, k, 0.4);
  c.save();
  c.translate(0, -0.36 * k);
  if (rolling) c.rotate(t * 9);
  ellipse(c, 0, 0, 0.36 * k, 0.36 * k);
  paint(c, '#D9E3F2', P.ink, lw(k));
  c.strokeStyle = '#8F9BB8';
  c.lineWidth = lw(k);
  for (const a of [0, Math.PI / 2]) {
    c.beginPath();
    c.moveTo(Math.cos(a) * -0.33 * k, Math.sin(a) * -0.33 * k);
    c.lineTo(Math.cos(a) * 0.33 * k, Math.sin(a) * 0.33 * k);
    c.stroke();
  }
  ellipse(c, 0, 0, 0.12 * k, 0.12 * k);
  paint(c, '#B9C5DA', P.ink, lw(k) * 0.8);
  c.restore();
}
export function ramp(c, k) {
  shadow(c, k, 1, 0.3, 0.18);
  poly(c, [
    [-0.95 * k, 0],
    [0.95 * k, 0],
    [0.95 * k, -0.55 * k],
  ]);
  paint(c, '#F7D58C', P.ink, lw(k));
  c.strokeStyle = P.pink;
  c.lineWidth = Math.max(2, k * 0.08);
  c.beginPath();
  c.moveTo(-0.7 * k, -0.06 * k);
  c.lineTo(0.9 * k, -0.52 * k);
  c.stroke();
  text(c, '↗', 0.35 * k, -0.18 * k, 0.32 * k, P.ink, { weight: 900 });
}
export function crate(c, k, t) {
  shadow(c, k, 0.5);
  const bob = Math.sin(t * 4) * 0.04 * k;
  rr(c, -0.42 * k, -0.62 * k + bob, 0.84 * k, 0.62 * k, 0.06 * k);
  paint(c, '#F2B66B', P.ink, lw(k));
  c.strokeStyle = darken('#F2B66B', 0.3);
  c.lineWidth = lw(k) * 0.8;
  c.beginPath();
  c.moveTo(-0.42 * k, -0.31 * k + bob);
  c.lineTo(0.42 * k, -0.31 * k + bob);
  c.stroke();
  for (const x of [-0.24, 0, 0.24]) {
    rr(c, (x - 0.07) * k, -0.9 * k + bob, 0.14 * k, 0.32 * k, 0.05 * k);
    paint(c, '#7FE0A0', P.ink, lw(k) * 0.7);
  }
  text(c, '+3', 0, -1.2 * k + bob, Math.max(10, 0.38 * k), P.ink, { stroke: '#FFFFFF', strokeWidth: 3 });
}
export function golfCart(c, k, t) {
  shadow(c, k, 1.5, 0.35);
  for (const x of [-0.85, 0.85]) {
    ellipse(c, x * k, -0.25 * k, 0.25 * k, 0.25 * k);
    paint(c, P.ink, null);
  }
  rr(c, -1.3 * k, -0.85 * k, 2.6 * k, 0.6 * k, 0.2 * k);
  paint(c, '#FFFFFF', P.ink, lw(k));
  rr(c, -1.2 * k, -1.85 * k, 2.4 * k, 0.18 * k, 0.08 * k);
  paint(c, P.mint, P.ink, lw(k));
  c.fillStyle = P.ink;
  for (const x of [-1.05, 0.95]) c.fillRect(x * k, -1.7 * k, 0.08 * k, 0.9 * k);
  // Headlight beam (toward the player)
  c.fillStyle = `rgba(255,246,180,${0.35 + 0.2 * Math.sin(t * 10)})`;
  poly(c, [
    [-1.3 * k, -0.62 * k],
    [-2.6 * k, -0.95 * k],
    [-2.6 * k, -0.25 * k],
  ]);
  c.fill();
  ellipse(c, -1.28 * k, -0.6 * k, 0.1 * k, 0.1 * k);
  paint(c, P.sun, P.ink, lw(k) * 0.6);
}
export function fireTruck(c, k, t, stage) {
  shadow(c, k, 3.6, 0.5);
  for (const x of [-2.4, -1.4, 2.2]) {
    ellipse(c, x * k, -0.35 * k, 0.38 * k, 0.38 * k);
    paint(c, P.ink, null);
    ellipse(c, x * k, -0.35 * k, 0.16 * k, 0.16 * k);
    c.fillStyle = '#D9E3F2';
    c.fill();
  }
  rr(c, -3.4 * k, -1.9 * k, 5.2 * k, 1.5 * k, 0.15 * k);
  paint(c, P.truck, P.ink, lw(k));
  rr(c, 1.8 * k, -2.3 * k, 1.6 * k, 1.9 * k, 0.25 * k);
  paint(c, P.truck, P.ink, lw(k));
  rr(c, 2.3 * k, -2.1 * k, 0.9 * k, 0.7 * k, 0.12 * k);
  paint(c, P.glass, P.ink, lw(k) * 0.8);
  c.fillStyle = '#FFFFFF';
  c.fillRect(-3.4 * k, -1.2 * k, 6.8 * k, 0.16 * k);
  rr(c, -3.1 * k, -2.25 * k, 4.6 * k, 0.18 * k, 0.08 * k);
  paint(c, '#E8EEF8', P.ink, lw(k) * 0.8);
  text(c, 'ROW FIRE CO.', -0.8 * k, -1.55 * k, Math.max(8, 0.32 * k), '#FFFFFF', { weight: 900 });
  const on = Math.floor(t * 6) % 2 === 0;
  for (const [x, col] of [[2.0, on ? '#FF4D6D' : '#FFE0E6'], [2.9, on ? '#E8F6FF' : P.cyan]]) {
    rr(c, x * k, -2.6 * k, 0.35 * k, 0.25 * k, 0.08 * k);
    paint(c, col, P.ink, lw(k) * 0.7);
  }
  if (stage === 'spraying') {
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = 'rgba(127,231,255,0.5)';
    c.lineWidth = Math.max(3, k * 0.18);
    c.beginPath();
    c.moveTo(-1.6 * k, -2.2 * k);
    c.quadraticCurveTo(-1 * k, -6 * k, 0.2 * k + Math.sin(t * 5) * 0.4 * k, -3.8 * k * 2.1);
    c.stroke();
    c.restore();
  }
}
export function ambulance(c, k, t, open) {
  shadow(c, k, 3, 0.45);
  for (const x of [-1.9, 1.8]) {
    ellipse(c, x * k, -0.35 * k, 0.38 * k, 0.38 * k);
    paint(c, P.ink, null);
  }
  rr(c, -2.8 * k, -2.6 * k, 4.4 * k, 2.25 * k, 0.25 * k);
  paint(c, '#FFFFFF', P.ink, lw(k));
  rr(c, 1.5 * k, -1.9 * k, 1.4 * k, 1.55 * k, 0.3 * k);
  paint(c, '#FFFFFF', P.ink, lw(k));
  rr(c, 1.9 * k, -1.75 * k, 0.8 * k, 0.6 * k, 0.12 * k);
  paint(c, P.glass, P.ink, lw(k) * 0.8);
  c.fillStyle = P.mint;
  c.fillRect(-2.8 * k, -1.45 * k, 5.6 * k, 0.28 * k);
  c.fillStyle = P.pink;
  c.fillRect(-2.8 * k, -1.17 * k, 5.6 * k, 0.12 * k);
  c.fillStyle = P.hazard;
  c.fillRect(-0.95 * k, -2.25 * k, 0.5 * k, 0.16 * k);
  c.fillRect(-0.78 * k, -2.42 * k, 0.16 * k, 0.5 * k);
  text(c, 'CAMPUS EMS', 0.2 * k, -1.75 * k, Math.max(8, 0.3 * k), P.inkSoft, { weight: 900 });
  const on = Math.floor(t * 5) % 2 === 0;
  for (const [x, col] of [[-1.6, on ? P.hazard : '#FFE0E6'], [-0.2, on ? '#E8F6FF' : P.cyan]]) {
    rr(c, x * k, -2.85 * k, 0.4 * k, 0.25 * k, 0.08 * k);
    paint(c, col, P.ink, lw(k) * 0.7);
  }
  if (open) {
    rr(c, -3.05 * k, -2.4 * k, 0.3 * k, 2 * k, 0.08 * k);
    paint(c, '#F3ECFF', P.ink, lw(k));
  }
}
export function subwoofer(c, k, t, beat) {
  shadow(c, k, 0.6);
  const pulse = 1 + Math.exp(-8 * (beat % 1)) * 0.12;
  rr(c, -0.55 * k, -1.05 * k, 1.1 * k, 1.05 * k, 0.12 * k);
  paint(c, '#3A2F5C', P.ink, lw(k));
  ellipse(c, 0, -0.52 * k, 0.38 * k * pulse, 0.38 * k * pulse);
  paint(c, '#5B4FD8', P.cyan, lw(k));
  ellipse(c, 0, -0.52 * k, 0.14 * k * pulse, 0.14 * k * pulse);
  paint(c, P.cyan, null);
  c.strokeStyle = alpha(P.cyan, Math.exp(-4 * (beat % 1)));
  c.lineWidth = Math.max(2, 0.06 * k);
  for (const r of [0.8, 1.3]) {
    ellipse(c, 0, -0.52 * k, (r + (beat % 1) * 0.6) * k, (r + (beat % 1) * 0.6) * k * 0.6);
    c.stroke();
  }
}
export function fryer(c, k, t, armed = true) {
  shadow(c, k, 0.45);
  c.strokeStyle = P.ink;
  c.lineWidth = lw(k);
  for (const x of [-0.35, 0.35]) {
    c.beginPath();
    c.moveTo(x * k, 0);
    c.lineTo(x * 0.6 * k, -0.45 * k);
    c.stroke();
  }
  ellipse(c, 0, -0.42 * k, 0.4 * k, 0.12 * k);
  paint(c, '#9AA6C4', P.ink, lw(k));
  rr(c, -0.38 * k, -1.15 * k, 0.76 * k, 0.75 * k, 0.1 * k);
  paint(c, '#D9E3F2', P.ink, lw(k));
  ellipse(c, 0, -1.15 * k, 0.38 * k, 0.1 * k);
  paint(c, '#F7D58C', P.ink, lw(k) * 0.8);
  // Turkey legs peeking out
  for (const x of [-0.12, 0.14]) {
    ellipse(c, x * k, -1.32 * k, 0.09 * k, 0.16 * k, x * 3);
    paint(c, '#E8A25C', P.ink, lw(k) * 0.6);
  }
  if (armed && Math.floor(t * 2) % 2 === 0) {
    ellipse(c, 0.3 * k, -0.7 * k, 0.06 * k, 0.06 * k);
    c.fillStyle = P.hazard;
    c.fill();
  }
}
export function beehive(c, k, t) {
  c.save();
  for (let i = 0; i < 4; i++) {
    const w = (0.5 - i * 0.07) * k;
    rr(c, -w, (-0.25 - i * 0.24) * k, w * 2, 0.28 * k, 0.14 * k);
    paint(c, i % 2 ? '#FFE07A' : P.sun, P.ink, lw(k));
  }
  ellipse(c, 0, -0.4 * k, 0.1 * k, 0.1 * k);
  c.fillStyle = P.ink;
  c.fill();
  for (let i = 0; i < 4; i++) bee(c, Math.sin(t * 7 + i * 2) * 0.6 * k, -0.6 * k + Math.cos(t * 9 + i) * 0.4 * k, Math.max(1.6, 0.07 * k), t);
  c.restore();
}
export function balloonBundle(c, k, t, count = 5, string = 1.4) {
  const colors = [P.pink, P.cyan, P.sun, P.mint, P.grape, P.tangerine];
  c.strokeStyle = P.inkSoft;
  c.lineWidth = Math.max(1, k * 0.025);
  for (let i = 0; i < count; i++) {
    const a = (i / count - 0.5) * 1.6,
      bx = Math.sin(a) * 0.55 * k + Math.sin(t * 2 + i) * 0.05 * k,
      by = -string * k - Math.cos(a) * 0.4 * k;
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(bx * 0.3, by * 0.5, bx, by + 0.3 * k);
    c.stroke();
    ellipse(c, bx, by, 0.3 * k, 0.36 * k);
    paint(c, colors[i % colors.length], P.ink, lw(k) * 0.8);
    c.fillStyle = 'rgba(255,255,255,0.6)';
    ellipse(c, bx - 0.1 * k, by - 0.12 * k, 0.07 * k, 0.1 * k);
    c.fill();
  }
}
export function raccoonCrate(c, k, t, open = false) {
  if (open) {
    for (let i = 0; i < 3; i++) {
      c.save();
      c.translate((i - 1) * 0.55 * k, 0);
      raccoon(c, 0.17 * k, t, i * 2.1);
      c.restore();
    }
    return;
  }
  rr(c, -0.45 * k, -0.6 * k, 0.9 * k, 0.6 * k, 0.08 * k);
  paint(c, '#D7BBFF', P.ink, lw(k));
  for (const x of [-0.15, 0.15]) {
    ellipse(c, x * k, -0.32 * k, 0.07 * k, 0.07 * k);
    c.fillStyle = Math.floor(t * 3) % 4 ? '#FFFFFF' : P.ink;
    c.fill();
  }
}
export function bottle(c, k, t, spin = 0) {
  c.save();
  c.rotate(spin);
  rr(c, -0.1 * k, -0.18 * k, 0.2 * k, 0.4 * k, 0.07 * k);
  paint(c, '#7FE0A0', P.ink, lw(k) * 0.8);
  rr(c, -0.05 * k, -0.34 * k, 0.1 * k, 0.18 * k, 0.03 * k);
  paint(c, '#7FE0A0', P.ink, lw(k) * 0.8);
  c.restore();
  flames(c, Math.sin(spin) * -0.3 * k, -Math.cos(spin) * 0.3 * k, 0.32 * k, 0.5 * k, t, 11);
}
export function hydrant(c, k) {
  shadow(c, k, 0.3);
  rr(c, -0.18 * k, -0.7 * k, 0.36 * k, 0.7 * k, 0.1 * k);
  paint(c, P.sun, P.ink, lw(k));
  ellipse(c, 0, -0.72 * k, 0.2 * k, 0.12 * k);
  paint(c, '#FFE07A', P.ink, lw(k));
  rr(c, -0.3 * k, -0.48 * k, 0.6 * k, 0.12 * k, 0.05 * k);
  paint(c, '#FFE07A', P.ink, lw(k));
}
export function lampPost(c, k, t) {
  c.fillStyle = P.inkSoft;
  c.fillRect(-0.06 * k, -4.4 * k, 0.12 * k, 4.4 * k);
  rr(c, -0.3 * k, -4.75 * k, 0.6 * k, 0.4 * k, 0.15 * k);
  paint(c, '#FFFFFF', P.ink, lw(k));
  rr(c, -0.5 * k, -4.1 * k, 1 * k, 0.5 * k, 0.08 * k);
  paint(c, P.pink, P.ink, lw(k) * 0.8);
  text(c, 'GREEK ROW', 0, -3.85 * k, Math.max(7, 0.2 * k), '#FFFFFF', { weight: 900 });
}
export function tree(c, k, t, seed = 0, tone = P.hedge) {
  c.fillStyle = '#C08A5B';
  rr(c, -0.18 * k, -2.4 * k, 0.36 * k, 2.4 * k, 0.1 * k);
  paint(c, '#C9945F', P.ink, lw(k));
  const sway = Math.sin(t * 1.3 + seed) * 0.05 * k;
  const pts = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU,
      r = 1.35 + 0.18 * noise(seed * 3 + i * 1.3);
    pts.push([Math.cos(a) * r * k + sway, -3.2 * k + Math.sin(a) * r * 0.85 * k]);
  }
  blob(c, pts);
  paint(c, tone, P.ink, lw(k));
  c.fillStyle = lighten(tone, 0.25);
  ellipse(c, -0.45 * k + sway, -3.65 * k, 0.55 * k, 0.35 * k);
  c.fill();
}
export function shrub(c, k, tone = P.hedge) {
  blob(c, [
    [-0.9 * k, 0],
    [-0.95 * k, -0.45 * k],
    [-0.4 * k, -0.85 * k],
    [0.3 * k, -0.8 * k],
    [0.9 * k, -0.45 * k],
    [0.85 * k, 0],
  ]);
  paint(c, tone, P.ink, lw(k));
}
// Storefront for a shop. kind decides the sign art.
export function storefront(c, k, shop, t, visited) {
  const w = 8.4 * k,
    h = 4.6 * k;
  rr(c, -w / 2, -h, w, h, 0.15 * k);
  paint(c, lighten(shop.color, 0.55), P.ink, lw(k));
  // Awning stripes
  const aw = w * 1.04,
    ah = 0.9 * k;
  for (let i = 0; i < 8; i++) {
    c.beginPath();
    const x0 = -aw / 2 + (i * aw) / 8;
    c.moveTo(x0, -h * 0.62);
    c.lineTo(x0 + aw / 8, -h * 0.62);
    c.lineTo(x0 + aw / 8, -h * 0.62 + ah);
    c.quadraticCurveTo(x0 + aw / 16, -h * 0.62 + ah * 1.35, x0, -h * 0.62 + ah);
    c.closePath();
    paint(c, i % 2 ? '#FFFFFF' : shop.color, P.ink, lw(k) * 0.8);
  }
  // Window and door
  rr(c, -w * 0.42, -h * 0.42, w * 0.5, h * 0.36, 0.1 * k);
  paint(c, P.glass, P.ink, lw(k));
  c.fillStyle = P.glassHi;
  poly(c, [
    [-w * 0.38, -h * 0.4],
    [-w * 0.3, -h * 0.4],
    [-w * 0.38, -h * 0.12],
  ]);
  c.fill();
  rr(c, w * 0.16, -h * 0.5, w * 0.22, h * 0.5, 0.1 * k);
  paint(c, darken(shop.color, 0.15), P.ink, lw(k));
  // Sign board
  rr(c, -w * 0.46, -h * 0.98, w * 0.92, h * 0.3, 0.12 * k);
  paint(c, '#FFFFFF', P.ink, lw(k));
  text(c, shop.name, 0, -h * 0.87, Math.max(9, 0.5 * k), P.ink, { weight: 900 });
  text(c, shop.sign, 0, -h * 0.75, Math.max(7, 0.26 * k), darken(shop.color, 0.35), { weight: 800 });
  // Item icon in the window
  c.save();
  c.translate(-w * 0.17, -h * 0.1);
  if (shop.kind === 'bees') beehive(c, k * 0.9, t);
  else if (shop.kind === 'sub') subwoofer(c, k * 0.9, t, t * 3);
  else if (shop.kind === 'fryer') fryer(c, k * 0.9, t, false);
  else if (shop.kind === 'raccoons') raccoon(c, k * 0.16, t, 1);
  else if (shop.kind === 'balloons') balloonBundle(c, k * 0.7, t, 5, 0.9);
  c.restore();
  if (!visited) {
    c.save();
    c.translate(w * 0.27, -h * 0.62 - 0.5 * k + Math.sin(t * 4) * 0.08 * k);
    star(c, 0, 0, 0.42 * k, 8, 0.6);
    paint(c, P.sun, P.ink, lw(k));
    text(c, 'NEW', 0, 0, Math.max(7, 0.22 * k), P.ink, { weight: 900 });
    c.restore();
  }
}
export function welcomeSign(c, k, t, top = 'WELCOME TO', title = 'GREEK ROW', sub = 'EST. BAD DECISIONS') {
  shadow(c, k, 2.4, 0.3, 0.16);
  for (const x of [-1.9, 1.9]) {
    rr(c, (x - 0.12) * k, -3.2 * k, 0.24 * k, 3.2 * k, 0.06 * k);
    paint(c, '#F3ECFF', P.ink, lw(k));
  }
  c.save();
  c.translate(0, -3.3 * k);
  c.rotate(-0.04 + Math.sin(t * 1.5) * 0.008);
  rr(c, -2.6 * k, -1.35 * k, 5.2 * k, 1.75 * k, 0.22 * k);
  paint(c, P.ink, null);
  rr(c, -2.7 * k, -1.45 * k, 5.2 * k, 1.75 * k, 0.22 * k);
  paint(c, '#FFFFFF', P.ink, lw(k));
  c.fillStyle = P.pink;
  rr(c, -2.7 * k, -1.45 * k, 5.2 * k, 0.32 * k, 0.16 * k);
  c.fill();
  text(c, top, -0.1 * k, -1.29 * k, Math.max(7, 0.22 * k), '#FFFFFF', { weight: 900, italic: false });
  text(c, title, -0.1 * k, -0.68 * k, Math.max(10, 0.62 * k), P.ink, { weight: 900, stroke: P.sun, strokeWidth: Math.max(2, k * 0.08) });
  text(c, sub, -0.1 * k, -0.06 * k, Math.max(7, 0.24 * k), P.inkSoft, { weight: 800 });
  c.restore();
}
// Sidewalk pad in front of a shop (drawn on the ground).
export function shopPad(c, x0, x1, y0, y1, t, color, active) {
  c.save();
  c.fillStyle = alpha(color, active ? 0.45 : 0.18);
  c.fillRect(x0, y0, x1 - x0, y1 - y0);
  c.strokeStyle = active ? '#FFFFFF' : alpha('#FFFFFF', 0.6);
  c.lineWidth = 2;
  const step = (y1 - y0) * 1.2;
  const shift = ((t * 60) % step) - step;
  c.beginPath();
  for (let x = x0 + shift; x < x1; x += step) {
    c.moveTo(Math.max(x0, x), y0 + 3);
    c.lineTo(Math.min(x1, x + step * 0.4), (y0 + y1) / 2);
    c.lineTo(Math.max(x0, x), y1 - 3);
  }
  c.stroke();
  c.restore();
}
// ----- v5 skate furniture -------------------------------------------------------
// A park bench seen from the street side; its top edge is a 50-50 grind.
export function bench(c, k, len, glow = 0) {
  const w = len * k;
  shadow(c, k, len * 0.55, 0.22);
  for (const x of [-0.42, 0.42]) {
    rr(c, (x * len - 0.05) * k, -0.46 * k, 0.1 * k, 0.46 * k, 0.03 * k);
    paint(c, '#5E5A7A', P.ink, lw(k) * 0.8);
  }
  rr(c, -w / 2, -0.52 * k, w, 0.12 * k, 0.04 * k);
  paint(c, '#E8B07A', P.ink, lw(k));
  for (let i = 0; i < 3; i++) {
    rr(c, -w / 2, (-0.95 + i * 0.13) * k, w, 0.1 * k, 0.04 * k);
    paint(c, '#F2C28F', P.ink, lw(k) * 0.8);
  }
  if (glow > 0) railGlow(c, k, -w / 2, w / 2, -0.52 * k, glow);
}
// Low rail / ledge. kind 'ledge' is a concrete planter box.
export function flatbar(c, k, len, kind = 'rail', glow = 0) {
  const w = len * k;
  shadow(c, k, len * 0.52, 0.2);
  if (kind === 'ledge') {
    rr(c, -w / 2, -0.45 * k, w, 0.45 * k, 0.04 * k);
    paint(c, '#DDD6EE', P.ink, lw(k));
    rr(c, -w / 2 - 0.04 * k, -0.5 * k, w + 0.08 * k, 0.1 * k, 0.03 * k);
    paint(c, '#F4F0FF', P.ink, lw(k) * 0.8);
    c.fillStyle = '#5DBE5F';
    for (let x = -len / 2 + 0.4; x < len / 2; x += 0.7) {
      ellipse(c, x * k, -0.55 * k, 0.28 * k, 0.16 * k);
      c.fill();
    }
  } else {
    for (let x = -len / 2 + 0.3; x <= len / 2 - 0.29; x += Math.max(0.6, (len - 0.6) / Math.max(1, Math.round(len / 1.6)))) {
      rr(c, (x - 0.04) * k, -0.45 * k, 0.08 * k, 0.45 * k, 0.02 * k);
      paint(c, '#8F86B0', P.ink, lw(k) * 0.6);
    }
    rr(c, -w / 2, -0.5 * k, w, 0.09 * k, 0.04 * k);
    paint(c, '#E0E8F5', P.ink, lw(k));
    c.fillStyle = 'rgba(255,255,255,0.8)';
    c.fillRect(-w / 2 + 0.1 * k, -0.48 * k, w - 0.2 * k, Math.max(1, 0.02 * k));
  }
  if (glow > 0) railGlow(c, k, -w / 2, w / 2, (kind === 'ledge' ? -0.5 : -0.5) * k, glow);
}
// A grindable edge lights up when you could land on it.
export function railGlow(c, k, x0, x1, y, a) {
  c.save();
  c.globalAlpha = a;
  c.strokeStyle = P.cyan;
  c.lineWidth = Math.max(3, k * 0.1);
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x0, y);
  c.lineTo(x1, y);
  c.stroke();
  c.restore();
}
export function gnome(c, k, t) {
  shadow(c, k, 0.3);
  rr(c, -0.2 * k, -0.32 * k, 0.4 * k, 0.32 * k, 0.1 * k);
  paint(c, '#4C58D9', P.ink, lw(k));
  ellipse(c, 0, -0.38 * k, 0.17 * k, 0.12 * k);
  paint(c, '#FFFFFF', P.ink, lw(k) * 0.8);
  ellipse(c, 0, -0.48 * k, 0.12 * k, 0.11 * k);
  paint(c, '#FFD8BE', P.ink, lw(k) * 0.8);
  poly(c, [[-0.16 * k, -0.52 * k], [0.02 * k, -0.95 * k], [0.16 * k, -0.52 * k]]);
  paint(c, P.hazard, P.ink, lw(k) * 0.8);
}
// A beehive sitting on the ground or up on a fence post (h meters).
export function hiveSpot(c, k, t, h = 0) {
  if (h > 0) {
    shadow(c, k, 0.3);
    rr(c, -0.12 * k, -h * k, 0.24 * k, h * k, 0.03 * k);
    paint(c, '#C9945F', P.ink, lw(k));
  } else shadow(c, k, 0.5);
  c.save();
  c.translate(0, -h * k + Math.sin(t * 3) * 0.03 * k);
  const glow = 0.5 + 0.5 * Math.sin(t * 5);
  c.globalAlpha = 0.35 + 0.25 * glow;
  ellipse(c, 0, -0.55 * k, 0.8 * k, 0.75 * k);
  c.fillStyle = P.sun;
  c.fill();
  c.globalAlpha = 1;
  beehive(c, k * 1.1, t);
  c.restore();
}
// Back-alley fence run between x0 and x1 (meters, relative), h meters tall.
export function fence(c, k, x0, x1, h = 1.6, tone = '#E8C08A') {
  rr(c, x0 * k, -h * k, (x1 - x0) * k, h * k, 0.02 * k);
  paint(c, tone, P.ink, lw(k));
  c.strokeStyle = darken(tone, 0.25);
  c.lineWidth = Math.max(1, k * 0.025);
  c.beginPath();
  for (let x = x0 + 0.3; x < x1; x += 0.3) {
    c.moveTo(x * k, -h * k);
    c.lineTo(x * k, 0);
  }
  c.stroke();
  for (const y of [0.3, h - 0.35]) {
    rr(c, x0 * k, -(y + 0.08) * k, (x1 - x0) * k, 0.12 * k, 0.02 * k);
    paint(c, darken(tone, 0.1), P.ink, lw(k) * 0.5);
  }
}
// Skate-school station flag with a big number and a word.
export function stationFlag(c, k, t, n, word, color, done = false) {
  c.fillStyle = P.inkSoft;
  c.fillRect(-0.05 * k, -3.4 * k, 0.1 * k, 3.4 * k);
  const wave = Math.sin(t * 3 + n) * 0.08 * k;
  c.beginPath();
  c.moveTo(0.05 * k, -3.4 * k);
  c.quadraticCurveTo(1.2 * k, -3.4 * k + wave, 2.3 * k, -3.3 * k - wave);
  c.lineTo(2.3 * k, -2.3 * k - wave);
  c.quadraticCurveTo(1.2 * k, -2.4 * k + wave, 0.05 * k, -2.3 * k);
  c.closePath();
  paint(c, done ? P.mint : color, P.ink, lw(k));
  text(c, done ? '✓' : String(n), 0.6 * k, -2.85 * k, 0.6 * k, P.ink, { weight: 900, stroke: '#FFFFFF', strokeWidth: 3 });
  text(c, word, 1.55 * k, -2.85 * k, Math.max(8, 0.26 * k), P.ink, { weight: 900 });
}
// Start / finish gate over the course.
export function gate(c, k, t, top, sub, color) {
  for (const x of [-3.2, 3.2]) {
    rr(c, (x - 0.15) * k, -4.2 * k, 0.3 * k, 4.2 * k, 0.05 * k);
    paint(c, '#FFFFFF', P.ink, lw(k));
  }
  rr(c, -3.6 * k, -5.2 * k, 7.2 * k, 1.1 * k, 0.2 * k);
  paint(c, color, P.ink, lw(k));
  text(c, top, 0, -4.78 * k, Math.max(10, 0.5 * k), '#FFFFFF', { weight: 900, stroke: P.ink, strokeWidth: 3 });
  if (sub) text(c, sub, 0, -4.32 * k, Math.max(7, 0.22 * k), P.ink, { weight: 800 });
  for (let i = 0; i < 9; i++) {
    const x = (-3.4 + i * 0.85) * k;
    c.fillStyle = [P.pink, P.cyan, P.sun, P.mint][i % 4];
    poly(c, [[x, -4.1 * k], [x + 0.42 * k, -4.1 * k], [x + 0.21 * k, -3.65 * k - Math.sin(t * 4 + i) * 0.04 * k]]);
    c.fill();
  }
}
// ----- Lawn party dressing (cosmetic only) ----------------------------------------
export function kiddiePool(c, k, t) {
  shadow(c, k, 1.2, 0.3, 0.15);
  ellipse(c, 0, -0.12 * k, 1.1 * k, 0.32 * k);
  paint(c, '#FF9AC8', P.ink, lw(k));
  ellipse(c, 0, -0.16 * k, 0.9 * k, 0.22 * k);
  c.fillStyle = '#7FE7FF';
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.7)';
  ellipse(c, Math.sin(t * 1.5) * 0.3 * k, -0.18 * k, 0.25 * k, 0.05 * k);
  c.fill();
  // A floating rubber duck
  ellipse(c, 0.35 * k, -0.28 * k, 0.12 * k, 0.09 * k);
  paint(c, P.sun, P.ink, lw(k) * 0.6);
}
export function pongTable(c, k) {
  shadow(c, k, 1.1, 0.25, 0.15);
  for (const x of [-0.9, 0.9]) {
    c.fillStyle = P.inkSoft;
    c.fillRect((x - 0.03) * k, -0.75 * k, 0.06 * k, 0.75 * k);
  }
  rr(c, -1.1 * k, -0.85 * k, 2.2 * k, 0.12 * k, 0.04 * k);
  paint(c, '#FFFFFF', P.ink, lw(k));
  for (const [side, n] of [[-1, 3], [1, 2]])
    for (let i = 0; i < n; i++) {
      const x = side * (0.85 - i * 0.14);
      rr(c, (x - 0.06) * k, -1.02 * k, 0.12 * k, 0.17 * k, 0.03 * k);
      paint(c, P.truck, P.ink, lw(k) * 0.5);
    }
}
export function flamingo(c, k, t, seed = 0) {
  c.strokeStyle = P.ink;
  c.lineWidth = Math.max(1, k * 0.03);
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(0, -0.6 * k);
  c.stroke();
  const bob = Math.sin(t * 1.2 + seed) * 0.03 * k;
  ellipse(c, 0, -0.72 * k + bob, 0.24 * k, 0.14 * k);
  paint(c, '#FF7AB8', P.ink, lw(k) * 0.7);
  c.beginPath();
  c.moveTo(0.18 * k, -0.76 * k + bob);
  c.quadraticCurveTo(0.34 * k, -1.1 * k + bob, 0.2 * k, -1.2 * k + bob);
  c.strokeStyle = '#FF7AB8';
  c.lineWidth = Math.max(2, k * 0.06);
  c.stroke();
  ellipse(c, 0.22 * k, -1.22 * k + bob, 0.07 * k, 0.06 * k);
  paint(c, '#FF7AB8', P.ink, lw(k) * 0.5);
}
export function cornhole(c, k) {
  shadow(c, k, 0.5, 0.15, 0.15);
  poly(c, [[-0.45 * k, 0], [0.45 * k, 0], [0.32 * k, -0.42 * k], [-0.32 * k, -0.42 * k]]);
  paint(c, '#F2C28F', P.ink, lw(k));
  ellipse(c, 0, -0.3 * k, 0.09 * k, 0.04 * k);
  c.fillStyle = P.ink;
  c.fill();
  rr(c, -0.2 * k, -0.12 * k, 0.16 * k, 0.07 * k, 0.03 * k);
  paint(c, P.truck, P.ink, lw(k) * 0.4);
}
// Party lights strung between two points (px), sagging in the middle.
export function stringLights(c, x0, y0, x1, y1, k, t) {
  const sag = 0.6 * k;
  c.strokeStyle = alpha(P.ink, 0.6);
  c.lineWidth = Math.max(1, k * 0.02);
  c.beginPath();
  c.moveTo(x0, y0);
  c.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + sag * 2, x1, y1);
  c.stroke();
  const colors = [P.pink, P.sun, P.cyan, P.mint, P.tangerine];
  for (let i = 1; i < 12; i++) {
    const u = i / 12,
      x = (1 - u) * (1 - u) * x0 + 2 * u * (1 - u) * ((x0 + x1) / 2) + u * u * x1,
      y = (1 - u) * (1 - u) * y0 + 2 * u * (1 - u) * ((y0 + y1) / 2 + sag * 2) + u * u * y1;
    const on = Math.sin(t * 3 + i * 1.7) > -0.4;
    ellipse(c, x, y + 0.08 * k, 0.07 * k, 0.1 * k);
    c.fillStyle = on ? colors[i % colors.length] : alpha(colors[i % colors.length], 0.4);
    c.fill();
  }
}
