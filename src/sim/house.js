import { TUNING as T, SCORE, clamp, chance, lerp } from '../data/tuning.js';
import { C, S } from '../data/strings.js';
import { LIT, BEES } from '../data/houses.js';
import { facade, Z } from './row.js';
// House destruction states: 0 UNTOUCHED, 1 HARMED, 2 REALLY HARMED, 3 GONE.
export const STATE = Object.freeze({ untouched: 0, harmed: 1, reallyHarmed: 2, gone: 3 });
const LAWN = { dx0: -8, dx1: 8, z0: Z.lawnBack, z1: Z.lawnFront };
export function stateFor(integrity) {
  if (integrity <= 0) return STATE.gone;
  if (integrity <= T.reallyHarmed) return STATE.reallyHarmed;
  if (integrity <= T.harmed) return STATE.harmed;
  return STATE.untouched;
}
export function createHouse(data, place, random, nextId) {
  const h = {
    ...data,
    id: place.id,
    s: place.s,
    lot: place.lot,
    facade: facade(data.style),
    integrity: 100,
    state: STATE.untouched,
    fire: 0,
    burnTime: 0,
    empty: false,
    rotting: false,
    bees: 0,
    can: { dx: data.can[0], z: data.can[1], state: 'ready', fuel: 0, litId: 0 },
    comeBack: false,
    bros: [],
    fd: null,
    sub: null,
    fryer: null,
    raccoons: null,
    balloons: 0,
    lifting: false,
    lift: 0,
    gone: false,
    cause: null,
  };
  for (let i = 0; i < data.bros; i++) {
    const homeDx = lerp(-6.5, 6.5, (i + 0.5) / data.bros) + (random() - 0.5) * 1.5;
    const homeZ = lerp(LAWN.z0 + 0.4, LAWN.z1 - 0.3, random());
    h.bros.push({
      id: nextId(),
      house: place.id,
      dx: homeDx,
      z: homeZ,
      homeDx,
      homeZ,
      tx: homeDx,
      tz: homeZ,
      drunk: clamp(data.drunk + (random() - 0.5) * 0.4, 0, 1),
      ext: 0,
      state: 'party',
      t: random() * 2,
      burn: 0,
      mode: null,
      immune: 0,
      fumble: 0,
      spraying: false,
      attracted: 0,
      facing: random() < 0.5 ? -1 : 1,
      seed: Math.floor(random() * 1e6),
    });
  }
  // Extinguishers go to the soberest bros: drunk chapters end up with drunk firefighters.
  [...h.bros]
    .sort((a, b) => a.drunk - b.drunk)
    .slice(0, data.ext)
    .forEach((b) => (b.ext = T.extinguisherSeconds));
  return h;
}
const dist = (a, x, z) => Math.hypot(a.dx - x, a.z - z);
function moveToward(b, x, z, speed, dt) {
  const dx = x - b.dx,
    dz = z - b.z,
    d = Math.hypot(dx, dz);
  if (d < 1e-6) return d;
  const step = Math.min(d, speed * dt);
  b.dx += (dx / d) * step;
  b.z += (dz / d) * step;
  if (Math.abs(dx) > 0.05) b.facing = Math.sign(dx);
  return d - step;
}
export const door = (h) => ({ dx: h.facade.door.dx, z: Z.porch });
export const brosHome = (h) =>
  h.bros.filter((b) => !['flee', 'away', 'inside'].includes(b.state));
