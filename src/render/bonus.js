import { P, FONT } from './palette.js';
import { rr, paint, text, chrome, banner, ellipse, poly, alpha, darken, lighten, easeOutBack, star, TAU, rand } from './draw.js';
import { skater, bonusSpec, flames, figure, walkerPose } from './characters.js';
import { trashCan, bottle, shadow } from './props.js';
import { BONUS_SKATERS } from '../data/looks.js';
import { TUNING as T } from '../data/tuning.js';
// The 10x bonus: same throw, ten cameras. The can sits at x = 0, z = CAN_Z.
const CAN_Z = -5,
  LANE = -1,
  HAND_Y = 1.45;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function camera({ pos, yaw = 0, pitch = 0, roll = 0, fov = 0.9, w, h, cx = w / 2, cy = h / 2, fisheye = 0 }) {
  const cyw = Math.cos(yaw),
    syw = Math.sin(yaw),
    cp = Math.cos(pitch),
    sp = Math.sin(pitch);
  const f = [-syw * cp, sp, -cyw * cp],
    r = [cyw, 0, -syw],
    u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  return { pos, f, r, u, F: h / 2 / Math.tan(fov / 2), w, h, cx, cy, roll, fisheye, near: 0.2 };
}
const toCam = (cam, p) => {
  const v = [p[0] - cam.pos[0], p[1] - cam.pos[1], p[2] - cam.pos[2]];
  return [dot(v, cam.r), dot(v, cam.u), dot(v, cam.f)];
};
function screen(cam, q) {
  let sx = (cam.F * q[0]) / q[2],
    sy = (-cam.F * q[1]) / q[2];
  if (cam.fisheye) {
    // Monotonic barrel squeeze: r' = r / sqrt(1 + k (r/R)^2) never folds back inward.
    const R = cam.h * 0.62,
      d = Math.hypot(sx, sy) / R,
      k = 1 / Math.sqrt(1 + cam.fisheye * d * d);
    sx *= k;
    sy *= k;
  }
  if (cam.roll) {
    const c = Math.cos(cam.roll),
      s = Math.sin(cam.roll);
    [sx, sy] = [sx * c - sy * s, sx * s + sy * c];
  }
  return [cam.cx + sx, cam.cy + sy, cam.F / q[2]];
}
const project3 = (cam, p) => {
  const q = toCam(cam, p);
  return q[2] > cam.near ? screen(cam, q) : null;
};
// Clip a world-space polygon at the near plane, then project it.
function polygon(cam, pts, steps = 1) {
  let q = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i],
      b = pts[(i + 1) % pts.length];
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      q.push(toCam(cam, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]));
    }
  }
  const out = [];
  for (let i = 0; i < q.length; i++) {
    const a = q[i],
      b = q[(i + 1) % q.length],
      ain = a[2] > cam.near,
      bin = b[2] > cam.near;
    if (ain) out.push(a);
    if (ain !== bin) {
      const t = (cam.near - a[2]) / (b[2] - a[2]);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, cam.near]);
    }
  }
  return out.map((p) => screen(cam, p));
}
function fillPoly(c, pts, fill, stroke, width = 2) {
  if (pts.length < 3) return;
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) c.lineTo(p[0], p[1]);
  c.closePath();
  paint(c, fill, stroke, width);
}
function ground3(c, cam, steps = 1) {
  const X0 = -60,
    X1 = 60,
    bands = [
      [-30, -11, '#9EE6BE'],
      [-11, -4.6, P.lawn],
      [-4.6, -3.1, P.sidewalk],
      [-3.1, -2.9, P.curb],
      [-2.9, 2.6, P.street],
      [2.6, 3.1, P.curb],
      [3.1, 6, P.sidewalk],
      [6, 30, '#9EE6BE'],
    ];
  for (const [z0, z1, col] of bands) {
    for (let x = X0; x < X1; x += 10)
      fillPoly(c, polygon(cam, [[x, 0, z0], [x + 10, 0, z0], [x + 10, 0, z1], [x, 0, z1]], steps), col, null);
  }
  for (let x = X0; x < X1; x += 3)
    fillPoly(c, polygon(cam, [[x, 0.01, -0.12], [x + 1.6, 0.01, -0.12], [x + 1.6, 0.01, 0.12], [x, 0.01, 0.12]], steps), P.laneDash, null);
  for (let x = X0; x < X1; x += 1.5)
    fillPoly(c, polygon(cam, [[x, 0.01, -4.6], [x + 0.06, 0.01, -4.6], [x + 0.06, 0.01, -3.1], [x, 0.01, -3.1]], 1), P.joint, null);
}
function facade3(c, cam, steps = 1) {
  const z = -11;
  fillPoly(c, polygon(cam, [[-7, 0, z], [7, 0, z], [7, 4.6, z], [-7, 4.6, z]], steps), '#FFB3DA', P.ink, 2);
  fillPoly(c, polygon(cam, [[-7.6, 4.5, z], [7.6, 4.5, z], [0, 7.4, z]], steps), '#7B4DFF', P.ink, 2);
  for (const [x, y] of [[-4.5, 1.4], [-2, 1.4], [2, 1.4], [4.5, 1.4], [-4.5, 3.3], [-2, 3.3], [2, 3.3], [4.5, 3.3]])
    fillPoly(c, polygon(cam, [[x - 0.55, y - 0.6, z], [x + 0.55, y - 0.6, z], [x + 0.55, y + 0.6, z], [x - 0.55, y + 0.6, z]], 1), P.glass, P.ink, 1.5);
  fillPoly(c, polygon(cam, [[-0.7, 0, z], [0.7, 0, z], [0.7, 2.2, z], [-0.7, 2.2, z]], 1), '#FF3EA5', P.ink, 2);
  const label = project3(cam, [0, 5.6, z]);
  if (label && label[2] > 4) text(c, 'ΒΟΝΥΣ', label[0], label[1], Math.min(60, label[2] * 0.7), '#FFFFFF', { stroke: P.ink, family: 'Georgia, serif', italic: false });
}
function sky(c, w, h, horizonY, tint = null) {
  const g = c.createLinearGradient(0, 0, 0, Math.max(10, horizonY));
  g.addColorStop(0, '#4FC3FF');
  g.addColorStop(0.7, '#9FE3FF');
  g.addColorStop(1, '#FFE6F3');
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  if (tint) {
    c.fillStyle = tint;
    c.fillRect(0, 0, w, h);
  }
}
// Back view of a skater for chase-style cameras.
function skaterBack(c, sk, u, t, throwing) {
  const bob = Math.sin(t * 9) * 0.1 * u;
  ellipse(c, 0, 0, 1.4 * u, 0.32 * u);
  paint(c, 'rgba(42,30,79,0.2)', null);
  // Board seen from behind: tail, trucks, two wheels.
  for (const x of [-0.75, 0.75]) {
    ellipse(c, x * u, -0.2 * u, 0.3 * u, 0.3 * u);
    paint(c, '#FFFFFF', P.ink, u * 0.15);
  }
  rr(c, -1.05 * u, -0.75 * u, 2.1 * u, 0.4 * u, 0.2 * u);
  paint(c, sk.trim, P.ink, u * 0.18);
  sk = { ...sk, outfit: lighten(sk.outfit, 0.25) };
  for (const x of [-0.45, 0.45]) {
    rr(c, x * u - 0.45 * u, -4.2 * u + bob, 0.9 * u, 3.7 * u, 0.4 * u);
    paint(c, darken(sk.outfit, 0.25), P.ink, u * 0.18);
  }
  rr(c, -1.15 * u, -7.4 * u + bob, 2.3 * u, 3.4 * u, 0.6 * u);
  paint(c, sk.outfit, P.ink, u * 0.18);
  c.lineCap = 'round';
  for (const side of [-1, 1]) {
    const up = throwing && side === 1;
    c.strokeStyle = P.ink;
    c.lineWidth = u * 1;
    c.beginPath();
    c.moveTo(side * 1 * u, -7 * u + bob);
    c.lineTo(side * (up ? 1.6 : 2.4) * u, (up ? -9.6 : -5.2) * u + bob);
    c.stroke();
    c.strokeStyle = sk.outfit;
    c.lineWidth = u * 0.7;
    c.stroke();
  }
  ellipse(c, 0, -8.7 * u + bob, 1.3 * u, 1.3 * u);
  paint(c, sk.hair === '#F3ECFF' ? '#E4DCF5' : sk.hair, P.ink, u * 0.2);
  if (sk.style === 'mohawk') {
    rr(c, -0.3 * u, -10.6 * u + bob, 0.6 * u, 2.2 * u, 0.3 * u);
    paint(c, sk.trim, P.ink, u * 0.18);
  }
  if (sk.style === 'hijab') {
    ellipse(c, 0, -8.4 * u + bob, 1.45 * u, 1.5 * u);
    paint(c, sk.hair, P.ink, u * 0.2);
  }
}
// Underside of a board crossing overhead (trash-can cam).
function boardUnderside(c, x, y, s, sk) {
  c.save();
  c.translate(x, y);
  rr(c, -2.6 * s, -0.55 * s, 5.2 * s, 1.1 * s, 0.55 * s);
  paint(c, sk.trim, P.ink, Math.max(2, s * 0.12));
  c.fillStyle = sk.outfit;
  star(c, 0, 0, 0.42 * s, 5, 0.45);
  c.fill();
  for (const bx of [-1.6, 1.6]) {
    rr(c, bx * s - 0.2 * s, -0.75 * s, 0.4 * s, 1.5 * s, 0.1 * s);
    paint(c, '#D9E3F2', P.ink, Math.max(1.5, s * 0.08));
    for (const by of [-0.75, 0.75]) {
      ellipse(c, bx * s, by * s, 0.28 * s, 0.28 * s);
      paint(c, '#FFFFFF', P.ink, Math.max(1.5, s * 0.08));
    }
  }
  c.restore();
}
export class BonusRenderer {
  draw(c, m, view, t) {
    const b = m.bonus;
    if (!b) return;
    this.controls = view.touch ? view.controls : 0;
    const w = view.width,
      h = view.height,
      sk = BONUS_SKATERS[Math.min(9, b.pass)];
    c.save();
    if (b.stage === 'card') this.card(c, m, sk, w, h, t);
    else this.scene(c, m, sk, w, h, t);
    this.overlay(c, m, sk, w, h, t);
    c.restore();
  }
  card(c, m, sk, w, h, t) {
    const b = m.bonus;
    // Memphis-pattern title card.
    const g = c.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#FFE6F3');
    g.addColorStop(1, '#D9F7FF');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = rand(i * 3.1) * w,
        y = rand(i * 7.7) * h,
        s = 10 + rand(i) * 18;
      c.save();
      c.translate(x, y + Math.sin(t * 2 + i) * 4);
      c.rotate(i + t * 0.3);
      const col = [P.pink, P.cyan, P.sun, P.mint, P.grape][i % 5];
      if (i % 3 === 0) {
        poly(c, [[-s, s * 0.6], [0, -s * 0.7], [s, s * 0.6]]);
        paint(c, null, col, 4);
      } else if (i % 3 === 1) {
        c.strokeStyle = col;
        c.lineWidth = 4;
        c.beginPath();
        for (let k = 0; k < 5; k++) c.lineTo(-s + k * s * 0.5, (k % 2 ? -1 : 1) * s * 0.3);
        c.stroke();
      } else {
        ellipse(c, 0, 0, s * 0.35, s * 0.35);
        paint(c, col, null);
      }
      c.restore();
    }
    const intro = easeOutBack(Math.min(1, b.t / 0.35));
    const u = Math.min(h * 0.045, w * 0.04);
    c.save();
    c.translate(w * (w > h ? 0.3 : 0.5), h * (w > h ? 0.78 : 0.62));
    c.scale(intro, intro);
    skater(c, bonusSpec(sk, u), { mode: 'cruise', time: t, speed: 0.6 });
    c.restore();
    const tx = w > h ? w * 0.64 : w * 0.5,
      size = Math.min(w > h ? w * 0.06 : w * 0.11, 64);
    banner(c, `${T_PASS} ${b.pass + 1} / 10`, tx, h * 0.2, size * 0.45, { fill: P.cyan, angle: -0.04 });
    chrome(c, sk.name, tx, h * (w > h ? 0.36 : 0.3), size);
    banner(c, sk.view, tx, h * (w > h ? 0.5 : 0.41), size * 0.55, { fill: P.sun, angle: 0.03 });
    text(c, b.pass === 0 ? 'RELEASE THROW ONE BEAT BEFORE THE CAN · 10× POINTS' : 'SAME THROW · NEW ANGLE · 10× POINTS', tx, h * (w > h ? 0.6 : 0.48), Math.max(11, size * 0.24), P.ink, { weight: 800, italic: false, family: FONT.ui });
  }
  scene(c, m, sk, w, h, t) {
    const b = m.bonus,
      x = b.x;
    const thrown = b.thrown;
    const throwing = thrown && thrown.t < 0.25 ? (thrown.t < 0.08 ? 'wind' : 'release') : null;
    const u3 = { x, t, sk, throwing, thrown, w, h };
    switch (sk.pov) {
      case 'side':
      case 'mirror':
      case 'dutch':
        this.side(c, u3, sk.pov);
        break;
      case 'iso':
        this.iso(c, u3);
        break;
      case 'sky':
        this.skyCam(c, u3);
        break;
      case 'chase':
      case 'helmet':
      case 'fisheye':
      case 'cctv':
        this.perspective(c, u3, sk.pov);
        break;
      case 'can':
        this.canCam(c, u3);
        break;
    }
  }
  bottlePos(thrown) {
    if (!thrown) return null;
    const k = Math.min(1, thrown.t / T.bonusFlight);
    const x = thrown.x + (thrown.landX - thrown.x) * k,
      z = LANE + (CAN_Z - LANE) * k,
      y = HAND_Y + (1 - HAND_Y) * k + Math.sin(k * Math.PI) * 2.2;
    return { x, y, z, k };
  }
  side(c, s, mode) {
    const { w, h, t, sk } = s;
    c.save();
    if (mode === 'mirror') {
      c.translate(w, 0);
      c.scale(-1, 1);
    }
    if (mode === 'dutch') {
      c.translate(w / 2, h / 2);
      c.rotate(-0.24);
      c.scale(1.25, 1.25);
      c.translate(-w / 2, -h / 2);
    }
    const S = Math.min(w / 17, h / 8.4),
      follow = mode === 'dutch' ? s.x + 3 : -2.5;
    const X = (x) => w / 2 + (x - follow) * S,
      Dz = S * 0.42,
      Y = (z, y = 0) => h * 0.7 + (z - LANE) * Dz - y * S;
    sky(c, w, h, Y(-12));
    c.fillStyle = '#9EE6BE';
    c.fillRect(-w, Y(-30), w * 3, Y(-11) - Y(-30));
    // House
    c.save();
    c.translate(X(0), Y(-11));
    rr(c, -7 * S, -4.6 * S, 14 * S, 4.6 * S, 4);
    paint(c, '#FFB3DA', P.ink, 2.5);
    poly(c, [[-7.6 * S, -4.5 * S], [7.6 * S, -4.5 * S], [0, -7.2 * S]]);
    paint(c, P.grape, P.ink, 2.5);
    for (const [x, y] of [[-4.5, 1.4], [-2, 1.4], [2, 1.4], [4.5, 1.4], [-4.5, 3.3], [-2, 3.3], [2, 3.3], [4.5, 3.3]]) {
      rr(c, (x - 0.55) * S, -(y + 0.6) * S, 1.1 * S, 1.2 * S, 3);
      paint(c, P.glass, P.ink, 2);
    }
    c.restore();
    for (const [z0, z1, col] of [[-11, -4.6, P.lawn], [-4.6, -3.1, P.sidewalk], [-3.1, -2.9, P.curb], [-2.9, 2.6, P.street], [2.6, 3.4, P.curb], [3.4, 8, P.sidewalk]]) {
      c.fillStyle = col;
      c.fillRect(-w, Y(z0), w * 3, Y(z1) - Y(z0) + 1);
    }
    c.fillStyle = P.laneDash;
    for (let x = -30; x < 40; x += 3) c.fillRect(X(x), Y(0) - 2, 1.6 * S, 4);
    // Can
    c.save();
    c.translate(X(0), Y(CAN_Z));
    trashCan(c, S, s.thrown?.done && m_hit(s) ? 'burning' : 'ready', t, 0.6 + 0.4 * Math.sin(t * 6));
    c.restore();
    // Skater
    c.save();
    c.translate(X(s.x), Y(LANE));
    skater(c, bonusSpec(sk, S * 0.2), { mode: 'cruise', time: t, throw: s.throwing });
    c.restore();
    const bp = this.bottlePos(s.thrown);
    if (bp && !s.thrown.done) {
      c.save();
      c.translate(X(bp.x), Y(bp.z, bp.y));
      bottle(c, S, t, t * 14);
      c.restore();
    }
    c.restore();
  }
  iso(c, s) {
    const { w, h, t, sk } = s,
      S = Math.min(w, h) / 12.5;
    const P2 = (x, z, y = 0) => [w * 0.5 + ((x + 2.5) * 0.82 + (z - LANE) * 0.5) * S, h * 0.62 + (-(x + 2.5) * 0.42 + (z - LANE) * 0.62) * S - y * S];
    sky(c, w, h, 0);
    c.fillStyle = '#9EE6BE';
    c.fillRect(0, 0, w, h);
    const quad = (x0, x1, z0, z1, col) => {
      const pts = [P2(x0, z0), P2(x1, z0), P2(x1, z1), P2(x0, z1)];
      fillPoly(c, pts, col, null);
    };
    quad(-40, 40, -11, -4.6, P.lawn);
    quad(-40, 40, -4.6, -3.1, P.sidewalk);
    quad(-40, 40, -3.1, 2.6, P.street);
    quad(-40, 40, 2.6, 5, P.sidewalk);
    for (let x = -40; x < 40; x += 3) quad(x, x + 1.6, -0.12, 0.12, P.laneDash);
    // House block (iso box)
    const top = (x, z) => P2(x, z, 4.4);
    fillPoly(c, [P2(-7, -11), P2(7, -11), top(7, -11), top(-7, -11)], '#FFB3DA', P.ink, 2.5);
    fillPoly(c, [top(-7, -11), top(7, -11), top(7, -16), top(-7, -16)], P.grape, P.ink, 2.5);
    for (const x of [-4.5, -2, 2, 4.5]) {
      const a = P2(x - 0.5, -11, 1),
        b2 = P2(x + 0.5, -11, 1),
        c2 = P2(x + 0.5, -11, 2.2),
        d = P2(x - 0.5, -11, 2.2);
      fillPoly(c, [a, b2, c2, d], P.glass, P.ink, 1.5);
    }
    const can = P2(0, CAN_Z);
    c.save();
    c.translate(can[0], can[1]);
    trashCan(c, S, s.thrown?.done && m_hit(s) ? 'burning' : 'ready', t, 0.6 + 0.4 * Math.sin(t * 6));
    c.restore();
    const p = P2(s.x, LANE);
    c.save();
    c.translate(p[0], p[1]);
    skater(c, bonusSpec(sk, S * 0.2), { mode: 'cruise', time: t, throw: s.throwing });
    c.restore();
    const bp = this.bottlePos(s.thrown);
    if (bp && !s.thrown.done) {
      const q = P2(bp.x, bp.z, bp.y);
      c.save();
      c.translate(q[0], q[1]);
      bottle(c, S, t, t * 14);
      c.restore();
    }
  }
  skyCam(c, s) {
    const { w, h, t, sk } = s,
      S = Math.min(w / 20, h / 13);
    const X = (x) => w / 2 + (x + 1.5) * S,
      Z = (z) => h * 0.5 + (z + 2.5) * S;
    for (const [z0, z1, col] of [[-30, -11, '#FFB3DA'], [-11, -4.6, P.lawn], [-4.6, -3.1, P.sidewalk], [-3.1, 2.6, P.street], [2.6, 30, P.sidewalk]]) {
      c.fillStyle = col;
      c.fillRect(0, Z(z0), w, Z(z1) - Z(z0) + 1);
    }
    // Roof from above with shingle lines
    c.fillStyle = P.grape;
    c.fillRect(X(-7.6), 0, X(7.6) - X(-7.6), Z(-11) - 0);
    c.strokeStyle = darken(P.grape, 0.2);
    c.lineWidth = 2;
    for (let y = Z(-11) - S * 0.5; y > 0; y -= S * 0.5) {
      c.beginPath();
      c.moveTo(X(-7.6), y);
      c.lineTo(X(7.6), y);
      c.stroke();
    }
    c.fillStyle = P.laneDash;
    for (let x = -30; x < 30; x += 3) c.fillRect(X(x), Z(0) - 3, 1.6 * S, 6);
    // Can from above
    ellipse(c, X(0), Z(CAN_Z), 0.5 * S, 0.5 * S);
    paint(c, '#BFD4EC', P.ink, 3);
    ellipse(c, X(0), Z(CAN_Z), 0.36 * S, 0.36 * S);
    paint(c, '#7A6AB8', P.ink, 2);
    if (s.thrown?.done && m_hit(s)) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        ellipse(c, X(0), Z(CAN_Z), (0.6 + i * 0.25 + Math.sin(t * 12 + i) * 0.08) * S, (0.6 + i * 0.25) * S);
        c.fillStyle = alpha(P.fire[i], 0.55);
        c.fill();
      }
      c.restore();
    }
    // Skater from above: board, shoulders, head.
    const sx = X(s.x),
      sz = Z(LANE);
    ellipse(c, sx + 0.3 * S, sz + 0.35 * S, 1.3 * S, 0.45 * S);
    c.fillStyle = 'rgba(42,30,79,0.18)';
    c.fill();
    rr(c, sx - 1.25 * S, sz - 0.3 * S, 2.5 * S, 0.6 * S, 0.3 * S);
    paint(c, P.ink, P.ink, 2);
    rr(c, sx - 1.15 * S, sz - 0.22 * S, 2.3 * S, 0.44 * S, 0.22 * S);
    c.fillStyle = sk.trim;
    c.fill();
    for (const fx of [-0.55, 0.55]) {
      ellipse(c, sx + fx * S, sz, 0.22 * S, 0.14 * S);
      paint(c, '#FFFFFF', P.ink, 2);
    }
    c.lineCap = 'round';
    for (const side of [-1, 1]) {
      const up = s.throwing && side === -1;
      c.strokeStyle = P.ink;
      c.lineWidth = S * 0.26 + 4;
      c.beginPath();
      c.moveTo(sx + side * 0.45 * S, sz - 0.1 * S);
      c.lineTo(sx + side * (up ? 0.3 : 1.15) * S, sz + (up ? -1.3 : -0.55 * side * 0) * S - (up ? 0 : 0.3 * S));
      c.stroke();
      c.strokeStyle = sk.outfit;
      c.lineWidth = S * 0.26;
      c.stroke();
    }
    ellipse(c, sx, sz - 0.1 * S, 0.6 * S, 0.4 * S);
    paint(c, sk.outfit, P.ink, 2.5);
    ellipse(c, sx + 0.05 * S, sz - 0.12 * S, 0.34 * S, 0.34 * S);
    paint(c, sk.hair, P.ink, 2.5);
    c.fillStyle = 'rgba(255,255,255,0.35)';
    ellipse(c, sx - 0.05 * S, sz - 0.22 * S, 0.12 * S, 0.08 * S);
    c.fill();
    const bp = this.bottlePos(s.thrown);
    if (bp && !s.thrown.done) {
      const sc = 1 + bp.y * 0.35;
      ellipse(c, X(bp.x), Z(bp.z), 0.2 * S, 0.12 * S);
      c.fillStyle = 'rgba(42,30,79,0.25)';
      c.fill();
      c.save();
      c.translate(X(bp.x), Z(bp.z) - bp.y * S * 0.25);
      c.scale(sc, sc);
      bottle(c, S, t, t * 14);
      c.restore();
    }
  }
  perspective(c, s, pov) {
    const { w, h, t, sk } = s;
    let cam;
    if (pov === 'chase') cam = camera({ pos: [s.x - 6.5, 2.7, LANE + 1.4], yaw: -Math.PI / 2 + 0.12, pitch: -0.18, fov: 0.95, w, h });
    else if (pov === 'helmet') cam = camera({ pos: [s.x + 0.3, 1.65, LANE], yaw: -Math.PI / 2 + 0.85, pitch: -0.16, fov: 1.2, w, h });
    else if (pov === 'fisheye') cam = camera({ pos: [s.x - 1.2, 0.7, LANE + 3.4], yaw: -0.35, pitch: -0.08, fov: 1.75, w, h, fisheye: 1.6 });
    else cam = camera({ pos: [4, 7.5, 7], yaw: 0.35, pitch: -0.62, fov: 1.0, w, h });
    const steps = pov === 'fisheye' ? 10 : 1;
    const horizon = project3(cam, [s.x + 200 * cam.f[0], 0, 200 * cam.f[2]]);
    const horizonY = horizon ? horizon[1] : h * 0.4;
    sky(c, w, h, horizonY, pov === 'cctv' ? 'rgba(170,230,190,0.25)' : null);
    // Anything below the horizon that the clipped ground misses is street, not sky.
    c.fillStyle = P.street;
    c.fillRect(0, Math.max(0, horizonY + (pov === 'fisheye' ? h * 0.08 : 0)), w, h);
    ground3(c, cam, steps);
    facade3(c, cam, steps);
    const sprites = [];
    const canP = project3(cam, [0, 0, CAN_Z]);
    if (canP) sprites.push({ d: canP[2], draw: () => {
      c.save();
      c.translate(canP[0], canP[1]);
      trashCan(c, canP[2], s.thrown?.done && m_hit(s) ? 'burning' : 'ready', t, 0.5 + 0.5 * Math.sin(t * 6));
      c.restore();
    } });
    if (pov !== 'helmet') {
      const sp = project3(cam, [s.x, 0, LANE]);
      if (sp)
        sprites.push({ d: sp[2], draw: () => {
          c.save();
          c.translate(sp[0], sp[1]);
          if (pov === 'chase') skaterBack(c, sk, sp[2] * 0.18, t, s.throwing);
          else skater(c, bonusSpec(sk, sp[2] * 0.18), { mode: 'cruise', time: t, throw: s.throwing });
          c.restore();
        } });
    }
    const bp = this.bottlePos(s.thrown);
    if (bp && !s.thrown.done) {
      const q = project3(cam, [bp.x, bp.y, bp.z]);
      if (q) sprites.push({ d: q[2] * 1.001, draw: () => {
        c.save();
        c.translate(q[0], q[1]);
        bottle(c, q[2], t, t * 14);
        c.restore();
      } });
    }
    sprites.sort((a, b) => a.d - b.d).forEach((sp) => sp.draw());
    if (pov === 'helmet') {
      // Your own hands and board nose at the bottom of the frame.
      const bob = Math.sin(t * 9) * 6;
      // Board nose poking into the bottom of the frame
      c.save();
      c.translate(w * 0.5, h * 0.86 + bob);
      c.beginPath();
      c.moveTo(-w * 0.09, h * 0.2);
      c.lineTo(-w * 0.07, 0);
      c.quadraticCurveTo(0, -h * 0.06, w * 0.07, 0);
      c.lineTo(w * 0.09, h * 0.2);
      c.closePath();
      paint(c, sk.trim, P.ink, 4);
      c.fillStyle = sk.outfit;
      star(c, 0, h * 0.05, w * 0.02, 5, 0.45);
      c.fill();
      c.restore();
      const arm = (x, side, up) => {
        const hx = x + (up ? -side * w * 0.05 : 0),
          hy = up ? h * 0.5 : h * 0.74 + bob;
        c.lineCap = 'round';
        c.strokeStyle = P.ink;
        c.lineWidth = w * 0.07 + 6;
        c.beginPath();
        c.moveTo(x + side * w * 0.08, h + 30);
        c.lineTo(hx, hy);
        c.stroke();
        c.strokeStyle = sk.outfit;
        c.lineWidth = w * 0.07;
        c.stroke();
        // Fingerless glove: palm, thumb and a cuff in the trim color
        c.save();
        c.translate(hx, hy);
        rr(c, -w * 0.035, -w * 0.03, w * 0.07, w * 0.065, w * 0.02);
        paint(c, sk.skin, P.ink, 3);
        rr(c, -w * 0.036, w * 0.012, w * 0.072, w * 0.025, w * 0.01);
        paint(c, sk.trim, P.ink, 3);
        ellipse(c, side * w * 0.04, 0, w * 0.014, w * 0.024, side * 0.6);
        paint(c, sk.skin, P.ink, 3);
        if (up) {
          c.translate(0, -w * 0.05);
          bottle(c, w * 0.08, t, 0.3);
        }
        c.restore();
      };
      arm(w * 0.16, -1, false);
      arm(w * 0.84, 1, Boolean(s.throwing) || (!s.thrown && Math.floor(t * 2) % 2 === 0 && false));
    }
    if (pov === 'fisheye') {
      // Rounded VX-style mask in a light frame (never black).
      c.save();
      c.fillStyle = '#F3ECFF';
      c.beginPath();
      c.rect(0, 0, w, h);
      c.ellipse(w / 2, h / 2, w * 0.58, h * 0.62, 0, 0, TAU);
      c.fill('evenodd');
      c.strokeStyle = P.ink;
      c.lineWidth = 4;
      c.beginPath();
      c.ellipse(w / 2, h / 2, w * 0.58, h * 0.62, 0, 0, TAU);
      c.stroke();
      c.restore();
    }
    if (pov === 'cctv') {
      c.fillStyle = 'rgba(42,30,79,0.06)';
      for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 2);
      text(c, `CAM 03  ● REC  ${new Date(0).toISOString().slice(0, 10)} 13:3${Math.floor(t) % 10}`, 18, h - 24, 14, '#FFFFFF', { align: 'left', stroke: P.ink, italic: false, family: 'ui-monospace, Menlo, monospace' });
      if (Math.floor(t * 2) % 2) {
        ellipse(c, w - 30, 30, 8, 8);
        paint(c, P.hazard, P.ink, 2);
      }
    }
  }
  canCam(c, s) {
    const { w, h, t, sk } = s,
      R = Math.min(w, h) * 0.46,
      cx = w / 2,
      cy = h / 2;
    // Looking up out of the can: sky disk, the board crosses overhead.
    c.fillStyle = '#BFD4EC';
    c.fillRect(0, 0, w, h);
    c.save();
    ellipse(c, cx, cy, R, R);
    c.clip();
    const g = c.createRadialGradient(cx, cy, R * 0.1, cx, cy, R);
    g.addColorStop(0, '#E6FAFF');
    g.addColorStop(1, '#5CC8FF');
    c.fillStyle = g;
    c.fillRect(cx - R, cy - R, R * 2, R * 2);
    for (let i = 0; i < 3; i++) {
      c.fillStyle = 'rgba(255,255,255,0.85)';
      ellipse(c, cx - R * 0.5 + i * R * 0.45 + Math.sin(t * 0.5 + i) * 10, cy - R * 0.4 + i * R * 0.3, R * 0.25, R * 0.1);
      c.fill();
    }
    const S = R / 5.5;
    boardUnderside(c, cx + s.x * S, cy + R * 0.1, S * 1.1, sk);
    const bp = this.bottlePos(s.thrown);
    if (bp && !s.thrown.done) {
      const grow = 0.5 + bp.k * 2.2;
      c.save();
      c.translate(cx + bp.x * S, cy + R * 0.15 * (1 - bp.k));
      c.scale(grow, grow);
      bottle(c, S, t, t * 14);
      c.restore();
    }
    if (s.thrown?.done && m_hit(s)) flames(c, cx, cy + R, R * 2.2, R * 1.8, t, 2);
    c.restore();
    // Can wall ribs around the opening
    c.strokeStyle = P.ink;
    c.lineWidth = 6;
    ellipse(c, cx, cy, R, R);
    c.stroke();
    c.strokeStyle = '#9FB6D6';
    c.lineWidth = 3;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * R * 1.02, cy + Math.sin(a) * R * 1.02);
      c.lineTo(cx + Math.cos(a) * R * 1.4, cy + Math.sin(a) * R * 1.4);
      c.stroke();
    }
    text(c, '(you are the trash can)', cx, cy + R + 22, 13, P.inkSoft, { italic: true, weight: 700, family: FONT.ui });
  }
  overlay(c, m, sk, w, h, t) {
    const b = m.bonus;
    // Ten pass dots
    const dot = 16,
      gap = 8,
      total = 10 * dot + 9 * gap,
      x0 = w / 2 - total / 2,
      y = h - 34 - (this.controls ?? 0);
    rr(c, x0 - 14, y - 16, total + 28, 32, 16);
    paint(c, 'rgba(255,255,255,0.9)', P.ink, 2);
    for (let i = 0; i < 10; i++) {
      const r = b.results[i];
      ellipse(c, x0 + i * (dot + gap) + dot / 2, y, dot / 2, dot / 2);
      paint(c, r ? (r.hit ? P.mint : '#D9D2F0') : i === b.pass ? P.sun : '#FFFFFF', P.ink, 2);
    }
    banner(c, '10× BONUS', 92, 34, 18, { fill: P.pink, color: '#FFFFFF', angle: -0.06 });
    if (b.stage !== 'card') {
      text(c, `${sk.name} · ${sk.view}`, 24, 66, 15, P.ink, { align: 'left', weight: 900, stroke: '#FFFFFF', strokeWidth: 4 });
      if (b.stage === 'run' && !b.thrown && b.pass < 2)
        text(c, 'RELEASE THROW TO TOSS', w / 2, h * 0.16, 18, P.ink, { weight: 900, stroke: '#FFFFFF', strokeWidth: 5 });
    }
    if (b.stage === 'result') {
      const r = b.results[b.results.length - 1];
      const s = easeOutBack(Math.min(1, b.t / 0.25));
      c.save();
      c.translate(w / 2, h * 0.32);
      c.scale(s, s);
      banner(c, r?.hit ? 'SWISH! +1000' : 'CLANK.', 0, 0, Math.min(56, w * 0.08), { fill: r?.hit ? P.mint : '#D9D2F0', angle: -0.05 });
      c.restore();
    }
  }
}
const T_PASS = 'PASS';
function m_hit(s) {
  return s.thrown && Math.abs(s.thrown.landX) <= s.sk.tol;
}
export { walkerPose, figure, shadow, lighten };
