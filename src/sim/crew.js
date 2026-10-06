import { TUNING as T, SCORE, clamp } from '../data/tuning.js';
import { C, S } from '../data/strings.js';
import { createPlayer } from './player.js';
// The Pipeline horde rolls after you. Standing still (or crashing) closes the gap.
export function hordeSpeed(m) {
  const d = m.diff;
  if (m.phase === 'rescue') return d.hordeRescue;
  return Math.min(d.hordeMax, d.hordeSpeed + d.hordeLapStep * (m.lap - 1));
}
export function updateHorde(m, dt) {
  const h = m.horde;
  h.speed = hordeSpeed(m);
  h.gap = Math.min(T.hordeGap, h.gap + (m.player.vx - h.speed) * dt);
  if (h.gap < T.hordeWarn && !h.warned) {
    h.warned = true;
    m.emit('warn', C.warn, { gap: h.gap });
  } else if (h.gap > T.hordeWarn + 2) h.warned = false;
  if (h.gap <= 0) capture(m);
}
export function capture(m) {
  const p = m.player;
  m.phase = 'captured';
  m.phaseTime = 0;
  m.aiming = false;
  p.vx = 0;
  p.vz = 0;
  p.towing = false;
  m.horde.gap = 0;
  m.zombie = { x: p.x, z: clamp(p.z, -2.6, 2.4), crew: p.crew, state: 'turning', sway: 0 };
  m.ambulance = null;
  m.stats.captures++;
  m.emit('captured', C.captured, { crew: p.crew, sub: C.crewDown });
}
export function updateCaptured(m, dt) {
  m.phaseTime += dt;
  if (m.phaseTime < T.captureTime) return;
  m.lives--;
  if (m.lives <= 0) {
    m.phase = 'continue';
    m.phaseTime = 0;
    m.emit('continue', S.continuePrompt);
    return;
  }
  startRescue(m);
}
export function startRescue(m) {
  const z = m.zombie,
    crew = 3 - m.lives;
  z.state = 'waiting';
  m.player = createPlayer(crew, z.x - T.rescueBehind);
  m.player.z = clamp(z.z + 1.2, T.zMin, T.zMax);
  m.player.vx = T.roll;
  m.player.invulnerable = 1.5;
  m.horde = { gap: T.hordeGap, speed: m.diff.hordeRescue, warned: false };
  m.ambulance = { x: z.x + T.ambulanceAhead, z: -2.2, state: 'waiting' };
  m.aiming = false;
  m.phase = 'rescue';
  m.phaseTime = 0;
  m.emit('rescueStart', C.rescue, { crew, sub: S.hud.free });
}
export function updateRescue(m, dt) {
  const p = m.player,
    z = m.zombie,
    a = m.ambulance;
  m.phaseTime += dt;
  z.sway += dt;
  if (z.state === 'waiting') {
    z.x += T.zombieShamble * dt;
    if (Math.abs(p.x - z.x) < 1.1 && Math.abs(p.z - z.z) < 1) {
      z.state = 'towed';
      p.towing = true;
      m.emit('freed', C.freed, { x: z.x, z: z.z, sub: S.hud.tow });
    } else if (p.x > z.x + 2.5) {
      // No soft-locks: a recruiter drags the zombie further down the Row.
      z.x = p.x + 18;
      m.emit('zombieMoved', null, { x: z.x, z: z.z });
    }
  } else if (z.state === 'towed') {
    z.x += (p.x - 1.3 - z.x) * (1 - Math.exp(-14 * dt));
    z.z += (p.z + 0.1 - z.z) * (1 - Math.exp(-8 * dt));
    if (Math.abs(p.x - a.x) < 3 && Math.abs(p.z - a.z) < 1.6) {
      z.state = 'saved';
      p.towing = false;
      a.state = 'loading';
      m.stats.rescues++;
      const points = m.award(SCORE.rescue);
      m.emit('rescued', C.rescued, { x: a.x, z: a.z, points, sub: `+${points}` });
      // A short beat for the ambulance to load up before the bonus round starts.
      m.phase = 'rescued';
      m.phaseTime = 0;
    } else if (p.x > a.x + 3.5) {
      a.x = p.x + 24;
      m.emit('ambulanceMoved', null, { x: a.x });
    }
  }
}
export function continueRun(m) {
  if (m.phase !== 'continue') return false;
  const x = m.zombie?.x ?? m.player.x;
  m.continues++;
  m.score = 0;
  m.lives = 3;
  m.zombie = null;
  m.ambulance = null;
  m.player = createPlayer(0, x);
  m.player.vx = T.roll;
  m.player.invulnerable = 2;
  m.horde = { gap: T.hordeGap, speed: m.diff.hordeSpeed, warned: false };
  m.bottles = Math.max(m.bottles, T.bottles);
  m.phase = 'playing';
  m.emit('continued', C.go);
  return true;
}
