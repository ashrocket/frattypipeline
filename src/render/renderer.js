import { layout, project, depthScale, cameraLead } from '../layout.js';
import { P, skyFor, FONT } from './palette.js';
import { rr, paint, text, chrome, ellipse, poly, alpha, spring, noise, rand, darken, lighten, easeOutBack } from './draw.js';
import { Backdrop } from './backdrop.js';
import { FacadeCache, drawRot, drawRubble } from './house.js';
import { Effects, feedback } from './fx.js';
import { Hud, itemIcon } from './hud.js';
import { BonusRenderer } from './bonus.js';
import * as props from './props.js';
import { skater, bro, lookSpec, zombieSpec, recruiter, firefighter, medic, raccoon, bee, flames, figure, walkerPose, litBottle } from './characters.js';
import { ROW, LAP, Z, near, ring, objX } from '../sim/row.js';
import { STATIONS, COURSE_LENGTH } from '../sim/training.js';
import { ALLEY_LENGTH } from '../sim/alley.js';
import { railSpan } from '../sim/rails.js';
import { Bubbles } from './bubbles.js';
import { newspaper } from './newspaper.js';
import { SHOPS } from '../data/houses.js';
import { S } from '../data/strings.js';
import { TUNING as T } from '../data/tuning.js';
import { STATE } from '../sim/house.js';
const CHAR_BOOST = 1.3;
export class WorldRenderer {
  constructor(container) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-label', S.canvasLabel);
    this.canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.backdrop = new Backdrop();
    this.facades = new FacadeCache();
    this.hud = new Hud();
    this.bonus = new BonusRenderer();
    this.bubbles = new Bubbles();
    this.fx = new Effects((container.clientWidth || innerWidth) <= 900);
    this.reduced = false;
    this.scanlines = false;
    this.count = { activeCount: 0, capacity: 20 };
    this.debug = new URLSearchParams(location.search).has('debug');
    this.t = 0;
    this.lead = { x: 0, v: 0 };
    this.attract = 0;
    this.unlock = null;
    this.collapse = new Map();
    this.frameMs = 0;
    this.resize();
  }
  resize() {
    this.width = this.container.clientWidth || innerWidth;
    this.height = this.container.clientHeight || innerHeight;
    this.ratio = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * this.ratio);
    this.canvas.height = Math.round(this.height * this.ratio);
  }
  stats() {
    return {
      width: this.width,
      height: this.height,
      ratio: this.ratio,
      particles: this.fx.pool.filter((p) => p.life > 0).length,
      particleCap: this.fx.cap,
      frameMs: Math.round(this.frameMs * 100) / 100,
    };
  }
  // Row houses keep simulating in Bee Alley, where the camera is in alley meters: no x there.
  houseX(m, id, level = m.level) {
    if (level !== 'row') return null;
    return near(m.houses[id].s, this.view?.cameraX ?? m.player.x);
  }
  event(e, m) {
    if (e.type === 'unlock') this.unlock = { ...e, age: 0 };
    this.bubbles.event(e, m);
    this.hud.event?.(e, m);
    if (e.type === 'houseGone' && e.cause !== 'airlift') this.collapse.set(e.house, this.t);
    feedback(this.fx, e, {
      model: m,
      reduced: this.reduced,
      houseX: (id) => this.houseX(m, id, e.level ?? m.level),
      lapName: skyFor(m.lap).name,
    });
  }
  draw(m, dt = 1 / 60) {
    const start = performance.now();
    const c = this.ctx;
    this.t += dt;
    const t = this.t;
    c.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    this.fx.update(dt);
    if (this.unlock) {
      this.unlock.age += dt;
      if (this.unlock.age > 3.2) this.unlock = null;
    }
    // Paused keeps drawing the scene it paused (bonus, front page); main.js sets pausedFrom.
    const phase = m.phase === 'paused' ? (m.pausedFrom ?? 'paused') : m.phase;
    if (phase === 'bonus' && m.bonus) {
      this.view = layout(this.width, this.height, m, 0);
      this.bonus.draw(c, m, this.view, t);
      this.fx.drawCallout(c, this.view);
      this.drawCount(c);
      this.frameMs = performance.now() - start;
      return;
    }
    const title = m.phase === 'title';
    spring(this.lead, cameraLead(m.player.vx), 4, dt);
    let view = layout(this.width, this.height, m, this.lead.x);
    if (title) {
      this.attract += dt * 3.2;
      const left = 4 + (this.attract % (LAP - 40));
      view = { ...view, left, cameraX: left + view.playerFrac * view.viewM };
    }
    this.view = view;
    const w = view.width,
      h = view.height;
    c.fillStyle = '#DDF8FF';
    c.fillRect(0, 0, w, h);
    const tint = this.backdrop.draw(c, view, m, t, this.ratio);
    c.save();
    if (!this.reduced && this.fx.trauma > 0) {
      const amp = (view.touch ? 6 : 9) * this.fx.trauma ** 2;
      c.translate(noise(t * 23) * amp, noise(t * 29 + 7) * amp * 0.7);
      c.rotate(noise(t * 17 + 3) * 0.006 * this.fx.trauma);
    }
    const pr = (x, z, y = 0) => project(view, x, z, y);
    const x0 = view.left - 14,
      x1 = view.left + view.viewM + 14;
    const lots = [],
      level = title ? 'row' : m.level;
    if (level === 'row') {
      for (const h2 of m.houses) {
        const hx = near(h2.s, view.cameraX);
        if (hx > x0 - 6 && hx < x1 + 6) lots.push({ kind: 'house', h: h2, x: hx });
      }
      ROW.shops.forEach((s, i) => {
        const sx = near(s.s, view.cameraX);
        if (sx > x0 && sx < x1) lots.push({ kind: 'shop', shop: SHOPS[i], index: i, x: sx });
      });
    }
    if (level === 'training') this.courseGround(c, view, m, t);
    else if (level === 'alley') this.alleyGround(c, view, m, t);
    else this.ground(c, view, m, lots, t);
    // Facades and side-yard trees (the back layer of the playfield)
    for (const lot of lots) {
      if (lot.kind === 'house') this.house(c, view, m, lot.h, lot.x, t);
      else this.shop(c, view, m, lot, t);
    }
    const sprites = [];
    const add = (x, z, draw, y = 0) => sprites.push({ x, z, y, draw });
    for (const lot of lots) if (lot.kind === 'house') this.houseActors(view, m, lot.h, lot.x, t, add);
    if (level === 'training') this.courseActors(view, m, t, add);
    else if (level === 'alley') this.alleyActors(view, m, t, add);
    this.streetActors(view, m, t, add, level);
    if (!title) this.playerActors(view, m, t, add);
    else this.attractActor(view, m, t, add);
    sprites.sort((a, b) => a.z - b.z || a.y - b.y);
    for (const s of sprites) s.draw(c);
    if (!title) {
      this.projectiles(c, view, m, t);
      if (m.aiming && ['playing', 'rescue', 'training'].includes(m.phase) && m.level !== 'alley') this.reticle(c, view, m, t);
    }
    this.fx.draw(c, pr, view.S, this.reduced);
    if (this.debug) this.debugDraw(c, view, m);
    c.restore();
    if (tint) {
      c.fillStyle = tint;
      c.fillRect(0, 0, w, h);
    }
    if (!title && m.level === 'row') this.dangerVignette(c, view, m, t);
    if (phase === 'captured') {
      c.fillStyle = `rgba(232,220,196,${Math.min(0.35, m.phaseTime * 0.3)})`;
      c.fillRect(0, 0, w, h);
    }
    if (this.fx.flash > 0) {
      if (this.reduced) {
        c.strokeStyle = this.fx.flashColor;
        c.lineWidth = 6;
        c.strokeRect(3, 3, w - 6, h - 6);
      } else {
        c.fillStyle = alpha(this.fx.flashColor.startsWith('#') ? this.fx.flashColor : '#FFFFFF', this.fx.flash);
        c.fillRect(0, 0, w, h);
      }
    }
    if (!title) {
      // One teacher at a time: the coach line stays quiet while a hero bubble talks.
      this.hud.quiet = Boolean(this.bubbles.current);
      this.hud.draw(c, m, view, dt, this.count, t);
      this.bubbles.draw(c, view, m, t, dt);
      this.fx.drawCallout(c, view);
      if (this.unlock) this.unlockCard(c, view, m, t);
      if (phase === 'resume') this.resumeCard(c, view, m, t);
      if (phase === 'newspaper' && m.newspaper) newspaper(c, view, m, t);
    }
    if (this.scanlines && !this.reduced) {
      c.fillStyle = 'rgba(42,30,79,0.045)';
      for (let y = 0; y < h; y += 3) c.fillRect(0, y, w, 1);
    }
    this.frameMs = performance.now() - start;
  }
  drawCount(c) {
    const v = this.view;
    const str = `${this.count.activeCount} / ${this.count.capacity} ${S.hud.playing}`;
    c.font = `800 12px ${FONT.ui}`;
    const w = c.measureText(str).width + 24;
    rr(c, v.width - w - 12, 12, w, 26, 13);
    paint(c, 'rgba(255,255,255,0.9)', P.cyan, 2);
    text(c, str, v.width - 12 - w / 2, 25, 12, P.inkSoft, { weight: 800, italic: false, family: FONT.ui });
  }
  ground(c, view, m, lots, t) {
    const S2 = view.S,
      X = (x) => (x - view.left) * S2,
      Y = (z) => view.groundTop + (z - Z.facade) * view.Dz;
    const w = view.width;
    // Lawn band across the screen, then per-lot surfaces.
    c.fillStyle = P.lawn;
    c.fillRect(0, Y(Z.facade) - 2, w, Y(Z.walkBack) - Y(Z.facade) + 2);
    const stripe = 1.5;
    c.fillStyle = P.lawnStripe;
    for (let x = Math.floor(view.left / stripe) * stripe; x < view.left + view.viewM + stripe; x += stripe)
      if (Math.floor(x / stripe) % 2 === 0) c.fillRect(X(x), Y(Z.facade), stripe * S2 + 0.5, Y(Z.walkBack) - Y(Z.facade));
    for (const lot of lots) {
      if (lot.kind === 'shop') {
        // Paved plaza in front of the storefront
        c.fillStyle = '#EDE4FA';
        c.fillRect(X(lot.x - 5), Y(Z.facade), 10 * S2, Y(Z.walkBack) - Y(Z.facade));
        c.strokeStyle = P.joint;
        c.lineWidth = 1;
        for (let x = lot.x - 5; x <= lot.x + 5; x += 1) {
          c.beginPath();
          c.moveTo(X(x), Y(Z.facade));
          c.lineTo(X(x), Y(Z.walkBack));
          c.stroke();
        }
      } else {
        const h = lot.h;
        if (!h.gone) {
          // Walkway from the porch to the sidewalk
          const dx = lot.x + h.facade.door.dx;
          c.fillStyle = '#F7EEDF';
          c.fillRect(X(dx - 0.75), Y(Z.porch), 1.5 * S2, Y(Z.walkBack) - Y(Z.porch));
          c.strokeStyle = '#E2D3BE';
          c.lineWidth = 1;
          for (let z = Z.porch; z < Z.walkBack; z += 0.6) {
            c.beginPath();
            c.moveTo(X(dx - 0.75), Y(z));
            c.lineTo(X(dx + 0.75), Y(z));
            c.stroke();
          }
        } else {
          c.fillStyle = 'rgba(181,167,122,0.35)';
          c.fillRect(X(lot.x - 7), Y(Z.facade), 14 * S2, Y(Z.lawnBack) - Y(Z.facade) + 8);
        }
      }
    }
    // Sidewalk, curb, street, far side
    c.fillStyle = P.sidewalk;
    c.fillRect(0, Y(Z.walkBack), w, Y(Z.curb) - Y(Z.walkBack));
    c.fillStyle = P.joint;
    for (let x = Math.floor(view.left / 1.5) * 1.5; x < view.left + view.viewM + 1.5; x += 1.5)
      c.fillRect(X(x), Y(Z.walkBack), 1.5, Y(Z.curb) - Y(Z.walkBack));
    c.fillStyle = P.curb;
    c.fillRect(0, Y(Z.curb) - 3, w, 4);
    c.fillStyle = P.curbShade;
    c.fillRect(0, Y(Z.curb) + 1, w, Math.max(3, view.Dz * 0.18));
    const g = c.createLinearGradient(0, Y(Z.curb), 0, Y(Z.streetNear));
    g.addColorStop(0, '#928DC6');
    g.addColorStop(1, P.streetLight);
    c.fillStyle = g;
    c.fillRect(0, Y(Z.curb) + 1 + Math.max(3, view.Dz * 0.18), w, Y(Z.streetNear) - Y(Z.curb));
    c.fillStyle = P.laneDash;
    for (let x = Math.floor(view.left / 3) * 3; x < view.left + view.viewM + 3; x += 3)
      c.fillRect(X(x), Y(0.4) - 2, 1.6 * S2, 4);
    c.fillStyle = 'rgba(255,255,255,0.75)';
    for (let x = Math.floor(view.left / 3) * 3; x < view.left + view.viewM + 3; x += 3) c.fillRect(X(x), Y(-1.9) - 1, 0.8 * S2, 2);
    c.fillStyle = P.curb;
    c.fillRect(0, Y(Z.streetNear), w, Y(Z.farWalk) - Y(Z.streetNear));
    c.fillStyle = P.sidewalk;
    c.fillRect(0, Y(Z.farWalk), w, view.height - Y(Z.farWalk));
    c.fillStyle = P.joint;
    for (let x = Math.floor(view.left / 1.5) * 1.5; x < view.left + view.viewM + 1.5; x += 1.5)
      c.fillRect(X(x), Y(Z.farWalk), 1.5, view.height);
    // Crosswalk at the corner and start line
    const corner = near(LAP - 8, view.cameraX);
    if (corner > view.left - 6 && corner < view.left + view.viewM + 6) {
      c.fillStyle = '#FFFFFF';
      for (let z = Z.curb + 0.3; z < Z.streetNear - 0.2; z += 0.9) c.fillRect(X(corner - 1.5), Y(z), 3 * S2, Math.max(4, view.Dz * 0.45));
    }
    const startLine = near(6, view.cameraX);
    if (startLine > view.left - 3 && startLine < view.left + view.viewM + 3) {
      for (let i = 0; i < 12; i++) {
        c.fillStyle = i % 2 ? '#FFFFFF' : P.ink;
        c.fillRect(X(startLine), Y(Z.curb + (i * 5.6) / 12), 0.5 * S2, (5.6 / 12) * view.Dz + 1);
      }
    }
    // Shop pads on the sidewalk
    for (const lot of lots)
      if (lot.kind === 'shop') {
        const active = m.shopVisits[lot.index] !== m.lap;
        props.shopPad(c, X(lot.x - 4), X(lot.x + 4), Y(Z.walkBack) + 2, Y(Z.walkFront), t, lot.shop.color, active);
        if (active && view.S > 20)
          text(c, S.objects.shopPad, X(lot.x), Y(Z.walkFront) + 12, Math.max(9, view.S * 0.22), P.ink, { weight: 900, stroke: '#FFFFFF', strokeWidth: 3 });
      }
    // Curbs are grindable: they light up while you're in the air near them.
    const p = m.player;
    if (!p.grounded && !p.grind && m.phase !== 'title')
      for (const r of m.rails) {
        if (r.kind !== 'curb' || Math.abs(p.z - r.z) > 1.4) continue;
        const [a, b] = railSpan(m, r);
        if (b < view.left || a > view.left + view.viewM) continue;
        props.railGlow(c, view.S, X(a), X(b), Y(Z.curb) - 3, 0.5 + 0.3 * Math.sin(t * 12));
      }
    // Ground decals: potholes and ramps sit flat on the street.
    for (const o of m.hazards) {
      if (o.taken || o.kind !== 'pothole') continue;
      const ox = objX(o, view.cameraX);
      if (ox < view.left - 2 || ox > view.left + view.viewM + 2) continue;
      c.save();
      c.translate(X(ox), Y(o.z));
      c.scale(1, view.Dz / (view.S * 0.45));
      props.pothole(c, view.S);
      c.restore();
    }
  }
  house(c, view, m, h, hx, t) {
    const X = (x) => (x - view.left) * view.S,
      base = view.groundTop,
      k = view.S;
    // Side-yard trees between lots
    for (const side of [-1, 1]) {
      const tx = hx + side * 8.2;
      c.save();
      c.translate(X(tx), base - 0.1 * k);
      props.tree(c, k * 0.95, t, h.id * 2 + side, side < 0 ? P.hedge : '#46BC72');
      c.restore();
    }
    // Party lights from the porch corner out to a tree (every other house).
    if (!h.gone && h.id % 2 === 0 && !h.empty) props.stringLights(c, X(hx + h.facade.width / 2 - 0.3), base - 3.1 * k, X(hx + 8.2), base - 3 * k, k, t);
    if (h.gone) {
      c.save();
      c.translate(X(hx), base);
      drawRubble(c, h, k, t);
      c.restore();
      // Collapse: the last facade folds down into the rubble over 0.7 s.
      const since = this.t - (this.collapse.get(h.id) ?? -9);
      if (since < 0.7) {
        const f = since / 0.7,
          entry = this.facades.get({ ...h, gone: false, state: STATE.reallyHarmed }, k, view.Dz, this.ratio);
        c.save();
        c.translate(X(hx), base);
        c.globalAlpha = 1 - f * f;
        c.rotate(Math.sin(h.id * 3) * 0.12 * f);
        c.scale(1 + f * 0.08, 1 - f * 0.85);
        c.drawImage(entry.canvas, -entry.ox, -entry.oy, entry.w, entry.h);
        c.restore();
      }
      return;
    }
    const entry = this.facades.get(h, k, view.Dz, this.ratio);
    let lift = 0,
      sway = 0;
    if (h.lifting) {
      lift = h.lift * h.lift * 10 * k;
      sway = Math.sin(t * 2) * 0.04 * h.lift;
      c.fillStyle = '#E2D9F2';
      c.fillRect(X(hx - h.facade.width / 2), base - 4, h.facade.width * k, 8);
    }
    c.save();
    c.translate(X(hx), base - lift);
    c.rotate(sway);
    if (h.state >= STATE.reallyHarmed && !h.lifting) c.rotate(Math.sin(h.id) * 0.012);
    c.drawImage(entry.canvas, -entry.ox, -entry.oy, entry.w, entry.h);
    if (h.empty || h.rotting) drawRot(c, h, k, t);
    // Fire pours out of windows and then the roof.
    if (h.fire > 0) {
      c.save();
      const n = Math.max(1, Math.ceil(h.fire * h.facade.windows.length));
      const lit = h.facade.windows.slice(0, n);
      c.globalCompositeOperation = 'lighter';
      for (const win of lit) {
        const gx = win.dx * k,
          gy = -win.y * k,
          g = c.createRadialGradient(gx, gy, 0, gx, gy, win.w * k * 1.6);
        g.addColorStop(0, 'rgba(255,170,60,0.35)');
        g.addColorStop(1, 'rgba(255,120,80,0)');
        c.fillStyle = g;
        c.fillRect(gx - win.w * k * 1.6, gy - win.w * k * 1.6, win.w * k * 3.2, win.w * k * 3.2);
      }
      c.globalCompositeOperation = 'source-over';
      lit.forEach((win, i) => {
        flames(c, win.dx * k, -(win.y + win.h / 2 - 0.1) * k, win.w * k * 1.1, (0.8 + h.fire * 1.6) * k, t, h.id * 3 + i);
      });
      if (h.fire > 0.55) flames(c, 0, -h.facade.roofY * k, h.facade.width * k * 0.8, h.fire * 3.2 * k, t, h.id);
      c.restore();
      if (Math.random() < h.fire * 0.5)
        this.fx.spawn('smoke', hx + (Math.random() - 0.5) * h.facade.width * 0.7, -11.2, h.facade.peak + Math.random(), { vx: 0.4, vz: 0, vy: 1.2, size: 0.5 + h.fire * 0.6, life: 2.4, grow: 0.8, color: P.smoke, drag: 0.2 });
    }
    // Balloon bundles tied to the roof.
    const bundles = h.lifting ? Math.max(3, h.balloons) : h.balloons;
    for (let i = 0; i < bundles; i++) {
      c.save();
      c.translate(((i + 0.5) / bundles - 0.5) * h.facade.width * 0.7 * k, -h.facade.roofY * k);
      props.balloonBundle(c, k * 0.9, t + i, 5, 1.6 + (h.lifting ? h.lift : 0));
      c.restore();
    }
    c.restore();
    if (h.bees > 0) {
      const cx = X(hx),
        cy = base - h.facade.eave * 0.6 * k;
      for (let i = 0; i < 26; i++) {
        const a = t * (1.5 + (i % 5) * 0.3) + i;
        bee(c, cx + Math.sin(a * 1.3) * h.facade.width * 0.45 * k, cy + Math.cos(a * 1.9 + i) * h.facade.eave * 0.45 * k, Math.max(2, k * 0.08), t);
      }
    }
  }
  shop(c, view, m, lot, t) {
    c.save();
    c.translate((lot.x - view.left) * view.S, view.groundTop);
    props.storefront(c, view.S, lot.shop, t, Boolean(m.unlocked[lot.shop.kind]));
    c.restore();
  }
  houseActors(view, m, h, hx, t, add) {
    const k = view.S;
    const at = (dx, z, y = 0) => project(view, hx + dx, z, y);
    // Hedge row along the front of the lawn with a gap for the walkway.
    if (!h.gone)
      for (const dx of [-7.2, -5.2, -3.2, 3.2, 5.2, 7.2]) {
        if (Math.abs(dx - h.facade.door.dx) < 1.4) continue;
        add(hx + dx, Z.lawnFront + 0.1, (c) => {
          const p = at(dx, Z.lawnFront + 0.1);
          c.save();
          c.translate(p.x, p.y);
          props.shrub(c, k * 0.95 * depthScale(Z.lawnFront), dx % 2 ? P.hedge : '#46BC72');
          c.restore();
        });
      }
    // Party dressing on the lawn: two seeded props per house, kept clear of the walkway.
    if (!h.gone)
      for (let i = 0; i < 2; i++) {
        const kind = Math.floor(rand(h.id * 7.3 + i * 3.1) * 4),
          side = (i === 0 ? -1 : 1) * (h.facade.door.dx > 0 ? -1 : 1),
          dx = side * (4.2 + rand(h.id + i) * 2),
          z = -8.6 + rand(h.id * 3 + i) * 1.6;
        if (Math.abs(dx - h.facade.door.dx) < 1.6 || Math.abs(dx - h.can.dx) < 1.4) continue;
        add(hx + dx, z, (c) => {
          const q = at(dx, z),
            kk = k * depthScale(z);
          c.save();
          c.translate(q.x, q.y);
          if (kind === 0) props.kiddiePool(c, kk, t);
          else if (kind === 1) props.pongTable(c, kk);
          else if (kind === 2)
            for (const f of [-0.5, 0, 0.5]) {
              c.save();
              c.translate(f * kk, 0);
              props.flamingo(c, kk, t, f * 3 + h.id);
              c.restore();
            }
          else props.cornhole(c, kk);
          c.restore();
        });
      }
    if (!h.gone && h.can.state !== 'gone') {
      const target = m.aiming && m.item === 'bottle' && this.aimHouse === h.id;
      add(hx + h.can.dx, h.can.z, (c) => {
        const p = at(h.can.dx, h.can.z);
        c.save();
        c.translate(p.x, p.y);
        const glow = h.can.state === 'ready' && m.item === 'bottle' ? (target ? 1 : 0.35 + 0.25 * Math.sin(t * 4 + h.id)) : 0;
        props.trashCan(c, k * depthScale(h.can.z) * 1.05, h.can.state, t, glow);
        if (h.comeBack) {
          c.rotate(-0.08);
          rr(c, -0.55 * k, -1.65 * k, 1.1 * k, 0.42 * k, 0.06 * k);
          paint(c, '#FFF3A0', P.ink, 1.5);
          text(c, '↻ COME BACK', 0, -1.44 * k, Math.max(8, k * 0.17), P.ink, { weight: 900, italic: false });
        }
        c.restore();
      });
    }
    if (h.couch && !h.gone) {
      const dx = h.can.dx > 0 ? -4.6 : 4.6,
        z = -7.9;
      add(hx + dx, z, (c) => {
        const p = at(dx, z);
        c.save();
        c.translate(p.x, p.y);
        props.couch(c, k * depthScale(z), t, true);
        c.restore();
      });
    }
    if (h.sub)
      add(hx + h.sub.dx, h.sub.z, (c) => {
        const p = at(h.sub.dx, h.sub.z);
        c.save();
        c.translate(p.x, p.y);
        props.subwoofer(c, k * depthScale(h.sub.z), t, m.beat);
        c.restore();
      });
    if (h.fryer)
      add(hx + h.fryer.dx, h.fryer.z, (c) => {
        const p = at(h.fryer.dx, h.fryer.z);
        c.save();
        c.translate(p.x, p.y);
        props.fryer(c, k * depthScale(h.fryer.z), t, true);
        c.restore();
      });
    if (h.raccoons) {
      const prog = h.can.state === 'burning' ? Math.min(1, h.raccoons.t / T.raccoonDelay) : 0;
      for (let i = 0; i < 3; i++) {
        const dx0 = h.can.dx + (i - 1) * 0.6,
          z0 = h.can.z + 0.35;
        const dx = dx0 + (h.facade.door.dx - dx0) * prog,
          z = z0 + (Z.porch - z0) * prog;
        add(hx + dx, z, (c) => {
          const p = at(dx, z);
          c.save();
          c.translate(p.x, p.y);
          if (prog > 0 && h.can.dx > h.facade.door.dx) c.scale(-1, 1);
          raccoon(c, k * 0.16 * depthScale(z), t, i * 2.1);
          if (prog > 0) flames(c, 0.2 * k, -0.55 * k, 0.3 * k, 0.5 * k, t, i);
          c.restore();
        });
      }
    }
    if (h.fd) {
      const fd = h.fd,
        z = -2.1;
      const tx = fd.stage === 'coming' ? hx + 30 * Math.max(0, fd.t / T.fdDelay) : fd.stage === 'leaving' && fd.t < 1 ? hx - (1 - fd.t) * 20 : hx;
      add(tx, z, (c) => {
        const p = project(view, tx, z);
        c.save();
        c.translate(p.x, p.y);
        props.fireTruck(c, k * depthScale(z), t, fd.stage);
        c.restore();
        if (fd.stage === 'spraying') {
          for (const dx of [-2.2, 1.4]) {
            const q = project(view, hx + dx, -3.6);
            c.save();
            c.translate(q.x, q.y);
            firefighter(c, k * 0.16 * CHAR_BOOST, t, true, 1);
            c.restore();
            if (Math.random() < 0.6) this.fx.spawn('water', hx + dx + 0.5, -3.8, 1.4, { vx: (Math.random() - 0.3) * 1.5, vz: -3.5, vy: 4, size: 0.12, grav: 0.8, life: 0.9, drag: 0.1 });
          }
        }
      });
    }
    for (const b of h.bros) {
      if (b.state === 'away' || b.state === 'inside') continue;
      if (h.lifting && b.state !== 'flee') continue;
      add(hx + b.dx, b.z, (c) => {
        const p = at(b.dx, b.z),
          u = k * 0.18 * CHAR_BOOST * depthScale(b.z);
        c.save();
        ellipse(c, p.x, p.y, u * 1.8, u * 0.55);
        c.fillStyle = 'rgba(42,30,79,0.2)';
        c.fill();
        c.translate(p.x, p.y);
        bro(c, b, u, t);
        if (b.state === 'burning' || b.fleeBurning > 0) {
          flames(c, 0, (b.mode === 'roll' ? -1.4 : -5.5) * u, 3.4 * u, 7 * u, t, b.id);
          if (Math.random() < 0.3) this.fx.spawn('ember', hx + b.dx, b.z, 1.6, { vx: (Math.random() - 0.5), vy: 1.5, size: 0.05, color: P.sun, life: 0.6, grav: -0.2 });
        }
        if (b.state === 'spray' && b.spraying === true) {
          c.save();
          c.scale(b.facing ?? 1, 1);
          c.fillStyle = 'rgba(255,255,255,0.8)';
          for (let i = 0; i < 6; i++) {
            const d = ((t * 4 + i / 6) % 1) * 2.2;
            ellipse(c, (2.4 + d * 1.6) * u * 3, (-6 + d * 0.8) * u, (0.6 + d) * u, (0.5 + d * 0.8) * u);
            c.fill();
          }
          c.restore();
        }
        if (b.state === 'charred' && Math.random() < 0.05) this.fx.spawn('smoke', hx + b.dx, b.z, 2, { vx: 0, vz: 0, vy: 0.8, size: 0.15, life: 1, grow: 0.3, color: P.smoke });
        c.restore();
      });
    }
  }
  streetActors(view, m, t, add, level = 'row') {
    const k = view.S,
      p = m.player;
    // Grindable things glow while you're in the air above them (it teaches the grind).
    const glowFor = (x0, x1, z) => (!p.grounded && !p.grind && p.vy < 2 && p.x > x0 - 2 && p.x < x1 && Math.abs(p.z - z) < 1.2 ? 0.55 + 0.35 * Math.sin(t * 12) : 0);
    for (const o of m.hazards) {
      if (o.taken || o.kind === 'pothole') continue;
      const ox = objX(o, view.cameraX);
      if (ox + (o.hx ?? 0) < view.left - 3 || ox - (o.hx ?? 0) > view.left + view.viewM + 3) continue;
      add(ox, o.z, (c) => {
        const q = project(view, ox, o.z),
          kk = k * depthScale(o.z);
        c.save();
        c.translate(q.x, q.y);
        if (o.kind === 'cone') props.cone(c, kk);
        else if (o.kind === 'keg') props.keg(c, kk, t, o.rolling);
        else if (o.kind === 'ramp') props.ramp(c, kk);
        else if (o.kind === 'crate') props.crate(c, kk, t);
        else if (o.kind === 'gnome') props.gnome(c, kk, t);
        else if (o.kind === 'flatbar') props.flatbar(c, kk, o.hx * 2, level === 'alley' ? 'ledge' : 'rail', glowFor(ox - o.hx, ox + o.hx, o.z));
        c.restore();
      });
    }
    for (const r of m.rails) {
      if (r.kind !== 'bench') continue;
      // Mapped by the camera like the houses (the title attract camera sweeps away from player.x).
      const x0 = r.abs ? r.s0 : near(r.s0, view.cameraX),
        x1 = x0 + (r.s1 - r.s0),
        cx = (x0 + x1) / 2;
      if (x1 < view.left - 3 || x0 > view.left + view.viewM + 3) continue;
      add(cx, r.z, (c) => {
        const q = project(view, cx, r.z);
        c.save();
        c.translate(q.x, q.y);
        props.bench(c, k * depthScale(r.z), x1 - x0, glowFor(x0, x1, r.z));
        c.restore();
      });
    }
    if (level !== 'row') return;
    for (const cart of m.carts)
      add(cart.x, cart.z, (c) => {
        const p = project(view, cart.x, cart.z);
        c.save();
        c.translate(p.x, p.y);
        props.golfCart(c, k * depthScale(cart.z), t);
        c.restore();
      });
    // Welcome billboard on the intro lot; a lap sign on the corner lot.
    for (const [s, args] of [[7, []], [LAP - 9, ['GREEK ROW', 'GO AROUND', 'EVERY LAP GETS LATER']]]) {
      const x = near(s, view.cameraX);
      if (x < view.left - 4 || x > view.left + view.viewM + 4) continue;
      add(x, -8.6, (c) => {
        const p = project(view, x, -8.6);
        c.save();
        c.translate(p.x, p.y);
        props.welcomeSign(c, k * depthScale(-8.6), t, ...args);
        c.restore();
      });
    }
    // Street furniture every few lots
    for (let s = 20; s < LAP; s += 37) {
      const x = near(s, view.cameraX);
      // The lamp and its hydrant 12 m on are culled separately.
      if (x + 12 < view.left - 2 || x > view.left + view.viewM + 2) continue;
      if (ROW.shops.some((shop) => Math.abs(near(shop.s, x) - x) < 7)) continue;
      if (x > view.left - 2)
        add(x, -4.5, (c) => {
          const p = project(view, x, -4.5);
          c.save();
          c.translate(p.x, p.y);
          props.lampPost(c, k * depthScale(-4.5), t);
          c.restore();
        });
      if (x + 12 < view.left + view.viewM + 2)
        add(x + 12, -4.45, (c) => {
          const p = project(view, x + 12, -4.45);
          c.save();
          c.translate(p.x, p.y);
          props.hydrant(c, k * depthScale(-4.45));
          c.restore();
        });
    }
  }
  playerActors(view, m, t, add) {
    const k = view.S,
      p = m.player;
    const u = (z) => k * 0.18 * CHAR_BOOST * depthScale(z);
    const crew = m.crew[p.crew] ?? m.crew[0];
    if (m.zombie && m.phase !== 'captured') {
      const z = m.zombie;
      if (z.state !== 'saved' || m.phase === 'rescue')
        add(z.x, z.z, (c) => {
          const q = project(view, z.x, z.z);
          c.save();
          c.translate(q.x, q.y);
          const spec = zombieSpec(lookSpec(m.crew[z.crew] ?? m.crew[0], u(z.z)), u(z.z));
          if (z.state === 'towed') skater(c, { ...spec, board: { deck: '#CDBB8E', stripe: '#1F2A44' } }, { mode: 'cruise', time: t, speed: 0.4, face: { dead: true } });
          else figure(c, { ...spec, pose: walkerPose({ mode: 'shamble', time: t, rate: 1 }) });
          if (z.state === 'waiting') {
            text(c, '!', 0, -12.5 * u(z.z), Math.max(16, k * 0.5), P.ink, { stroke: P.mint, strokeWidth: 5, weight: 900 });
            c.strokeStyle = '#1F2A44';
            c.lineWidth = 3;
            c.setLineDash([6, 5]);
            c.beginPath();
            c.moveTo(-1 * u(z.z), -6 * u(z.z));
            c.lineTo(-6 * u(z.z), -1 * u(z.z));
            c.stroke();
            c.setLineDash([]);
          }
          c.restore();
        });
    }
    if (m.ambulance)
      add(m.ambulance.x, m.ambulance.z, (c) => {
        const a = m.ambulance,
          q = project(view, a.x, a.z);
        c.save();
        c.translate(q.x, q.y);
        props.ambulance(c, k * depthScale(a.z), t, true);
        c.translate(-3.6 * k, 0);
        medic(c, u(a.z), t);
        c.restore();
      });
    // The Pipeline horde: drawn when it is close enough to be on screen.
    const hx = p.x - Math.max(0, m.horde.gap);
    if (hx > view.left - 3 && m.level === 'row' && ['playing', 'rescue', 'captured'].includes(m.phase)) {
      for (let i = 0; i < 7; i++) {
        const z = Math.max(T.zMin, Math.min(T.zMax, p.z + (i - 3) * 1.1)),
          x = hx - 0.4 - (i % 3) * 0.7 - rand(i) * 0.5 + (m.phase === 'captured' ? Math.max(0, 1 - m.phaseTime) * 0 : 0);
        add(x, z, (c) => {
          const q = project(view, x, z);
          c.save();
          c.translate(q.x, q.y);
          recruiter(c, u(z), t, i);
          c.restore();
        });
      }
      add(hx - 1.2, p.z - 0.01, (c) => {
        const q = project(view, hx - 1.2, p.z, 3.8);
        c.save();
        c.translate(q.x, q.y);
        c.rotate(-0.06 + Math.sin(t * 3) * 0.04);
        rr(c, -1.3 * k, -0.45 * k, 2.6 * k, 0.9 * k, 0.1 * k);
        paint(c, '#E8DCC4', P.ink, 2);
        text(c, 'WE’RE HIRING', 0, 0, Math.max(9, k * 0.3), '#1F2A44', { weight: 900 });
        c.restore();
      });
    }
    if (m.phase === 'continue' || m.phase === 'lost') return;
    add(p.x, p.z, (c) => {
      const q = project(view, p.x, p.z, p.y),
        g = project(view, p.x, p.z),
        uu = u(p.z);
      ellipse(c, g.x, g.y, uu * (2.6 - Math.min(1.2, p.y * 0.6)), uu * 0.6);
      c.fillStyle = 'rgba(42,30,79,0.22)';
      c.fill();
      c.save();
      c.translate(q.x, q.y);
      const blink = p.invulnerable > 0 && Math.floor(t * 14) % 2 === 0;
      if (blink) c.globalAlpha = 0.45;
      let spec = lookSpec(crew, uu);
      if (m.phase === 'captured') {
        const turn = Math.min(1, m.phaseTime / (T.captureTime * 0.7));
        if (turn >= 0.5) spec = zombieSpec(spec, uu);
        c.rotate(Math.sin(t * 30) * 0.08 * (1 - turn));
      }
      const grind = p.grind?.rail.kind,
        lit = m.aiming && m.item === 'bottle' && ['playing', 'rescue', 'training'].includes(m.phase);
      const mode =
        p.wipeout > 0 ? 'wipeout'
        : p.grind ? (grind === 'rail' ? 'slide' : 'grind')
        : !p.grounded ? 'air'
        : p.stumble > 0 ? 'stumble'
        : p.sliding ? 'slide'
        : p.dragging ? 'drag'
        : p.pushAge < 0.32 || p.kickAge < 0.36 ? 'push'
        : m.aiming ? 'crouch'
        : 'cruise';
      const state = {
        mode,
        phase: p.pushAge < 0.32 ? p.pushAge / 0.32 : p.kickAge / 0.36,
        time: t,
        speed: Math.min(1.4, p.vx / 6),
        throw: p.release > 0 ? 'release' : m.aiming ? 'wind' : null,
        tow: p.towing,
        flip: p.flip ? { name: p.flip.name, f: p.flip.t / p.flip.dur } : null,
        tuck: !p.grounded && !p.grind && Math.abs(p.rot) > 0.35,
        grab: p.grab > 0,
        handItem: lit ? litBottle(t, Math.max(0, 0.25 - (m.time - m.litAt)) * 4) : undefined,
        boardTilt: p.grind ? { curb: -0.22, bench: 0, ledge: 0.18 }[grind] ?? 0 : !p.grounded ? Math.max(-0.35, Math.min(0.35, -p.vy * 0.04)) : 0,
        spin: p.wipeout > 0 ? (1 - p.wipeout / T.wipeout) * 1.4 : 0,
        boardX: 3 + (1 - p.wipeout / T.wipeout) * 3,
        boardSpin: (1 - p.wipeout / T.wipeout) * 8,
        squash: p.landingLag > 0 ? 0.08 : 0,
        face: m.phase === 'captured' ? { dead: true } : m.horde.gap < T.hordeWarn ? { panic: true, brows: true } : undefined,
      };
      c.rotate(Math.max(-0.12, Math.min(0.12, p.vz * 0.025 + (p.vx - T.roll) * 0.006)));
      // Backflips turn the whole rider around the hips.
      if (!p.grounded && !p.grind && p.rot) {
        c.translate(0, -3.6 * uu);
        c.rotate(p.rot);
        c.translate(0, 3.6 * uu);
      }
      // FLOW: a shield bubble that smashes through things.
      if (m.flowTime > 0) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 9),
          fade = Math.min(1, m.flowTime / 1.2);
        c.save();
        c.globalAlpha = fade * (0.35 + 0.2 * pulse);
        const g = c.createRadialGradient(0, -5 * uu, uu, 0, -5 * uu, 7.5 * uu);
        g.addColorStop(0, 'rgba(61,242,168,0)');
        g.addColorStop(0.75, 'rgba(61,242,168,0.35)');
        g.addColorStop(1, 'rgba(31,229,255,0.9)');
        c.fillStyle = g;
        ellipse(c, 0, -5 * uu, 6.4 * uu, 7.2 * uu);
        c.fill();
        c.restore();
      }
      skater(c, spec, state);
      c.restore();
      if (!this.reduced && (p.grind || p.sliding) && Math.random() < 0.8)
        this.fx.spawn('spark', p.x - 0.3, p.z, p.y + 0.05, { vx: -2 - Math.random() * 2, vz: (Math.random() - 0.5) * 0.6, vy: 0.8 + Math.random() * 1.5, size: 0.05, color: p.grind ? P.sun : '#FFFFFF', life: 0.3, grav: 1 });
      if (!this.reduced && (p.sliding || p.dragging) && Math.random() < 0.35)
        this.fx.spawn('dust', p.x - 0.8, p.z, 0.05, { vx: -1, vz: 0, vy: 0.2, size: 0.18, color: '#EDE6FA', life: 0.45, grow: 0.5 });
      // Speed lines when pushing fast (and all through FLOW)
      if ((p.vx > T.cruise + 0.5 || m.flowTime > 0) && !this.reduced) {
        c.strokeStyle = 'rgba(255,255,255,0.8)';
        c.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const yy = q.y - (2 + i * 2) * uu,
            len = Math.max(0, p.vx - T.cruise) * 10 + 10;
          const off = ((t * 300 + i * 37) % 60) + 20;
          c.beginPath();
          c.moveTo(q.x - off - len, yy);
          c.lineTo(q.x - off, yy);
          c.stroke();
        }
      }
    });
  }
  // ----- Skate school: a plaza on the campus quad --------------------------------
  courseGround(c, view, m, t) {
    const k = view.S,
      X = (x) => (x - view.left) * k,
      Y = (z) => view.groundTop + (z - Z.facade) * view.Dz,
      w = view.width,
      campus = m.campus;
    // Campus halls set back across the quad: smaller, slower (parallax), trees in front.
    const depth = 0.6,
      back = view.left * 0.82;
    for (let s = Math.floor((back - 30) / 40) * 40; s < back + view.viewM / depth + 30; s += 40) hall(c, (s + 20 - back) * k * depth, view.groundTop - 0.6 * k, k * depth, campus, s / 40);
    for (let s = Math.floor((view.left * 0.9 - 8) / 7) * 7; s < view.left * 0.9 + view.viewM + 8; s += 7) {
      c.save();
      c.translate((s - view.left * 0.9) * k, view.groundTop + 0.1 * k);
      props.tree(c, k * 0.7, t, s * 0.37, Math.floor(s / 7) % 2 ? P.hedge : '#46BC72');
      c.restore();
    }
    c.fillStyle = P.lawn;
    c.fillRect(0, Y(Z.facade) - 2, w, Y(Z.walkBack) - Y(Z.facade) + 2);
    c.fillStyle = alpha(P.lawnStripe, 0.6);
    for (let x = Math.floor(view.left / 3) * 3; x < view.left + view.viewM + 3; x += 3)
      if (Math.floor(x / 3) % 2 === 0) c.fillRect(X(x), Y(Z.facade), 3 * k + 0.5, Y(Z.walkBack) - Y(Z.facade));
    // The plaza: big pale pavers, the lane line, and a painted band per station.
    const top = Y(Z.walkBack),
      bottom = Y(Z.streetNear);
    c.fillStyle = '#F4EEFF';
    c.fillRect(0, top, w, bottom - top);
    c.strokeStyle = P.joint;
    c.lineWidth = 1;
    c.beginPath();
    for (let x = Math.floor(view.left / 2) * 2; x < view.left + view.viewM + 2; x += 2) {
      c.moveTo(X(x), top);
      c.lineTo(X(x), bottom);
    }
    for (let z = Z.walkBack; z < Z.streetNear; z += 1.4) {
      c.moveTo(0, Y(z));
      c.lineTo(w, Y(z));
    }
    c.stroke();
    STATIONS.forEach((st, i) => {
      if (st.x1 < view.left || st.x0 > view.left + view.viewM) return;
      const current = m.course?.station === i;
      c.fillStyle = alpha([P.pink, P.cyan, P.sun, P.mint, P.grape, P.tangerine][i % 6], current ? 0.16 : 0.07);
      c.fillRect(X(st.x0), top, (st.x1 - st.x0) * k, bottom - top);
      c.fillStyle = '#FFFFFF';
      c.fillRect(X(st.x0) - 2, top, 4, bottom - top);
    });
    c.fillStyle = alpha(P.grape, 0.35);
    for (let x = Math.floor(view.left / 2.4) * 2.4; x < view.left + view.viewM + 2.4; x += 2.4) c.fillRect(X(x), Y(0.2) - 2, 1.2 * k, 4);
    // The throw lesson's slow zone is painted on the plaza.
    const zone = STATIONS.find((st) => st.slow);
    for (let x = zone.x0 + 8; x < zone.x1 - 4; x += 20)
      if (x > view.left - 8 && x < view.left + view.viewM + 8) text(c, 'SLOW ZONE · LIGHT ALL 3', X(x), Y(1.7), Math.max(11, k * 0.42), alpha(P.grape, 0.38), { weight: 900 });
    c.fillStyle = P.curb;
    c.fillRect(0, bottom, w, Y(Z.farWalk) - bottom);
    c.fillStyle = P.lawn;
    c.fillRect(0, Y(Z.farWalk), w, view.height - Y(Z.farWalk));
  }
  courseActors(view, m, t, add) {
    const k = view.S,
      course = m.course;
    STATIONS.forEach((st, i) => {
      const x = st.x0 + 1.2;
      if (x < view.left - 4 || x > view.left + view.viewM + 4) return;
      const word = { kick: 'KICK', glide: 'GLIDE', slow: 'SLOW', ollie: 'OLLIE', throw: 'THROW', backflip: 'FLIP!', grind: 'GRIND', flip: 'TRICKS', pipeline: 'GO!' }[st.id];
      add(x, Z.walkBack + 0.1, (c) => {
        const q = project(view, x, Z.walkBack + 0.1);
        c.save();
        c.translate(q.x, q.y);
        props.stationFlag(c, k * depthScale(Z.walkBack), t, i + 1, word, [P.pink, P.cyan, P.sun, P.mint, P.grape, P.tangerine][i % 6], course?.completed.includes(st.id));
        c.restore();
      });
    });
    for (const [x, top, sub] of [[3, 'SKATE SCHOOL', `${m.campus.name} · GREEK ROW PREP`], [COURSE_LENGTH - 3, 'DROP IN →', 'GREEK ROW']]) {
      if (x < view.left - 6 || x > view.left + view.viewM + 6) continue;
      add(x, Z.walkBack + 0.05, (c) => {
        const q = project(view, x, Z.walkBack + 0.05);
        c.save();
        c.translate(q.x, q.y);
        props.gate(c, k * depthScale(Z.walkBack), t, top, sub, m.campus.colors.primary);
        c.restore();
      });
    }
    for (const can of course?.cans ?? []) {
      if (can.x < view.left - 3 || can.x > view.left + view.viewM + 3) continue;
      add(can.x, can.z, (c) => {
        const q = project(view, can.x, can.z),
          kk = k * depthScale(can.z) * 1.05;
        c.save();
        c.translate(q.x, q.y);
        // A painted target ring around a practice can.
        if (can.state === 'ready') {
          c.strokeStyle = alpha(P.pink, 0.8);
          c.lineWidth = Math.max(2, kk * 0.06);
          for (const r of [1.1, 0.7]) {
            ellipse(c, 0, 0, r * kk, r * kk * 0.32);
            c.stroke();
          }
        }
        props.trashCan(c, kk, can.state === 'burning' ? 'burning' : 'ready', t, can.state === 'ready' && m.aiming ? 0.7 + 0.3 * Math.sin(t * 8) : 0);
        c.restore();
      });
    }
  }
  // ----- Bee Alley: behind the frat back yards ---------------------------------
  alleyGround(c, view, m, t) {
    const k = view.S,
      X = (x) => (x - view.left) * k,
      Y = (z) => view.groundTop + (z - Z.facade) * view.Dz,
      w = view.width;
    // Back yards: lawn, the backs of the houses, back porches.
    c.fillStyle = P.lawnShade;
    c.fillRect(0, Y(Z.facade) - 2, w, Y(Z.walkBack) - Y(Z.facade) + 2);
    for (let s = Math.floor((view.left - 10) / 14) * 14; s < view.left + view.viewM + 14; s += 14) backOfHouse(c, X(s + 7), Y(-8.8), k, m.campus, s / 14, t);
    // Tall back fence along the yards
    c.save();
    c.translate(0, Y(Z.walkBack));
    // Start on the 0.3 m picket grid so the pickets scroll with the world.
    props.fence(c, k, Math.floor(view.left / 0.3) * 0.3 - view.left - 1, view.viewM + 1, 1.7);
    c.restore();
    const top = Y(Z.walkBack),
      bottom = Y(Z.streetNear);
    const g = c.createLinearGradient(0, top, 0, bottom);
    g.addColorStop(0, '#B9AFD6');
    g.addColorStop(1, '#CFC7E8');
    c.fillStyle = g;
    c.fillRect(0, top, w, bottom - top);
    // Cobbles
    c.fillStyle = alpha('#FFFFFF', 0.25);
    for (let z = Z.walkBack + 0.3, row = 0; z < Z.streetNear; z += 0.55, row++)
      for (let x = Math.floor(view.left / 0.8) * 0.8 + (row % 2) * 0.4; x < view.left + view.viewM + 1; x += 0.8) {
        ellipse(c, X(x), Y(z), 0.32 * k, 0.12 * view.Dz + 1);
        c.fill();
      }
    // Center drain line
    c.fillStyle = alpha(P.inkSoft, 0.35);
    c.fillRect(0, Y(-0.9) - 2, w, 4);
    c.fillStyle = '#D9C9A8';
    c.fillRect(0, bottom, w, view.height - bottom);
  }
  alleyActors(view, m, t, add) {
    const k = view.S,
      a = m.alley;
    if (!a) return;
    for (const hive of a.hives) {
      if (hive.taken || hive.x < view.left - 3 || hive.x > view.left + view.viewM + 3) continue;
      add(hive.x, hive.z, (c) => {
        const q = project(view, hive.x, hive.z);
        c.save();
        c.translate(q.x, q.y);
        props.hiveSpot(c, k * depthScale(hive.z), t + hive.id, hive.h);
        c.restore();
      });
    }
    for (const [x, top, sub] of [[3, 'BEE ALLEY', 'GRAB THE HIVES · KEEP MOVING'], [ALLEY_LENGTH - 2, 'BACK TO THE ROW →', null]]) {
      if (x < view.left - 6 || x > view.left + view.viewM + 6) continue;
      add(x, Z.walkBack + 0.05, (c) => {
        const q = project(view, x, Z.walkBack + 0.05);
        c.save();
        c.translate(q.x, q.y);
        props.gate(c, k * depthScale(Z.walkBack), t, top, sub, P.sun);
        c.restore();
      });
    }
    // A bro on the back porch notices anyone standing around: ? then !
    const notice = Math.min(1, a.still / (m.diff?.notice ?? 3));
    if (notice > 0.15) {
      const x = m.player.x + 3;
      add(x, Z.walkBack - 0.3, (c) => {
        const q = project(view, x, Z.walkBack - 0.3, 1.2 + notice * 0.6),
          u = k * 0.18 * CHAR_BOOST;
        c.save();
        c.translate(q.x, q.y);
        bro(c, { seed: 7, state: notice > 0.75 ? 'gawk' : 'party', drunk: 0.2, facing: -1, ext: 0, tx: 0, tz: 0, dx: 0, z: 0 }, u, t);
        text(c, notice > 0.75 ? '!' : '?', 2.2 * u, -12 * u, Math.max(18, k * 0.6), P.ink, { stroke: notice > 0.75 ? P.hazard : P.sun, strokeWidth: 6, weight: 900 });
        c.restore();
      });
    }
  }
  attractActor(view, m, t, add) {
    const x = view.left + view.viewM * (view.portrait ? 0.5 : 0.74),
      z = 1;
    add(x, z, (c) => {
      const q = project(view, x, z),
        uu = view.S * 0.18 * CHAR_BOOST * 1.2;
      ellipse(c, q.x, q.y, uu * 2.6, uu * 0.6);
      c.fillStyle = 'rgba(42,30,79,0.22)';
      c.fill();
      c.save();
      c.translate(q.x, q.y);
      skater(c, lookSpec(m.crew[0], uu), { mode: Math.floor(t / 2.4) % 3 === 2 ? 'push' : 'cruise', phase: (t % 2.4) / 0.6, time: t, speed: 1 });
      c.restore();
    });
  }
  projectiles(c, view, m, t) {
    for (const pr of m.projectiles) {
      const kk = Math.min(1, pr.t / pr.flight),
        x = pr.fromX + (pr.toX - pr.fromX) * kk,
        z = pr.fromZ + (pr.toZ - pr.fromZ) * kk,
        arc = 1.1 + Math.abs(pr.toZ - pr.fromZ) * 0.22,
        y = pr.fromY + (pr.toY - pr.fromY) * kk + Math.sin(kk * Math.PI) * arc;
      const g = project(view, x, z),
        q = project(view, x, z, y),
        k = view.S * depthScale(z);
      ellipse(c, g.x, g.y, k * 0.25, k * 0.08);
      c.fillStyle = 'rgba(42,30,79,0.2)';
      c.fill();
      c.save();
      c.translate(q.x, q.y);
      if (pr.item === 'bottle') {
        props.bottle(c, k, t, t * 16);
        if (Math.random() < 0.7) this.fx.spawn('ember', x, z, y, { vx: -1, vz: 0, vy: 0.3, size: 0.06, color: P.sun, life: 0.4 });
      } else itemIconFlight(c, pr.item, k, t);
      c.restore();
    }
  }
  reticle(c, view, m, t) {
    const a = m.aim(),
      p = m.player;
    this.aimHouse = a.house;
    const from = { x: p.x + 0.2, z: p.z, y: p.y + 1.45 };
    const arc = 1.1 + Math.abs(a.z - p.z) * 0.22;
    const color = a.locked ? P.mint : a.target ? P.cyan : '#D9D2F0';
    c.save();
    c.setLineDash([4, 7]);
    c.lineDashOffset = -t * 40;
    c.strokeStyle = color;
    c.lineWidth = 3;
    c.beginPath();
    for (let i = 0; i <= 18; i++) {
      const kk = i / 18,
        q = project(view, from.x + (a.x - from.x) * kk, from.z + (a.z - from.z) * kk, from.y + (a.y - from.y) * kk + Math.sin(kk * Math.PI) * arc);
      if (i === 0) c.moveTo(q.x, q.y);
      else c.lineTo(q.x, q.y);
    }
    c.stroke();
    c.setLineDash([]);
    const q = project(view, a.x, a.z, a.y),
      k = view.S;
    if (a.target?.x0 !== undefined) {
      const l = project(view, a.target.x0, a.z, a.y),
        r = project(view, a.target.x1, a.z, a.y);
      c.fillStyle = alpha(a.locked ? P.mint : P.cyan, 0.22);
      rr(c, l.x, q.y - 0.3 * k, r.x - l.x, 0.6 * k, 0.3 * k);
      c.fill();
      c.strokeStyle = color;
      c.lineWidth = 2;
      c.stroke();
    }
    const rad = (a.target?.kind === 'window' ? 0.7 : 0.55) * k * (1 + 0.08 * Math.sin(t * 10));
    c.strokeStyle = P.ink;
    c.lineWidth = 5;
    ellipse(c, q.x, q.y, rad, a.target?.kind === 'window' ? rad : rad * 0.5);
    c.stroke();
    c.strokeStyle = color;
    c.lineWidth = 3;
    c.stroke();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      c.beginPath();
      c.moveTo(q.x + dx * rad * 0.6, q.y + dy * rad * 0.35);
      c.lineTo(q.x + dx * rad * 1.3, q.y + dy * rad * 0.7);
      c.stroke();
    }
    const label = a.locked ? S.hud.lock : a.target ? '' : S.hud.noTarget;
    if (label) text(c, label, q.x, q.y - rad - 12, 13, P.ink, { stroke: color, strokeWidth: 5, weight: 900 });
    c.restore();
  }
  dangerVignette(c, view, m, t) {
    if (!['playing', 'rescue'].includes(m.phase)) return;
    const d = 1 - Math.max(0, m.horde.gap) / T.hordeWarn;
    if (d <= 0) return;
    const w = view.width,
      h = view.height,
      pulse = 0.6 + 0.4 * Math.sin(t * 10);
    const g = c.createLinearGradient(0, 0, w * 0.35, 0);
    g.addColorStop(0, alpha(P.hazard, 0.45 * d * pulse));
    g.addColorStop(1, alpha(P.hazard, 0));
    c.fillStyle = g;
    c.fillRect(0, 0, w * 0.35, h);
  }
  unlockCard(c, view, m, t) {
    const u = this.unlock,
      w = Math.min(view.width * 0.9, 460),
      h = 150,
      x = view.width / 2 - w / 2,
      y = view.portrait ? view.height * 0.42 : view.hud + view.height * 0.24;
    const a = u.age < 0.25 ? easeOutBack(u.age / 0.25) : u.age > 2.9 ? Math.max(0, 1 - (u.age - 2.9) / 0.3) : 1;
    c.save();
    c.globalAlpha = Math.min(1, a);
    c.translate(view.width / 2, y + h / 2);
    c.scale(Math.max(0.01, a), Math.max(0.01, a));
    c.translate(-view.width / 2, -(y + h / 2));
    rr(c, x + 6, y + 8, w, h, 18);
    c.fillStyle = 'rgba(42,30,79,0.25)';
    c.fill();
    rr(c, x, y, w, h, 18);
    paint(c, '#FFFFFF', P.ink, 3);
    const shop = SHOPS.find((s) => s.kind === u.kind);
    rr(c, x, y, 110, h, 18);
    paint(c, shop.color, P.ink, 3);
    itemIcon(c, u.kind, x + 55, y + h * 0.72, 46, t);
    text(c, 'NEW WAY TO WRECK A HOUSE', x + 128, y + 24, 12, P.inkSoft, { align: 'left', weight: 800, italic: false, family: FONT.ui });
    chrome(c, u.sub, x + 128, y + 54, 30, { align: 'left' });
    wrap(c, shop.blurb, x + 128, y + 84, w - 145, 14, P.ink);
    text(c, view.touch ? 'Tap ITEM to switch' : 'Q switches items', x + 128, y + h - 16, 12, P.pink, { align: 'left', weight: 900, italic: false, family: FONT.ui });
    c.restore();
  }
  resumeCard(c, view, m, t) {
    const hits = m.bonus?.hits ?? 0;
    const y = view.height * 0.38;
    c.save();
    c.translate(view.width / 2, y);
    const s = easeOutBack(Math.min(1, m.phaseTime / 0.3));
    c.scale(s, s);
    chrome(c, `${hits} / 10 IN THE CAN`, 0, 0, Math.min(56, view.width * 0.07));
    c.restore();
  }
  debugDraw(c, view, m) {
    c.save();
    c.strokeStyle = P.cyan;
    c.lineWidth = 1.5;
    const p = m.player,
      q = project(view, p.x, p.z);
    ellipse(c, q.x, q.y, 0.3 * view.S, 0.25 * view.Dz);
    c.stroke();
    for (const o of m.hazards) {
      if (o.taken) continue;
      const ox = near(o.s, view.cameraX),
        a = project(view, ox - o.hx, o.z - o.hz),
        b = project(view, ox + o.hx, o.z + o.hz);
      c.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    }
    text(c, `${m.phase} gap ${m.horde.gap.toFixed(1)} vx ${p.vx.toFixed(1)} lap ${m.lap} ring ${ring(p.x).toFixed(0)}`, 12, view.height - 12, 12, P.ink, { align: 'left', italic: false, family: 'monospace', stroke: '#FFFFFF' });
    c.restore();
  }
}
// A collegiate hall for the skate-school quad, in the campus colors.
function hall(c, x, base, k, campus, seed) {
  const w = 30 * k,
    h = 7.2 * k,
    wall = seed % 2 ? '#E9DCC8' : '#E8A08A',
    trim = '#FFF6E8';
  c.save();
  c.translate(x, base);
  rr(c, -w / 2, -h, w, h, 0.05 * k);
  paint(c, wall, P.ink, Math.max(1.2, k * 0.05));
  poly(c, [[-w / 2 - 0.4 * k, -h], [-w / 2 + 2 * k, -h - 2 * k], [w / 2 - 2 * k, -h - 2 * k], [w / 2 + 0.4 * k, -h]]);
  paint(c, '#5E6B7A', P.ink, Math.max(1.2, k * 0.05));
  for (let i = 0; i < 12; i++)
    for (const y of [1.6, 4.4]) {
      const wx = -w / 2 + (i + 0.5) * (w / 12);
      if (Math.abs(wx) < 2 * k && y < 3) continue;
      rr(c, wx - 0.5 * k, -(y + 1.4) * k, 1 * k, 1.6 * k, 0.4 * k);
      paint(c, P.glass, P.ink, Math.max(1, k * 0.035));
    }
  // Tower over the entry, with the campus banner
  rr(c, -1.8 * k, -(h + 5 * k), 3.6 * k, h + 5 * k, 0.05 * k);
  paint(c, lighten(wall, 0.06), P.ink, Math.max(1.2, k * 0.05));
  poly(c, [[-2.1 * k, -(h + 5 * k)], [0, -(h + 8.2 * k)], [2.1 * k, -(h + 5 * k)]]);
  paint(c, '#5E6B7A', P.ink, Math.max(1.2, k * 0.05));
  ellipse(c, 0, -(h + 4.1 * k), 0.7 * k, 0.7 * k);
  paint(c, trim, P.ink, Math.max(1, k * 0.04));
  c.strokeStyle = P.ink;
  c.lineWidth = Math.max(1, k * 0.05);
  c.beginPath();
  c.moveTo(0, -(h + 4.1 * k));
  c.lineTo(0, -(h + 4.55 * k));
  c.moveTo(0, -(h + 4.1 * k));
  c.lineTo(0.35 * k, -(h + 4.0 * k));
  c.stroke();
  // The campus banner hangs down the tower.
  rr(c, -1.25 * k, -(h + 3.2 * k), 2.5 * k, 3.4 * k, 0.1 * k);
  paint(c, campus.colors.primary, P.ink, Math.max(1, k * 0.04));
  text(c, campus.name, 0, -(h + 1.5 * k), Math.max(7, Math.min(0.5 * k, (2.2 * k) / (0.62 * campus.name.length))), '#FFFFFF', { weight: 900 });
  rr(c, -1.1 * k, -2.6 * k, 2.2 * k, 2.6 * k, 1 * k);
  paint(c, darken(wall, 0.3), P.ink, Math.max(1, k * 0.04));
  c.restore();
}
// The back of a frat house seen from the alley: siding, a back door, a porch light.
function backOfHouse(c, x, base, k, campus, seed, t) {
  const w = 11 * k,
    h = 4.6 * k,
    wall = campus.walls[Math.abs(Math.floor(seed)) % campus.walls.length],
    roof = campus.roofs[Math.abs(Math.floor(seed)) % campus.roofs.length];
  c.save();
  c.translate(x, base);
  rr(c, -w / 2, -h, w, h, 0.04 * k);
  paint(c, darken(wall, 0.08), P.ink, Math.max(1.2, k * 0.05));
  poly(c, [[-w / 2 - 0.4 * k, -h], [0, -h - 2.2 * k], [w / 2 + 0.4 * k, -h]]);
  paint(c, roof, P.ink, Math.max(1.2, k * 0.05));
  for (const wx of [-3.6, -1.2, 2.4])
    for (const y of [1.3, 3.2]) {
      rr(c, (wx - 0.5) * k, -(y + 0.6) * k, 1 * k, 1.1 * k, 0.04 * k);
      paint(c, P.glass, P.ink, Math.max(1, k * 0.035));
    }
  rr(c, 3.6 * k, -2.2 * k, 1.1 * k, 2.2 * k, 0.04 * k);
  paint(c, darken(roof, 0.1), P.ink, Math.max(1, k * 0.04));
  ellipse(c, 4.9 * k, -2.5 * k, 0.16 * k, 0.16 * k);
  c.fillStyle = Math.sin(t * 2 + seed) > -0.6 ? P.sun : '#FFF3C0';
  c.fill();
  c.restore();
}
function itemIconFlight(c, item, k, t) {
  c.rotate(Math.sin(t * 8) * 0.3);
  if (item === 'bees') props.beehive(c, k * 0.8, t);
  else if (item === 'sub') props.subwoofer(c, k * 0.7, t, t);
  else if (item === 'fryer') props.fryer(c, k * 0.7, t, false);
  else if (item === 'raccoons') props.raccoonCrate(c, k, t, false);
  else if (item === 'balloons') props.balloonBundle(c, k * 0.6, t, 4, 0.8);
}
function wrap(c, str, x, y, width, size, color) {
  c.font = `600 ${size}px ${FONT.ui}`;
  c.textAlign = 'left';
  c.textBaseline = 'middle';
  c.fillStyle = color;
  let line = '',
    yy = y;
  for (const word of str.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (c.measureText(test).width > width && line) {
      c.fillText(line, x, yy);
      line = word;
      yy += size * 1.3;
    } else line = test;
  }
  if (line) c.fillText(line, x, yy);
}
