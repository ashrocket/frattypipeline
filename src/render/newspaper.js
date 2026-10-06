import { P, FONT } from './palette.js';
import { rr, paint, text, ellipse, poly, alpha, easeOutBack, rand } from './draw.js';
import { S } from '../data/strings.js';
// THE DAILY PIPELINE: Paperboy's front page between days. It spins in like a
// thrown paper, then sits still long enough to read.
export function newspaper(c, view, m, t) {
  const n = m.newspaper,
    age = m.phaseTime,
    // Short screens (landscape phones) too: the stats column needs a tall paper.
    small = view.portrait || view.width < 700 || view.height < 520;
  const w = Math.min(view.width - 32, small ? 360 : 640),
    h = Math.min(view.height - view.hud - 40, small ? 420 : 430);
  c.save();
  c.fillStyle = alpha(P.ink, Math.min(0.45, age * 1.5));
  c.fillRect(0, 0, view.width, view.height);
  const spin = Math.min(1, age / 0.45),
    s = easeOutBack(spin);
  c.translate(view.width / 2, view.hud + 16 + h / 2 + (view.height - view.hud - 32 - h) / 2);
  c.rotate((1 - spin) * -3.6 - 0.025);
  c.scale(s, s);
  c.translate(-w / 2, -h / 2);
  rr(c, 8, 10, w, h, 6);
  c.fillStyle = alpha(P.ink, 0.35);
  c.fill();
  rr(c, 0, 0, w, h, 6);
  paint(c, '#FBF6EA', P.ink, 3);
  // Masthead
  const mh = small ? 54 : 70;
  text(c, S.daily, w / 2, mh * 0.52, small ? 30 : 46, P.ink, { family: 'Georgia, "Times New Roman", serif', weight: 900, italic: false });
  c.fillStyle = P.ink;
  c.fillRect(16, mh, w - 32, 3);
  c.fillRect(16, mh + 24, w - 32, 1.5);
  const dateline = `${n.day} · WEEK ${n.week} ${S.edition} · ${m.campus.place} · 25¢`;
  text(c, dateline, w / 2, mh + 13, small ? 10 : 12, P.inkSoft, { family: FONT.ui, weight: 800, italic: false });
  // Headline
  const hs = small ? 26 : 40;
  const lines = wrap(c, n.headline, w - 48, hs);
  let y = mh + 40 + hs * 0.6;
  for (const line of lines) {
    text(c, line, w / 2, y, hs, P.ink, { family: 'Georgia, "Times New Roman", serif', weight: 900, italic: false });
    y += hs * 1.08;
  }
  // Photo: a halftone of the Row with the skater, and the stats column beside it.
  const py = y + 4,
    ph = Math.max(0, h - py - 52),
    pw = small ? w - 32 : w * 0.56;
  if (ph > 12) {
    rr(c, 16, py, pw, ph, 2);
    paint(c, '#E9E2D2', P.ink, 2);
    c.save();
    rr(c, 16, py, pw, ph, 2);
    c.clip();
    c.fillStyle = alpha(P.ink, 0.6);
    for (let yy = py + 4; yy < py + ph; yy += 6)
      for (let xx = 18 + ((yy / 6) % 2) * 3; xx < 16 + pw; xx += 6) {
        const roof = py + ph * 0.55 - Math.abs(((xx - 16) % (pw / 3)) - pw / 6) * 0.6;
        const dark = yy > roof ? 0.55 : 0.18 + 0.1 * rand(xx * 0.31 + yy);
        ellipse(c, xx, yy, 1.4 * dark + 0.3, 1.4 * dark + 0.3);
        c.fill();
      }
    c.fillStyle = P.tangerine;
    for (let i = 0; i < 3; i++) {
      const fx = 16 + pw * (0.25 + i * 0.25),
        fy = py + ph * 0.5;
      poly(c, [[fx - 10, fy], [fx, fy - 24 - Math.sin(t * 9 + i) * 4], [fx + 10, fy]]);
      c.fill();
    }
    c.restore();
  }
  if (!small) {
    const y0 = mh + 40 + lines.length * hs * 1.08 + 18,
      sx = 16 + pw + 18;
    text(c, `YESTERDAY · ${n.yesterday}`, sx, y0, 12, P.inkSoft, { align: 'left', family: FONT.ui, weight: 900, italic: false });
    (n.stats ?? []).forEach(([label, value], i) => {
      if (y0 + 30 + i * 34 > h - 36) return; // rows that would leave the paper
      text(c, String(value), sx, y0 + 30 + i * 34, 24, P.ink, { align: 'left', family: 'Georgia, serif', weight: 900, italic: false });
      text(c, label, sx + 70, y0 + 30 + i * 34, 11, P.inkSoft, { align: 'left', family: FONT.ui, weight: 800, italic: false });
    });
  }
  // Press-to-continue line (input is ignored for the first 0.4 s)
  if (age > 0.4) {
    const key = { keyboard: 'SPACE', touch: 'TAP OLLIE', gamepad: 'A' }[m.inputDevice ?? 'keyboard'];
    text(c, `${key} · NEXT DAY`, w / 2, h - 20, small ? 12 : 14, P.pink, { family: FONT.ui, weight: 900, italic: false, stroke: '#FFFFFF', strokeWidth: 3 });
  }
  c.restore();
}
function wrap(c, str, width, size) {
  c.font = `900 ${size}px Georgia, "Times New Roman", serif`;
  const out = [];
  let line = '';
  for (const word of str.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (c.measureText(test).width > width && line) {
      out.push(line);
      line = word;
    } else line = test;
  }
  if (line) out.push(line);
  return out.slice(0, 3);
}
