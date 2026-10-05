import { COLORS as P, rect, line, poly, text } from './draw.js';
import { LOOKS } from '../data/looks.js';
import { S, C, stageLabel } from '../data/strings.js';
export class Hud {
  constructor() {
    this.punk = 100;
    this.pride = 1;
    this.holdPunk = 0;
    this.holdPride = 0;
    this.house = -1;
  }
  draw(c, m, v, dt, count) {
    const w = v.width,
      h = v.hud,
      small = v.portrait || v.height < 500;
    const hp = 100 - m.player.pipeline,
      target = m.target();
    const pride = target?.hp / target?.maxHp || 0;
    if (hp < this.punk && this.lastHp !== hp) this.holdPunk = 0.4;
    if (pride < this.pride && this.lastPr !== pride) this.holdPride = 0.4;
    if (this.house !== target?.id) {
      this.pride = pride;
      this.house = target?.id;
    }
    this.holdPunk -= dt;
    this.holdPride -= dt;
    this.punk =
      hp > this.punk ? hp : this.holdPunk > 0 ? this.punk : Math.max(hp, this.punk - dt * 120);
    this.pride =
      pride > this.pride
        ? pride
        : this.holdPride > 0
          ? this.pride
          : Math.max(pride, this.pride - dt * 1.2);
    this.lastHp = hp;
    this.lastPr = pride;
    rect(c, 0, 0, w, h, '#0B0A0FEB');
    const gap = small ? 62 : 110,
      barW = (w - gap - 28) / 2,
      left = 10,
      right = w - 10 - barW,
      barY = small ? 17 : 27,
      barH = small ? 10 : 18;
    text(c, LOOKS[m.look].name, left, small ? 8 : 14, small ? 10 : 13, P.paper);
    text(
      c,
      target ? `${S.hud.pride} · ${target.name}` : S.brand,
      w - 10,
      small ? 8 : 14,
      small ? 9 : 13,
      P.paper,
      'right',
    );
    rect(c, left, barY, barW, barH, '#342B39');
    rect(c, left, barY, (barW * this.punk) / 100, barH, P.pink);
    rect(c, left, barY, (barW * hp) / 100, barH, P.green);
    rect(c, right, barY, barW, barH, '#342B39');
    rect(c, right + barW * (1 - this.pride), barY, barW * this.pride, barH, P.orange);
    rect(c, right + barW * (1 - pride), barY, barW * pride, barH, P.yellow);
    for (let i = 1; i < (target?.bars ?? 1) * 2; i++)
      line(
        c,
        [
          [right + (barW * i) / (target.bars * 2), barY],
          [right + (barW * i) / (target.bars * 2), barY + barH],
        ],
        P.ink,
        i % 2 === 0 ? 5 : 2,
      );
    text(
      c,
      String(Math.max(0, Math.ceil(target?.timer ?? 60))).padStart(2, '0'),
      w / 2,
      small ? 16 : 29,
      small ? 25 : 42,
      target?.timer <= 3 ? P.orange : P.yellow,
      'center',
      'Impact',
    );
    text(
      c,
      `${S.hud.round} ${Math.min(12, m.burned + 1)}`,
      w / 2,
      small ? 34 : 57,
      small ? 9 : 11,
      P.paper,
      'center',
    );
    if (v.touch)
      text(
        c,
        `${count.activeCount}/${count.capacity}`,
        w / 2 + (v.portrait ? 45 : 65),
        33,
        11,
        P.green,
        'center',
      );
    for (let i = 0; i < 3; i++)
      poly(
        c,
        [
          [left + i * 13, barY + barH + 10],
          [left + 4 + i * 13, barY + barH + 1],
          [left + 7 + i * 13, barY + barH + 7],
          [left + 10 + i * 13, barY + barH + 2],
          [left + 10 + i * 13, barY + barH + 11],
        ],
        i < m.lives ? P.pink : '#514352',
      );
    text(
      c,
      `${String(m.score).padStart(6, '0')}  ×${m.combo}${small ? '' : ` ${S.hud.streak}`}`,
      left + 45,
      barY + barH + 7,
      small ? 10 : 14,
      P.paper,
    );
    const y = small ? 49 : 76;
    text(c, S.hud.riot, left, y, small ? 9 : 11, P.green);
    rect(c, left + 32, y - 4, small ? 55 : 120, 7, '#403747');
    rect(c, left + 32, y - 4, ((small ? 55 : 120) * m.riot) / 100, 7, P.green);
    for (let i = 0; i < 4; i++) {
      const height = [4, 7, 5, 9][i] * (0.25 + m.beatPulse * 0.75);
      rect(c, left + (small ? 95 : 165) + i * 5, y + 3 - height, 3, height, P.green);
    }
    for (let i = 0; i < 12; i++)
      rect(c, w / 2 - 42 + i * 7, y - 3, 5, 6, i < m.burned ? P.pink : '#625968');
    c.save();
    if (this.emptyUntil > m.time) c.translate(Math.sin(m.time * 90) * 3, 0);
    for (let i = 0; i < m.maxAmmo; i++) {
      rect(c, w - 15 - i * 12, y - 4, 6, 9, i < Math.floor(m.ammo) ? P.green : '#514352');
      rect(c, w - 13 - i * 12, y - 7, 2, 3, P.paper);
    }
    if (this.emptyUntil > m.time) text(c, C.empty, w - 6, y, 12, P.pink, 'right');
    c.restore();
    if (!small) text(c, stageLabel(m.player.pipeline), w - 15, 57, 10, P.paper, 'right');
  }
}
