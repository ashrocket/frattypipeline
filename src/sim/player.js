import { TUNING as T, clamp } from '../data/tuning.js';
import { C } from '../data/strings.js';
export function createPlayer() {
  return {
    x: 6,
    z: -1.5,
    vx: 0,
    vz: 0,
    pipeline: 0,
    level: 0,
    invulnerable: 0,
    jumpHeight: 0,
    jumpVelocity: 0,
    landingLag: 0,
    jumpAt: -100,
    pushAge: 999,
    pushCooldown: 0,
    wipeout: 0,
    hurt: 0,
    release: 0,
    onBoard: true,
    pitchLock: 0,
    pitchMash: 0,
  };
}
export const pushProtected = (p) =>
  p.pushAge >= T.pushStartup && p.pushAge < T.pushStartup + T.pushInvulnerable;
export function ollie(m) {
  const p = m.player;
  if (p.pitchLock > 0) {
    p.pitchMash++;
    p.pitchLock = Math.max(0, p.pitchLock - 0.4);
    m.emit('escape', C.ollie);
    return true;
  }
  if (p.jumpHeight > 0 || p.jumpVelocity > 0 || p.landingLag > 1e-8 || p.wipeout > 0) return false;
  p.jumpVelocity = T.jumpVelocity;
  p.jumpAt = m.motionTime;
  p.onBoard = false;
  m.used.ollie = true;
  m.emit('ollie', C.ollie);
  return true;
}
export function push(m) {
  const p = m.player;
  if (p.pushCooldown > 1e-8 || p.jumpHeight > 0 || p.wipeout > 0 || p.pitchLock > 0) return false;
  p.pushAge = 0;
  p.pushCooldown = T.pushCooldown;
  m.used.push = true;
  m.emit('push', C.push);
  return true;
}
export function updatePlayer(m, dt) {
  const p = m.player;
  for (const key of [
    'invulnerable',
    'landingLag',
    'pushCooldown',
    'wipeout',
    'hurt',
    'release',
    'pitchLock',
  ])
    p[key] = Math.max(0, p[key] - dt);
  p.pushAge += dt;
  if (p.jumpHeight > 0 || p.jumpVelocity > 0) {
    p.jumpHeight += p.jumpVelocity * dt - (T.gravity * dt * dt) / 2;
    p.jumpVelocity -= T.gravity * dt;
    if (p.jumpHeight <= 1e-8) {
      p.jumpHeight = p.jumpVelocity = 0;
      p.onBoard = true;
      p.landingLag = T.landingLag;
      m.emit('land', C.land);
    }
  }
  let x = m.move.x,
    z = m.move.z;
  if (p.wipeout > 0 || p.pitchLock > 0) x = z = 0;
  const boost = p.pushAge < T.pushDuration ? T.pushBoost : 0;
  if (Math.abs(x) < 0.12 && !boost) {
    const drag = Math.exp(-T.coast * dt);
    p.x += (p.vx * (1 - drag)) / T.coast;
    p.vx *= drag;
  } else {
    const target = (x >= 0 ? x * T.forward : x * T.backward) + boost;
    const drag = Math.exp(-9 * dt);
    p.x += target * dt + ((p.vx - target) * (1 - drag)) / 9;
    p.vx = target + (p.vx - target) * drag;
  }
  const targetZ = z * T.carve,
    dragZ = Math.exp(-10 * dt);
  p.z += targetZ * dt + ((p.vz - targetZ) * (1 - dragZ)) / 10;
  p.vz = targetZ + (p.vz - targetZ) * dragZ;
  p.z = clamp(p.z, -4.3, 4.3);
  const x0 = m.arena ? m.arena.x - 9 : Math.max(0, m.cameraX - 12);
  const x1 = m.arena ? m.arena.x + 9 : m.houses.at(-1).x + 12;
  const clamped = clamp(p.x, x0, x1);
  if (clamped !== p.x) p.vx = 0;
  p.x = clamped;
  if (!m.arena) m.cameraX = Math.max(m.cameraX, p.x - 2);
}
export function addMakeover(m, amount, source, kind = 'attack') {
  const p = m.player;
  if (m.phase !== 'playing') return false;
  if (kind === 'attack' && (p.invulnerable > 0 || pushProtected(p))) return false;
  p.pipeline = clamp(p.pipeline + amount, 0, 100);
  m.combo = 1;
  p.hurt = 0.09;
  m.hits++;
  m.fightHits++;
  m.score = Math.max(0, m.score - 150);
  if (kind !== 'keg') p.invulnerable = 0.25;
  if (kind === 'keg') {
    p.wipeout = 0.7;
    p.vx = 0;
  }
  m.freeze(0.1);
  m.emit('hit', C.hit, {
    source: source.id,
    kind,
    amount,
    x: p.x,
    z: p.z,
    telegraphAge: source.tellAge ?? 0,
    visibleAge: source.visibleAge ?? source.age ?? 0,
  });
  if (p.pipeline >= 100) m.transform();
  return true;
}
