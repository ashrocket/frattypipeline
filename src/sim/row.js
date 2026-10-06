import { HOUSES, SHOPS } from '../data/houses.js';
// Greek Row is a loop. Everything that belongs to the street stores a ring position `s`;
// the player and transient actors use continuous world x. `near()` maps between them.
export const LOT = 18;
export const SHOP_LOT = 10;
export const INTRO = 16;
export const CORNER = 16;
// Depth bands (meters). z grows toward the camera.
export const Z = Object.freeze({
  facade: -11,
  porch: -10,
  lawnBack: -9.3,
  lawnFront: -5,
  walkBack: -4.6,
  walkFront: -3.2,
  curb: -3,
  streetNear: 2.6,
  farWalk: 3,
  edge: 5.2,
});
export const LANES = [-1.8, 0.2, 1.9];
function build() {
  let x = INTRO;
  const houses = [],
    shops = [];
  HOUSES.forEach((data, id) => {
    houses.push({ id, s: x + LOT / 2, lot: [x, x + LOT] });
    x += LOT;
    if (id % 2 === 1 && shops.length < SHOPS.length) {
      shops.push({ id: shops.length, s: x + SHOP_LOT / 2, lot: [x, x + SHOP_LOT] });
      x += SHOP_LOT;
    }
  });
  return { houses, shops, length: x + CORNER };
}
export const ROW = build();
export const LAP = ROW.length;
export const ring = (x) => ((x % LAP) + LAP) % LAP;
// World x of ring position s nearest to world x (shortest way around the loop).
export const near = (s, x) => x + ((((s - ring(x)) % LAP) + LAP * 1.5) % LAP) - LAP / 2;
export const lapOf = (x) => Math.floor(x / LAP) + 1;
// World x of a street object: ring objects map near the player; course objects are absolute.
export const objX = (o, x) => (o.abs ? o.s : near(o.s, x));
// Facade geometry in meters, relative to the house center. Shared by targeting and art.
const FACADES = {
  colonial: {
    width: 11.6,
    eave: 4.5,
    peak: 6.5,
    door: { dx: 0, w: 1.3, h: 2.2 },
    windows: [
      [-3.9, 1.6],
      [-2.1, 1.6],
      [2.1, 1.6],
      [3.9, 1.6],
      [-3.9, 3.5],
      [-2.1, 3.5],
      [0, 3.5],
      [2.1, 3.5],
      [3.9, 3.5],
    ],
    roof: [-5.2, 5.2],
  },
  craftsman: {
    width: 12.2,
    eave: 3.6,
    peak: 6,
    door: { dx: -2.6, w: 1.3, h: 2.1 },
    windows: [
      [-4.6, 1.6],
      [0.4, 1.6],
      [2.4, 1.6],
      [4.4, 1.6],
      [-1.2, 4.4],
      [1.2, 4.4],
    ],
    roof: [-5.6, 5.6],
  },
  tudor: {
    width: 11.2,
    eave: 4.2,
    peak: 6.6,
    door: { dx: 2.6, w: 1.2, h: 2.2 },
    windows: [
      [-3.8, 1.6],
      [-1.4, 1.6],
      [4.4, 1.7],
      [-2.6, 3.6],
      [2.6, 3.8],
      [0, 5.1],
    ],
    roof: [-5, 5],
  },
  modern: {
    width: 12.6,
    eave: 5.4,
    peak: 5.4,
    door: { dx: 4, w: 1.5, h: 2.3 },
    windows: [
      [-4.4, 1.5],
      [-2.2, 1.5],
      [0.2, 1.5],
      [-4.4, 3.9],
      [-1.6, 3.9],
      [1.2, 3.9],
      [4, 3.9],
    ],
    roof: [-6, 6],
  },
  georgian: {
    width: 12,
    eave: 4.8,
    peak: 6.2,
    door: { dx: 0, w: 1.3, h: 2.3 },
    windows: [
      [-4.2, 1.6],
      [-2.2, 1.6],
      [2.2, 1.6],
      [4.2, 1.6],
      [-4.2, 3.6],
      [-2.2, 3.6],
      [0, 3.6],
      [2.2, 3.6],
      [4.2, 3.6],
    ],
    roof: [-5.6, 5.6],
  },
  gothic: {
    width: 11.6,
    eave: 4.6,
    peak: 7,
    door: { dx: -2.8, w: 1.3, h: 2.4 },
    windows: [
      [-0.6, 1.7],
      [1.6, 1.7],
      [3.9, 1.7],
      [-4.1, 3.8],
      [-1.6, 3.8],
      [1, 3.8],
      [3.6, 3.8],
    ],
    roof: [-5.2, 5.2],
  },
  brownstone: {
    width: 11,
    eave: 6.1,
    peak: 6.1,
    door: { dx: -2.9, w: 1.2, h: 2.2 },
    windows: [
      [0.4, 1.8],
      [2.4, 1.8],
      [4.3, 1.8],
      [-4.3, 3.5],
      [-1.6, 3.5],
      [1.4, 3.5],
      [4.1, 3.5],
      [-4.3, 5.1],
      [-1.6, 5.1],
      [1.4, 5.1],
      [4.1, 5.1],
    ],
    roof: [-5.2, 5.2],
  },
  victorian: {
    width: 11.4,
    eave: 4.4,
    peak: 7.2,
    door: { dx: 1.2, w: 1.2, h: 2.2 },
    windows: [
      [-3.9, 1.6],
      [-1.5, 1.6],
      [3.6, 1.6],
      [-3.9, 3.6],
      [0.2, 3.6],
      [3, 3.6],
      [1.6, 5.4],
    ],
    roof: [-5.2, 5.2],
  },
  tower: {
    width: 12,
    eave: 6.4,
    peak: 6.4,
    door: { dx: 0, w: 2, h: 2.4 },
    windows: [
      [-4.2, 1.5],
      [-2.4, 1.5],
      [2.4, 1.5],
      [4.2, 1.5],
      [-4.2, 3.4],
      [-1.4, 3.4],
      [1.4, 3.4],
      [4.2, 3.4],
      [-4.2, 5.2],
      [-1.4, 5.2],
      [1.4, 5.2],
      [4.2, 5.2],
    ],
    roof: [-5.6, 5.6],
  },
};
export function facade(style) {
  const f = FACADES[style] ?? FACADES.colonial;
  return {
    ...f,
    windows: f.windows.map(([dx, y]) => ({ dx, y, w: 1.15, h: 1.25 })),
    roofY: (f.eave + f.peak) / 2,
  };
}
// Per-lap hazards, generated deterministically from the run's seeded random stream.
const MIX = [
  { cone: 7, pothole: 3, crate: 6, ramp: 2, keg: 0 },
  { cone: 9, pothole: 4, crate: 6, ramp: 2, keg: 3 },
  { cone: 10, pothole: 5, crate: 5, ramp: 2, keg: 4 },
];
const SIZE = {
  cone: { hx: 0.3, hz: 0.3, h: 0.7 },
  pothole: { hx: 0.6, hz: 0.42, h: 0.22 },
  crate: { hx: 0.45, hz: 0.45, h: 0 },
  ramp: { hx: 0.9, hz: 0.7, h: 0 },
  keg: { hx: 0.35, hz: 0.35, h: 0.6 },
  flatbar: { hx: 1.7, hz: 0.22, h: 0.45 },
};
export function shopPad(shop) {
  return { s0: shop.s - 4, s1: shop.s + 4, z0: Z.walkBack, z1: Z.walkFront };
}
export function generateHazards(random, lap, scale = 1) {
  const base = MIX[Math.min(lap, MIX.length) - 1],
    mix = Object.fromEntries(Object.entries(base).map(([k, n]) => [k, k === 'crate' || k === 'ramp' ? n : Math.round(n * scale)]));
  mix.flatbar = lap >= 1 ? Math.max(1, Math.round(2 * scale)) : 0;
  const out = [];
  let id = lap * 1000;
  const blocked = (s, z) =>
    s < INTRO + 14 ||
    s > LAP - CORNER - 4 ||
    ROW.shops.some((shop) => Math.abs(s - shop.s) < 6.5 && z < Z.curb + 0.4) ||
    (z > Z.curb - 0.45 && z < Z.curb + 0.45 && kind !== 'keg') ||
    out.some((o) => Math.abs(o.s - s) < 5 && Math.abs(o.z - z) < 1.6);
  let kind;
  for (kind of ['ramp', 'crate', 'flatbar', 'keg', 'cone', 'pothole']) {
    for (let n = 0; n < mix[kind]; n++) {
      for (let attempt = 0; attempt < 40; attempt++) {
        const s = INTRO + 14 + random() * (LAP - INTRO - CORNER - 20);
        let z =
          kind === 'keg'
            ? Z.lawnFront - 0.3
            : kind === 'crate'
              ? -4 + random() * 6.2
              : kind === 'ramp' || kind === 'flatbar'
                ? LANES[Math.floor(random() * LANES.length)]
                : -3.9 + random() * 6.1;
        if (blocked(s, z)) continue;
        out.push({ id: ++id, kind, s, z, z0: z, ...SIZE[kind], taken: false, rolling: false });
        break;
      }
    }
  }
  return out.sort((a, b) => a.s - b.s);
}
