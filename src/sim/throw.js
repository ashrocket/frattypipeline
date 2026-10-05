import { BEAT_S } from '../data/tuning.js';
import { C } from '../data/strings.js';
import { nextBeat, judge } from './beat.js';
import { school } from './enemies.js';
export function startCharge(m, beat, rawBeat = beat) {
  if (!m.arena) return true;
  if (m.ammo < 1) {
    m.emit('empty', C.empty);
    return true;
  }
  if (!m.charge) {
    m.charge = {
      startBeat: beat,
      rawBeat,
      started: m.time - Math.max(0, (m.beat - rawBeat) * BEAT_S),
    };
    m.emit('charge', C.charge);
  }
  return true;
}
export function aim(m, heldSeconds = m.charge ? (m.beat - m.charge.rawBeat) * BEAT_S : 0) {
  const charged = m.charge && heldSeconds >= 0.4 - 1e-8;
  const air = m.player.jumpHeight >= 0.9;
  const kind = air ? 'air' : charged ? 'lob' : 'toss';
  return {
    kind,
    x: m.player.x + m.player.vx * (kind === 'toss' ? 0.6 : 0.9),
    z: kind === 'toss' && m.player.z > 0 ? -4.8 : -6.6,
  };
}
export function release(m, beat, rawBeat = beat) {
  if (!m.charge) return true;
  const held = (rawBeat - m.charge.rawBeat) * BEAT_S;
  const target = aim(m, held);
  m.charge = null;
  if (!m.arena || m.ammo < 1 || held > 1.8) return true;
  m.ammo -= 1;
  m.used[target.kind] = true;
  const timing = judge(m, beat);
  if (timing.grade !== 'off') {
    m.emit('beat', C[timing.grade]);
    if (timing.grade === 'tight') m.used.tight = true;
  }
  if (m.groove === 4 && m.used.tight) m.emit('streak', C.groove);
  const launchBeat = m.beat;
  const landBeat = nextBeat(launchBeat + (target.kind === 'toss' ? 1.5 : 2.5));
  const bottle = {
    id: ++m.id,
    fromX: m.player.x,
    fromZ: m.player.z,
    fromY: m.player.jumpHeight,
    toX: target.x,
    toZ: target.z,
    kind: target.kind,
    releaseBeat: launchBeat,
    landBeat,
    progress: 0,
    houseId: m.arena.id,
    damage: target.kind === 'air' ? 1.5 : target.kind === 'lob' ? 2 : 1,
    timing: timing.multiplier,
  };
  m.projectiles.push(bottle);
  m.player.release = 0.08;
  // Snipers run off the porch on release; a bottle never contacts a person.
  for (const enemy of m.enemies)
    if (enemy.kind === 'pong' && enemy.state !== 'flee') school(m, enemy);
  m.emit('throw', C.throw, {
    ...bottle,
    x: m.player.x,
    z: m.player.z,
    atBeat: beat,
    duration: (landBeat - launchBeat) * BEAT_S,
  });
  return true;
}
export function updateThrows(m) {
  const timelyRelease =
    m.charge &&
    m.inputQueue.some(
      (e) => e.action === 'throw' && !e.down && (e.rawBeat - m.charge.rawBeat) * BEAT_S <= 1.8,
    );
  if (m.charge && (m.beat - m.charge.rawBeat) * BEAT_S > 1.8 && !timelyRelease) {
    m.ammo = Math.max(0, m.ammo - 1);
    m.charge = null;
    m.emit('fizzle', C.fizzle);
  }
  for (const bottle of m.projectiles) {
    if (m.hitstop <= 0)
      bottle.progress = Math.min(
        1,
        (m.beat - bottle.releaseBeat) / (bottle.landBeat - bottle.releaseBeat),
      );
    if (m.beat + 1e-8 < bottle.landBeat) continue;
    bottle.dead = true;
    impact(m, bottle);
  }
  m.projectiles = m.projectiles.filter((p) => !p.dead);
}
export function impact(m, p) {
  const h = m.houses[p.houseId];
  const event = { x: p.toX, z: p.toZ, landBeat: p.landBeat, kind: p.kind };
  if (!h || h.burned || p.toZ > -6 || Math.abs(p.toX - h.x) > 2.6) {
    m.emit('miss', p.toZ > -6 ? C.short : C.miss, event);
    m.freeze(0.05);
    return;
  }
  if (h.guard && p.kind !== 'air') {
    m.emit('doused', C.doused, event);
    m.freeze(0.033);
    return;
  }
  const bullseye = Math.abs(p.toX - h.x) <= 0.75;
  const counters = m.attacks.filter((a) => a.porch && a.state === 'telegraph');
  const counter = counters.length > 0;
  for (const a of counters) a.dead = true;
  if (p.super) {
    if (p.damage > 0) m.damageHouse(h, p.damage);
    m.emit('impact', C.impact, { ...event, damage: p.damage });
    return;
  }
  const multiplier = Math.min(3, p.timing * (bullseye ? 1.5 : 1) * (counter ? 1.5 : 1));
  m.addRiot(5 + (bullseye ? 10 : 0));
  m.award(120 * multiplier);
  m.damageHouse(h, p.damage * multiplier);
  m.emit('impact', counter ? C.counter : bullseye ? C.bullseye : C.impact, {
    ...event,
    damage: p.damage * multiplier,
  });
  m.freeze(counter ? 0.133 : p.kind === 'toss' ? 0.05 : 0.083);
}
