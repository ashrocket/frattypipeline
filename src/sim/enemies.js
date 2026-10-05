import { TUNING as T, BEAT_S, clamp } from '../data/tuning.js';
import { C } from '../data/strings.js';
import { FLEE } from '../data/houses.js';
import { nextBeat } from './beat.js';
import { pushProtected, addMakeover } from './player.js';
const HEIGHT = { lax: 'LOW', keg: 'LOW', pong: 'HIGH', vest: 'MID', conga: 'MID', cart: 'MID' };
export function spawnBro(m, kind, index = 0, edge = false) {
  const h = m.arena ?? m.houses.find((h) => !h.burned);
  const cap = h.bars > 1 ? 6 : T.caps[h.district];
  if (m.enemies.filter((e) => e.state !== 'flee').length >= cap) return;
  const e = {
    id: ++m.id,
    kind,
    height: HEIGHT[kind],
    x: edge ? m.cameraX - 19 : h.x + (index - 0.5) * 1.2,
    z: edge ? m.player.z : -6,
    state: 'enter',
    age: 0,
    timer: 0.5,
    tellAge: 0,
    cooldown: m.random() * 0.4,
    speed: 2.2 + m.random() * 0.8,
    wave: h.chunk,
    duty: true,
    shots: 0,
    members: kind === 'conga' ? Math.min(7, 4 + h.district) : 1,
  };
  m.enemies.push(e);
  m.emit('spawn', C.guard, { source: e.id, kind, x: e.x, z: e.z, from: edge ? 'edge' : 'door' });
  return e;
}
export function school(m, e, parried = false) {
  if (!e || e.state === 'flee') return;
  e.state = 'flee';
  e.timer = 2;
  e.duty = false;
  // All attacks originating from this prop are retired only when its owner flees.
  for (const attack of m.attacks) if (attack.owner === e.id) attack.dead = true;
  m.ammo = Math.min(m.maxAmmo, m.ammo + (e.kind === 'vest' ? 2 : 1));
  m.addRiot(10);
  m.award(e.kind === 'vest' ? 350 : 200);
  m.emit('school', e.kind === 'vest' ? C.pitch : C.school, {
    source: e.id,
    x: e.x,
    z: e.z,
    bark: FLEE[e.id % FLEE.length],
    prop: e.kind,
    parried,
  });
}
export function fleeAll(m) {
  for (const e of m.enemies) {
    if (e.state !== 'flee')
      m.emit('flee', FLEE[e.id % FLEE.length], { x: e.x, z: e.z, prop: e.kind });
    e.state = 'flee';
    e.timer = 1.4;
    e.duty = false;
  }
  m.attacks = [];
  m.player.pitchLock = 0;
}
export function telegraph(m, owner, kind = owner.kind, porch = false) {
  const district = m.arena?.district ?? Math.min(2, Math.floor(m.burned / 4));
  const high = kind === 'pong';
  const duration = high
    ? Math.max(3 * BEAT_S, T.telegraph[district])
    : kind === 'cart'
      ? 3 * BEAT_S
      : T.telegraph[district];
  const a = {
    id: ++m.id,
    owner: owner.id,
    kind,
    height: HEIGHT[kind],
    state: 'telegraph',
    x: owner.x,
    z: owner.z,
    targetX: m.player.x,
    targetZ: m.player.z,
    age: 0,
    visibleAge: owner.age ?? 0,
    tellAge: 0,
    duration,
    strikeBeat: nextBeat(m.beat + duration / BEAT_S),
    porch,
    passed: false,
    rx: kind === 'lax' ? 2.4 : kind === 'conga' ? 2.8 : 1.25,
    rz: kind === 'lax' ? 1.05 : kind === 'conga' ? 4.5 : 1.05,
  };
  if (kind === 'keg') {
    a.targetX = m.player.x;
    a.x = a.targetX + T.forward * BEAT_S * 6;
    a.z = a.targetZ;
    a.duration = Math.max(duration, 6 * BEAT_S);
    a.strikeBeat = nextBeat(m.beat + 6);
    a.speed = [6.5, 7.5, 8.5][district];
    if (owner.kegNext) {
      a.strikeBeat = Math.max(owner.kegNext, nextBeat(m.beat + 2));
      a.duration = Math.max(0.4, (a.strikeBeat - m.beat) * BEAT_S);
    }
    owner.shots = (owner.shots ?? 0) + 1;
    owner.kegNext = owner.shots % 3 === 0 ? null : a.strikeBeat + 6;
  }
  if (kind === 'cart') {
    a.x = m.arena.x - 10;
    a.z = a.targetZ;
    a.rx = 2;
    a.rz = 0.9;
  }
  m.attacks.push(a);
  m.emit(
    'telegraph',
    C[kind === 'lax' ? 'low' : kind === 'pong' ? 'high' : kind === 'vest' ? 'lock' : kind],
    {
      source: a.id,
      owner: owner.id,
      kind,
      height: a.height,
      x: a.targetX,
      z: a.targetZ,
      strikeBeat: a.strikeBeat,
    },
  );
  return a;
}
function parry(m, a) {
  a.ignoreUntil = m.motionTime + 0.3;
  a.passed = true;
  m.freeze(0.15);
  m.addRiot(25);
  m.ammo = Math.min(m.maxAmmo, m.ammo + 1);
  m.player.pipeline = Math.max(0, m.player.pipeline - 5);
  m.award(350);
  m.parries++;
  m.emit('parry', C.parry, { source: a.id, x: m.player.x, z: m.player.z });
  const owner = m.enemies.find((e) => e.id === a.owner);
  if (a.height === 'MID') school(m, owner, true);
  else if (owner && owner.kind === 'lax') {
    owner.state = 'stunned';
    owner.timer = 1.2;
  }
}
function contact(m, a) {
  if (a.passed || m.phase !== 'playing' || a.tellAge < 0.4 || a.visibleAge < 0.9) return;
  const p = m.player;
  if (a.ignoreUntil > m.motionTime) return;
  const jumpAge = m.motionTime - p.jumpAt;
  // Parry precedence: the first 30 ms of a jump is deliberately vulnerable.
  if (a.height === 'LOW' && jumpAge >= 0.03 - 1e-8 && jumpAge <= 0.12 + 1e-8) {
    parry(m, a);
    return;
  }
  if (a.height === 'MID' && pushProtected(p) && p.pushAge - T.pushStartup <= 0.12 + 1e-8) {
    parry(m, a);
    return;
  }
  if (p.invulnerable > 0 || pushProtected(p)) return; // Hazard remains live and passes through.
  const owner = m.enemies.find((e) => e.id === a.owner);
  if ((a.height === 'LOW' && p.jumpHeight > 0.75) || (a.kind === 'conga' && p.jumpHeight >= 1.2)) {
    a.passed = true;
    m.addRiot(10);
    m.award(100);
    m.emit('dodge', C.dodge, { source: a.id, x: p.x, z: p.z });
    if (owner?.kind === 'lax') {
      owner.state = 'stunned';
      owner.timer = 1.2;
    }
    if (a.kind === 'conga') school(m, owner);
    return;
  }
  a.passed = true;
  if (a.kind === 'vest') {
    p.pitchLock = 1.5;
    p.pitchMash = 0;
    a.pitchNext = m.beat;
    a.state = 'pitch';
    a.timer = 1.5;
    if (owner) {
      owner.x = p.x + 1.25;
      owner.z = p.z;
    }
  }
  addMakeover(
    m,
    a.kind === 'lax'
      ? 15
      : a.kind === 'conga' || a.kind === 'cart'
        ? 12
        : a.kind === 'vest'
          ? 6
          : 8,
    a,
    a.kind === 'keg' ? 'keg' : 'attack',
  );
  if (a.kind === 'lax') p.x = clamp(p.x - 1, m.arena?.x - 9 ?? 0, m.arena?.x + 9 ?? p.x);
}
function overlap(p, a) {
  const x = a.kind === 'lax' || a.kind === 'vest' ? a.x : a.kind === 'conga' ? a.x : a.targetX;
  const z = a.kind === 'lax' || a.kind === 'conga' || a.kind === 'vest' ? a.z : a.targetZ;
  return ((p.x - x) / a.rx) ** 2 + ((p.z - z) / a.rz) ** 2 <= 1;
}
export function updateAttacks(m, dt) {
  for (const a of m.attacks) {
    if (a.dead) continue;
    a.age += dt;
    a.visibleAge += dt;
    if (a.state === 'telegraph') {
      a.tellAge += dt;
      if (m.beat >= a.strikeBeat - 1e-8) {
        if (a.tellAge + 1e-8 < a.duration || a.visibleAge < 0.9) {
          a.strikeBeat = nextBeat(m.beat + 0.01);
          continue;
        }
        a.state = 'active';
        a.timer =
          a.kind === 'cart' ? 1.8 : a.kind === 'keg' ? 0.65 : a.kind === 'vest' ? 0.5 : 0.22;
        if (a.kind === 'vest') {
          const dx = m.player.x - a.x,
            dz = m.player.z - a.z,
            length = Math.hypot(dx, dz) || 1;
          a.vx = (dx / length) * 7;
          a.vz = (dz / length) * 7;
        }
        if (a.kind === 'keg') a.x = a.targetX + a.speed * 0.12;
        m.emit(
          'attack',
          C[
            a.kind === 'lax'
              ? 'low'
              : a.kind === 'pong'
                ? 'high'
                : a.kind === 'vest'
                  ? 'lock'
                  : a.kind
          ],
          { source: a.id, x: a.targetX, z: a.targetZ },
        );
      }
    }
    if (a.state === 'active') {
      a.timer -= dt;
      if (a.kind === 'vest') {
        a.x += a.vx * dt;
        a.z += a.vz * dt;
        const owner = m.enemies.find((e) => e.id === a.owner);
        if (owner) {
          const dx = a.x - m.player.x,
            dz = a.z - m.player.z,
            distance = Math.hypot(dx, dz) || 1;
          owner.x = m.player.x + dx * Math.max(1, 1.05 / distance);
          owner.z = m.player.z + dz * Math.max(1, 1.05 / distance);
        }
      }
      if (a.kind === 'cart') {
        a.x += 12 * dt;
        a.targetX = a.x;
      }
      if (a.kind === 'keg') {
        a.x -= a.speed * dt;
        a.targetX = a.x;
      }
      if (overlap(m.player, a)) contact(m, a);
      if (a.timer <= 0) {
        if (!a.passed) {
          m.addRiot(10);
          m.award(60);
          m.emit('dodge', C.dodge, { source: a.id, x: m.player.x, z: m.player.z });
        }
        a.dead = true;
      }
    } else if (a.state === 'pitch') {
      a.timer -= dt;
      if (m.player.pitchLock <= 0 || a.timer <= 0) {
        a.dead = true;
        continue;
      }
      if (m.beat >= a.pitchNext + 1) {
        a.pitchNext++;
        addMakeover(m, 6, a, 'pitch');
      }
    }
  }
  m.attacks = m.attacks.filter((a) => !a.dead);
}
export function updateEnemies(m, dt) {
  const p = m.player,
    h = m.arena;
  const tokens = T.tokens[h?.district ?? Math.min(2, Math.floor(m.burned / 4))];
  for (const e of m.enemies) {
    e.age += dt;
    e.timer -= dt;
    if (e.state === 'flee') {
      e.x += 8 * dt;
      e.z += 14 * dt;
      continue;
    }
    if (e.state === 'enter') {
      e.z = Math.min(-1, e.z + 5 * dt);
      if (e.timer <= 0) {
        e.state = 'approach';
      }
      continue;
    }
    if (e.kind === 'vest' && p.pitchLock > 0 && Math.hypot(e.x - p.x, e.z - p.z) < 1.05)
      e.x = p.x + 1.05;
    const distance = Math.hypot(e.x - p.x, e.z - p.z);
    if (
      pushProtected(p) &&
      distance < 1.2 &&
      ((e.kind === 'vest' && ['telegraph', 'active', 'recovery'].includes(e.state)) ||
        (e.kind === 'conga' && ['telegraph', 'active'].includes(e.state)) ||
        ['stunned', 'recovery'].includes(e.state))
    ) {
      school(m, e);
      continue;
    }
    if (['stunned', 'recovery'].includes(e.state)) {
      if (e.timer <= 0) {
        e.state = 'approach';
        e.cooldown = 0.1 + m.random() * 0.25;
      }
      continue;
    }
    if (e.state === 'telegraph' || e.state === 'active') {
      const attack = m.attacks.find((a) => a.owner === e.id && !a.dead);
      if (!attack) {
        e.state = 'recovery';
        e.timer = e.kind === 'keg' ? 0.6 : e.kind === 'vest' ? 1 : 0.8;
      } else if (attack.state !== 'telegraph') e.state = 'active';
      continue;
    }
    e.cooldown -= dt;
    const dx = p.x - e.x,
      dz = p.z - e.z;
    if (e.kind !== 'pong') {
      const occupied = m.enemies.filter(
        (b) => b.state === 'telegraph' || b.state === 'active',
      ).length;
      const targetDistance =
        occupied >= tokens
          ? 3
          : e.kind === 'lax'
            ? 1.7
            : e.kind === 'vest'
              ? 2.6
              : e.kind === 'keg'
                ? 2.2
                : 1.8;
      if (distance > targetDistance) {
        e.x += Math.sign(dx) * Math.min(Math.abs(dx), dt * (e.kind === 'conga' ? 2.6 : e.speed));
        e.z += Math.sign(dz) * Math.min(Math.abs(dz), dt * 1.6);
      }
    } else e.z = -5.6;
    const busy = m.enemies.filter((b) => b.state === 'telegraph' || b.state === 'active').length;
    if (
      e.cooldown <= 0 &&
      busy < tokens &&
      e.age >= 0.5 &&
      (distance < 3.5 || ['pong', 'keg', 'conga'].includes(e.kind))
    ) {
      e.state = 'telegraph';
      telegraph(m, e);
    }
  }
  m.enemies = m.enemies.filter((e) => e.state !== 'flee' || e.timer > 0);
  updateAttacks(m, dt);
}
