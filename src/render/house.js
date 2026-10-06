import { P } from './palette.js';
import { ellipse, paint, rr, poly, text, darken, lighten, alpha, rand, blob } from './draw.js';
import { STATE } from '../sim/house.js';
// Facades are drawn procedurally in meters (k = px per meter) with the base center at (0, 0).
// Damage is seeded per house so broken windows stay put between frames.
const lw = (k) => Math.max(1.2, k * 0.05);
function windowArt(c, k, x, y, w, h, o) {
  const x0 = (x - w / 2) * k,
    y0 = -(y + h / 2) * k,
    W = w * k,
    H = h * k;
  if (o.shutters && !o.boarded) {
    for (const sx of [x0 - W * 0.32, x0 + W + W * 0.04]) {
      rr(c, sx, y0, W * 0.28, H, 0.04 * k);
      paint(c, o.shutters, P.ink, lw(k) * 0.8);
      c.strokeStyle = darken(o.shutters, 0.25);
      c.lineWidth = lw(k) * 0.5;
      for (let i = 1; i < 5; i++) {
        c.beginPath();
        c.moveTo(sx + W * 0.04, y0 + (H * i) / 5);
        c.lineTo(sx + W * 0.24, y0 + (H * i) / 5);
        c.stroke();
      }
    }
  }
  rr(c, x0 - 0.08 * k, y0 - 0.08 * k, W + 0.16 * k, H + 0.16 * k, 0.05 * k);
  paint(c, o.trim ?? P.trim, P.ink, lw(k));
  if (o.pointed) lancet(c, x0, y0, W, H);
  else if (o.arched) {
    c.beginPath();
    c.moveTo(x0, y0 + H);
    c.lineTo(x0, y0 + W / 2);
    c.arc(x0 + W / 2, y0 + W / 2, W / 2, Math.PI, 0);
    c.lineTo(x0 + W, y0 + H);
    c.closePath();
  } else rr(c, x0, y0, W, H, 0.03 * k);
  const glass = o.broken ? '#5B4D78' : o.curtain ? '#FFE2EC' : P.glass;
  paint(c, glass, P.ink, lw(k) * 0.8);
  if (o.broken) {
    c.strokeStyle = '#B9AFD6';
    c.lineWidth = lw(k) * 0.7;
    c.beginPath();
    const cx = x0 + W * (0.3 + 0.4 * o.seed),
      cy = y0 + H * 0.4;
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3 + o.seed * 5;
      c.moveTo(cx, cy);
      c.lineTo(cx + Math.cos(a) * W * 0.5, cy + Math.sin(a) * H * 0.5);
    }
    c.stroke();
    // Scorch above the opening
    c.fillStyle = 'rgba(74,61,122,0.35)';
    ellipse(c, x0 + W / 2, y0 - 0.1 * k, W * 0.75, H * 0.35);
    c.fill();
  } else {
    c.fillStyle = o.curtain ? '#FF9AC8' : P.glassHi;
    if (o.curtain) {
      c.fillRect(x0, y0, W * 0.3, H);
      c.fillRect(x0 + W * 0.7, y0, W * 0.3, H);
    } else {
      poly(c, [
        [x0 + W * 0.1, y0 + H * 0.08],
        [x0 + W * 0.42, y0 + H * 0.08],
        [x0 + W * 0.1, y0 + H * 0.6],
      ]);
      c.fill();
    }
    if (o.muntins) {
      c.strokeStyle = o.trim ?? P.trim;
      c.lineWidth = lw(k) * 0.9;
      c.beginPath();
      c.moveTo(x0 + W / 2, y0);
      c.lineTo(x0 + W / 2, y0 + H);
      c.moveTo(x0, y0 + H / 2);
      c.lineTo(x0 + W, y0 + H / 2);
      c.stroke();
    }
    if (o.diamond) {
      c.strokeStyle = alpha(P.inkSoft, 0.5);
      c.lineWidth = lw(k) * 0.5;
      c.beginPath();
      for (let i = -3; i <= 3; i++) {
        c.moveTo(x0 + (W * (i + 0)) / 3, y0);
        c.lineTo(x0 + (W * (i + 3)) / 3, y0 + H);
        c.moveTo(x0 + (W * (i + 3)) / 3, y0);
        c.lineTo(x0 + (W * i) / 3, y0 + H);
      }
      c.save();
      rr(c, x0, y0, W, H, 0.03 * k);
      c.clip();
      c.stroke();
      c.restore();
    }
  }
  if (o.boarded) {
    for (const [a, dy] of [[-0.18, 0.3], [0.2, 0.62]]) {
      c.save();
      c.translate(x0 + W / 2, y0 + H * dy);
      c.rotate(a);
      rr(c, -W * 0.65, -0.11 * k, W * 1.3, 0.22 * k, 0.03 * k);
      paint(c, '#E8C08A', P.ink, lw(k) * 0.8);
      c.restore();
    }
  }
}
function doorArt(c, k, d, o) {
  const x0 = (d.dx - d.w / 2) * k,
    y0 = -d.h * k,
    W = d.w * k,
    H = d.h * k;
  rr(c, x0 - 0.15 * k, y0 - 0.15 * k, W + 0.3 * k, H + 0.15 * k, 0.06 * k);
  paint(c, o.trim ?? P.trim, P.ink, lw(k));
  if (o.arched) {
    c.beginPath();
    c.moveTo(x0, 0);
    c.lineTo(x0, y0 + W / 2);
    c.arc(x0 + W / 2, y0 + W / 2, W / 2, Math.PI, 0);
    c.lineTo(x0 + W, 0);
    c.closePath();
  } else rr(c, x0, y0, W, H, 0.04 * k);
  paint(c, o.boarded ? '#C9A27A' : o.color, P.ink, lw(k));
  if (o.boarded) {
    for (const a of [0.5, -0.5]) {
      c.save();
      c.translate(x0 + W / 2, y0 + H / 2);
      c.rotate(a);
      rr(c, -W * 0.7, -0.1 * k, W * 1.4, 0.2 * k, 0.03 * k);
      paint(c, '#E8C08A', P.ink, lw(k) * 0.8);
      c.restore();
    }
    return;
  }
  c.strokeStyle = darken(o.color, 0.25);
  c.lineWidth = lw(k) * 0.7;
  for (const [px, py] of [[0.18, 0.18], [0.18, 0.55]]) {
    rr(c, x0 + W * px, y0 + H * py, W * 0.64, H * 0.28, 0.03 * k);
    c.stroke();
  }
  ellipse(c, x0 + W * 0.82, y0 + H * 0.55, 0.06 * k, 0.06 * k);
  paint(c, P.sun, P.ink, lw(k) * 0.5);
}
// A pointed gothic arch over a rectangle.
function lancet(c, x0, y0, W, H) {
  const rise = W * 0.7;
  c.beginPath();
  c.moveTo(x0, y0 + H);
  c.lineTo(x0, y0 + rise);
  c.quadraticCurveTo(x0, y0, x0 + W / 2, y0 - rise * 0.15);
  c.quadraticCurveTo(x0 + W, y0, x0 + W, y0 + rise);
  c.lineTo(x0 + W, y0 + H);
  c.closePath();
}
// Running-bond brick: courses every 0.25 m, head joints staggered.
function brick(c, k, w, h, color) {
  c.save();
  rr(c, (-w / 2) * k, -h * k, w * k, h * k, 0);
  c.clip();
  c.strokeStyle = alpha(lighten(color, 0.45), 0.55);
  c.lineWidth = Math.max(0.8, k * 0.018);
  c.beginPath();
  for (let y = 0.25, row = 0; y < h; y += 0.25, row++) {
    c.moveTo((-w / 2) * k, -y * k);
    c.lineTo((w / 2) * k, -y * k);
    for (let x = -w / 2 + (row % 2 ? 0.27 : 0); x < w / 2; x += 0.54) {
      c.moveTo(x * k, -y * k);
      c.lineTo(x * k, -(y - 0.25) * k);
    }
  }
  c.stroke();
  c.restore();
}
// Ashlar stone: long courses with irregular joints.
function stone(c, k, x0, w, h, color) {
  c.save();
  rr(c, x0 * k, -h * k, w * k, h * k, 0);
  c.clip();
  c.strokeStyle = alpha(darken(color, 0.25), 0.45);
  c.lineWidth = Math.max(0.8, k * 0.02);
  c.beginPath();
  for (let y = 0.42, row = 0; y < h + 0.42; y += 0.42, row++) {
    c.moveTo(x0 * k, -y * k);
    c.lineTo((x0 + w) * k, -y * k);
    for (let x = x0 + rand(row * 3.1) * 0.6; x < x0 + w; x += 0.7 + rand(row * 7 + x) * 0.6) {
      c.moveTo(x * k, -y * k);
      c.lineTo(x * k, -(y - 0.42) * k);
    }
  }
  c.stroke();
  c.restore();
}
// Light stone blocks at the corners of a brick wall.
function quoins(c, k, w, h) {
  for (const side of [-1, 1])
    for (let y = 0, i = 0; y < h - 0.2; y += 0.42, i++) {
      const bw = i % 2 ? 0.42 : 0.62;
      rr(c, side < 0 ? (-w / 2) * k : (w / 2 - bw) * k, -(y + 0.4) * k, bw * k, 0.38 * k, 0.02 * k);
      paint(c, '#FFF6E8', P.ink, lw(k) * 0.5);
    }
}
function dormer(c, k, x, base, roof) {
  rr(c, (x - 0.65) * k, -(base + 1.05) * k, 1.3 * k, 1.05 * k, 0.03 * k);
  paint(c, '#FFFFFF', P.ink, lw(k));
  rr(c, (x - 0.4) * k, -(base + 0.9) * k, 0.8 * k, 0.75 * k, 0.03 * k);
  paint(c, P.glass, P.ink, lw(k) * 0.7);
  poly(c, [[(x - 0.85) * k, -(base + 1.0) * k], [x * k, -(base + 1.6) * k], [(x + 0.85) * k, -(base + 1.0) * k]]);
  paint(c, roof, P.ink, lw(k));
}
function siding(c, k, w, h, color, step = 0.32) {
  c.strokeStyle = darken(color, 0.12);
  c.lineWidth = Math.max(1, k * 0.02);
  c.beginPath();
  for (let y = step; y < h; y += step) {
    c.moveTo(-w / 2 * k, -y * k);
    c.lineTo(w / 2 * k, -y * k);
  }
  c.stroke();
}
function roofShingles(c, k, pts, color) {
  poly(c, pts.map(([x, y]) => [x * k, -y * k]));
  paint(c, color, P.ink, lw(k));
  c.save();
  c.clip();
  c.strokeStyle = darken(color, 0.18);
  c.lineWidth = Math.max(1, k * 0.025);
  const ys = pts.map((p) => p[1]),
    lo = Math.min(...ys),
    hi = Math.max(...ys);
  c.beginPath();
  for (let y = lo + 0.3; y < hi; y += 0.3) {
    c.moveTo(-20 * k, -y * k);
    c.lineTo(20 * k, -y * k);
  }
  c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.18)';
  c.fillRect(-20 * k, -hi * k, 40 * k, (hi - lo) * k * 0.25);
  c.restore();
}
function chimney(c, k, x, base, top, color) {
  rr(c, (x - 0.35) * k, -top * k, 0.7 * k, (top - base) * k, 0.05 * k);
  paint(c, color, P.ink, lw(k));
  rr(c, (x - 0.45) * k, -top * k - 0.2 * k, 0.9 * k, 0.25 * k, 0.05 * k);
  paint(c, lighten(color, 0.2), P.ink, lw(k));
}
function letters(c, k, str, x, y, size, color, stroke = P.ink) {
  c.save();
  c.font = `900 ${Math.max(8, size * k)}px Georgia, "Times New Roman", serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.lineJoin = 'round';
  c.strokeStyle = stroke;
  c.lineWidth = Math.max(2, size * k * 0.14);
  c.strokeText(str, x * k, -y * k);
  c.fillStyle = color;
  c.fillText(str, x * k, -y * k);
  c.restore();
}
// Damage seeds: which windows break first is fixed per house.
function damageFor(h, i) {
  const r = rand(h.id * 31.7 + i * 7.3);
  return {
    broken: h.state >= STATE.harmed && r < (h.state >= STATE.reallyHarmed ? 0.75 : 0.35),
    boarded: h.state >= STATE.reallyHarmed && r > 0.82,
    seed: r,
  };
}
export function drawFacade(c, h, k, dz) {
  const f = h.facade,
    W = f.width,
    wall = h.wall,
    roof = h.roof,
    dmg = h.state;
  const accent = h.roof;
  c.save();
  // Porch slab: one meter of depth in front of the facade.
  const porchDepth = 1 * dz;
  rr(c, (-W / 2 - 0.2) * k, -0.15 * k, (W + 0.4) * k, porchDepth + 0.25 * k, 0.08 * k);
  paint(c, '#F3E3D3', P.ink, lw(k));
  c.fillStyle = '#E2CFBD';
  c.fillRect((-W / 2 - 0.2) * k, porchDepth * 0.55, (W + 0.4) * k, porchDepth * 0.45 + 0.1 * k);
  // Steps to the walkway
  rr(c, (f.door.dx - 0.9) * k, porchDepth - 0.05 * k, 1.8 * k, 0.32 * k, 0.05 * k);
  paint(c, '#FFFFFF', P.ink, lw(k) * 0.8);
  if (h.style === 'colonial') {
    rr(c, -W / 2 * k, -f.eave * k, W * k, f.eave * k, 0.04 * k);
    paint(c, wall, P.ink, lw(k));
    siding(c, k, W, f.eave, wall);
    roofShingles(c, k, [[-W / 2 - 0.4, f.eave - 0.05], [-W / 2 + 0.9, f.peak], [W / 2 - 0.9, f.peak], [W / 2 + 0.4, f.eave - 0.05]], roof);
    chimney(c, k, W / 2 - 1.8, f.eave + 0.6, f.peak + 0.9, '#F2A69A');
    // Pediment with the letters
    poly(c, [[-2.4 * k, -(f.eave + 0.05) * k], [0, -(f.eave + 1.6) * k], [2.4 * k, -(f.eave + 0.05) * k]]);
    paint(c, '#FFFFFF', P.ink, lw(k));
    letters(c, k, h.letters, 0, f.eave + 0.55, 0.85, accent, P.ink);
    f.windows.forEach((w, i) => windowArt(c, k, w.dx, w.y, w.w, w.h, { shutters: accent, muntins: true, ...damageFor(h, i), curtain: h.empty }));
    doorArt(c, k, f.door, { color: accent, boarded: h.empty && dmg >= STATE.harmed });
    // Columns
    for (const x of [-3, -1.05, 1.05, 3]) {
      rr(c, (x - 0.18) * k, -3.05 * k, 0.36 * k, 3.05 * k, 0.05 * k);
      paint(c, '#FFFFFF', P.ink, lw(k));
    }
    rr(c, -3.5 * k, -3.25 * k, 7 * k, 0.3 * k, 0.05 * k);
    paint(c, '#FFFFFF', P.ink, lw(k));
  } else if (h.style === 'craftsman') {
    rr(c, -W / 2 * k, -f.eave * k, W * k, f.eave * k, 0.04 * k);
    paint(c, wall, P.ink, lw(k));
    siding(c, k, W, f.eave, wall, 0.22);
    roofShingles(c, k, [[-W / 2 - 0.6, f.eave - 0.1], [0, f.peak], [W / 2 + 0.6, f.eave - 0.1]], roof);
    // Gable shingles and the letters board
    rr(c, -1.9 * k, -(f.eave + 1.75) * k, 3.8 * k, 0.75 * k, 0.1 * k);
    paint(c, '#FFFFFF', P.ink, lw(k));
    letters(c, k, h.letters, 0, f.eave + 1.38, 0.62, accent);
    f.windows.forEach((w, i) => windowArt(c, k, w.dx, w.y, w.w, w.h, { muntins: i >= 4, ...damageFor(h, i), curtain: h.empty, trim: '#FFF6E8' }));
    doorArt(c, k, f.door, { color: '#FF9AC8', boarded: h.empty && dmg >= STATE.harmed, trim: '#FFF6E8' });
    // Deep porch roof with tapered columns on stone bases
    rr(c, (-W / 2 - 0.3) * k, -2.95 * k, (W + 0.6) * k, 0.38 * k, 0.06 * k);
    paint(c, darken(roof, 0.05), P.ink, lw(k));
    for (const x of [-5.4, -0.9, 3.6, 5.4]) {
      rr(c, (x - 0.32) * k, -0.95 * k, 0.64 * k, 0.95 * k, 0.05 * k);
      paint(c, '#D9D2F0', P.ink, lw(k));
      poly(c, [[(x - 0.22) * k, -0.95 * k], [(x - 0.14) * k, -2.6 * k], [(x + 0.14) * k, -2.6 * k], [(x + 0.22) * k, -0.95 * k]]);
      paint(c, '#FFF6E8', P.ink, lw(k));
    }
  } else if (h.style === 'tudor') {
    rr(c, -W / 2 * k, -f.eave * k, W * k, f.eave * k, 0.04 * k);
    paint(c, '#FFF4E3', P.ink, lw(k));
    // Half-timbering in the house color
    c.strokeStyle = darken(wall, 0.45);
    c.lineWidth = Math.max(2, k * 0.12);
    c.beginPath();
    for (const x of [-W / 2 + 0.4, -2.4, -0.4, 1.6, W / 2 - 0.4]) {
      c.moveTo(x * k, 0);
      c.lineTo(x * k, -f.eave * k);
    }
    c.moveTo(-W / 2 * k, -2.7 * k);
    c.lineTo(W / 2 * k, -2.7 * k);
    c.moveTo(-2.4 * k, -2.7 * k);
    c.lineTo(-0.4 * k, -f.eave * k);
    c.moveTo(1.6 * k, -2.7 * k);
    c.lineTo(3.4 * k, -f.eave * k);
    c.stroke();
    roofShingles(c, k, [[-W / 2 - 0.3, f.eave - 0.1], [-2.6, f.peak - 0.7], [-0.2, f.eave + 0.6], [2.6, f.peak], [W / 2 + 0.3, f.eave - 0.1]], roof);
    chimney(c, k, -3.6, f.eave + 0.4, f.peak + 0.3, '#E2867A');
    poly(c, [[1.1 * k, -(f.eave - 0.05) * k], [2.6 * k, -(f.peak - 0.4) * k], [4.1 * k, -(f.eave - 0.05) * k]]);
    paint(c, wall, P.ink, lw(k));
    letters(c, k, h.letters, 2.6, f.eave + 0.55, 0.62, '#FFFFFF');
    f.windows.forEach((w, i) => windowArt(c, k, w.dx, w.y, w.w, w.h, { diamond: true, arched: i === 2, ...damageFor(h, i), curtain: h.empty, trim: '#FFF4E3' }));
    doorArt(c, k, f.door, { color: darken(wall, 0.3), arched: true, boarded: h.empty && dmg >= STATE.harmed, trim: '#FFF4E3' });
  } else if (h.style === 'modern') {
    rr(c, -W / 2 * k, -f.eave * k, W * k, f.eave * k, 0.04 * k);
    paint(c, wall, P.ink, lw(k));
    // Wood slat accent panel
    rr(c, 2.6 * k, -f.eave * k, 3.7 * k, f.eave * k, 0.02 * k);
    paint(c, '#F2C28F', P.ink, lw(k));
    c.strokeStyle = '#D9A26E';
    c.lineWidth = Math.max(1, k * 0.03);
    c.beginPath();
    for (let x = 2.8; x < 6.2; x += 0.28) {
      c.moveTo(x * k, -f.eave * k);
      c.lineTo(x * k, 0);
    }
    c.stroke();
    rr(c, (-W / 2 - 0.3) * k, -(f.eave + 0.35) * k, (W + 0.6) * k, 0.4 * k, 0.04 * k);
    paint(c, roof, P.ink, lw(k));
    // Roof deck railing
    c.strokeStyle = P.ink;
    c.lineWidth = Math.max(1, k * 0.04);
    c.beginPath();
    c.moveTo(-4 * k, -(f.eave + 1.1) * k);
    c.lineTo(1.5 * k, -(f.eave + 1.1) * k);
    for (let x = -4; x <= 1.5; x += 0.55) {
      c.moveTo(x * k, -(f.eave + 1.1) * k);
      c.lineTo(x * k, -(f.eave + 0.35) * k);
    }
    c.stroke();
    letters(c, k, h.letters, 4.45, f.eave - 0.9, 0.75, '#FFFFFF');
    f.windows.forEach((w, i) => windowArt(c, k, w.dx, w.y, w.w * (i < 3 ? 1.6 : 1.1), w.h * 1.15, { ...damageFor(h, i), curtain: h.empty, trim: '#FFFFFF' }));
    doorArt(c, k, f.door, { color: '#3A2F5C', boarded: h.empty && dmg >= STATE.harmed });
  } else if (h.style === 'georgian') {
    // Red-brick Georgian: hipped roof, dormers, quoins, a fanlight door under a portico.
    rr(c, (-W / 2) * k, -f.eave * k, W * k, f.eave * k, 0.04 * k);
    paint(c, wall, P.ink, lw(k));
    brick(c, k, W, f.eave, wall);
    quoins(c, k, W, f.eave);
    rr(c, (-W / 2) * k, -2.78 * k, W * k, 0.16 * k, 0.02 * k);
    paint(c, '#FFF6E8', P.ink, lw(k) * 0.6);
    roofShingles(c, k, [[-W / 2 - 0.3, f.eave - 0.05], [-W / 2 + 1.7, f.peak], [W / 2 - 1.7, f.peak], [W / 2 + 0.3, f.eave - 0.05]], roof);
    chimney(c, k, -W / 2 + 1.1, f.eave + 0.5, f.peak + 0.7, darken(wall, 0.12));
    chimney(c, k, W / 2 - 1.1, f.eave + 0.5, f.peak + 0.7, darken(wall, 0.12));
    for (const x of [-3.6, 3.6]) dormer(c, k, x, f.eave + 0.2, roof);
    rr(c, (-W / 2 - 0.25) * k, -(f.eave + 0.14) * k, (W + 0.5) * k, 0.28 * k, 0.03 * k);
    paint(c, '#FFFFFF', P.ink, lw(k));
    // Central pediment on the roof carries the letters.
    poly(c, [[-2.3 * k, -(f.eave + 0.1) * k], [0, -(f.eave + 1.35) * k], [2.3 * k, -(f.eave + 0.1) * k]]);
    paint(c, '#FFFFFF', P.ink, lw(k));
    letters(c, k, h.letters, 0, f.eave + 0.5, 0.62, accent, P.ink);
    f.windows.forEach((w, i) => {
      windowArt(c, k, w.dx, w.y, w.w, w.h, { muntins: true, ...damageFor(h, i), curtain: h.empty, trim: '#FFFFFF' });
      rr(c, (w.dx - w.w / 2 - 0.12) * k, -(w.y + w.h / 2 + 0.28) * k, (w.w + 0.24) * k, 0.2 * k, 0.02 * k);
      paint(c, '#FFF6E8', P.ink, lw(k) * 0.5);
    });
    doorArt(c, k, f.door, { color: accent, arched: true, boarded: h.empty && dmg >= STATE.harmed });
    for (const x of [-1.05, 1.05]) {
      rr(c, (x - 0.15) * k, -2.5 * k, 0.3 * k, 2.5 * k, 0.04 * k);
      paint(c, '#FFFFFF', P.ink, lw(k));
    }
    poly(c, [[-1.45 * k, -2.5 * k], [0, -2.95 * k], [1.45 * k, -2.5 * k]]);
    paint(c, '#FFFFFF', P.ink, lw(k));
  } else if (h.style === 'gothic') {
    // Collegiate gothic: stone, a crenellated tower over the entry, pointed lancets.
    const d = f.door.dx;
    rr(c, (-W / 2) * k, -f.eave * k, W * k, f.eave * k, 0.04 * k);
    paint(c, wall, P.ink, lw(k));
    stone(c, k, -W / 2, W, f.eave, wall);
    roofShingles(c, k, [[-W / 2 - 0.2, f.eave - 0.05], [1, f.peak], [W / 2 + 0.2, f.eave - 0.05]], roof);
    // Pinnacles at the gable ends
    for (const x of [-W / 2, W / 2]) {
      rr(c, (x - 0.2) * k, -(f.eave + 0.8) * k, 0.4 * k, 0.85 * k, 0.03 * k);
      paint(c, lighten(wall, 0.08), P.ink, lw(k));
      poly(c, [[(x - 0.24) * k, -(f.eave + 0.8) * k], [x * k, -(f.eave + 1.4) * k], [(x + 0.24) * k, -(f.eave + 0.8) * k]]);
      paint(c, lighten(wall, 0.08), P.ink, lw(k));
    }
    // Entry tower rising above the roofline
    const tw = 2.2,
      top = f.peak + 0.9;
    rr(c, (d - tw / 2) * k, -top * k, tw * k, top * k, 0.02 * k);
    paint(c, lighten(wall, 0.05), P.ink, lw(k));
    stone(c, k, d - tw / 2, tw, top, wall);
    for (let i = 0; i < 4; i++) {
      rr(c, (d - tw / 2 + i * 0.62) * k, -(top + 0.36) * k, 0.38 * k, 0.4 * k, 0.02 * k);
      paint(c, lighten(wall, 0.05), P.ink, lw(k) * 0.8);
    }
    rr(c, (d - 0.95) * k, -(f.eave + 0.25) * k, 1.9 * k, 0.6 * k, 0.05 * k);
    paint(c, '#FFF6E8', P.ink, lw(k));
    letters(c, k, h.letters, d, f.eave - 0.05, 0.42, accent, P.ink);
    windowArt(c, k, d, f.eave + 1.6, 0.6, 1, { pointed: true, ...damageFor(h, 9), curtain: h.empty, trim: '#FFF6E8' });
    f.windows.forEach((w, i) => windowArt(c, k, w.dx, w.y, w.w * 0.85, w.h * 1.15, { pointed: true, diamond: true, ...damageFor(h, i), curtain: h.empty, trim: '#FFF6E8' }));
    doorArt(c, k, f.door, { color: darken(wall, 0.35), arched: true, boarded: h.empty && dmg >= STATE.harmed, trim: '#FFF6E8' });
  } else if (h.style === 'brownstone') {
    // City brownstone: flat roof, a bracketed cornice, lintels and a stoop.
    rr(c, (-W / 2) * k, -f.eave * k, W * k, f.eave * k, 0.04 * k);
    paint(c, wall, P.ink, lw(k));
    stone(c, k, -W / 2, W, f.eave, wall);
    rr(c, (-W / 2 - 0.35) * k, -(f.eave + 0.55) * k, (W + 0.7) * k, 0.6 * k, 0.04 * k);
    paint(c, roof, P.ink, lw(k));
    for (let x = -W / 2; x <= W / 2 + 0.01; x += W / 8) {
      rr(c, (x - 0.12) * k, -(f.eave + 0.02) * k, 0.24 * k, 0.4 * k, 0.03 * k);
      paint(c, darken(roof, 0.1), P.ink, lw(k) * 0.6);
    }
    letters(c, k, h.letters, 0, f.eave + 0.26, 0.44, '#FFF6E8', P.ink);
    f.windows.forEach((w, i) => {
      windowArt(c, k, w.dx, w.y, w.w * 0.95, w.h * 1.1, { muntins: true, ...damageFor(h, i), curtain: h.empty, trim: lighten(wall, 0.35) });
      rr(c, (w.dx - w.w / 2 - 0.16) * k, -(w.y + w.h * 0.55 + 0.3) * k, (w.w + 0.32) * k, 0.24 * k, 0.03 * k);
      paint(c, lighten(wall, 0.3), P.ink, lw(k) * 0.6);
    });
    doorArt(c, k, f.door, { color: darken(roof, 0.05), boarded: h.empty && dmg >= STATE.harmed, trim: lighten(wall, 0.35) });
    // Stoop railings down to the sidewalk
    c.strokeStyle = P.ink;
    c.lineWidth = Math.max(1.5, k * 0.06);
    c.beginPath();
    for (const side of [-1, 1]) {
      c.moveTo((f.door.dx + side * 0.75) * k, -1.2 * k);
      c.lineTo((f.door.dx + side * 1.05) * k, 0.1 * k);
    }
    c.stroke();
  } else if (h.style === 'victorian') {
    // Painted lady: a round turret, a fish-scale front gable and a spindle porch.
    rr(c, (-W / 2) * k, -f.eave * k, W * k, f.eave * k, 0.04 * k);
    paint(c, wall, P.ink, lw(k));
    siding(c, k, W, f.eave, wall, 0.24);
    roofShingles(c, k, [[-W / 2 - 0.3, f.eave - 0.05], [-2, f.eave + 1.4], [W / 2 + 0.3, f.eave - 0.05]], roof);
    // Front gable with fish-scale shingles
    const gx = 1.6;
    poly(c, [[(gx - 3.4) * k, -(f.eave - 0.05) * k], [gx * k, -f.peak * k], [(gx + 3.4) * k, -(f.eave - 0.05) * k]]);
    paint(c, lighten(wall, 0.12), P.ink, lw(k));
    c.save();
    c.clip();
    c.strokeStyle = darken(wall, 0.18);
    c.lineWidth = Math.max(1, k * 0.025);
    for (let y = f.eave + 0.2, row = 0; y < f.peak; y += 0.32, row++)
      for (let x = gx - 3.4 + (row % 2 ? 0.2 : 0); x < gx + 3.4; x += 0.4) {
        c.beginPath();
        c.arc(x * k, -y * k, 0.2 * k, 0, Math.PI);
        c.stroke();
      }
    c.restore();
    roofShingles(c, k, [[gx - 3.7, f.eave - 0.2], [gx, f.peak + 0.25], [gx + 3.7, f.eave - 0.2], [gx + 3.3, f.eave - 0.2], [gx, f.peak - 0.15], [gx - 3.3, f.eave - 0.2]], roof);
    rr(c, (gx - 1.6) * k, -(f.eave + 0.42) * k, 3.2 * k, 0.6 * k, 0.08 * k);
    paint(c, '#FFFFFF', P.ink, lw(k));
    letters(c, k, h.letters, gx, f.eave + 0.12, 0.46, accent, P.ink);
    // Turret
    const tx = -3.9,
      tr = 1.35;
    rr(c, (tx - tr) * k, -(f.eave + 0.9) * k, tr * 2 * k, (f.eave + 0.9) * k, 0.04 * k);
    paint(c, lighten(wall, 0.06), P.ink, lw(k));
    poly(c, [[(tx - tr - 0.2) * k, -(f.eave + 0.85) * k], [tx * k, -(f.peak + 0.9) * k], [(tx + tr + 0.2) * k, -(f.eave + 0.85) * k]]);
    paint(c, roof, P.ink, lw(k));
    c.strokeStyle = P.ink;
    c.lineWidth = Math.max(1.2, k * 0.04);
    c.beginPath();
    c.moveTo(tx * k, -(f.peak + 0.9) * k);
    c.lineTo(tx * k, -(f.peak + 1.4) * k);
    c.stroke();
    f.windows.forEach((w, i) => windowArt(c, k, w.dx, w.y, w.w * (i === 6 ? 0.9 : 1), w.h * 1.1, { arched: i === 6, shutters: i < 6 && i !== 0 && i !== 3 ? accent : null, ...damageFor(h, i), curtain: h.empty, trim: '#FFFFFF' }));
    // Spindle porch across the door bay
    const p0 = -1.9,
      p1 = W / 2 + 0.1;
    rr(c, p0 * k, -2.95 * k, (p1 - p0) * k, 0.32 * k, 0.05 * k);
    paint(c, roof, P.ink, lw(k));
    c.strokeStyle = '#FFFFFF';
    c.lineWidth = Math.max(1, k * 0.035);
    c.beginPath();
    for (let x = p0 + 0.2; x < p1; x += 0.28) {
      c.moveTo(x * k, -2.63 * k);
      c.lineTo(x * k, -2.38 * k);
    }
    c.stroke();
    for (const x of [p0 + 0.15, 0.2, 3, p1 - 0.15]) {
      rr(c, (x - 0.12) * k, -2.63 * k, 0.24 * k, 2.63 * k, 0.05 * k);
      paint(c, '#FFFFFF', P.ink, lw(k) * 0.8);
    }
    doorArt(c, k, f.door, { color: accent, boarded: h.empty && dmg >= STATE.harmed });
  } else {
    // THE PIPELINE: a glass corporate HQ.
    rr(c, -W / 2 * k, -f.eave * k, W * k, f.eave * k, 0.06 * k);
    paint(c, '#DCEBFA', P.ink, lw(k));
    c.strokeStyle = '#A9C4E6';
    c.lineWidth = Math.max(1, k * 0.03);
    c.beginPath();
    for (let x = -W / 2 + 1; x < W / 2; x += 1) {
      c.moveTo(x * k, -f.eave * k);
      c.lineTo(x * k, 0);
    }
    c.stroke();
    f.windows.forEach((w, i) => windowArt(c, k, w.dx, w.y, w.w * 1.25, w.h, { ...damageFor(h, i), curtain: h.empty, trim: '#F3F8FF' }));
    rr(c, -3 * k, -(f.eave + 1.2) * k, 6 * k, 1 * k, 0.12 * k);
    paint(c, UNIFORM_NAVY, P.ink, lw(k));
    letters(c, k, h.letters, 0, f.eave + 0.7, 0.75, '#E8DCC4', UNIFORM_NAVY);
    c.strokeStyle = P.ink;
    c.lineWidth = Math.max(1.5, k * 0.06);
    c.beginPath();
    c.moveTo(4.2 * k, -(f.eave + 0.1) * k);
    c.lineTo(4.2 * k, -(f.eave + 2.2) * k);
    c.stroke();
    ellipse(c, 4.2 * k, -(f.eave + 2.25) * k, 0.12 * k, 0.12 * k);
    paint(c, P.hazard, P.ink, lw(k) * 0.6);
    doorArt(c, k, f.door, { color: '#A9C4E6', boarded: h.empty && dmg >= STATE.harmed });
    rr(c, -2.6 * k, -2.9 * k, 5.2 * k, 0.45 * k, 0.08 * k);
    paint(c, '#E8DCC4', P.ink, lw(k) * 0.8);
    text(c, 'NOW HIRING · NEXT IN LINE', 0, -2.68 * k, Math.max(7, 0.24 * k), UNIFORM_NAVY, { weight: 900 });
  }
  if (dmg >= STATE.harmed) scorch(c, h, k, f);
  if (dmg >= STATE.reallyHarmed) wreck(c, h, k, f);
  c.restore();
}
const UNIFORM_NAVY = '#1F2A44';
function scorch(c, h, k, f) {
  c.fillStyle = 'rgba(74,61,122,0.28)';
  for (let i = 0; i < 4; i++) {
    const x = (rand(h.id + i * 3.1) - 0.5) * f.width,
      y = f.eave * (0.4 + rand(h.id * 2 + i) * 0.6);
    blob(c, [
      [(x - 0.9) * k, -y * k],
      [(x - 0.2) * k, -(y + 0.8) * k],
      [(x + 0.7) * k, -(y + 0.4) * k],
      [(x + 0.5) * k, -(y - 0.5) * k],
      [(x - 0.4) * k, -(y - 0.6) * k],
    ]);
    c.fill();
  }
}
function wreck(c, h, k, f) {
  // A hole in the roof with exposed rafters, a crack down the wall.
  const x = (rand(h.id * 5.3) - 0.5) * f.width * 0.5,
    y = (f.eave + f.peak) / 2;
  blob(c, [
    [(x - 1.1) * k, -(y - 0.2) * k],
    [(x - 0.5) * k, -(y + 0.6) * k],
    [(x + 0.9) * k, -(y + 0.4) * k],
    [(x + 1.2) * k, -(y - 0.4) * k],
    [(x + 0.1) * k, -(y - 0.7) * k],
  ]);
  paint(c, '#5B4D78', P.ink, lw(k));
  c.strokeStyle = '#E8C08A';
  c.lineWidth = Math.max(2, k * 0.09);
  c.beginPath();
  for (const dx of [-0.6, 0, 0.6]) {
    c.moveTo((x + dx - 0.3) * k, -(y + 0.4) * k);
    c.lineTo((x + dx + 0.3) * k, -(y - 0.5) * k);
  }
  c.stroke();
  c.strokeStyle = P.ink;
  c.lineWidth = Math.max(1.5, k * 0.04);
  c.beginPath();
  const cx = (rand(h.id * 9.1) - 0.5) * f.width * 0.7;
  c.moveTo(cx * k, -f.eave * k);
  c.lineTo((cx + 0.3) * k, -(f.eave - 0.8) * k);
  c.lineTo((cx - 0.2) * k, -(f.eave - 1.6) * k);
  c.lineTo((cx + 0.25) * k, -(f.eave - 2.4) * k);
  c.stroke();
}
// Rot creeps over an empty house: mold blotches and vines scale with the damage.
export function drawRot(c, h, k, t) {
  const f = h.facade,
    amount = Math.min(1, (100 - h.integrity) / 100 + 0.15);
  c.save();
  for (let i = 0; i < 9; i++) {
    if (rand(h.id * 3 + i) > amount * 1.2) continue;
    const x = (rand(h.id + i * 1.9) - 0.5) * f.width * 0.95,
      y = rand(h.id * 4.1 + i) * f.eave * 0.95,
      r = (0.35 + rand(i * 2.3 + h.id) * 0.7) * amount;
    c.fillStyle = alpha(i % 2 ? P.mold : P.decay, 0.6);
    blob(c, [
      [(x - r) * k, -y * k],
      [(x - r * 0.3) * k, -(y + r * 0.9) * k],
      [(x + r) * k, -(y + r * 0.4) * k],
      [(x + r * 0.6) * k, -(y - r * 0.6) * k],
    ]);
    c.fill();
  }
  c.strokeStyle = P.vine;
  c.lineWidth = Math.max(1.5, k * 0.07);
  for (const side of [-1, 1]) {
    c.beginPath();
    const x = side * (f.width / 2 - 0.3);
    c.moveTo(x * k, 0);
    const top = f.eave * amount * 1.1;
    for (let y = 0; y < top; y += 0.4) c.lineTo((x + Math.sin(y * 3 + h.id) * 0.25) * k, -y * k);
    c.stroke();
    c.fillStyle = P.vine;
    for (let y = 0.3; y < top; y += 0.6) {
      ellipse(c, (x + Math.sin(y * 3 + h.id) * 0.25 + 0.18 * side) * k, -y * k, 0.16 * k, 0.09 * k, 0.6 * side);
      c.fill();
    }
  }
  c.restore();
}
export function drawRubble(c, h, k, t) {
  const W = h.facade.width;
  c.save();
  blob(c, [
    [-W * 0.48 * k, 0],
    [-W * 0.35 * k, -0.9 * k],
    [-W * 0.1 * k, -1.4 * k],
    [W * 0.15 * k, -1.1 * k],
    [W * 0.4 * k, -0.7 * k],
    [W * 0.5 * k, 0],
  ]);
  paint(c, '#C9B9EA', P.ink, lw(k));
  const pieces = [
    [-4, -0.6, 0.4, '#E8C08A'],
    [-1.5, -1.1, -0.3, '#E8C08A'],
    [1.8, -0.8, 0.7, h.roof],
    [3.6, -0.4, -0.5, h.wall],
    [0.2, -1.2, 0.15, h.wall],
    [-2.8, -0.4, -0.8, h.roof],
  ];
  for (const [x, y, a, col] of pieces) {
    c.save();
    c.translate(x * k, y * k);
    c.rotate(a);
    rr(c, -0.9 * k, -0.15 * k, 1.8 * k, 0.3 * k, 0.04 * k);
    paint(c, col, P.ink, lw(k));
    c.restore();
  }
  // The chimney stump survives, as they do.
  rr(c, 2.6 * k, -2.2 * k, 0.7 * k, 1.6 * k, 0.05 * k);
  paint(c, '#F2A69A', P.ink, lw(k));
  // A sign for what used to be here
  c.fillStyle = P.inkSoft;
  c.fillRect(-4.9 * k, -1.9 * k, 0.1 * k, 1.9 * k);
  rr(c, -5.9 * k, -2.5 * k, 2.1 * k, 0.75 * k, 0.08 * k);
  paint(c, '#FFFFFF', P.ink, lw(k));
  text(c, h.letters, -4.85 * k, -2.12 * k, Math.max(8, 0.36 * k), P.inkSoft, { weight: 900, italic: false });
  c.strokeStyle = P.hazard;
  c.lineWidth = Math.max(2, k * 0.06);
  c.beginPath();
  c.moveTo(-5.85 * k, -2.45 * k);
  c.lineTo(-3.85 * k, -1.8 * k);
  c.stroke();
  c.restore();
}
// Cache facades at device resolution: a small LRU keeps the visible two or three.
export class FacadeCache {
  constructor() {
    this.entries = new Map();
  }
  get(h, k, dz, ratio) {
    const key = `${h.id}|${h.style}|${h.wall}|${h.letters}|${h.state}|${h.empty ? 1 : 0}|${k.toFixed(2)}|${dz.toFixed(2)}|${ratio}`;
    let entry = this.entries.get(key);
    if (entry) {
      this.entries.delete(key);
      this.entries.set(key, entry);
      return entry;
    }
    const f = h.facade,
      padX = 1.6,
      top = f.peak + 2.8,
      bottom = 1.4 * (dz / k) + 0.4;
    const w = (f.width + padX * 2) * k,
      hgt = (top + bottom) * k;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(w * ratio);
    canvas.height = Math.ceil(hgt * ratio);
    const c = canvas.getContext('2d');
    c.scale(ratio, ratio);
    c.translate(w / 2, top * k);
    drawFacade(c, h, k, dz);
    entry = { canvas, ox: w / 2, oy: top * k, w, h: hgt };
    this.entries.set(key, entry);
    while (this.entries.size > 7) this.entries.delete(this.entries.keys().next().value);
    return entry;
  }
}
