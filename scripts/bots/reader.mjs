import { policyRandom } from './degenerate.mjs';
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export function reader(seed, { novice = false } = {}) {
  const random = policyRandom(seed + 11939),
    history = [],
    ignored = new Set(),
    noticed = new Map();
  let holding = false,
    nextThrow = 0,
    lastJump = -9,
    lastPush = -9,
    aimOffset = 0,
    releaseDelay = 0.6;
  return (current) => {
    history.push(current);
    const delay = novice ? 0.4 + (random() - 0.5) * 0.24 : 0.25 + (random() - 0.5) * 0.1;
    while (history.length > 1 && history[1].time <= current.time - delay) history.shift();
    const seen = history[0],
      p = current.player,
      now = current.time;
    let input = { x: 0, z: 0, throw: holding, ollie: false, push: false, super: false };
    if (current.phase !== 'playing') {
      holding = false;
      return {};
    }
    if (p.pitchLock > 0) {
      input.ollie = Math.floor(now * 10) % 2 === 0;
      return input;
    }
    let targetX = current.arena ? current.arena.x + aimOffset : p.x,
      targetZ = -1.7;
    if (!current.arena) {
      input.x = 1;
      if (!novice && p.pushCooldown <= 0) {
        input.push = true;
      }
      const coffee = current.coffee.find((c) => c.x > p.x - 1);
      targetZ = novice ? -1.7 : (coffee?.z ?? -3.4);
      input.z = clamp((targetZ - p.z) * 1.7 - p.vx * 0, -1, 1);
      holding = false;
      input.throw = false;
      return input;
    }
    for (const a of seen.attacks) {
      if (!noticed.has(a.id)) {
        noticed.set(a.id, now);
        if (novice && random() < 0.2) ignored.add(a.id);
      }
    }
    const threats = seen.attacks.filter((a) => !ignored.has(a.id));
    const near = seen.enemies
      .filter((e) => e.state !== 'flee')
      .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
    const ignoredOwners = new Set(
      seen.attacks.filter((a) => ignored.has(a.id)).map((a) => a.owner),
    );
    const bro = near.find((e) => e.kind !== 'pong' && !ignoredOwners.has(e.id));
    if (seen.arena?.guard && bro) {
      targetX = bro.x - 1.05;
      targetZ = bro.z;
      if (
        (['stunned', 'recovery'].includes(bro.state) ||
          (bro.kind === 'vest' && ['telegraph', 'active'].includes(bro.state)) ||
          bro.kind === 'conga') &&
        Math.hypot(bro.x - p.x, bro.z - p.z) < 2.4 &&
        p.pushCooldown <= 0.06 &&
        p.jumpHeight <= 0 &&
        now - lastPush > 0.12
      ) {
        input.push = true;
        lastPush = now;
      }
    }
    const danger = threats.find((a) => a.state === 'telegraph' || a.state === 'active');
    if (danger) {
      const until = (danger.strikeBeat - current.beat) * 0.32616;
      if (danger.height === 'HIGH' || danger.kind === 'cart') {
        targetZ = danger.z < 0 ? Math.min(3.5, danger.z + 2.5) : Math.max(-3.5, danger.z - 2.5);
      } else if (danger.height === 'LOW') {
        const lead = novice ? 0.2 : 0.1;
        if (
          until <= lead &&
          until > -0.1 &&
          p.jumpHeight === 0 &&
          p.landingLag <= 0.06 &&
          now - lastJump > 0.15
        ) {
          input.ollie = true;
          lastJump = now;
        }
        if (danger.kind === 'keg' && until > 0.3) targetZ = danger.z + (danger.z > 0 ? -1.7 : 1.7);
      } else if (danger.height === 'MID' && danger.kind !== 'cart') {
        if (until < 0.38 && p.pushCooldown <= 0.04 && p.jumpHeight <= 0 && now - lastPush > 0.12) {
          input.push = true;
          lastPush = now;
        } else if (p.pushCooldown > 0.5) targetZ = danger.z + (danger.z > 0 ? -2.2 : 2.2);
      }
    }
    if (current.riot >= 100 && (!novice || random() > 0.3)) {
      input.super = true;
      holding = false;
      input.throw = false;
      return input;
    }
    // Brake against the fixed aim lead. The player can see their own momentum.
    const predicted = p.x + p.vx * 0.9;
    input.x = clamp((targetX - p.x) * 1.1 - p.vx * 0.7, -1, 1);
    input.z = clamp((targetZ - p.z) * 1.6, -1, 1);
    const porch = near.some((e) => e.kind === 'pong');
    const open = !seen.arena?.guard;
    const inAim = Math.abs(predicted - current.arena.x) < (novice ? 2.1 : 0.65);
    if (
      !novice &&
      current.arena.id >= 2 &&
      seen.arena?.guard &&
      p.jumpHeight >= 0.9 &&
      inAim &&
      current.ammo >= 1
    ) {
      if (current.charge) {
        holding = false;
        input.throw = false;
        nextThrow = now + 0.2;
      } else {
        holding = true;
        input.throw = true;
      }
      return input;
    }
    if (!holding && current.ammo >= 1 && now >= nextThrow && (open || porch) && inAim) {
      holding = true;
      input.throw = true;
      if (novice) {
        aimOffset = (random() - 0.5) * 3.8;
        releaseDelay = 0.4 + random() * 0.4;
      }
    }
    if (holding) {
      const age = current.charge ? now - current.charge.started : 0;
      const timing = Math.abs(current.beat - Math.round(current.beat)) * 0.32616;
      if (
        (age >= (novice ? 0.2 : 0.4) && inAim && (novice ? age > releaseDelay : timing < 0.017)) ||
        age > 1.5
      ) {
        holding = false;
        input.throw = false;
        nextThrow = now + 0.1;
      }
    }
    if (input.push && !novice) input.x = 1;
    return input;
  };
}
