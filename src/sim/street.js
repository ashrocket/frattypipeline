import { TUNING as T, SCORE } from '../data/tuning.js';
import { C, DAYS } from '../data/strings.js';
import { SHOPS } from '../data/houses.js';
import { ROW, LANES, Z, near, objX, generateHazards } from './row.js';
import { wipeout, stumble, launch } from './player.js';
import { newLapCans } from './house.js';
import { itemName } from './throw.js';
import { rowRails } from './rails.js';
import { enterAlley } from './alley.js';
// Small things trip you (stumble); big things knock you down (wipeout).
const SMALL = new Set(['cone', 'pothole', 'flatbar', 'gnome', 'bench']);
// Collisions are generous to the player: hazards are a little smaller than their art.
function overlaps(p, x, z, hx, hz) {
  return Math.abs(x - p.x) <= hx + 0.3 && Math.abs(z - p.z) <= hz + 0.25;
}
export function truckBox(m, h) {
  if (!h.fd || h.fd.stage === 'coming') return null;
  return { x: near(h.s, m.player.x), z: -2.1, hx: 3.4, hz: 0.75, h: 2.6 };
}
function smash(m, o, x, z) {
  o.taken = true;
  m.award(SCORE.smash);
  m.emit('smash', C.smash, { x, z, kind: o.kind });
}
function hit(m, kind) {
  return SMALL.has(kind) ? stumble(m, kind) : wipeout(m, kind);
}
// Long things (rails, ledges, benches) only trip you head-on. Brush the side and you
// are nudged off it, like a wall, so carving next to a ledge never chains stumbles.
function sideSwipe(p, x, z, hx, hz) {
  if (p.x < x - hx + 0.35) return false;
  p.z = z + Math.sign(p.z - z || 1) * (hz + 0.26);
  p.vz = 0;
  return true;
}
export function updateStreet(m, dt) {
  const p = m.player,
    shield = m.flowTime > 0;
  for (const o of m.hazards) {
    if (o.taken) continue;
    const ox = objX(o, p.x);
    if (o.kind === 'keg') {
      if (!o.rolling && ox - p.x < 13 && ox - p.x > 3) {
        o.rolling = true;
        m.emit('keg', null, { x: ox, z: o.z });
      }
      if (o.rolling) {
        o.z += 3.2 * dt;
        if (o.z > Z.edge + 0.4) o.taken = true;
      }
      if (o.z < Z.walkBack) continue;
    }
    if (!overlaps(p, ox, o.z, o.hx, o.hz)) continue;
    if (o.kind === 'crate') {
      if (p.y > 1.4) continue;
      o.taken = true;
      m.bottles = Math.min(T.maxBottles, m.bottles + T.crateBottles);
      m.emit('crate', C.crate, { x: ox, z: o.z });
    } else if (o.kind === 'ramp') {
      if (p.grounded && p.vx > 3 && p.wipeout <= 0) launch(m);
    } else if (p.grind || p.y >= o.h) continue;
    else if (o.rail && sideSwipe(p, ox, o.z, o.hx, o.hz)) continue;
    else if (shield) {
      if (!o.rail) smash(m, o, ox, o.z);
    } else hit(m, o.kind);
  }
  for (const r of m.rails)
    if (r.solid && !shield && !p.grind && p.y < r.h) {
      const x0 = objX({ s: r.s0, abs: r.abs }, p.x),
        half = (r.s1 - r.s0) / 2;
      if (overlaps(p, x0 + half, r.z, half, 0.25) && !sideSwipe(p, x0 + half, r.z, half, 0.25)) hit(m, 'bench');
    }
  if (m.level !== 'row') return;
  // Oncoming golf carts from day 2: honk, headlights, carve around (or ramp over).
  if (m.lap >= 2 && m.phase === 'playing') {
    m.cartTimer -= dt;
    if (m.cartTimer <= 0) {
      m.cartTimer = Math.max(4.5, 10 - m.lap) / Math.max(0.5, m.diff.hazards) + m.random() * 4;
      const z = LANES[Math.floor(m.random() * LANES.length)];
      m.carts.push({ id: ++m.id, x: p.x + 42, z, vx: -4.5, hx: 1.3, hz: 0.7, h: 1.6, honked: false });
    }
  }
  for (const cart of m.carts) {
    cart.x += cart.vx * dt;
    if (!cart.honked && cart.x - p.x < 26) {
      cart.honked = true;
      m.emit('honk', null, { x: cart.x, z: cart.z });
    }
    if (!cart.smashed && overlaps(p, cart.x, cart.z, cart.hx, cart.hz) && p.y < cart.h && !p.grind) {
      if (shield) {
        cart.smashed = true;
        m.award(SCORE.smash * 2);
        m.emit('smash', C.totaled, { x: cart.x, z: cart.z, kind: 'cart' });
      } else wipeout(m, 'cart');
    }
  }
  m.carts = m.carts.filter((cart) => cart.x > p.x - 30);
  for (const h of m.houses) {
    const box = truckBox(m, h);
    if (box && overlaps(p, box.x, box.z, box.hx, box.hz) && p.y < box.h && !p.grind) wipeout(m, 'truck');
  }
}
// Rolling through a shop's sidewalk pad unlocks and restocks its destruction method.
// The apiary is different: its pad opens the gate into Bee Alley.
export function updateShops(m) {
  const p = m.player;
  if (m.level !== 'row' || p.wipeout > 0 || p.z > Z.walkFront + 0.2) return;
  ROW.shops.forEach((place, index) => {
    const shop = SHOPS[index],
      x = near(place.s, p.x);
    if (Math.abs(p.x - x) > 4 || m.shopVisits[index] === m.lap) return;
    // Hives only ever come from the alley (owner rule 8); mid-rescue the gate stays
    // shut and today's visit is kept for later.
    if (shop.kind === 'bees') {
      if (m.phase === 'playing') {
        m.shopVisits[index] = m.lap;
        enterAlley(m, index, x);
      }
      return;
    }
    m.shopVisits[index] = m.lap;
    const first = !m.unlocked[shop.kind];
    m.unlocked[shop.kind] = true;
    m.items[shop.kind] = Math.min(shop.cap, (m.items[shop.kind] ?? 0) + shop.stock);
    m.bottles = Math.min(T.maxBottles, m.bottles + T.shopBottles);
    m.stats.shopVisits++;
    if (first) {
      m.award(SCORE.shop);
      m.item = shop.kind;
      m.emit('unlock', C.unlock, { shop: index, kind: shop.kind, sub: itemName(shop.kind), blurb: shop.blurb, x, z: Z.walkBack });
    } else m.emit('restock', C.restock, { shop: index, kind: shop.kind, sub: itemName(shop.kind), x });
  });
}
export const dayName = (lap) => DAYS[(lap - 1) % DAYS.length];
export function startLap(m, lap) {
  m.lap = lap;
  m.hazards = generateHazards(m.random, lap, m.diff.hazards);
  m.rails = [
    ...m.staticRails,
    ...m.hazards
      .filter((o) => o.kind === 'flatbar')
      .map((o) => ({ id: o.id + 0.5, kind: 'rail', s0: o.s - o.hx, s1: o.s + o.hx, z: o.z, h: o.h })),
  ];
  for (const o of m.hazards) if (o.kind === 'flatbar') o.rail = true;
  m.carts = [];
  m.cartTimer = 3;
  for (const h of m.houses) newLapCans(h);
  if (lap > 1) m.emit('lap', dayName(lap), { lap, day: dayName(lap) });
}
export { rowRails };
