import { cachedCanvas, rect, line, poly, text, COLORS as P } from './draw.js';
import { S } from '../data/strings.js';
export class Scenery {
  constructor() {
    this.facades = new Map();
    this.background = null;
  }
  backdrop(w, h, portrait) {
    const key = `${w}/${h}/${portrait}`;
    if (this.background?.key === key) return this.background.canvas;
    const canvas = cachedCanvas(w, h),
      c = canvas.getContext('2d');
    rect(c, 0, 0, w, h, '#18141F');
    rect(c, 0, 0, w, h * 0.38, '#24113A');
    rect(c, 0, h * 0.22, w, h * 0.18, '#3A1D5C');
    for (let i = 0; i < 26; i++) {
      const x = (i * w) / 25;
      rect(c, x, h * 0.14 + (i % 5) * 11, w / 24, h * 0.3, '#160E22');
      rect(c, x + 9, h * 0.22, 4, 13, '#674065');
    }
    if (portrait) {
      rect(c, w * 0.27, 0, w * 0.71, h, '#3C3941');
      rect(c, w * 0.29, 0, 5, h, '#8D8692');
      for (let y = 90; y < h; y += 110) rect(c, w * 0.74, y, 3, 40, '#7A737D');
    } else {
      rect(c, 0, h * 0.46, w, h * 0.46, '#3C3941');
      rect(c, 0, h * 0.45, w, 8, '#8D8692');
      rect(c, 0, h * 0.92, w, h * 0.08, '#1B1722');
      for (let x = 0; x < w; x += 120) rect(c, x, h * 0.84, 60, 3, '#7A737D');
    }
    this.background = { key, canvas };
    return canvas;
  }
  house(h, burned = false) {
    const key = `${h.id}:${burned}`;
    if (this.facades.has(key)) return this.facades.get(key);
    const canvas = cachedCanvas(320, 310),
      c = canvas.getContext('2d');
    const wall = ['#E8DCC4', '#F4A6A0', '#A8C5C2', '#CDBB8E'][h.id % 4];
    rect(c, 20, 55, 280, 230, P.ink);
    rect(c, 26, 61, 268, 219, burned ? '#332C37' : wall);
    poly(
      c,
      [
        [8, 63],
        [160, 2],
        [312, 63],
      ],
      P.ink,
    );
    poly(
      c,
      [
        [22, 57],
        [160, 12],
        [297, 57],
      ],
      burned ? '#51243A' : '#1F2A44',
    );
    for (let row = 0; row < 2; row++)
      for (let col = 0; col < 4; col++) {
        const x = 42 + col * 62,
          y = 81 + row * 69;
        rect(c, x, y, 41, 52, P.ink);
        rect(c, x + 4, y + 4, 33, 44, burned ? '#FF5A1F' : '#B7A381');
        line(
          c,
          [
            [x + 20, y + 4],
            [x + 20, y + 48],
          ],
          P.ink,
          3,
        );
        line(
          c,
          [
            [x + 4, y + 25],
            [x + 37, y + 25],
          ],
          P.ink,
          3,
        );
      }
    rect(c, 126, 203, 68, 77, P.ink);
    rect(c, 136, 210, 48, 70, burned ? '#110E14' : '#71575B');
    for (const x of [26, 96, 210, 278]) {
      rect(c, x, 192, 14, 89, burned ? '#615361' : '#F2EDE4');
      rect(c, x - 5, 186, 24, 9, P.ink);
    }
    rect(c, 10, 274, 300, 12, P.ink);
    rect(c, 27, 286, 266, 9, '#777078');
    rect(c, 38, 296, 244, 8, '#55505A');
    text(c, h.letters, 160, 38, 26, burned ? P.pink : P.paper, 'center', 'Georgia');
    rect(c, 22, 161, 276, 27, P.ink);
    text(c, h.name, 160, 175, 17, burned ? P.pink : P.paper, 'center');
    if (burned) {
      c.save();
      c.translate(163, 111);
      c.rotate(-0.13);
      text(c, h.id === 11 ? S.art.burst : S.art.denied, 0, 0, 30, P.green, 'center', 'Impact');
      c.restore();
    }
    this.facades.set(key, canvas);
    return canvas;
  }
}
