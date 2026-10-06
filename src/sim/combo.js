import { TUNING as T, TRICKS } from '../data/tuning.js';
import { C } from '../data/strings.js';
// Tony Hawk-style combos with Alto's payoff: banked style fills FLOW, and full FLOW
// is speed plus a shield. Repeating a trick inside one combo is worth half.
export const newCombo = () => ({ parts: [], counts: {}, points: 0, ground: 0, active: false });
export const comboMultiplier = (c) => Math.min(TRICKS.maxMultiplier, Object.keys(c.counts).length);
export function addTrick(m, name, points) {
  const c = m.combo,
    seen = c.counts[name] ?? 0;
  c.counts[name] = seen + 1;
  const value = Math.round(points * (seen > 0 ? 0.5 : 1));
  c.parts.push(name);
  c.points += value;
  c.active = true;
  c.ground = 0;
  m.stats.tricks++;
  m.emit('trick', name, { points: value, mult: comboMultiplier(c), combo: c.points, parts: c.parts.length, names: c.parts.slice(-6) });
  return value;
}
// Links (perfect pops, reverts) keep a combo alive on the ground.
export function comboLink(m, name, points) {
  if (!m.combo.active && name === 'REVERT') return 0;
  return addTrick(m, name, points);
}
export function bankCombo(m) {
  const c = m.combo;
  if (!c.active) return 0;
  const mult = comboMultiplier(c),
    total = c.points * mult,
    // What the score actually gained (the route multiplies it); FLOW fills the same on every route.
    scored = m.award(total);
  m.flow = Math.min(100, m.flow + total / 40);
  if (c.parts.length >= 3) m.bottles = Math.min(T.maxBottles, m.bottles + 1);
  m.stats.bestCombo = Math.max(m.stats.bestCombo, scored);
  m.dayBestCombo = Math.max(m.dayBestCombo ?? 0, scored);
  m.emit('combo', C.combo, { points: scored, mult, parts: c.parts.slice(), refill: c.parts.length >= 3 });
  m.combo = newCombo();
  if (m.flow >= 100 && m.flowTime <= 0) startFlow(m);
  return total;
}
export function comboFail(m, reason = 'BAILED') {
  if (!m.combo.active) return;
  m.emit('comboLost', reason, { lost: m.combo.points });
  m.combo = newCombo();
}
export function startFlow(m) {
  m.flowTime = T.flowTime;
  m.stats.flows++;
  m.emit('flow', C.flow);
}
export function addFlow(m, amount) {
  if (m.flowTime > 0) return;
  m.flow = Math.min(100, m.flow + amount);
  if (m.flow >= 100) startFlow(m);
}
export function updateCombo(m, dt) {
  const c = m.combo,
    p = m.player;
  if (c.active) {
    if (p.grounded && !p.grind && p.wipeout <= 0) {
      c.ground += dt;
      if (c.ground >= T.comboBank) bankCombo(m);
    } else c.ground = 0;
  }
  if (m.flowTime > 0) {
    m.flowTime = Math.max(0, m.flowTime - dt);
    if (m.flowTime === 0) {
      m.flow = 0;
      m.emit('flowEnd');
    }
  }
}
