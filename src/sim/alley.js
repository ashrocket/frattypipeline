import { TUNING as T, SCORE } from '../data/tuning.js';
import { C } from '../data/strings.js';
import { SHOPS } from '../data/houses.js';
import { Z } from './row.js';
import { itemName } from './throw.js';
import { leaveGrind } from './rails.js';
// Bee Alley: a short side run behind the frat back yards. Grab hives; don't stand
// around, or a bro in a back yard notices you and you get chased out.
export const ALLEY_LENGTH = 84;
const LEDGE_Z = 1.4;
const HIVES = [
  [14, -1.2, 0],
  [25, 1, 0],
  [36, 0, 1],
  [50, -1.6, 0],
  [62, 1.4, 1], // up on a fence post: ollie for it and come down on the ledge
  [73, 1.4, 0.45], // at the end of the ledge
];
const GNOMES = [
  [30, -0.4],
  [44, 1.2],
  [57, -0.9],
];
// Through the gate (or back out) on the ground: a grind on the Row's curb ends here
// and banks, so it can't ride on in alley coordinates.
function dismount(m) {
  const p = m.player;
  if (!p.grind) return;
  leaveGrind(m, false);
  p.y = 0;
  p.vy = 0;
  p.grounded = true;
  p.airAge = 0;
  p.coyote = 0;
}
export function enterAlley(m, shopIndex, shopX) {
  const p = m.player;
  dismount(m);
  m.level = 'alley';
  m.alley = {
    shop: shopIndex,
    rowX: shopX + 6,
    still: 0,
    got: 0,
    t: 0,
    hives: HIVES.map(([x, z, h], i) => ({ id: 80000 + i, x, z, h, taken: false })),
    rowHazards: m.hazards,
    rowRails: m.rails,
  };
  m.hazards = GNOMES.map(([x, z], i) => ({ id: 81000 + i, kind: 'gnome', s: x, z, z0: z, hx: 0.3, hz: 0.3, h: 0.55, abs: true, taken: false }));
  m.rails = [{ id: 82000, kind: 'ledge', s0: 64, s1: 72, z: LEDGE_Z, h: 0.45, abs: true }];
  m.hazards.push({ id: 81100, kind: 'flatbar', s: 68, z: LEDGE_Z, z0: LEDGE_Z, hx: 4, hz: 0.22, h: 0.45, abs: true, taken: false, rail: true });
  p.x = 0;
  p.z = 0;
  p.vx = Math.max(p.vx, T.roll);
  aimReset(m);
  m.emit('alleyEnter', C.beeAlley, { sub: C.beeAlleySub });
}
function aimReset(m) {
  m.aiming = false;
}
export function updateAlley(m, dt) {
  const a = m.alley,
    p = m.player;
  a.t += dt;
  for (const hive of a.hives) {
    if (hive.taken) continue;
    if (Math.abs(hive.x - p.x) < 0.9 && Math.abs(hive.z - p.z) < 0.8 && Math.abs(p.y - hive.h) < 0.75) {
      hive.taken = true;
      const cap = SHOPS.find((s) => s.kind === 'bees').cap,
        full = (m.items.bees ?? 0) >= cap;
      // Over the cap, a hive is still worth grabbing: it's honey (points).
      if (!full) m.items.bees = (m.items.bees ?? 0) + 1;
      a.got++;
      m.stats.hives++;
      m.award(SCORE.hive);
      m.emit('hive', full ? C.honey : C.hive, { x: hive.x, z: hive.z, y: hive.h, count: m.items.bees, full });
    }
  }
  // Bros in their back yards only notice someone standing around (3 s on Easy Street).
  a.still = p.vx < 1 ? a.still + dt : Math.max(0, a.still - dt * 2);
  if (a.still >= m.diff.notice) {
    m.emit('noticed', C.noticed, { x: p.x });
    exitAlley(m, 'chased');
    return;
  }
  if (p.x >= ALLEY_LENGTH) exitAlley(m, 'done');
}
export function exitAlley(m, how) {
  const a = m.alley,
    p = m.player,
    first = !m.unlocked.bees && a.got > 0;
  dismount(m);
  m.level = 'row';
  m.hazards = a.rowHazards;
  m.rails = a.rowRails;
  p.x = a.rowX;
  p.z = Z.walkFront + 0.4;
  m.shopVisits[a.shop] = m.lap;
  m.alley = null;
  if (a.got > 0) {
    m.unlocked.bees = true;
    if (first) {
      m.item = 'bees';
      m.award(SCORE.shop);
      m.emit('unlock', C.unlock, { kind: 'bees', sub: itemName('bees'), blurb: SHOPS[0].blurb, shop: a.shop, x: p.x, z: Z.walkBack });
    }
  }
  m.emit('alleyExit', how === 'chased' ? C.chased : C.alleyDone, { got: a.got, how });
}
