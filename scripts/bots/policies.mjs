// Bot policies see the game only through perceive() (what is on screen) and act only
// through player inputs. Reaction delay models a human seeing the frame late.
import { seededRandom, TUNING as T } from '../../src/data/tuning.js';
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const SOBER = new Set([3, 5, 9, 11]);
const steer = (from, to, gain = 2) => clamp((to - from) * gain, -1, 1);
function delayed(delay) {
  const frames = [];
  return (view) => {
    frames.push(view);
    while (frames.length > 1 && frames[1].time <= view.time - delay) frames.shift();
    return frames[0];
  };
}
// Doing nothing: the board keeps rolling, nobody throws.
export const idle = () => () => ({ x: 0, z: 0 });
// Holding brake: must be captured quickly (the owner's no-standing-still rule).
export const brake = () => () => ({ x: -1, z: 0 });
// Mashes throw without looking, wanders lanes. Must score far below deliberate play.
export function masher(seed) {
  const random = seededRandom(seed * 7 + 3);
  let lane = 0;
  return (view) => {
    if (Math.floor(view.time * 2) !== lane) lane = Math.floor(view.time * 2);
    const z = Math.sin(lane * 1.7 + seed) * 3;
    if (view.phase === 'continue') return { throw: Math.floor(view.time * 4) % 2 === 0 };
    return {
      x: 1,
      z: steer(view.player.z, z, 1),
      throw: Math.floor(view.time * 3.3) % 2 === 0,
      ollie: random() < 0.02,
      push: random() < 0.03,
    };
  };
}
function itemFor(view, house) {
  if (!house) return 'bottle';
  const has = (kind) => (view.items[kind] ?? 0) > 0;
  if (house.can.state === 'lidded' && has('raccoons') && !house.raccoons) return 'raccoons';
  if (house.state >= 2 && has('balloons')) return 'balloons';
  if (house.fire > 0.2 && has('fryer') && !house.fryer && house.state < 2) return 'fryer';
  if (SOBER.has(house.id) && !house.empty && has('bees')) return 'bees';
  if (house.can.state === 'ready') return 'bottle';
  if (house.can.state === 'burning' && has('sub') && !house.sub) return 'sub';
  if (house.state === 1 && (view.items.balloons ?? 0) >= 2) return 'balloons';
  return 'bottle';
}
// Reads hazards, routes through shops and crates, picks items per house, waits for LOCK.
export function skilled(seed, { novice = false } = {}) {
  const random = seededRandom(seed * 13 + (novice ? 5 : 1));
  const see = delayed(novice ? 0.42 : 0.22);
  let holding = false,
    wantItem = null,
    lastItemPress = -1,
    lastOllie = -1,
    releaseError = 0;
  return (live) => {
    const view = see(live),
      p = live.player,
      t = live.time;
    if (live.phase === 'continue') return { throw: Math.floor(t * 4) % 2 === 0 };
    if (live.phase === 'bonus') {
      const b = live.bonus;
      if (!b || b.stage !== 'run' || b.thrown) return { throw: false };
      // Release a beat before the can: the landing lead is speed × flight.
      const target = -T.bonusSpeed * T.bonusFlight + (novice ? (random() - 0.5) * 1.6 : (random() - 0.5) * 0.6);
      return { throw: b.x < target };
    }
    if (!['playing', 'rescue'].includes(live.phase)) {
      holding = false;
      return {};
    }
    const input = { x: 1, z: 0, throw: holding, ollie: false, push: false, item: false };
    let laneZ = novice ? -2.2 : -2.7;
    if (live.level === 'alley') {
      // Bee Alley: steer for the next hive, pop an ollie for the ones up on fence posts.
      holding = false;
      input.throw = false;
      const hive = view.alley?.hives.find((h) => h.x > p.x - 0.5);
      if (hive) {
        laneZ = hive.z;
        const d = hive.x - p.x;
        if (hive.h > 0 && p.grounded && d < 1.6 && d > 0.4 && t - lastOllie > 0.3 && (!novice || random() < 0.8)) {
          input.ollie = true;
          lastOllie = t;
          input.z = steer(p.z, laneZ, 3);
          return input;
        }
      } else laneZ = 0.8;
    } else if (live.phase === 'rescue' && live.zombie) {
      const goal = live.zombie.state === 'waiting' ? live.zombie : live.ambulance ?? live.zombie;
      laneZ = goal.z;
      holding = false;
      input.throw = false;
    } else {
      // Shops: roll along the sidewalk pad when one is coming up and not yet visited.
      const shop = view.shops.find((s) => !s.visited && s.x - p.x < 14 && s.x - p.x > -3);
      if (shop && !novice) laneZ = -3.9;
      // Crates when low on bottles.
      if (live.bottles < 4) {
        const crate = view.hazards.find((o) => o.kind === 'crate' && o.x - p.x > 2 && o.x - p.x < 14);
        if (crate) laneZ = crate.z;
      }
    }
    // Hazards ahead in my lane: ollie over low ones, carve around carts and trucks.
    const benches = view.rails.filter((r) => r.solid).map((r) => ({ kind: 'bench', x: (r.x0 + r.x1) / 2, hx: (r.x1 - r.x0) / 2, z: r.z, hz: 0.25, h: r.h }));
    const ahead = [...view.hazards, ...benches, ...view.carts.map((c) => ({ ...c, kind: 'cart', h: 1.6 }))]
      .filter((o) => o.kind !== 'crate' && o.kind !== 'ramp' && o.x + (o.hx ?? 0.5) > p.x - 0.2 && o.x - p.x < 9)
      .sort((a, b) => a.x - b.x);
    for (const o of ahead) {
      const dz = Math.abs(o.z - p.z);
      // Alongside something long: hold this side of it instead of carving into it.
      if (o.x - (o.hx ?? 0.4) < p.x && dz < (o.hz ?? 0.4) + 1 && (laneZ - p.z) * (o.z - p.z) > 0) laneZ = p.z;
      if (dz > (o.hz ?? 0.4) + 0.6) continue;
      const distance = o.x - (o.hx ?? 0.4) - p.x;
      if (o.kind === 'cart' || (o.h ?? 0) > 1) {
        laneZ = o.z > -0.5 ? o.z - 2.2 : o.z + 2.2;
        break;
      }
      const reach = 0.9 + p.vx * 0.05;
      if (distance < reach && distance > -0.2 && p.grounded && t - lastOllie > 0.3) {
        if (!novice || random() < 0.7) {
          input.ollie = true;
          lastOllie = t;
        }
      }
      break;
    }
    for (const h of view.houses) if (h.truck && h.truck !== 'coming' && Math.abs(h.x - p.x) < 6) laneZ = Math.max(laneZ, -0.4);
    input.z = steer(p.z, clamp(laneZ, T.zMin, T.zMax), live.level === 'alley' ? 3 : 2.2);
    if (live.level === 'alley') return input;
    // Push for speed on clear road.
    if (!novice && p.pushCooldown <= 0 && p.grounded && ahead.length === 0 && random() < 0.02) input.push = true;
    if (live.phase !== 'playing') return input;
    // Choose the item for the house we are about to pass.
    const next = view.houses
      .filter((h) => !h.gone && h.x - p.x > 1 && h.x - p.x < 20)
      .sort((a, b) => a.x - b.x)[0];
    wantItem = novice ? 'bottle' : itemFor(live, next && live.houses.find((h) => h.id === next.id));
    if (wantItem !== live.item && t - lastItemPress > 0.12 && !holding) {
      lastItemPress = t;
      input.item = true;
      return input;
    }
    const a = live.aim;
    if (!holding) {
      if (a?.target && (live.stock ?? 0) > 0) {
        holding = true;
        releaseError = novice ? (random() - 0.5) * 2.2 : 0;
      }
    } else if (!a?.target) holding = false;
    else {
      const error = (a.landX ?? a.x) - a.target.x;
      const ready = novice ? Math.abs(error - releaseError) < 0.35 || a.locked && random() < 0.08 : a.locked;
      if (ready) holding = false;
    }
    input.throw = holding;
    // People ease off and brake to line up a throw; that is what lets the Pipeline close in.
    if (novice && holding && a?.target) {
      const error = (a.landX ?? a.x) - a.target.x;
      input.x = error > 0.4 ? -0.6 : 0.2;
    }
    return input;
  };
}
export const novice = (seed) => skilled(seed, { novice: true });
// Skate school, played the way the bubbles teach it (used by the demo and the recorder).
export function trainer() {
  let holding = false,
    flipped = false,
    lastOllie = -1;
  return (view) => {
    const p = view.player,
      t = view.time,
      c = view.course;
    if (!c) return {};
    const input = { x: 1, z: (0.2 - p.z) * 2, ollie: false, throw: false, up: false };
    const ahead = (kind) => view.hazards.find((o) => o.kind === kind && o.x + (o.hx ?? 0) > p.x);
    if (c.station === 'glide') input.x = 0;
    else if (c.station === 'slow') input.x = c.done ? 1 : -1;
    else if (c.station === 'ollie') {
      input.x = p.vx < 6 ? 1 : 0;
      const cone = ahead('cone');
      if (cone && p.grounded && cone.x - p.x < 1.6 && cone.x - p.x > 0.7 && t - lastOllie > 0.4) {
        input.ollie = true;
        lastOllie = t;
      }
    } else if (c.station === 'throw') {
      input.x = p.vx < 5.5 ? 1 : 0;
      if (!holding && view.aim?.target) holding = true;
      else if (holding && (view.aim?.locked || !view.aim?.target)) holding = false;
      input.throw = holding;
    } else if (c.station === 'backflip') {
      input.x = 1;
      // Hold Space through the ramp's air until the flip is nearly round, then let go.
      input.ollie = !p.grounded && !c.done && p.rot > -Math.PI * 2 + 0.6;
    } else if (c.station === 'grind') {
      const rail = view.rails.find((r) => r.x1 > p.x);
      input.x = p.vx < 6 ? 1 : 0;
      if (rail && p.grounded && !c.done && rail.x0 + 0.6 - p.x < 0.56 * p.vx && t - lastOllie > 0.5) {
        input.ollie = true;
        lastOllie = t;
      }
    } else if (c.station === 'flip') {
      input.x = 1;
      if (!p.grounded && !p.flip && !flipped && !c.done) {
        input.up = true;
        flipped = true;
      }
    }
    return input;
  };
}
export const POLICIES = { idle, brake, masher, novice, skilled };
// Demo director for gameplay videos (not part of the gauntlet): skilled play plus one
// deliberate stop, so the footage shows capture → rescue → 10× bonus → resume.
export function demo(seed, { stopAfter = 4, stopAt = 80 } = {}) {
  const play = skilled(seed),
    school = trainer();
  let braking = false,
    done = false;
  return (view) => {
    if (view.level === 'training') return school(view);
    if (!done && !braking && view.phase === 'playing' && (view.destroyed >= stopAfter || view.time >= stopAt)) braking = true;
    if (braking && view.phase !== 'playing') {
      braking = false;
      done = true;
    }
    return braking ? { x: -1, z: 0, throw: false } : play(view);
  };
}
