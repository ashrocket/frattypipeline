import { TUNING as T, SCORE, clamp } from '../data/tuning.js';
import { C, S } from '../data/strings.js';
import { SHOPS } from '../data/houses.js';
import { near, ring, Z, ROW } from './row.js';
import { beehive, balloonsNeeded } from './house.js';
import { addFlow } from './combo.js';
export const ITEMS = ['bottle', ...SHOPS.map((shop) => shop.kind)];
const WEIGHT = { bottle: 1, bees: 1.05, sub: 1.15, fryer: 1.2, raccoons: 1.1, balloons: 1.3 };
export const itemName = (item) =>
  item === 'bottle' ? 'FLAMING BOTTLE' : SHOPS.find((s) => s.kind === item).item;
export function flightTime(item, dz, y = 0) {
  return (T.throwBase + T.throwPerMeter * (Math.abs(dz) + 0.5 * y)) * WEIGHT[item];
}
// Can size comes from the difficulty; aim assist widens it and snaps the reticle (visibly).
const canRadius = (m) => m.diff?.canRadius ?? T.canRadius;
const assistExtra = (m, kind) =>
  m.assist ? (kind === 'can' ? (m.diff?.assistRadius ?? T.assistRadius) - canRadius(m) : 0.22) : 0;
function zone(kind, x0, x1, landX, z, y) {
  return { kind, x: clamp(landX, x0, x1), x0, x1, z, y, half: (x1 - x0) / 2 };
}
// The target an item would hit on house h (world center hx), given a landing x.
export function targetOn(m, h, hx, item, landX) {
  if (h.gone || h.lifting) return null;
  const f = h.facade;
  if (item === 'bottle') {
    if (h.can.state !== 'ready') return null;
    return { kind: 'can', x: hx + h.can.dx, z: h.can.z, y: 0.95, half: canRadius(m) };
  }
  if (item === 'bees') {
    if (h.empty) return null;
    let best = null;
    f.windows.forEach((w, index) => {
      const d = Math.abs(hx + w.dx - landX);
      if (!best || d < best.d) best = { d, w, index };
    });
    return { kind: 'window', x: hx + best.w.dx, z: Z.facade, y: best.w.y, half: best.w.w / 2, window: best.index };
  }
  if (item === 'sub') return h.sub ? null : zone('lawn', hx - 6.5, hx + 6.5, landX, -7.2, 0);
  if (item === 'fryer')
    return h.fryer ? null : zone('porch', hx + f.door.dx - 1.8, hx + f.door.dx + 1.8, landX, Z.porch + 0.3, 0.3);
  if (item === 'raccoons')
    return h.raccoons || h.can.state === 'gone' ? null : zone('can-side', hx + h.can.dx - 1.6, hx + h.can.dx + 1.6, landX, h.can.z + 0.3, 0);
  if (item === 'balloons') return zone('roof', hx + f.roof[0], hx + f.roof[1], landX, Z.facade, f.roofY);
  return null;
}
export const tolerance = (m, t) => (t.x0 !== undefined ? assistExtra(m, t.kind) : t.half + assistExtra(m, t.kind));
export function hits(m, t, x) {
  if (t.x0 !== undefined) return x >= t.x0 - tolerance(m, t) && x <= t.x1 + tolerance(m, t);
  return Math.abs(x - t.x) <= tolerance(m, t);
}
function candidates(m, item) {
  const p = m.player;
  if (m.level === 'alley') return [];
  if (m.level === 'training') {
    if (item !== 'bottle') return [];
    return (m.course?.cans ?? [])
      .filter((c) => c.state === 'ready')
      .map((c) => ({ house: null, practice: c.id, at: () => ({ kind: 'can', x: c.x, z: c.z, y: 0.95, half: canRadius(m) }) }));
  }
  return m.houses
    .map((h) => ({ h, hx: near(h.s, p.x) }))
    .filter(({ hx }) => hx >= p.x - 10 && hx <= p.x + 34)
    .map(({ h, hx }) => ({ house: h.id, at: (landX) => targetOn(m, h, hx, item, landX) }));
}
// What the reticle shows right now: the nearest reachable target ahead for the item.
export function aim(m) {
  const p = m.player,
    item = m.item;
  let best = null;
  for (const cand of candidates(m, item)) {
    let t = cand.at(p.x + p.vx * 0.5);
    if (!t) continue;
    let flight = flightTime(item, t.z - p.z, t.y);
    const landX = p.x + p.vx * flight;
    t = cand.at(landX);
    flight = flightTime(item, t.z - p.z, t.y);
    const ahead = t.x - p.x;
    if (ahead < T.throwAhead[0] || ahead > T.throwAhead[1]) continue;
    const reachable = (t.x1 ?? t.x) >= landX - tolerance(m, t) - 0.4;
    const score = (reachable ? 0 : 100) + ahead;
    if (!best || score < best.score) best = { t, house: cand.house, practice: cand.practice, flight, landX, score };
  }
  if (!best) {
    const flight = flightTime(item, -6.6 - p.z);
    return { item, target: null, x: p.x + p.vx * flight, z: -6.6, y: 0, locked: false, flight };
  }
  const locked = hits(m, best.t, best.landX);
  const snap = locked && m.assist && best.t.x0 === undefined;
  return {
    item,
    target: best.t,
    house: best.house,
    practice: best.practice,
    flight: best.flight,
    landX: best.landX,
    x: snap ? best.t.x : best.landX,
    z: best.t.z,
    y: best.t.y,
    locked,
  };
}
export function stock(m, item = m.item) {
  if (m.level === 'training' && item === 'bottle') return 99;
  return item === 'bottle' ? Math.floor(m.bottles) : (m.items[item] ?? 0);
}
export function cycleItem(m, direction = 1) {
  const owned = ITEMS.filter((item) => item === 'bottle' || m.unlocked[item]);
  const index = owned.indexOf(m.item);
  m.item = owned[(index + direction + owned.length) % owned.length];
  m.emit('item', null, { item: m.item, name: itemName(m.item) });
  return true;
}
// Holding T lights the rag (a lighter flick) and shows where it will land.
export function light(m) {
  m.aiming = true;
  m.litAt = m.time;
  m.emit('light', null, { item: m.item });
  return true;
}
// Style while throwing: off a rail or mid-trick is worth more than from the ground.
function styleOf(p) {
  if (p.grind) return [1.5, C.grindToss];
  if (p.flip || (p.rot !== 0 && !p.grounded)) return [2, C.trickToss];
  if (p.y > 0.4) return [T.airMultiplier, C.air];
  return [1, null];
}
export function release(m) {
  const p = m.player;
  if (!m.aiming) return true;
  m.aiming = false;
  if (m.phase === 'rescue') {
    m.emit('noThrow', S.hud.rescue);
    return true;
  }
  if (m.level === 'alley') {
    m.emit('noThrow', S.hud.noTargetsHere);
    return true;
  }
  if (p.wipeout > 0 || p.throwCooldown > 1e-9) return true;
  if (stock(m) < 1) {
    m.emit('empty', m.item === 'bottle' ? C.noAmmo : C.noItem, { item: m.item });
    if (m.item !== 'bottle') m.item = 'bottle';
    return true;
  }
  const a = aim(m),
    [style, styleName] = styleOf(p);
  if (m.level !== 'training') {
    if (m.item === 'bottle') m.bottles -= 1;
    else m.items[m.item] -= 1;
  }
  p.throwCooldown = T.throwCooldown;
  p.release = 0.14;
  const projectile = {
    id: ++m.id,
    item: m.item,
    fromX: p.x + 0.2,
    fromZ: p.z,
    fromY: p.y + 1.45,
    toX: a.x,
    toZ: a.z,
    toY: a.y,
    t: 0,
    flight: a.flight,
    house: a.house ?? null,
    practice: a.practice ?? null,
    air: p.y > 0.4,
    style,
    styleName,
    locked: a.locked,
  };
  m.projectiles.push(projectile);
  m.stats.throws++;
  if (m.item !== 'bottle') m.stats.itemThrows++;
  m.emit('throw', null, { ...projectile, x: p.x, z: p.z });
  if (m.item !== 'bottle' && m.items[m.item] <= 0) m.item = 'bottle';
  return true;
}
export function updateProjectiles(m, dt) {
  for (const pr of m.projectiles) {
    pr.t += dt;
    if (pr.t + 1e-9 >= pr.flight) {
      pr.dead = true;
      impact(m, pr);
    }
  }
  m.projectiles = m.projectiles.filter((pr) => !pr.dead);
}
function houseAt(m, x) {
  const s = ring(x);
  const place = ROW.houses.find((h) => s >= h.lot[0] && s < h.lot[1]);
  return place ? m.houses[place.id] : null;
}
function impact(m, pr) {
  if (pr.practice || m.level === 'training') {
    const can = m.course?.cans.find((c) => c.id === pr.practice);
    const at = { x: pr.toX, z: pr.toZ, y: pr.toY, item: pr.item };
    if (can && can.state === 'ready' && Math.abs(pr.toX - can.x) <= canRadius(m) + assistExtra(m, 'can')) {
      can.state = 'burning';
      can.fuel = 60;
      m.emit('practiceHit', pr.styleName ?? C.hit, { ...at, x: can.x, z: can.z, practice: true });
    } else {
      // Short of the can means it left the hand too soon; long means too late.
      const short = can && pr.toX < can.x;
      m.emit('practiceMiss', C.miss, { ...at, sub: short ? C.practiceShortSub : C.practiceMissSub });
    }
    return;
  }
  const h = pr.house !== null ? m.houses[pr.house] : houseAt(m, pr.toX);
  const at = { x: pr.toX, z: pr.toZ, y: pr.toY, item: pr.item, house: h?.id ?? null };
  if (!h || h.gone || h.lifting) {
    m.emit('wasted', pr.item === 'bottle' ? C.wasted : C.itemMiss, at);
    return;
  }
  const hx = near(h.s, pr.toX),
    t = targetOn(m, h, hx, pr.item, pr.toX);
  const hit = Boolean(t) && hits(m, t, pr.toX);
  if (pr.item === 'bottle') {
    if (hit) {
      h.can.state = 'burning';
      h.can.fuel = T.canBurn;
      h.can.litId++;
      h.comeBack = false;
      m.stats.cansLit++;
      const flowing = m.flowTime > 0 ? 2 : 1,
        style = pr.style ?? 1;
      const points = m.award(Math.round(SCORE.can * style * flowing));
      addFlow(m, 3);
      m.emit('hit', pr.styleName ?? C.hit, { ...at, dx: h.can.dx, z: h.can.z, points });
    } else if (h.can.state === 'ready') {
      // Owner rule: a miss is a miss. The lid goes on until the next day.
      h.can.state = 'lidded';
      h.comeBack = true;
      m.stats.misses++;
      m.emit('miss', C.miss, { ...at, sub: C.missSub });
    } else m.emit('wasted', C.wasted, at);
    return;
  }
  if (!hit) {
    m.emit('itemMiss', C.itemMiss, at);
    return;
  }
  const dx = pr.toX - hx;
  if (pr.item === 'bees') beehive(m, h);
  else if (pr.item === 'sub') {
    h.sub = { dx, z: t.z, beats: T.subBeats, lastBeat: Math.floor(m.beat + 1e-9) };
    m.award(SCORE.sub);
    m.emit('sub', C.sub, { ...at, dx });
  } else if (pr.item === 'fryer') {
    h.fryer = { dx: clamp(dx, h.facade.door.dx - 1.8, h.facade.door.dx + 1.8), z: Z.porch + 0.3 };
    m.emit('fryer', C.fryer, { ...at, dx: h.fryer.dx });
  } else if (pr.item === 'raccoons') {
    h.raccoons = { t: 0, dx: clamp(dx, h.can.dx - 1.2, h.can.dx + 1.2) };
    m.emit('raccoons', C.raccoons, { ...at, dx });
    if (h.can.state === 'lidded') {
      h.can.state = 'ready';
      h.comeBack = false;
      m.emit('lidOff', C.lidOff, { ...at, dx: h.can.dx });
    }
  } else if (pr.item === 'balloons') {
    h.balloons++;
    m.emit('balloon', C.balloon, { ...at, dx, count: h.balloons, need: balloonsNeeded(h), sub: `${h.balloons} / ${balloonsNeeded(h)}` });
  }
}
