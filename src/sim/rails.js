import { TUNING as T, TRICKS } from '../data/tuning.js';
import { LAP, Z, near } from './row.js';
import { addTrick } from './combo.js';
import { tilt, scoreAir, bail } from './player.js';
// Grindable edges. Row rails store ring positions (s0, s1); course rails (training,
// Bee Alley) store absolute x and set abs: true.
export const GRIND_NAMES = { curb: '5-0 GRIND', bench: '50-50 GRIND', rail: 'BOARDSLIDE', ledge: 'SMITH GRIND' };
export function railSpan(m, r) {
  const x0 = r.abs ? r.s0 : near(r.s0, m.player.x);
  return [x0, x0 + (r.s1 - r.s0)];
}
// Curb segments between walkways, plus benches on the sidewalk in front of every
// other house. Built from the houses because walkway positions depend on the facade.
export function rowRails(houses) {
  const rails = [];
  let id = 9000;
  const breaks = houses
    .map((h) => h.s + h.facade.door.dx)
    .map((x) => [x - 1.2, x + 1.2])
    .concat([
      [0, 9],
      [LAP - 13, LAP],
    ])
    .sort((a, b) => a[0] - b[0]);
  let from = 0;
  for (const [a, b] of breaks) {
    if (a - from >= 4) rails.push({ id: ++id, kind: 'curb', s0: from, s1: a, z: Z.curb - 0.05, h: 0.22 });
    from = Math.max(from, b);
  }
  houses.forEach((h, i) => {
    if (i % 2) return;
    const c = h.s + (h.facade.door.dx > 0 ? -4.8 : 4.8);
    rails.push({ id: ++id, kind: 'bench', s0: c - 1.2, s1: c + 1.2, z: -3.9, h: 0.48, solid: true });
  });
  return rails;
}
export function catchRail(m, prevY) {
  const p = m.player;
  for (const r of m.rails) {
    const [x0, x1] = railSpan(m, r);
    if (p.x < x0 - 0.2 || p.x > x1 - 0.3) continue;
    if (Math.abs(p.z - r.z) > T.railSnapZ) continue;
    if (prevY < r.h - 0.02 || p.y > r.h + 0.02) continue;
    startGrind(m, r, x1);
    return true;
  }
  return false;
}
function startGrind(m, r, x1) {
  const p = m.player,
    flipLeft = p.flip ? p.flip.dur - p.flip.t : 0,
    bailed = flipLeft > 0.06 || Math.abs(tilt(p.rot)) > T.sketchyLanding;
  if (bailed) {
    p.y = r.h;
    // Knocked off the rail; while shielded it is a sketchy catch with the trick lost.
    if (bail(m)) return;
  }
  scoreAir(m);
  if (!bailed && m.time - p.lastGrindEnd < 0.9) addTrick(m, 'GAP', TRICKS.gap);
  p.grind = { rail: r, x1, t: 0, name: GRIND_NAMES[r.kind] ?? '50-50 GRIND' };
  p.y = r.h;
  p.vy = 0;
  p.z = r.z;
  p.vz = 0;
  p.rot = 0;
  p.rotTotal = 0;
  p.ramp = false;
  p.grounded = false;
  m.stats.grinds++;
  m.emit('grind', p.grind.name, { kind: r.kind });
}
export function updateGrind(m, dt) {
  const p = m.player,
    g = p.grind;
  g.t += dt;
  p.vx = Math.max(T.grindMinSpeed, p.vx - T.grindDecel * dt);
  p.x += p.vx * dt;
  p.y = g.rail.h;
  if (p.x >= g.x1) leaveGrind(m, false);
}
export function leaveGrind(m, popped) {
  const p = m.player,
    g = p.grind;
  if (!g) return;
  addTrick(m, g.name, TRICKS.grind + TRICKS.grindPerSecond * g.t);
  p.lastGrindEnd = m.time;
  p.grind = null;
  p.grounded = false;
  p.airAge = 0;
  p.rot = 0;
  p.rotTotal = 0;
  p.vy = popped ? T.jumpVelocity * 0.95 : 1.2;
  p.coyote = popped ? 0 : T.coyote;
  m.emit('grindEnd', null, { kind: g.rail.kind, seconds: g.t });
}
