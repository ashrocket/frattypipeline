import { P, skyFor } from './palette.js';
import { ellipse, rr, poly, darken, lighten, alpha, rand, blob, TAU } from './draw.js';
// Parallax layers behind the houses. Static art is cached per size and time of day.
const STRIP = 2400;
export class Backdrop {
  constructor() {
    this.cache = new Map();
  }
  canvas(key, w, h, ratio, paintFn) {
    let entry = this.cache.get(key);
    if (entry) return entry;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(w * ratio);
    canvas.height = Math.ceil(h * ratio);
    const c = canvas.getContext('2d');
    c.scale(ratio, ratio);
    paintFn(c);
    entry = { canvas, w, h };
    this.cache.set(key, entry);
    if (this.cache.size > 12) this.cache.delete(this.cache.keys().next().value);
    return entry;
  }
  sky(view, lap, ratio) {
    const sky = skyFor(lap),
      w = view.width,
      horizon = this.horizon(view);
    return this.canvas(`sky|${w}|${view.height}|${lap}|${ratio}|${horizon | 0}`, w, horizon + 4, ratio, (c) => {
      const g = c.createLinearGradient(0, 0, 0, horizon);
      g.addColorStop(0, sky.top);
      g.addColorStop(0.55, sky.mid);
      g.addColorStop(1, sky.horizon);
      c.fillStyle = g;
      c.fillRect(0, 0, w, horizon + 4);
      // The sun: high and plain at noon, big and striped as the laps roll toward dusk.
      const big = lap >= 3,
        r = Math.min(w, horizon * 2) * (big ? 0.2 : 0.09),
        sx = w * (view.portrait ? 0.7 : 0.78),
        sy = big ? horizon - r * 0.35 : horizon * 0.3;
      const glow = c.createRadialGradient(sx, sy, r * 0.2, sx, sy, r * 2.4);
      glow.addColorStop(0, alpha(sky.glow, 0.75));
      glow.addColorStop(1, alpha(sky.glow, 0));
      c.fillStyle = glow;
      c.fillRect(0, 0, w, horizon);
      c.save();
      ellipse(c, sx, sy, r, r);
      c.clip();
      const sg = c.createLinearGradient(0, sy - r, 0, sy + r);
      sg.addColorStop(0, '#FFFBE0');
      sg.addColorStop(1, big ? '#FF7FB8' : sky.sun);
      c.fillStyle = sg;
      c.fillRect(sx - r, sy - r, r * 2, r * 2);
      if (big || lap === 2) {
        c.fillStyle = sky.mid;
        for (let i = 0; i < 6; i++) {
          const y = sy + r * (0.05 + i * 0.17),
            hgt = r * (0.03 + i * 0.022);
          c.fillRect(sx - r, y, r * 2, hgt);
        }
      }
      c.restore();
      // Soft light shafts from the sun (Alto's haze).
      c.save();
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * (0.55 + i * 0.12) + rand(i * 2.3) * 0.08,
          len = horizon * 2.2,
          spread = 0.025 + rand(i * 5.7) * 0.03;
        const g2 = c.createLinearGradient(sx, sy, sx + Math.cos(a) * len, sy + Math.sin(a) * len);
        g2.addColorStop(0, alpha(sky.glow, 0.16));
        g2.addColorStop(1, alpha(sky.glow, 0));
        c.fillStyle = g2;
        poly(c, [[sx, sy], [sx + Math.cos(a - spread) * len, sy + Math.sin(a - spread) * len], [sx + Math.cos(a + spread) * len, sy + Math.sin(a + spread) * len]]);
        c.fill();
      }
      c.restore();
      // Retro grid shimmer on the horizon for dusk laps
      if (lap >= 4) {
        c.strokeStyle = alpha('#FFFFFF', 0.25);
        c.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
          c.beginPath();
          c.moveTo(0, horizon - 6 - i * 9);
          c.lineTo(w, horizon - 6 - i * 9);
          c.stroke();
        }
      }
    });
  }
  horizon(view) {
    return Math.max(view.hud + 10, view.groundTop - 2.6 * view.S);
  }
  // Far ridges: two hazy layers that fade into the horizon color.
  ridges(view, lap, ratio) {
    const sky = skyFor(lap),
      h = view.S * 5;
    return this.canvas(`ridges|${view.S.toFixed(2)}|${lap}|${ratio}`, STRIP, h, ratio, (c) => {
      for (const [layer, amp, tone] of [[0, 0.9, 0.55], [1, 0.6, 0.3]]) {
        c.fillStyle = mixHex(sky.far, sky.horizon, tone);
        c.beginPath();
        c.moveTo(0, h);
        for (let x = 0; x <= STRIP; x += 16) {
          const u = x / STRIP;
          const y = h * (0.25 + layer * 0.3) + Math.sin(u * TAU * (2 + layer) + layer * 2) * h * 0.12 * amp + Math.sin(u * TAU * (7 + layer * 2)) * h * 0.04 * amp;
          c.lineTo(x, y);
        }
        c.lineTo(STRIP, h);
        c.closePath();
        c.fill();
      }
    });
  }
  skyline(view, lap, ratio, campus) {
    const sky = skyFor(lap),
      h = view.S * 6.5,
      base = h;
    return this.canvas(`skyline|${view.S.toFixed(2)}|${lap}|${ratio}|${campus?.id}`, STRIP, h, ratio, (c) => {
      const k = view.S * 0.5,
        far = sky.far;
      // The campus landmark rises out of the skyline twice per strip.
      for (const lx of [STRIP * 0.22, STRIP * 0.72]) landmark(c, campus?.landmark, lx, base, h / 19, darken(far, 0.12), lighten(far, 0.5));
      let x = 0,
        i = 0;
      while (x < STRIP) {
        const r = rand(i * 3.7 + 1),
          bw = (2.5 + r * 4) * k,
          bh = (3 + rand(i * 1.3) * 6) * k;
        const kind = i % 7 === 3 ? 'tower' : i % 9 === 5 ? 'dome' : 'block';
        c.fillStyle = far;
        if (kind === 'tower') {
          rr(c, x, base - bh * 1.5, bw * 0.6, bh * 1.5, 2);
          c.fill();
          poly(c, [[x - 4, base - bh * 1.5], [x + bw * 0.3, base - bh * 1.5 - bw * 0.9], [x + bw * 0.6 + 4, base - bh * 1.5]]);
          c.fill();
          // Clock face
          c.fillStyle = lighten(far, 0.6);
          ellipse(c, x + bw * 0.3, base - bh * 1.25, bw * 0.16, bw * 0.16);
          c.fill();
        } else if (kind === 'dome') {
          rr(c, x, base - bh, bw * 1.4, bh, 2);
          c.fill();
          ellipse(c, x + bw * 0.7, base - bh, bw * 0.45, bw * 0.4);
          c.fill();
        } else {
          rr(c, x, base - bh, bw, bh, 3);
          c.fill();
          c.fillStyle = lighten(far, 0.45);
          for (let wy = base - bh + k * 0.8; wy < base - k; wy += k * 1.2)
            for (let wx = x + k * 0.5; wx < x + bw - k * 0.5; wx += k * 1)
              if (rand(wx * 0.1 + wy) > 0.35) c.fillRect(wx, wy, k * 0.42, k * 0.55);
        }
        x += bw * (kind === 'dome' ? 1.4 : 1) + (rand(i * 9.1) * 1.5 + 0.4) * k;
        i++;
      }
    });
  }
  hills(view, lap, ratio) {
    const sky = skyFor(lap),
      h = view.S * 3.2;
    return this.canvas(`hills|${view.S.toFixed(2)}|${lap}|${ratio}`, STRIP, h, ratio, (c) => {
      const k = view.S;
      c.fillStyle = sky.hills;
      c.beginPath();
      c.moveTo(0, h);
      for (let x = 0; x <= STRIP; x += 24) {
        const y = h - (1.2 + Math.sin((x / STRIP) * TAU * 3) * 0.5 + Math.sin((x / STRIP) * TAU * 7 + 1) * 0.25) * k;
        c.lineTo(x, y);
      }
      c.lineTo(STRIP, h);
      c.closePath();
      c.fill();
      // Rows of round trees on the hills
      for (let i = 0; i < 40; i++) {
        const x = (i / 40) * STRIP + rand(i) * 30,
          y = h - (0.9 + Math.sin((x / STRIP) * TAU * 3) * 0.5) * k;
        c.fillStyle = darken(sky.hills, 0.12 + rand(i * 2) * 0.1);
        ellipse(c, x, y - 0.5 * k, (0.5 + rand(i * 3) * 0.4) * k, (0.6 + rand(i * 5) * 0.4) * k);
        c.fill();
      }
    });
  }
  draw(c, view, model, t, ratio) {
    const lap = model.lap,
      sky = this.sky(view, lap, ratio);
    c.drawImage(sky.canvas, 0, 0, sky.w, sky.h);
    const horizon = this.horizon(view);
    // Clouds drift slowly; they do not need caching.
    const cam = view.left * view.S;
    for (let i = 0; i < 7; i++) {
      const span = view.width + 400,
        x = ((((rand(i * 7.7) * span - cam * 0.04 - t * (6 + i * 1.5)) % span) + span) % span) - 200,
        y = horizon * (0.12 + rand(i * 3.3) * 0.5),
        s = view.S * (0.9 + rand(i * 5.1) * 1.3);
      cloud(c, x, y, s, lap);
    }
    // A few birds, flapping slowly across the sky.
    for (let i = 0; i < 4; i++) {
      const span = view.width + 200,
        bx = ((((rand(i * 4.1 + 2) * span + t * (14 + i * 3) - cam * 0.05) % span) + span) % span) - 100,
        by = horizon * (0.18 + rand(i * 2.9) * 0.35) + Math.sin(t * 0.7 + i) * 6,
        flap = Math.sin(t * 7 + i * 1.7) * 0.6,
        s = view.S * 0.16;
      c.strokeStyle = alpha(P.ink, 0.45);
      c.lineWidth = Math.max(1.2, s * 0.25);
      c.beginPath();
      c.moveTo(bx - s * 1.4, by - s * flap);
      c.quadraticCurveTo(bx - s * 0.6, by - s * 0.6, bx, by);
      c.quadraticCurveTo(bx + s * 0.6, by - s * 0.6, bx + s * 1.4, by - s * flap);
      c.stroke();
    }
    for (const [layer, factor, yOffset] of [
      [this.ridges(view, lap, ratio), 0.04, 0.6],
      [this.skyline(view, lap, ratio, model.campus), 0.12, 0.2],
      [this.hills(view, lap, ratio), 0.3, 0.05],
    ]) {
      const offset = -(((cam * factor) % STRIP) + STRIP) % STRIP;
      const y = horizon - layer.h + yOffset * view.S;
      for (let x = offset; x < view.width; x += STRIP) c.drawImage(layer.canvas, x, y, STRIP, layer.h);
    }
    // Back lawn between the horizon and the facades, with a hedge line.
    const g = c.createLinearGradient(0, horizon, 0, view.groundTop);
    g.addColorStop(0, lighten(P.lawn, 0.35));
    g.addColorStop(1, P.lawn);
    c.fillStyle = g;
    c.fillRect(0, horizon - 1, view.width, view.groundTop - horizon + 2);
    const tint = skyFor(lap).tint;
    return tint;
  }
}
function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16),
    pb = parseInt(b.slice(1), 16);
  const ch = (p, sh) => (p >> sh) & 255;
  const m = (sh) => Math.round(ch(pa, sh) + (ch(pb, sh) - ch(pa, sh)) * t);
  return `rgb(${m(16)},${m(8)},${m(0)})`;
}
// Campus landmark silhouettes (stylized, not architectural copies).
function landmark(c, kind = 'steeple', x, base, k, tone, light) {
  c.save();
  c.fillStyle = tone;
  const rect = (x0, y0, w, h) => c.fillRect(x + x0 * k, base - (y0 + h) * k, w * k, h * k);
  const roof = (x0, y0, w, h) => {
    poly(c, [[x + x0 * k, base - y0 * k], [x + (x0 + w / 2) * k, base - (y0 + h) * k], [x + (x0 + w) * k, base - y0 * k]]);
    c.fill();
  };
  const windows = (x0, y0, w, h, n) => {
    c.fillStyle = light;
    for (let i = 0; i < n; i++) c.fillRect(x + (x0 + ((i + 0.5) * w) / n - 0.2) * k, base - (y0 + h * 0.75) * k, 0.4 * k, h * 0.5 * k);
    c.fillStyle = tone;
  };
  switch (kind) {
    case 'dome':
      rect(-7, 0, 14, 4);
      rect(-4, 4, 8, 1.6);
      ellipse(c, x, base - 5.6 * k, 4 * k, 3.4 * k);
      c.fill();
      rect(-0.4, 8.8, 0.8, 1.2);
      windows(-7, 0, 14, 4, 7);
      break;
    case 'campanile':
      rect(-1.3, 0, 2.6, 13);
      roof(-1.6, 13, 3.2, 3);
      c.fillStyle = light;
      c.fillRect(x - 0.7 * k, base - 11.8 * k, 1.4 * k, 1.6 * k);
      break;
    case 'clocktower':
      rect(-1.6, 0, 3.2, 12);
      roof(-1.9, 12, 3.8, 4.2);
      c.fillStyle = light;
      ellipse(c, x, base - 10.4 * k, 0.9 * k, 0.9 * k);
      c.fill();
      break;
    case 'library-tower':
      rect(-6, 0, 12, 4.2);
      rect(-1.4, 4.2, 2.8, 4.5);
      rect(-0.9, 8.7, 1.8, 1.8);
      roof(-0.9, 10.5, 1.8, 3.2);
      windows(-6, 0, 12, 4.2, 6);
      break;
    case 'green-hall':
      rect(-6, 0, 12, 5);
      roof(-6.4, 5, 12.8, 2.2);
      rect(-1.5, 0, 3, 9);
      roof(-1.8, 9, 3.6, 2.6);
      windows(-6, 0, 12, 5, 6);
      break;
    case 'stone-tower':
      rect(-2.2, 0, 4.4, 12);
      for (const px of [-2.2, 1.6]) {
        rect(px, 12, 0.6, 1.6);
        roof(px - 0.1, 13.6, 0.8, 1.2);
      }
      windows(-2.2, 6, 4.4, 4, 2);
      break;
    case 'gothic-tower':
      rect(-2, 0, 4, 9);
      rect(-1.5, 9, 3, 4);
      rect(-1, 13, 2, 2.5);
      for (const px of [-2, 1.5, -1.5, 1]) roof(px, px < -1.6 || px > 1.4 ? 9 : 13, 0.5, 2.2);
      roof(-1.1, 15.5, 2.2, 2.4);
      windows(-2, 3, 4, 4, 2);
      break;
    default:
      // steeple: a white meetinghouse with a tall slim spire
      rect(-4, 0, 8, 4.5);
      roof(-4.3, 4.5, 8.6, 2.2);
      rect(-0.9, 4.5, 1.8, 4.2);
      rect(-0.6, 8.7, 1.2, 1.6);
      roof(-0.6, 10.3, 1.2, 5);
      windows(-4, 0, 8, 4.5, 4);
  }
  c.restore();
}
function cloud(c, x, y, s, lap) {
  const tone = lap >= 3 ? '#FFE3F1' : '#FFFFFF',
    shade = lap >= 3 ? '#E9B8F0' : '#D9E9FF';
  c.fillStyle = shade;
  blob(c, [
    [x - 2.2 * s, y + 0.25 * s],
    [x - 1.6 * s, y - 0.5 * s],
    [x - 0.6 * s, y - 1.1 * s],
    [x + 0.6 * s, y - 0.9 * s],
    [x + 1.6 * s, y - 0.4 * s],
    [x + 2.2 * s, y + 0.25 * s],
  ]);
  c.fill();
  c.fillStyle = tone;
  blob(c, [
    [x - 2 * s, y],
    [x - 1.5 * s, y - 0.7 * s],
    [x - 0.5 * s, y - 1.25 * s],
    [x + 0.6 * s, y - 1.05 * s],
    [x + 1.5 * s, y - 0.6 * s],
    [x + 2 * s, y],
  ]);
  c.fill();
}
