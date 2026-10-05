import { HOUSES, DISTRICTS } from '../data/houses.js';
import { TUNING as T, BEAT_S } from '../data/tuning.js';
import { C, S } from '../data/strings.js';
import { nextBar } from './beat.js';
import { spawnBro, fleeAll, telegraph } from './enemies.js';
import { addMakeover } from './player.js';
export function createHouses() {
  return HOUSES.map((data, id) => {
    const district = Math.floor(id / 4),
      bars = data.bars ?? 1;
    const chunkMax = bars > 1 ? T.bossChunkHp[district] : T.chunkHp[district];
    return {
      ...data,
      id,
      district,
      bars,
      x: 14 + id * 30 + Math.floor(id / 4) * 30,
      z: -10.5,
      hp: chunkMax * bars * 2,
      maxHp: chunkMax * bars * 2,
      chunkMax,
      chunkHp: chunkMax,
      chunk: 0,
      burned: false,
      guard: true,
      state: 'waiting',
      timer: bars > 1 ? 90 : 60,
      lastDamageBeat: 0,
      phase: 0,
      porchCount: 0,
    };
  });
}
export function lockArena(m, h) {
  m.arena = h;
  m.cameraX = h.x;
  m.fightHits = 0;
  h.lockAt = m.time;
  h.state = 'door';
  h.doorTime = 0.5;
  h.spawnBeat = nextBar(m.beat + 0.5 / BEAT_S);
  m.stripTime = 0;
  const verb = ['ollie', 'lob', 'air', 'push'][h.id];
  if (h.id < 4 && !m.used[verb] && !m.charge) {
    m.emit('hint', (S.hints[m.inputDevice] ?? S.hints.keyboard)[h.id], {
      x: m.player.x,
      z: m.player.z,
    });
  }
  m.emit('vs', C.vs, { houseId: h.id, name: h.name, sub: h.vs, boss: h.bars > 1, x: h.x, z: 0 });
  if (h.bars > 1) {
    m.phase = 'vs';
    m.vsTime = 1.4;
    m.vsElapsed = 0;
  } else m.bannerUntil = m.time + 1.2;
}
export function beginWave(m, h) {
  h.guard = true;
  h.state = 'door';
  h.doorTime = 0.5;
  h.transitionPorchBeat = m.beat;
  h.spawnBeat = nextBar(m.beat + 0.5 / BEAT_S);
  h.phase = Math.min(h.bars - 1, Math.floor(h.chunk / 2));
  if (h.id === 11 && h.phase === 2) {
    const stand = m.coffeeStands.find((s) => s.boss);
    stand.active = true;
    m.conveyor = { id: ++m.id, age: 0, tellAge: 0, x: h.x, z: -2 };
    m.emit('telegraph', S.phases[2], { source: m.conveyor.id, kind: 'conveyor', x: h.x, z: -2 });
  }
  m.emit('guard', C.guard, { x: h.x, z: -6.6 });
}
export function damageHouse(m, h, amount) {
  if (h.burned) return;
  h.lastDamageBeat = m.beat;
  h.chunkHp = Math.max(0, h.chunkHp - amount);
  h.hp = h.chunkHp + (h.bars * 2 - h.chunk - 1) * h.chunkMax;
  if (h.chunkHp > 0) return;
  h.chunk++;
  if (h.chunk < h.bars * 2) {
    h.chunkHp = h.chunkMax;
    fleeAll(m);
    beginWave(m, h);
    return;
  }
  h.burned = true;
  h.hp = 0;
  h.guard = false;
  h.state = 'burned';
  h.koAt = m.time;
  m.burned++;
  m.award(1000);
  m.combo = Math.min(8, m.combo + 1);
  m.emit('burn', h.id === 11 ? C.final : C.burn, { x: h.x, z: -6.6, houseId: h.id, sub: h.ko });
  if (m.fightHits === 0) {
    m.score += 3000;
    m.perfects++;
    m.emit('perfect', C.perfect, { x: h.x, z: -6.6, sub: '+3000' });
  }
  m.freeze(0.4);
  m.slowmo = 0.9;
  fleeAll(m);
  m.arena = null;
  m.conveyor = null;
  m.fights.push({
    id: h.id,
    seconds: m.time - h.lockAt,
    hits: m.fightHits,
    deadAir: h.deadAir ?? 0,
  });
  const next = m.houses.find((v) => !v.burned);
  if (next) {
    next.timer = next.bars > 1 ? 90 : 60;
    next.timerStarted = true;
  }
  if (m.burned % 4 === 0) {
    m.ammo = m.maxAmmo;
    m.player.pipeline = Math.max(0, m.player.pipeline - 12);
    m.emit('district', C.district, { sub: DISTRICTS[h.district], x: h.x, z: 0 });
  }
  if (m.burned === 12) {
    // Let the final KO's freeze and slow-motion beat finish before results.
    m.phase = 'ko';
  }
}
export function updateRoundTimer(m, dt) {
  const h = m.houses.find((v) => !v.burned);
  if (!h || m.beat < 8) return;
  h.timer -= dt;
  if (h.timer <= 3 && !h.timerTell) {
    h.timerTell = { id: ++m.id, age: 0, tellAge: 0 };
    m.emit('telegraph', C.timeover, {
      source: h.timerTell.id,
      kind: 'timer',
      x: m.player.x,
      z: m.player.z,
    });
  }
  if (h.timerTell) {
    h.timerTell.age += dt;
    h.timerTell.tellAge += dt;
  }
  if (h.timer <= 0 && m.phase === 'playing') {
    addMakeover(m, 30, h.timerTell, 'timeout');
    h.chunkHp = Math.min(h.chunkMax, h.chunkHp + h.chunkMax * 0.25);
    h.hp = h.chunkHp + (h.bars * 2 - h.chunk - 1) * h.chunkMax;
    h.timeouts = (h.timeouts ?? 0) + 1;
    h.timer = 20;
    h.timerTell = null;
    m.emit('timeover', C.timeover, { sub: C.timeoverSub, x: m.player.x, z: m.player.z });
  }
}
export function updateHouses(m, dt) {
  let h = m.arena;
  const next = m.houses.find((v) => !v.burned);
  if (!h && next && m.player.x >= next.x - 8) {
    lockArena(m, next);
    h = next;
  }
  if (!h) {
    m.stripTime += dt;
    if (m.stripTime >= T.stripClock) {
      spawnBro(m, 'lax', 0, true);
      m.stripTime = 0;
    }
    return;
  }
  // Once alerted, the porch stays active through a reinforcement. This prevents
  // a single LOW source becoming an endless parry/relief farm.
  if (
    (h.chunk > 0 || h.everOpened || h.timeouts) &&
    h.state !== 'open' &&
    m.beat >= (h.transitionPorchBeat ?? 0)
  ) {
    telegraph(
      m,
      { id: `porch-${h.id}`, x: h.x, z: -5.6 },
      h.chunk === 0 ? 'pong' : h.porchCount++ % 2 ? 'keg' : 'pong',
      true,
    );
    h.transitionPorchBeat = m.beat + 6;
  }
  if (h.state === 'door') {
    h.doorTime -= dt;
    if (h.doorTime <= 0 && m.beat >= h.spawnBeat) {
      let wave = h.id === 11 ? h.waves[h.phase] : h.waves[h.chunk % 2];
      wave.forEach((kind, index) => spawnBro(m, kind, index));
      h.state = 'wave';
    }
  } else if (h.state === 'wave' && !m.enemies.some((e) => e.duty && e.state !== 'flee')) {
    h.guard = false;
    h.state = 'open';
    h.everOpened = true;
    h.lastDamageBeat = m.beat;
    h.porchBeat = m.beat + 2;
    m.emit('open', C.open, { x: h.x, z: -6.6 });
  } else if (h.state === 'open') {
    if (m.beat - h.lastDamageBeat >= 32) {
      spawnBro(m, 'lax', 0, true);
      h.state = 'wave';
      h.guard = true;
    }
    if (m.beat >= h.porchBeat) {
      telegraph(
        m,
        { id: `porch-${h.id}`, x: h.x, z: -5.6 },
        h.porchCount++ % 2 ? 'keg' : 'pong',
        true,
      );
      h.porchBeat = m.beat + (h.district === 0 ? 6 : 3);
    }
  }
  if (h.id === 11 && h.phase === 1 && m.beat >= (h.cartBeat ?? 0)) {
    telegraph(m, { id: 'booster', x: h.x - 10, z: m.player.z }, 'cart', true);
    h.cartBeat = m.beat + 6;
  }
  if (m.conveyor) {
    const c = m.conveyor;
    c.age += dt;
    c.tellAge += dt;
    if (c.age > 0.975 && Math.abs(m.player.z - c.z) < 0.9 && m.player.jumpHeight === 0) {
      if (!c.contact) {
        m.hits++;
        m.fightHits++;
        m.emit('conveyor', S.phases[2], { source: c.id, x: m.player.x, z: m.player.z });
      }
      c.contact = true;
      m.player.z -= 1.5 * dt;
      m.player.pipeline = Math.min(100, m.player.pipeline + 4 * dt);
      if (m.player.pipeline >= 100) m.transform();
    } else c.contact = false;
  }
  if (!m.attacks.some((a) => a.state === 'telegraph') && h.state !== 'open')
    h.deadAir = (h.deadAir ?? 0) + dt;
}