export function ignitable(b) {
  return ['party', 'gawk', 'dance', 'spray', 'charred'].includes(b.state) && b.immune <= 0;
}
function fireTarget(h, b) {
  let best = null;
  for (const o of h.bros)
    if (o !== b && o.state === 'burning') {
      const d = dist(b, o.dx, o.z);
      if (!best || d < best.d) best = { kind: 'bro', ref: o, dx: o.dx, z: o.z, d };
    }
  if (best) return best;
  if (h.can.state === 'burning') return { kind: 'can', dx: h.can.dx, z: h.can.z };
  if (h.fire > 0) return { kind: 'house', dx: door(h).dx, z: Z.porch + 0.6 };
  return null;
}
export function chainAward(m) {
  m.chain.n = m.time <= m.chain.until ? Math.min(SCORE.chainMax, m.chain.n + 1) : 1;
  m.chain.until = m.time + SCORE.chainWindow;
  m.stats.bestChain = Math.max(m.stats.bestChain, m.chain.n);
  return m.chain.n;
}
export function igniteBro(m, h, b, cause = 'can') {
  b.state = 'burning';
  b.burn = lerp(T.burnTime[0], T.burnTime[1], m.random());
  const r = m.random();
  b.mode =
    h.gone || h.lifting
      ? 'zig'
      : r < T.burnToHouse
        ? 'door'
        : r < T.burnToHouse + T.burnRoll
          ? 'roll'
          : 'zig';
  b.spraying = false;
  b.t = 0;
  m.stats.brosLit++;
  const n = chainAward(m),
    points = m.award(SCORE.bro * n);
  m.emit('broLit', C.broLit, {
    points,
    house: h.id,
    bro: b.id,
    dx: b.dx,
    z: b.z,
    chain: n,
    cause,
    mode: b.mode,
    bark: LIT[b.id % LIT.length],
  });
}
function douse(m, h, b, by) {
  b.state = 'charred';
  b.t = T.charredTime;
  b.immune = T.immuneTime;
  b.burn = 0;
  m.emit('doused', by === 'self' ? null : C.doused, { house: h.id, bro: b.id, dx: b.dx, z: b.z, by });
}
export function houseIgnite(m, h, cause, amount = T.houseFireStart) {
  if (h.gone || h.lifting) return false;
  const fresh = h.fire <= 0;
  h.fire = Math.min(1, Math.max(fresh ? 0 : h.fire + 0.15, amount));
  if (!fresh) return false;
  m.stats.houseFires++;
  m.emit('houseFire', C.houseFire, { house: h.id, cause, dx: door(h).dx, z: Z.porch });
  // Owner rule: a house already burning a couch in its yard has exactly a 15% chance
  // per new house fire that the fire department shows up. Empty houses have nobody to call.
  if (h.couch && !h.empty && !h.fd) {
    const roll = m.random(),
      success = roll < T.fdChance;
    m.stats.fdRolls++;
    if (success) {
      m.stats.fdRescues++;
      h.fd = { stage: 'coming', t: T.fdDelay };
    }
    m.emit('fdRoll', success ? C.fd : C.noTruck, {
      house: h.id,
      success,
      roll,
      sub: success ? C.fdSub : null,
    });
  }
  return true;
}
export function damage(m, h, amount, cause) {
  if (h.gone || amount <= 0) return;
  h.integrity = Math.max(0, h.integrity - amount);
  const next = stateFor(h.integrity);
  while (h.state < next) {
    h.state++;
    if (h.state === STATE.harmed) {
      m.award(SCORE.harmed);
      m.emit('harmed', C.harmed, { house: h.id, cause, sub: h.name });
    } else if (h.state === STATE.reallyHarmed) {
      m.award(SCORE.reallyHarmed);
      m.emit('reallyHarmed', C.reallyHarmed, { house: h.id, cause, sub: h.name });
    } else if (h.state === STATE.gone) destroy(m, h, cause);
  }
}
export function destroy(m, h, cause) {
  if (h.gone) return;
  h.gone = true;
  h.state = STATE.gone;
  h.integrity = 0;
  h.cause = cause;
  h.fire = 0;
  h.fd = null;
  h.sub = null;
  h.fryer = null;
  h.raccoons = null;
  h.lifting = false;
  h.can.state = 'gone';
  h.comeBack = false;
  for (const b of h.bros) {
    if (b.state === 'inside') {
      b.state = 'charred';
      b.t = T.charredTime;
      b.immune = T.immuneTime;
      b.dx = door(h).dx;
      b.z = Z.porch + 0.8;
    }
    if (b.state !== 'burning') {
      b.state = 'flee';
      b.spraying = false;
    } else b.mode = 'zig';
  }
  m.destroyed++;
  const n = m.destroyed,
    points = m.award(SCORE.gone * n);
  m.emit('houseGone', cause === 'airlift' ? C.airlift : C.gone, {
    house: h.id,
    n,
    points,
    cause,
    sub: h.ko,
  });
}
export function beehive(m, h) {
  if (h.gone || h.empty) return false;
  h.empty = true;
  h.bees = 12;
  for (const b of h.bros)
    if (b.state !== 'away') {
      if (b.state === 'inside') {
        b.dx = door(h).dx;
        b.z = Z.porch + 0.6;
      }
      b.fleeBurning = b.state === 'burning' ? b.burn : 0;
      b.state = 'flee';
      b.spraying = false;
    }
  m.award(SCORE.bees);
  m.emit('bees', C.bees, { house: h.id, bark: BEES[h.id % BEES.length] });
  // Not 'empty': that type is "out of bottles" (a dud at the skater).
  m.emit('houseEmpty', C.empty, { house: h.id });
  return true;
}
export function balloonsNeeded(h) {
  return h.state >= STATE.reallyHarmed ? 1 : h.state === STATE.harmed ? 2 : 3;
}
function updateBro(m, h, b, dt) {
  b.immune = Math.max(0, b.immune - dt);
  b.t -= dt;
  if (b.state !== 'spray') b.spraying = false;
  switch (b.state) {
    case 'party': {
      if (b.ext > 0 && fireTarget(h, b)) {
        b.state = 'spray';
        return;
      }
      if (h.can.state === 'burning' && b.attracted !== h.can.litId) {
        b.attracted = h.can.litId;
        if (b.ext <= 0 && m.random() < T.attractBase + T.attractDrunk * b.drunk) {
          b.state = 'gawk';
          b.t = 0;
          m.emit('gawk', null, { house: h.id, bro: b.id });
          return;
        }
      }
      if (h.sub && dist(b, h.sub.dx, h.sub.z) < T.subRadius) {
        b.state = 'dance';
        b.t = 0;
        return;
      }
      if (b.t <= 0) {
        b.tx = clamp(b.homeDx + (m.random() - 0.5) * 5, LAWN.dx0, LAWN.dx1);
        b.tz = clamp(b.homeZ + (m.random() - 0.5) * 2, LAWN.z0, LAWN.z1);
        b.t = 1.5 + m.random() * 2.5;
      }
      moveToward(b, b.tx, b.tz, 0.9 + b.drunk * 0.4, dt);
      return;
    }
    case 'gawk': {
      if (h.can.state !== 'burning') {
        b.state = 'party';
        b.t = 0;
        return;
      }
      if (b.t <= 0) {
        const angle = m.random() * Math.PI * 2,
          r = 0.5 + m.random() * 0.55;
        b.tx = h.can.dx + Math.cos(angle) * r;
        b.tz = clamp(h.can.z + Math.sin(angle) * r * 0.7, LAWN.z0, LAWN.z1 + 0.6);
        b.t = 0.8 + m.random() * 1.2;
      }
      moveToward(b, b.tx, b.tz, 1.6, dt);
      return;
    }
    case 'dance': {
      if (!h.sub) {
        b.state = 'party';
        b.t = 0;
        return;
      }
      if (b.t <= 0) {
        const angle = m.random() * Math.PI * 2,
          r = 0.9 + m.random() * 1.1;
        b.tx = clamp(h.sub.dx + Math.cos(angle) * r, LAWN.dx0, LAWN.dx1);
        b.tz = clamp(h.sub.z + Math.sin(angle) * r * 0.7, LAWN.z0, LAWN.z1);
        b.t = 0.9 + m.random() * 0.8;
      }
      moveToward(b, b.tx, b.tz, 1.5, dt);
      return;
    }
    case 'spray': {
      const target = fireTarget(h, b);
      if (!target || b.ext <= 0) {
        b.state = 'party';
        b.t = 0;
        return;
      }
      const d = dist(b, target.dx, target.z);
      if (d > T.sprayRange) {
        moveToward(b, target.dx, target.z, 2.8, dt);
        return;
      }
      b.facing = Math.sign(target.dx - b.dx) || b.facing;
      b.spraying = true;
      b.ext = Math.max(0, b.ext - dt);
      if (b.fumble > 0) {
        b.fumble -= dt;
        b.spraying = 'fumble';
      } else if (m.random() < chance(T.fumbleDrunk * b.drunk, dt)) {
        b.fumble = 1;
        m.emit('fumble', C.fumble, { house: h.id, bro: b.id, dx: b.dx, z: b.z });
      } else if (target.kind === 'house') {
        h.fire = Math.max(0, h.fire - T.houseFireDouse * (m.diff?.douse ?? 1) * (1 - b.drunk) * dt);
      } else if (m.random() < chance((T.extinguishSober * (1 - b.drunk) + T.extinguishBase) * (m.diff?.douse ?? 1), dt)) {
        if (target.kind === 'bro') douse(m, h, target.ref, 'spray');
        else {
          h.can.state = 'burnt';
          h.can.fuel = 0;
          m.emit('canOut', C.doused, { house: h.id, dx: h.can.dx, z: h.can.z });
        }
      }
      if (b.ext <= 0) m.emit('extEmpty', null, { house: h.id, bro: b.id });
      return;
    }
    case 'burning': {
      b.burn -= dt;
      if (b.mode === 'door' && !h.gone && !h.lifting) {
        const d = door(h);
        if (moveToward(b, d.dx, d.z, 4.2, dt) < 0.45) {
          houseIgnite(m, h, 'bro', T.houseFireStart + 0.1);
          h.fire = Math.min(1, h.fire + 0.1);
          b.state = 'inside';
          b.t = 3;
          m.emit('broIn', null, { house: h.id, bro: b.id });
          return;
        }
      } else if (b.mode === 'roll') {
        if (m.random() < chance(T.rollOut, dt)) {
          douse(m, h, b, 'self');
          return;
        }
      } else {
        if (b.t <= 0) {
          b.tx = clamp(b.dx + (m.random() - 0.5) * 6, LAWN.dx0, LAWN.dx1);
          b.tz = clamp(b.z + (m.random() - 0.5) * 3, LAWN.z0, LAWN.z1);
          b.t = 0.45;
        }
        moveToward(b, b.tx, b.tz, 3.8, dt);
      }
      if (b.burn <= 0) douse(m, h, b, 'self');
      return;
    }
    case 'inside': {
      if (b.t <= 0) {
        b.dx = door(h).dx;
        b.z = Z.porch + 0.7;
        b.state = 'charred';
        b.t = T.charredTime;
        b.immune = T.immuneTime;
        m.emit('broOut', null, { house: h.id, bro: b.id });
      }
      return;
    }
    case 'charred': {
      if (b.t <= 0) {
        b.state = 'party';
        b.t = 0;
      }
      return;
    }
    case 'flee': {
      if (b.fleeBurning > 0) b.fleeBurning = Math.max(0, b.fleeBurning - dt);
      const side = b.dx < 0 ? -1 : 1;
      if (moveToward(b, side * 12, Z.walkBack, 4.5, dt) < 0.3) b.state = 'away';
      return;
    }
  }
}
function igniteNearFire(m, h, dt) {
  const lit = [];
  for (const b of h.bros) {
    if (!ignitable(b)) continue;
    let rate = 0;
    if (h.can.state === 'burning' && dist(b, h.can.dx, h.can.z) < T.canIgniteRadius)
      rate += T.igniteBase + T.igniteDrunk * b.drunk;
    for (const o of h.bros)
      if (o !== b && o.state === 'burning' && dist(b, o.dx, o.z) < T.spreadRadius)
        rate += T.spreadRate;
    if (rate > 0 && m.random() < chance(rate, dt))
      lit.push([b, h.can.state === 'burning' ? 'can' : 'bro']);
  }
  for (const [b, cause] of lit) igniteBro(m, h, b, cause);
}
function fireNear(h, x, z, radius) {
  if (h.can.state === 'burning' && Math.hypot(h.can.dx - x, h.can.z - z) < radius) return true;
  if (h.fire > 0.05 && Math.abs(door(h).dx - x) < radius * 2) return true;
  return h.bros.some((b) => b.state === 'burning' && dist(b, x, z) < radius);
}
export function updateHouse(m, h, dt) {
  for (const b of h.bros) if (b.state !== 'away') updateBro(m, h, b, dt);
  if (h.gone) return;
  if (h.bees > 0) h.bees = Math.max(0, h.bees - dt);
  if (h.can.state === 'burning') {
    h.can.fuel -= dt;
    if (h.can.fuel <= 0) {
      h.can.state = 'burnt';
      h.can.fuel = 0;
      m.emit('canOut', null, { house: h.id });
    }
  }
  igniteNearFire(m, h, dt);
  // Fire department: arrives, sprays, rescues the house, then leaves.
  if (h.fd) {
    const fd = h.fd;
    fd.t -= dt;
    if (fd.stage === 'coming' && fd.t <= 0) {
      fd.stage = 'spraying';
      fd.t = T.fdSpray;
      for (const b of h.bros) if (b.state === 'burning') douse(m, h, b, 'fd');
      if (h.can.state === 'burning') h.can.state = 'burnt';
      m.emit('fdArrive', null, { house: h.id });
    } else if (fd.stage === 'spraying') {
      h.fire = Math.max(0, h.fire - 0.45 * dt);
      for (const b of h.bros) if (b.state === 'burning') douse(m, h, b, 'fd');
      if (fd.t <= 0) {
        h.fire = 0;
        fd.stage = 'leaving';
        fd.t = T.fdStay - T.fdSpray;
        m.emit('fdRescue', C.rescuedHouse, { house: h.id, sub: h.name });
      }
    } else if (fd.stage === 'leaving' && fd.t <= 0) {
      h.fd = null;
      m.emit('fdLeave', null, { house: h.id });
    }
  }
  if (h.fire > 0) {
    h.burnTime += dt;
    if (!h.fd || h.fd.stage === 'coming') h.fire = Math.min(1, h.fire + T.houseFireGrow * dt);
    damage(m, h, T.houseFireDamage * (m.diff?.fire ?? 1) * h.fire * dt, 'fire');
    if (!h.gone && h.fire <= 0.02) {
      h.fire = 0;
      m.emit('saved', C.saved, { house: h.id });
    }
  }
  if (h.gone) return;
  if (h.empty) {
    if (!h.rotting) {
      h.rotting = true;
      m.emit('rot', C.rot, { house: h.id, sub: h.name });
    }
    damage(m, h, T.rot * dt, 'rot');
  }
  if (h.gone) return;
  if (h.sub) {
    const beat = Math.floor(m.beat + 1e-9);
    if (beat > h.sub.lastBeat) {
      h.sub.lastBeat = beat;
      h.sub.beats--;
      m.award(SCORE.subBeat);
      m.emit('subBeat', null, { house: h.id, beats: h.sub.beats });
      damage(m, h, T.subDamage, 'sub');
      if (h.sub && h.sub.beats <= 0) {
        h.sub = null;
        m.emit('subEnd', null, { house: h.id });
      }
    }
  }
  if (h.gone) return;
  if (h.fryer && fireNear(h, h.fryer.dx, h.fryer.z, T.fryerRadius)) {
    const f = h.fryer;
    h.fryer = null;
    m.award(SCORE.fryer);
    m.emit('fireball', C.fireball, { house: h.id, dx: f.dx, z: f.z });
    damage(m, h, T.fryerDamage, 'fryer');
    if (!h.gone) {
      houseIgnite(m, h, 'fryer', 0.6);
      for (const b of h.bros)
        if (ignitable(b) && dist(b, f.dx, f.z) < T.fryerBlast) igniteBro(m, h, b, 'fryer');
    }
  }
  if (h.gone) return;
  if (h.raccoons && h.can.state === 'burning') {
    h.raccoons.t += dt;
    if (h.raccoons.t >= T.raccoonDelay) {
      h.raccoons = null;
      m.award(SCORE.raccoons);
      m.emit('raccoonsIn', C.raccoonsIn, { house: h.id });
      houseIgnite(m, h, 'raccoons', 0.45);
    }
  }
  if (!h.lifting && h.balloons > 0 && h.balloons >= balloonsNeeded(h)) {
    h.lifting = true;
    h.lift = 0;
    h.fire = 0;
    h.fd = null;
    for (const b of h.bros)
      if (!['away', 'burning'].includes(b.state)) {
        if (b.state === 'inside') {
          b.dx = door(h).dx;
          b.z = Z.porch + 0.6;
        }
        b.state = 'flee';
      }
    m.emit('liftoff', C.liftoff, { house: h.id, sub: h.name });
  }
  if (h.lifting) {
    h.lift = Math.min(1, h.lift + dt / T.liftTime);
    if (h.lift >= 1) {
      m.award(SCORE.airlift);
      destroy(m, h, 'airlift');
    }
  }
}
// A new lap brings fresh cans to standing houses; misses can be retried.
export function newLapCans(h) {
  if (h.gone) return;
  if (['lidded', 'burnt'].includes(h.can.state)) h.can.state = 'ready';
  h.comeBack = false;
}
export const describe = (h) => S.states[h.state];
