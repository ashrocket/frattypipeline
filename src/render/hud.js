import { P, FONT } from './palette.js';
import { rr, paint, text, chrome, ellipse, alpha, star, poly, easeOutBack } from './draw.js';
import { ROW, ring, LAP, near } from '../sim/row.js';
import { SHOPS } from '../data/houses.js';
import { S } from '../data/strings.js';
import { ITEMS, itemName, stock } from '../sim/throw.js';
import { TUNING as T } from '../data/tuning.js';
import { STATIONS } from '../sim/training.js';
import { KEYCAPS } from '../data/strings.js';
import { beehive, subwoofer, fryer, raccoonCrate, balloonBundle, bottle } from './props.js';
function card(c, x, y, w, h, border = P.grape) {
  c.save();
  c.fillStyle = 'rgba(42,30,79,0.18)';
  rr(c, x + 3, y + 4, w, h, 12);
  c.fill();
  rr(c, x, y, w, h, 12);
  paint(c, 'rgba(255,255,255,0.9)', border, 2.5);
  c.restore();
}
const STATE_COLORS = ['#FFFFFF', '#FFE69A', P.tangerine, P.inkSoft];
export function itemIcon(c, item, x, y, k, t) {
  c.save();
  c.translate(x, y);
  if (item === 'bottle') bottle(c, k * 1.4, t, 0.4);
  else if (item === 'bees') beehive(c, k * 0.9, t);
  else if (item === 'sub') subwoofer(c, k * 0.75, t, t * 3);
  else if (item === 'fryer') fryer(c, k * 0.75, t, false);
  else if (item === 'raccoons') raccoonCrate(c, k * 1.1, t, false);
  else if (item === 'balloons') balloonBundle(c, k * 0.55, t, 4, 0.7);
  c.restore();
}
export class Hud {
  constructor() {
    this.scoreShown = 0;
    this.itemFlash = 0;
    this.lastItem = 'bottle';
    this.combo = null;
  }
  // Combo readout (THPS style): the trick list grows while you chain, then banks or drops.
  event(e) {
    if (e.type === 'trick') this.combo = { parts: e.names ?? [e.text], count: e.parts ?? 1, points: e.combo ?? e.points, mult: e.mult ?? 1, state: 'live', age: 0 };
    else if (e.type === 'combo' && this.combo) Object.assign(this.combo, { state: 'banked', age: 0, total: e.points, mult: e.mult });
    else if (e.type === 'comboLost' && this.combo) Object.assign(this.combo, { state: 'lost', age: 0, reason: e.text });
    else if (e.type === 'start' || e.type === 'trainingStart') this.combo = null;
  }
  draw(c, m, view, dt, count, t) {
    const w = view.width,
      small = view.portrait || view.height < 520,
      pad = small ? 8 : 14;
    this.scoreShown += (m.score - this.scoreShown) * Math.min(1, dt * 10);
    if (Math.abs(m.score - this.scoreShown) < 1) this.scoreShown = m.score;
    if (m.item !== this.lastItem) {
      this.itemFlash = 1;
      this.lastItem = m.item;
    }
    this.itemFlash = Math.max(0, this.itemFlash - dt * 2.5);
    // Score
    const sw = small ? 132 : 190,
      sh = small ? 46 : 62;
    card(c, pad, pad, sw, sh, P.pink);
    text(c, S.hud.score, pad + 12, pad + (small ? 11 : 14), small ? 9 : 11, P.inkSoft, { align: 'left', weight: 800, italic: false, family: FONT.ui });
    chrome(c, String(Math.round(this.scoreShown)).padStart(7, '0'), pad + sw / 2 + 6, pad + sh * 0.62, small ? 22 : 31);
    if (m.chain.n > 1 && m.time <= m.chain.until) {
      const left = (m.chain.until - m.time) / 4;
      rr(c, pad, pad + sh + 6, sw, 20, 10);
      paint(c, P.tangerine, P.ink, 2);
      rr(c, pad + 3, pad + sh + 9, (sw - 6) * left, 14, 7);
      c.fillStyle = 'rgba(255,255,255,0.45)';
      c.fill();
      text(c, `CHAIN ×${m.chain.n}`, pad + sw / 2, pad + sh + 16, 12, P.ink, { weight: 900 });
    }
    // Crew lives and the live player count (owner directive: visible on every screen)
    const cw = small ? 122 : 176,
      ch = small ? 46 : 62,
      cx = w - pad - cw;
    card(c, cx, pad, cw, ch, P.cyan);
    for (let i = 0; i < 3; i++) {
      const hx = cx + (small ? 20 : 26) + i * (small ? 26 : 34),
        hy = pad + (small ? 18 : 24),
        r = small ? 9 : 12;
      const lost = i < 3 - m.lives,
        current = i === 3 - m.lives;
      ellipse(c, hx, hy, r, r);
      paint(c, lost ? P.uniform.skin : current ? P.sun : '#FFE6F3', P.ink, 2);
      c.fillStyle = P.ink;
      if (lost) {
        c.fillRect(hx - r * 0.45, hy - r * 0.15, r * 0.25, r * 0.25);
        c.fillRect(hx + r * 0.2, hy - r * 0.15, r * 0.25, r * 0.25);
      } else {
        ellipse(c, hx - r * 0.3, hy - r * 0.1, r * 0.12, r * 0.18);
        c.fill();
        ellipse(c, hx + r * 0.3, hy - r * 0.1, r * 0.12, r * 0.18);
        c.fill();
      }
      if (current && Math.floor(t * 3) % 2 === 0) {
        star(c, hx + r * 0.9, hy - r * 0.9, r * 0.45);
        paint(c, P.pink, P.ink, 1);
      }
    }
    text(c, `${count.activeCount} / ${count.capacity} ${S.hud.playing}`, cx + cw / 2, pad + ch - (small ? 9 : 12), small ? 9 : 11, P.inkSoft, { weight: 800, italic: false, family: FONT.ui });
    // Row map
    const mapW = Math.min(w - sw - cw - pad * 4, small ? 220 : 430),
      mapX = (w - mapW) / 2,
      mapY = pad;
    if (mapW > 120 && m.level === 'row') {
      card(c, mapX, mapY, mapW, small ? 40 : 50, P.grape);
      const lane = (s) => mapX + 12 + ((mapW - 24) * s) / LAP,
        ly = mapY + (small ? 24 : 30);
      c.strokeStyle = '#D8CCF2';
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(lane(0), ly);
      c.lineTo(lane(LAP), ly);
      c.stroke();
      ROW.shops.forEach((s, i) => {
        const x = lane(s.s);
        rr(c, x - 4, ly - 4, 8, 8, 2);
        paint(c, m.unlocked[SHOPS[i].kind] ? SHOPS[i].color : '#FFFFFF', P.ink, 1.2);
      });
      m.houses.forEach((h) => {
        const x = lane(h.s),
          r = small ? 6 : 7.5;
        if (h.gone) {
          c.strokeStyle = P.inkSoft;
          c.lineWidth = 2.5;
          c.beginPath();
          c.moveTo(x - r * 0.7, ly - r * 0.7);
          c.lineTo(x + r * 0.7, ly + r * 0.7);
          c.moveTo(x + r * 0.7, ly - r * 0.7);
          c.lineTo(x - r * 0.7, ly + r * 0.7);
          c.stroke();
          return;
        }
        ellipse(c, x, ly, r, r);
        paint(c, h.rotting ? P.mold : STATE_COLORS[h.state], P.ink, 1.6);
        if (h.fire > 0 || h.can.state === 'burning') {
          c.fillStyle = h.fire > 0 ? P.hazard : P.tangerine;
          poly(c, [[x - r * 0.5, ly - r * 0.9], [x, ly - r * 2.1 - Math.sin(t * 12 + h.id) * 2], [x + r * 0.5, ly - r * 0.9]]);
          c.fill();
        }
        if (h.comeBack) text(c, '↻', x, ly - r * 1.9, small ? 10 : 12, P.pink, { weight: 900, stroke: '#FFFFFF', strokeWidth: 3 });
        if (h.empty) text(c, '•', x, ly + 0.5, r * 1.6, '#4F8A2B', { weight: 900 });
      });
      const px = lane(ring(m.player.x));
      poly(c, [[px, ly + 6], [px - 6, ly + 15], [px + 6, ly + 15]]);
      paint(c, P.pink, P.ink, 1.5);
      text(c, `${S.hud.lap} ${m.lap}`, mapX + 12, mapY + (small ? 9 : 11), small ? 9 : 10, P.inkSoft, { align: 'left', weight: 900, italic: false, family: FONT.ui });
      text(c, `${m.destroyed}/12 GONE`, mapX + mapW - 12, mapY + (small ? 9 : 11), small ? 9 : 10, P.inkSoft, { align: 'right', weight: 900, italic: false, family: FONT.ui });
    }
    if (['playing', 'rescue', 'rescued', 'captured', 'resume', 'victory', 'training'].includes(m.phase)) {
      if (!view.touch) {
        const st = this.strip(view);
        c.fillStyle = 'rgba(123,77,255,0.08)';
        c.fillRect(0, st.top, w, st.h);
      }
      if (m.level === 'row') this.gap(c, m, view, t, small, pad);
      else if (m.level === 'alley') this.alley(c, m, view, t, small, pad);
      if (m.level !== 'training') this.items(c, m, view, t, small, pad);
      this.flowMeter(c, m, view, t, small, pad);
    }
    if (m.level === 'training' && m.course) this.training(c, m, view, t, small, pad);
    this.comboReadout(c, m, view, dt, small);
    if (m.phase === 'rescue') this.rescue(c, m, view, t);
    this.coach(c, m, view, t);
    if (m.phase === 'countin') {
      const n = Math.max(1, 3 - Math.floor((m.phaseTime / 1.8) * 3));
      const f = ((m.phaseTime / 1.8) * 3) % 1;
      c.save();
      c.translate(w / 2, view.height * 0.42);
      const s = easeOutBack(Math.min(1, f * 3));
      c.scale(s, s);
      chrome(c, String(n), 0, 0, Math.min(140, view.height * 0.22));
      c.restore();
    }
  }
  // Bottom strip: the far sidewalk is outside the playable depth, so HUD panels live there.
  strip(view) {
    const top = view.groundTop + (2.75 - -11) * view.Dz;
    return { top, h: view.height - top };
  }
  gap(c, m, view, t, small, pad) {
    const gap = Math.max(0, m.horde.gap),
      danger = gap < T.hordeWarn,
      fill = Math.min(1, gap / T.hordeGap);
    let x, y, bw, bh;
    if (view.touch) {
      bw = Math.min(220, view.width * 0.4);
      bh = 26;
      x = view.width / 2 - bw / 2;
      y = (small ? 52 : 70) + pad;
    } else {
      const st = this.strip(view);
      bw = 250;
      bh = Math.min(54, st.h - 10);
      x = pad;
      y = st.top + (st.h - bh) / 2;
    }
    card(c, x, y, bw, bh, danger ? P.hazard : P.grape);
    const label = danger ? 'KEEP ROLLING!' : S.hud.pipeline;
    const barY = view.touch ? y + bh / 2 - 4 : y + bh - 17,
      barX = view.touch ? x + 74 : x + 12,
      barW = view.touch ? bw - 86 : bw - 24;
    text(c, label, view.touch ? x + 10 : x + 12, view.touch ? y + bh / 2 : y + 14, view.touch ? 9 : 11, danger ? P.hazard : P.inkSoft, { align: 'left', weight: 900, italic: false, family: FONT.ui });
    if (!view.touch) text(c, `${gap.toFixed(1)} m`, x + bw - 12, y + 14, 12, P.ink, { align: 'right', weight: 900 });
    rr(c, barX, barY, barW, 8, 4);
    c.fillStyle = '#EDE6FA';
    c.fill();
    rr(c, barX, barY, Math.max(8, barW * fill), 8, 4);
    c.fillStyle = danger ? (Math.floor(t * 8) % 2 ? P.hazard : P.sun) : P.mint;
    c.fill();
    // The horde icon sits at the empty end of the bar: as the gap closes, the bar shrinks toward it.
    ellipse(c, barX, barY + 4, 7, 7);
    paint(c, P.uniform.zip, P.ink, 1.5);
  }
  items(c, m, view, t, small, pad) {
    const owned = ITEMS.filter((i) => i === 'bottle' || m.unlocked[i]);
    const slot = view.touch ? 42 : 58;
    let w = Math.max(view.touch ? 120 : 168, owned.length * slot + 12),
      h = slot + (view.touch ? 16 : 20),
      x = view.width - pad - w,
      y;
    if (view.touch) y = (small ? 52 : 70) + pad + (view.portrait ? 34 : 0);
    else {
      const st = this.strip(view);
      h = Math.min(h, st.h - 6);
      y = st.top + (st.h - h) / 2;
    }
    card(c, x, y, w, h, P.sun);
    const icon = Math.min(slot, h - 14);
    const x0 = x + (w - owned.length * slot) / 2;
    owned.forEach((item, i) => {
      const sx = x0 + i * slot,
        selected = item === m.item;
      if (selected) {
        rr(c, sx + 1, y + 4, slot - 2, icon - 2, 10);
        paint(c, alpha(P.sun, 0.55 + this.itemFlash * 0.4), P.ink, 2);
      }
      itemIcon(c, item, sx + slot / 2, y + icon * 0.82, icon * 0.5, t);
      const n = stock(m, item);
      text(c, `×${n}`, sx + slot - 5, y + 12, view.touch ? 10 : 12, n ? P.ink : P.hazard, { align: 'right', weight: 900, stroke: '#FFFFFF', strokeWidth: 3 });
    });
    const label = itemName(m.item) + (owned.length > 1 && !view.touch ? '  ·  Q' : '');
    text(c, label, x + w / 2, y + h - (view.touch ? 7 : 9), view.touch ? 9 : 11, P.inkSoft, { weight: 900, italic: false, family: FONT.ui });
    if (m.item === 'bottle' && m.bottles < 1)
      text(c, S.hud.crate, x + w / 2, y - 10, 12, P.hazard, { weight: 900, stroke: '#FFFFFF', strokeWidth: 3 });
  }
  flowMeter(c, m, view, t, small, pad) {
    const sw = small ? 132 : 190,
      x = pad,
      y = pad + (small ? 46 : 62) + (m.chain.n > 1 && m.time <= m.chain.until ? 32 : 8),
      h = small ? 14 : 18,
      flowing = m.flowTime > 0,
      fill = flowing ? m.flowTime / T.flowTime : m.flow / 100;
    rr(c, x, y, sw, h, h / 2);
    paint(c, 'rgba(255,255,255,0.9)', flowing ? P.mint : P.grape, 2);
    if (fill > 0.01) {
      rr(c, x + 3, y + 3, Math.max(h - 6, (sw - 6) * fill), h - 6, (h - 6) / 2);
      c.fillStyle = flowing ? (Math.floor(t * 10) % 2 ? P.mint : P.cyan) : P.grape;
      c.fill();
    }
    text(c, flowing ? 'FLOW!' : 'FLOW', x + sw / 2, y + h / 2 + 0.5, small ? 9 : 11, flowing || fill > 0.55 ? '#FFFFFF' : P.inkSoft, { weight: 900, italic: false, family: FONT.ui, stroke: flowing ? P.ink : null, strokeWidth: 3 });
  }
  comboReadout(c, m, view, dt, small) {
    const q = this.combo;
    if (!q) return;
    q.age += dt;
    if ((q.state === 'banked' && q.age > 1.4) || (q.state === 'lost' && q.age > 1.1)) {
      this.combo = null;
      return;
    }
    const y0 = view.touch ? view.height - view.controls - (small ? 74 : 92) : this.strip(view).top - (small ? 78 : 96);
    const rise = q.state === 'banked' ? -q.age * 40 : q.state === 'lost' ? q.age * 50 : 0,
      a = q.state === 'live' ? 1 : Math.max(0, 1 - q.age / (q.state === 'banked' ? 1.4 : 1.1));
    const list = (q.count > q.parts.length ? '… + ' : '') + q.parts.join(' + ');
    c.save();
    c.globalAlpha = a;
    c.translate(view.width / 2, y0 + rise);
    text(c, list, 0, 0, small ? 13 : 17, '#FFFFFF', { weight: 900, stroke: P.ink, strokeWidth: 4 });
    // Banked totals arrive route-scaled from the sim; scale the live sum to match.
    const value = q.state === 'banked' ? `+${q.total.toLocaleString()}` : `${Math.round(q.points * (m.diff?.points ?? 1)).toLocaleString()} × ${q.mult}`;
    const color = q.state === 'lost' ? P.hazard : q.state === 'banked' ? P.mint : P.sun;
    text(c, q.state === 'lost' ? q.reason ?? 'BAILED' : value, 0, small ? 24 : 32, small ? 22 : 32, color, { weight: 900, stroke: P.ink, strokeWidth: 5 });
    c.restore();
  }
  training(c, m, view, t, small, pad) {
    const course = m.course,
      n = STATIONS.length,
      cell = small ? 26 : 38,
      w = n * cell + 24,
      x = view.width / 2 - w / 2,
      // Narrow screens: tuck the checklist under the score and lives cards.
      y = view.width < 640 ? pad + (small ? 52 : 68) + 8 : pad;
    card(c, x, y, w, small ? 52 : 68, P.mint);
    text(c, 'SKATE SCHOOL', x + 12, y + (small ? 11 : 14), small ? 9 : 11, P.inkSoft, { align: 'left', weight: 900, italic: false, family: FONT.ui });
    const skip = (KEYCAPS[m.inputDevice ?? 'keyboard'] ?? KEYCAPS.keyboard).ENTER;
    text(c, skip === 'SKIP' ? 'TAP SKIP' : `${skip} · SKIP`, x + w - 12, y + (small ? 11 : 14), small ? 9 : 11, P.pink, { align: 'right', weight: 900, italic: false, family: FONT.ui });
    STATIONS.forEach((st, i) => {
      const cx = x + 12 + i * cell + cell / 2,
        cy = y + (small ? 34 : 44),
        r = cell * 0.36,
        done = course.completed.includes(st.id),
        now = course.station === i;
      ellipse(c, cx, cy, r, r);
      paint(c, done ? P.mint : now ? P.sun : '#FFFFFF', P.ink, now ? 3 : 1.5);
      text(c, done ? '✓' : String(i + 1), cx, cy + 1, r * 1.1, P.ink, { weight: 900, italic: false, family: FONT.ui });
      if (now && course.progress > 0 && !done) {
        c.strokeStyle = P.pink;
        c.lineWidth = 4;
        c.beginPath();
        c.arc(cx, cy, r + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, course.progress));
        c.stroke();
      }
    });
  }
  alley(c, m, view, t, small, pad) {
    const a = m.alley;
    if (!a) return;
    const bw = small ? 200 : 260,
      bh = small ? 46 : 58,
      x = view.width / 2 - bw / 2,
      y = view.width < 640 ? pad + (small ? 52 : 68) + 8 : pad;
    card(c, x, y, bw, bh, P.sun);
    text(c, 'BEE ALLEY', x + 12, y + (small ? 11 : 14), small ? 9 : 11, P.inkSoft, { align: 'left', weight: 900, italic: false, family: FONT.ui });
    text(c, `HIVES ×${m.items.bees ?? 0}`, x + bw - 12, y + (small ? 11 : 14), small ? 10 : 12, P.ink, { align: 'right', weight: 900 });
    const notice = Math.min(1, a.still / (m.diff?.notice ?? 3)),
      barX = x + 12,
      barW = bw - 24,
      barY = y + bh - (small ? 16 : 20);
    rr(c, barX, barY, barW, 8, 4);
    c.fillStyle = '#EDE6FA';
    c.fill();
    if (notice > 0) {
      rr(c, barX, barY, Math.max(8, barW * notice), 8, 4);
      c.fillStyle = notice > 0.66 ? (Math.floor(t * 8) % 2 ? P.hazard : P.sun) : P.tangerine;
      c.fill();
    }
    text(c, notice > 0 ? 'THEY’RE NOTICING YOU · MOVE!' : 'KEEP MOVING', x + bw / 2, barY - 8, small ? 8 : 10, notice > 0.5 ? P.hazard : P.inkSoft, { weight: 900, italic: false, family: FONT.ui });
  }
  // First-run coaching: one short, device-specific prompt at a time.
  coach(c, m, view, t) {
    if (this.quiet || m.phase !== 'playing' || m.level !== 'row' || m.time < 2.4) return;
    const dev = m.inputDevice ?? 'keyboard';
    const K = {
      keyboard: { throw: 'HOLD T', ollie: 'SPACE', pump: 'HOLD →', push: 'SHIFT', item: 'Q', up: '↑' },
      touch: { throw: 'HOLD THROW', ollie: 'OLLIE', pump: 'STICK RIGHT', push: 'PUSH', item: 'ITEM', up: 'STICK UP' },
      gamepad: { throw: 'HOLD X', ollie: 'A', pump: 'STICK RIGHT', push: 'B', item: 'Y', up: 'STICK UP' },
    }[dev] ?? {};
    const p = m.player;
    let hint = null;
    if (m.horde.gap < 6.5 && m.stats.captures === 0) hint = `${K.pump} TO KICK · ${K.push} POWER KICK · THE PIPELINE IS ON YOU`;
    else if (m.stats.ollies === 0 && m.hazards.some((o) => !o.taken && ['cone', 'pothole', 'keg'].includes(o.kind) && near(o.s, p.x) - p.x > 0.5 && near(o.s, p.x) - p.x < 9 && Math.abs(o.z - p.z) < 1))
      hint = `${K.ollie} TO OLLIE OVER IT`;
    else if (m.stats.throws === 0) hint = `${K.throw} TO AIM AT A TRASH CAN · RELEASE ON LOCK`;
    else if (m.aiming && m.stats.cansLit === 0) hint = 'RELEASE WHEN THE RING TURNS GREEN AND SAYS LOCK';
    else if (m.stats.shopVisits === 0 && m.stats.cansLit > 0 && ROW.shops.some((s) => near(s.s, p.x) - p.x > 2 && near(s.s, p.x) - p.x < 22))
      hint = `SHOP AHEAD: ${K.up} ONTO THE SIDEWALK AND ROLL THROUGH THE PAD`;
    else if (Object.keys(m.unlocked).length > 0 && m.stats.itemThrows === 0) hint = `${K.item} SWITCHES ITEMS · EACH ONE WRECKS A HOUSE ITS OWN WAY`;
    if (!hint) return;
    c.font = `800 ${view.touch ? 12 : 14}px ${FONT.ui}`;
    const w = Math.min(view.width - 24, c.measureText(hint).width + 36),
      h = view.touch ? 28 : 34,
      x = view.width / 2 - w / 2,
      y = view.touch ? view.height - view.controls - h - 8 : this.strip(view).top - h - 10;
    const pulse = 0.5 + 0.5 * Math.sin(t * 5);
    rr(c, x, y, w, h, h / 2);
    paint(c, P.ink, alpha(P.sun, 0.6 + 0.4 * pulse), 3);
    text(c, hint, view.width / 2, y + h / 2 + 1, view.touch ? 12 : 14, '#FFFFFF', { weight: 800, italic: false, family: FONT.ui });
  }
  rescue(c, m, view, t) {
    const z = m.zombie,
      a = m.ambulance;
    if (!z || !a) return;
    const target = z.state === 'waiting' ? z : a,
      label = z.state === 'waiting' ? S.hud.free : S.hud.tow,
      d = target.x - m.player.x;
    const y = view.portrait ? view.hud + 70 : view.hud + 54;
    rr(c, view.width / 2 - 130, y, 260, 34, 17);
    paint(c, P.mint, P.ink, 2.5);
    text(c, `${label}  ${Math.max(0, d).toFixed(0)} m →`, view.width / 2, y + 17, 15, P.ink, { weight: 900 });
  }
}
export { near };
