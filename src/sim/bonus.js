import { TUNING as T, SCORE } from '../data/tuning.js';
import { C } from '../data/strings.js';
import { BONUS_SKATERS } from '../data/looks.js';
// The 10x bonus: ten passes at one trash can, each by a different skater from a
// different point of view. Landing physics are identical in every view; only the
// camera changes, so every pass asks for the same skill: release at the right time.
export const PASSES = BONUS_SKATERS.length;
export function startBonus(m) {
  m.phase = 'bonus';
  m.phaseTime = 0;
  m.aiming = false;
  m.bonus = { pass: 0, stage: 'card', t: 0, x: 0, thrown: null, results: [], hits: 0 };
  m.emit('bonusStart', C.bonus, { passes: PASSES });
}
export function bonusSkater(m) {
  return BONUS_SKATERS[Math.min(PASSES - 1, m.bonus?.pass ?? 0)];
}
function beginRun(b) {
  b.stage = 'run';
  b.t = 0;
  b.x = -T.bonusSpeed * T.bonusLead;
  b.thrown = null;
}
export function bonusPress(m) {
  const b = m.bonus;
  if (b.stage === 'card' && b.t >= 0.35) beginRun(b);
  return true;
}
export function bonusRelease(m) {
  const b = m.bonus;
  if (b.stage !== 'run' || b.thrown) return true;
  b.thrown = { x: b.x, landX: b.x + T.bonusSpeed * T.bonusFlight, t: 0, done: false };
  m.emit('bonusThrow', null, { pass: b.pass, x: b.x });
  return true;
}
function record(m, hit, error) {
  const b = m.bonus,
    skater = bonusSkater(m);
  b.results.push({ pass: b.pass, name: skater.name, pov: skater.pov, hit, error });
  let points = 0;
  if (hit) {
    b.hits++;
    m.stats.bonusHits++;
    points = m.award(SCORE.bonusHit * SCORE.bonusMultiplier);
  }
  m.emit(hit ? 'bonusHit' : 'bonusMiss', hit ? C.bonusHit : C.bonusMiss, {
    pass: b.pass,
    error,
    points,
    sub: hit ? `+${points}` : null,
  });
  b.stage = 'result';
  b.t = 0;
}
export function updateBonus(m, dt) {
  const b = m.bonus;
  b.t += dt;
  m.phaseTime += dt;
  if (b.stage === 'card') {
    if (b.t >= T.bonusCard) beginRun(b);
  } else if (b.stage === 'run') {
    b.x += T.bonusSpeed * dt;
    if (b.thrown && !b.thrown.done) {
      b.thrown.t += dt;
      if (b.thrown.t + 1e-9 >= T.bonusFlight) {
        b.thrown.done = true;
        const error = b.thrown.landX;
        record(m, Math.abs(error) <= bonusSkater(m).tol, error);
      }
    } else if (!b.thrown && b.x >= T.bonusSpeed * T.bonusTail) record(m, false, null);
  } else if (b.stage === 'result' && b.t >= T.bonusResult) {
    b.pass++;
    if (b.pass < PASSES) {
      b.stage = 'card';
      b.t = 0;
      return;
    }
    if (b.hits === PASSES) {
      const points = m.award(SCORE.bonusPerfect);
      m.emit('perfect', C.perfect, { points, sub: `+${points}` });
    }
    m.emit('bonusEnd', C.resume, { hits: b.hits, sub: `${b.hits} / ${PASSES}` });
    m.phase = 'resume';
    m.phaseTime = 0;
  }
}
