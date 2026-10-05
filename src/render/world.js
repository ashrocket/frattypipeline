import { layout, project, projectEllipse, visible } from '../layout.js';
import { Scenery } from './scenery.js';
import { Effects } from './fx.js';
import { Hud } from './hud.js';
import { drawModelPlayer, drawPlayer } from './player.js';
import { COLORS as P, rect, oval, line, poly, text } from './draw.js';
import { S, C } from '../data/strings.js';
import { FLEE } from '../data/houses.js';
export class WorldRenderer {
  constructor(container) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-label', S.canvasLabel);
    this.canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
    container.appendChild(this.canvas);
    const raw = this.canvas.getContext('2d', { alpha: false });
    this.operations = 0;
    this.gradients = 0;
    // Count actual canvas API calls, including fills/text; no estimated performance claims.
    const counted = new Set([
      'fill',
      'stroke',
      'fillRect',
      'strokeRect',
      'drawImage',
      'fillText',
      'strokeText',
      'clearRect',
    ]);
    this.ctx = new Proxy(raw, {
      get: (c, key) =>
        typeof c[key] === 'function'
          ? (...args) => {
              if (counted.has(key)) this.operations++;
              if (String(key).includes('Gradient')) this.gradients++;
              return c[key](...args);
            }
          : c[key],
      set: (c, k, value) => {
        c[k] = value;
        return true;
      },
    });
    this.scenery = new Scenery();
    this.hud = new Hud();
    this.fx = new Effects((container.clientWidth || innerWidth) <= 900);
    this.reduced = false;
    this.count = { activeCount: 0, capacity: 20 };
    this.debugHitboxes = new URLSearchParams(location.search).has('hitboxes');
    this.resize();
  }
  resize() {
    this.width = this.container.clientWidth || innerWidth;
    this.height = this.container.clientHeight || innerHeight;
    this.ratio = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = this.width * this.ratio;
    this.canvas.height = this.height * this.ratio;
  }
  project(x, z, y = 0) {
    return project(this.view, x, z, y);
  }
  stats() {
    return {
      drawCalls: this.operations,
      gradients: this.gradients,
      particles: this.fx.pool.filter((p) => p.life > 0).length,
      particleCap: this.fx.pool.length,
      width: this.width,
      height: this.height,
    };
  }
  event(e, m) {
    if (e.type === 'hint' && e.text === C.ready)
      e = { ...e, text: S.superHints[m.inputDevice] ?? S.superHints.keyboard };
    this.fx.event(e, m.time, this.reduced, Boolean(m.charge), m.phase === 'transform');
    if (e.type === 'empty') this.hud.emptyUntil = m.time + 0.25;
  }
  enemy(e, m) {
    const c = this.ctx,
      p = this.project(e.x, e.z);
    c.save();
    c.translate(p.x, p.y);
    c.scale(this.view.figureScale, this.view.figureScale);
    const orange = P.orange,
      active = e.state === 'active',
      tell = e.state === 'telegraph',
      recover = ['recovery', 'stunned'].includes(e.state);
    oval(c, 0, 0, 24, 7, '#221B26', orange);
    line(
      c,
      [
        [-20, -2],
        [-12, 3],
        [-3, -3],
        [6, 3],
        [16, -3],
      ],
      orange,
      2,
    );
    c.save();
    if (recover) c.rotate(0.32);
    else if (active) c.rotate(-0.2);
    if (e.state === 'flee') c.rotate(-0.16);
    const body =
      e.kind === 'vest'
        ? '#1F2A44'
        : e.kind === 'pong'
          ? '#E8DCC4'
          : e.kind === 'conga'
            ? '#E8C27A'
            : '#A8C5C2';
    line(
      c,
      [
        [-9, -28],
        [-13, -3],
      ],
      P.ink,
      10,
    );
    line(
      c,
      [
        [9, -28],
        [16, -3],
      ],
      P.ink,
      10,
    );
    rect(c, -18, -58, 36, 34, body);
    c.strokeStyle = orange;
    c.lineWidth = 3;
    c.strokeRect(-18, -58, 36, 34);
    oval(c, 0, -70, 16, 17, '#C99C7E', orange);
    rect(c, -19, -88, 35, 9, '#1F2A44');
    rect(c, -22, -81, 21, 5, '#1F2A44');
    if (e.kind === 'lax' && e.state !== 'flee') {
      line(
        c,
        [
          [17, -38],
          [tell ? 33 : active ? -38 : 35, tell ? -103 : active ? -31 : -51],
        ],
        orange,
        5,
      );
      oval(c, tell ? 33 : 35, tell ? -105 : -54, 9, 13, '#2F2934', orange);
    }
    if (e.kind === 'keg' && e.state !== 'flee') {
      rect(c, 19, -27, 29, 27, '#8B818C');
      c.strokeStyle = orange;
      c.strokeRect(19, -27, 29, 27);
      line(
        c,
        [
          [20, -20],
          [47, -20],
          [47, -7],
          [20, -7],
        ],
        orange,
        2,
      );
    }
    if (e.kind === 'pong' && e.state !== 'flee') {
      oval(c, 25, -52, 12, 12, P.paper, orange);
      text(c, '●', 25, -51, 12, orange, 'center');
    }
    if (e.kind === 'vest') {
      poly(
        c,
        [
          [-16, -59],
          [0, -37],
          [16, -59],
          [16, -26],
          [-16, -26],
        ],
        '#5B5F68',
      );
      rect(c, tell ? 20 : 13, tell ? -77 : -45, 23, 15, P.paper);
      line(
        c,
        [
          [22, tell ? -71 : -39],
          [33, tell ? -71 : -39],
        ],
        orange,
        3,
      );
    }
    if (e.kind === 'conga' && e.state !== 'flee') {
      line(
        c,
        [
          [-34, -52],
          [35, -52],
        ],
        orange,
        7,
      );
      oval(c, 0, -59, 6, 4, P.yellow);
    }
    if (e.state === 'flee') {
      line(
        c,
        [
          [-17, -51],
          [-26, -92],
        ],
        body,
        7,
      );
      line(
        c,
        [
          [17, -51],
          [29, -92],
        ],
        body,
        7,
      );
    }
    c.restore();
    if (tell) text(c, '!', 0, -109, 25, orange, 'center');
    if (recover) text(c, '…', 0, -103, 18, P.paper, 'center');
    if (e.state === 'flee') text(c, FLEE[e.id % FLEE.length], 0, -118, 10, P.paper, 'center');
    c.restore();
  }
  attack(a, m) {
    const c = this.ctx,
      point = this.project(a.targetX, a.targetZ),
      v = this.view;
    const r = v.portrait ? Math.max(14, v.depthScale * a.rz) : Math.max(15, v.scale * a.rx),
      ry = v.portrait ? Math.max(8, v.scale * 0.6) : Math.max(9, v.depthScale * a.rz);
    c.save();
    c.globalAlpha = 0.85;
    poly(c, projectEllipse(v, a.targetX, a.targetZ, a.rx, a.rz), '#FF5A1F18', P.orange);
    if (a.kind === 'lax') poly(c, projectEllipse(v, a.x, a.z, a.rx, a.rz), '#FF5A1F18', P.orange);
    for (let i = -2; i <= 2; i++)
      line(
        c,
        [
          [point.x + (i * r) / 3 - 4, point.y - ry * 0.55],
          [point.x + (i * r) / 3 + 4, point.y + ry * 0.55],
        ],
        P.orange,
        2,
      );
    if (a.state === 'telegraph') {
      const progress = Math.max(0.1, Math.min(1, (a.strikeBeat - m.beat) / 3));
      poly(
        c,
        projectEllipse(v, a.targetX, a.targetZ, a.rx * progress, a.rz * progress),
        '#00000000',
        P.orange,
      );
      text(c, a.height, point.x, point.y - ry - 10, 11, P.orange, 'center');
    } else if (a.kind === 'keg') {
      rect(c, point.x - 15, point.y - 24, 30, 24, '#89818D');
      c.strokeStyle = P.orange;
      c.strokeRect(point.x - 15, point.y - 24, 30, 24);
    } else if (a.kind === 'cart') {
      rect(c, point.x - 35, point.y - 42, 70, 35, '#E8DCC4');
      line(
        c,
        [
          [point.x - 40, point.y - 47],
          [point.x + 40, point.y - 47],
        ],
        P.orange,
        5,
      );
      oval(c, point.x - 23, point.y, 8, 8, P.ink, P.orange);
      oval(c, point.x + 23, point.y, 8, 8, P.ink, P.orange);
    } else if (a.height === 'HIGH') oval(c, point.x, point.y - 7, 7, 7, P.paper, P.orange);
    c.restore();
  }
  draw(m, dt = 1 / 60) {
    const c = this.ctx;
    this.operations = 0;
    this.gradients = 0;
    if (m.time < (this.lastModelTime ?? 0) || m.continues !== (this.lastContinue ?? m.continues))
      this.fx = new Effects(this.width <= 900);
    this.lastModelTime = m.time;
    this.lastContinue = m.continues;
    this.view = layout(this.width, this.height, m);
    const v = this.view,
      w = v.width,
      h = v.height;
    c.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    this.endingTime = m.phase === 'won' ? (this.endingTime ?? 0) + dt : 0;
    this.fx.tick(dt, m.time, m.phase === 'transform', Boolean(m.charge));
    c.drawImage(this.scenery.backdrop(w, h, v.portrait), 0, 0);
    c.save();
    const max = v.portrait ? 7 : v.touch ? 9 : 14;
    if (!this.reduced) {
      const shake = max * this.fx.trauma ** 2;
      c.translate(Math.sin(m.time * 157) * shake, Math.sin(m.time * 193) * shake * 0.7);
    }
    for (const house of m.houses) {
      if (Math.abs(house.x - m.cameraX) > 35 && !v.portrait) continue;
      const pos = this.project(house.x, v.portrait ? -5.9 : -5.5);
      if (pos.y < -100 || pos.y > h + 260) continue;
      const scale = v.portrait ? 0.48 : v.height < 500 ? 0.5 : 0.9;
      c.drawImage(
        this.scenery.house(house, house.burned),
        pos.x - 160 * scale,
        pos.y - 290 * scale,
        320 * scale,
        310 * scale,
      );
      if (house.burned) {
        const lawn = this.project(house.x, -6.6);
        oval(
          c,
          lawn.x,
          lawn.y,
          v.portrait ? 21 : 2.6 * v.scale,
          v.portrait ? 2.6 * v.scale : 14,
          '#FF5A1F55',
          P.orange,
        );
        for (let i = -1; i <= 1; i++) {
          const x = lawn.x + (v.portrait ? 0 : i * 22);
          const y = lawn.y + (v.portrait ? i * 16 : 0);
          const height = 20 + Math.sin(m.time * 8 + i * 2) * 7;
          poly(
            c,
            [
              [x - 9, y],
              [x - 3, y - height * 0.6],
              [x + 2, y - height],
              [x + 10, y],
            ],
            P.orange,
          );
          poly(
            c,
            [
              [x - 4, y],
              [x + 1, y - height * 0.6],
              [x + 5, y],
            ],
            P.yellow,
          );
        }
      }
      if (house === m.arena) {
        const opening =
          house.state === 'door' ? Math.max(0, Math.min(1, 1 - house.doorTime / 0.5)) : 1;
        rect(
          c,
          pos.x - 24 * scale * opening,
          pos.y - 80 * scale,
          48 * scale * opening,
          70 * scale,
          P.ink,
        );
        const lawn = this.project(house.x, -6.6);
        oval(
          c,
          lawn.x,
          lawn.y,
          v.portrait ? 21 : 2.6 * v.scale,
          v.portrait ? 2.6 * v.scale : 14,
          '#B6FF0018',
          house.guard ? '#AAB5C0' : P.green,
        );
        if (house.guard) {
          for (let i = -1; i <= 1; i++)
            line(
              c,
              [
                [lawn.x + i * 15, lawn.y],
                [lawn.x + i * 15 - 7, lawn.y - 15 - m.beatPulse * 7],
              ],
              '#AAB5C0',
              2,
            );
        } else {
          c.globalAlpha = 0.4 + m.beatPulse * 0.6;
          oval(
            c,
            lawn.x,
            lawn.y,
            v.portrait ? 25 : 2.9 * v.scale,
            v.portrait ? 2.9 * v.scale : 19,
            '#00000000',
            P.green,
          );
          c.globalAlpha = 1;
        }
        if (!v.portrait)
          text(
            c,
            house.guard ? S.hud.sprinklers : S.hud.open,
            lawn.x,
            lawn.y + 28,
            12,
            house.guard ? P.paper : P.green,
            'center',
          );
      }
    }
    if (m.arena) {
      for (const x of [m.arena.x - 9, m.arena.x + 9]) {
        const a = this.project(x, -4.3),
          b = this.project(x, 4.3);
        line(
          c,
          [
            [a.x, a.y],
            [b.x, b.y],
          ],
          '#FF5A1F88',
          3,
        );
      }
    }
    if (m.conveyor) {
      const p = this.project(m.conveyor.x, m.conveyor.z);
      rect(c, p.x - 35, p.y - 12, 70, 24, '#CDBB8E66');
      line(
        c,
        [
          [p.x - 25, p.y],
          [p.x, p.y - 8],
          [p.x + 25, p.y],
        ],
        P.orange,
        3,
      );
    }
    for (const a of m.attacks) this.attack(a, m);
    const entities = [];
    for (const s of m.coffeeStands)
      if (s.active && visible(v, s))
        entities.push({
          x: s.x,
          z: s.z,
          draw: () => {
            const p = this.project(s.x, s.z);
            oval(c, p.x, p.y, 24, 9, '#B6FF0022', P.green);
            rect(c, p.x - 22, p.y - 48, 44, 41, '#D1B696');
            poly(
              c,
              [
                [p.x - 30, p.y - 49],
                [p.x + 30, p.y - 49],
                [p.x + 24, p.y - 62],
                [p.x - 24, p.y - 62],
              ],
              P.green,
            );
            text(c, s.served ? '✓' : '☕', p.x, p.y - 28, 22, P.ink, 'center');
          },
        });
    for (const p of m.pickups)
      if (!p.dead && visible(v, p))
        entities.push({
          ...p,
          draw: () => {
            const pos = this.project(p.x, p.z);
            oval(c, pos.x, pos.y, 15, 6, '#B6FF0022', P.green);
            oval(c, pos.x, pos.y - 14, 12, 12, P.ink, P.green);
            oval(c, pos.x, pos.y - 14, 4, 4, P.pink);
          },
        });
    for (const o of m.obstacles)
      if (visible(v, o))
        entities.push({
          ...o,
          draw: () => {
            const p = this.project(o.x, o.z);
            poly(
              c,
              [
                [p.x - 10, p.y],
                [p.x, p.y - 25],
                [p.x + 10, p.y],
              ],
              P.orange,
              P.ink,
            );
            line(
              c,
              [
                [p.x - 5, p.y - 10],
                [p.x + 5, p.y - 10],
              ],
              P.paper,
              3,
            );
          },
        });
    for (const source of m.enemies) {
      const e =
        this.endingTime && source.state === 'flee'
          ? { ...source, x: source.x + this.endingTime * 8, z: source.z + this.endingTime * 14 }
          : source;
      if (e.kind === 'conga')
        for (let i = 1; i < e.members; i++) {
          const mate = {
            ...e,
            z:
              e.state === 'flee'
                ? e.z + i * 0.2
                : Math.max(-4.3, Math.min(4.3, e.z + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.85)),
            x: e.x - i * 0.25,
            kind: 'pledge',
          };
          entities.push({ ...mate, draw: () => this.enemy(mate, m) });
        }
      entities.push({ ...e, draw: () => this.enemy(e, m) });
    }
    entities.push({
      ...m.player,
      draw: () => {
        const p =
          m.phase === 'title'
            ? { x: w * (v.portrait ? 0.84 : 0.65), y: h * (v.portrait ? 0.39 : 0.56) }
            : this.project(m.player.x, m.player.z, m.player.jumpHeight);
        c.save();
        c.translate(p.x, p.y);
        c.scale(v.figureScale, v.figureScale);
        drawModelPlayer(c, m);
        c.restore();
      },
    });
    if (m.phase === 'transform')
      for (const side of [-1, 1])
        entities.push({
          x: m.player.x,
          z: m.player.z + side * 2.1,
          draw: () => {
            const p = this.project(m.player.x, m.player.z + side * 2.1);
            c.save();
            c.translate(p.x, p.y);
            c.scale(v.figureScale, v.figureScale);
            drawPlayer(c, {
              look: m.look,
              hair: m.hair,
              pipeline: 100,
              pose: m.beat % 1 < 0.5 ? 'release' : 'charge',
              time: m.time,
            });
            c.restore();
          },
        });
    entities
      .sort((a, b) => this.project(a.x, a.z).y - this.project(b.x, b.z).y)
      .forEach((e) => e.draw());
    if (m.player.pitchLock > 0) {
      const p = this.project(m.player.x, m.player.z);
      const y = Math.max(v.hud + 30, p.y - 118 * v.figureScale);
      oval(c, p.x, p.y, 32, 12, '#FF5A1F22', P.orange);
      poly(
        c,
        [
          [p.x - 12, y + 10],
          [p.x + 2, y + 25],
          [p.x + 10, y + 10],
        ],
        P.paper,
        P.orange,
      );
      rect(c, p.x - 75, y - 18, 150, 31, P.paper);
      text(c, C.lock, p.x, y - 2, 10, P.ink, 'center');
    }
    for (const b of m.projectiles) {
      const t = b.progress,
        x = b.fromX + (b.toX - b.fromX) * t,
        z = b.fromZ + (b.toZ - b.fromZ) * t,
        y = (b.fromY || 0) * (1 - t) + Math.sin(t * Math.PI) * 4;
      const p = this.project(x, z, y);
      rect(c, p.x - 3, p.y - 10, 6, 13, P.green);
      rect(c, p.x - 2, p.y - 15, 4, 6, P.yellow);
    }
    if (m.charge && m.arena) {
      const a = m.aim(),
        p = this.project(a.x, a.z);
      oval(c, p.x, p.y, 17, 8, '#00000000', P.yellow);
      line(
        c,
        [
          [p.x - 24, p.y],
          [p.x + 24, p.y],
        ],
        P.yellow,
        2,
      );
      line(
        c,
        [
          [p.x, p.y - 13],
          [p.x, p.y + 13],
        ],
        P.yellow,
        2,
      );
    }
    // Abandoned props are inert: schooling is comic retreat, never bottle contact.
    for (const prop of this.fx.props) {
      const p = this.project(
        prop.x,
        prop.z,
        Math.max(0, Math.sin(Math.min(1, prop.age / 0.5) * Math.PI) * 0.6),
      );
      c.save();
      c.translate(p.x, p.y);
      c.rotate(Math.min(1, prop.age * 3) * 1.2);
      c.globalAlpha = Math.min(1, prop.life);
      if (prop.kind === 'lax') {
        line(
          c,
          [
            [-16, 0],
            [12, 0],
          ],
          P.paper,
          3,
        );
        oval(c, 14, 0, 5, 8, '#00000000', P.paper);
      } else if (prop.kind === 'keg') {
        rect(c, -8, -10, 16, 20, '#AAB5C0');
        line(
          c,
          [
            [-8, -5],
            [8, -5],
            [8, 5],
            [-8, 5],
          ],
          P.ink,
          2,
        );
      } else if (prop.kind === 'vest') rect(c, -10, -6, 20, 12, P.paper);
      else if (prop.kind === 'pong') oval(c, 0, 0, 5, 5, P.paper);
      else oval(c, 0, 0, 8, 4, P.yellow);
      c.restore();
      if (prop.bottles) {
        oval(c, p.x + 16, p.y, 12, 5, '#B6FF0022', P.green);
        rect(c, p.x + 13, p.y - 16, 6, 12, P.green);
        rect(c, p.x + 15, p.y - 20, 2, 5, P.yellow);
      }
    }
    if (this.fx.shockwave?.life > 0) {
      const wave = this.fx.shockwave;
      const radius = (0.8 - wave.life) * 14;
      c.save();
      c.globalAlpha = wave.life / 0.8;
      poly(c, projectEllipse(v, wave.x, wave.z, radius, radius * 0.55), '#00000000', P.green);
      c.restore();
      const pos = this.project(wave.x, wave.z);
      text(c, C.reborn, pos.x, Math.max(v.hud + 18, pos.y - 90), 13, P.green, 'center');
    }
    for (const part of this.fx.pool)
      if (part.life > 0) {
        const p = this.project(part.x, part.z, part.life * 2);
        rect(c, p.x, p.y, 3, 3, part.color);
      }
    if (this.debugHitboxes) {
      for (const entity of [m.player, ...m.enemies]) {
        const p = this.project(entity.x, entity.z);
        oval(
          c,
          p.x,
          p.y,
          v.portrait ? v.depthScale * 0.7 : v.scale * 0.8,
          v.portrait ? v.scale * 0.8 : v.depthScale * 0.7,
          '#00000000',
          '#00E5FF',
        );
      }
    }
    c.restore(); // HUD and screen overlays never inherit world shake.
    if (this.fx.flash > 0) {
      if (this.reduced) {
        c.strokeStyle = P.pink;
        c.lineWidth = 4;
        c.strokeRect(2, 2, w - 4, h - 4);
      } else rect(c, 0, 0, w, h, '#FFFFFF22');
    }
    if (m.phase !== 'title') this.hud.draw(c, m, v, dt, this.count);
    if (this.fx.current && m.phase !== 'transform') {
      const event = this.fx.current,
        p = this.project(event.x, event.z),
        x = Math.max(110, Math.min(w - 110, p.x)),
        y = Math.max(v.hud + 60, Math.min(h - v.controls - 70, p.y - 125));
      c.save();
      c.translate(x, y);
      c.rotate(-0.045);
      rect(c, -Math.min(180, w * 0.43), -20, Math.min(360, w * 0.86), 40, P.yellow);
      text(c, event.text, 0, 1, v.portrait ? 18 : 24, P.ink, 'center', 'Impact');
      if (event.sub) text(c, event.sub, 0, 33, v.portrait ? 10 : 13, P.paper, 'center');
      c.restore();
    }
    if (m.phase === 'countin' || m.phase === 'vs' || m.bannerUntil > m.time) {
      const target = m.target(),
        y = v.portrait ? h * 0.3 : h * 0.2;
      rect(c, w * 0.08, y - 28, w * 0.84, 65, '#0B0A0FE8');
      text(
        c,
        m.phase === 'countin'
          ? `${S.brand} · ${Math.max(1, Math.ceil((8 - m.beat) / 2))}`
          : `${S.hud.round} ${target.id + 1} · ${target.name} ${S.versusYou}`,
        w / 2,
        y,
        v.portrait ? 15 : 25,
        P.yellow,
        'center',
        'Impact',
      );
      text(c, target.vs, w / 2, y + 25, v.portrait ? 9 : 12, P.paper, 'center');
    }
    if (m.phase === 'transform') {
      const y = v.portrait ? h * 0.29 : h * 0.3;
      rect(c, w * 0.04, y - 40, w * 0.92, 132, '#0B0A0FEF');
      text(c, S.transformKicker, w / 2, y - 18, v.portrait ? 11 : 15, P.paper, 'center');
      text(c, S.transformTitle, w / 2, y + 15, v.portrait ? 25 : 42, P.yellow, 'center', 'Impact');
      text(
        c,
        m.beat >= m.transformEnd - 2
          ? S.transformSteps[2]
          : m.beat - m.transformStart >= 2
            ? S.transformSteps[1]
            : S.transformSteps[0],
        w / 2,
        y + 63,
        23,
        P.pink,
        'center',
      );
    }
    if (!m.arena && m.burned > 0 && m.phase === 'playing' && Math.floor(m.time * 2) % 2 === 0)
      text(c, S.hud.go, w * 0.82, h * 0.4, 28, P.green, 'center');
  }
}
