import { TUNING as T, TRICKS, clamp } from '../data/tuning.js';
import { C } from '../data/strings.js';
import { addTrick, comboFail, comboLink } from './combo.js';
import { catchRail, updateGrind, leaveGrind } from './rails.js';
const TAU = Math.PI * 2;
// Angle from upright in (-π, π].
export const tilt = (rot) => {
  const a = ((rot % TAU) + TAU) % TAU;
  return a > Math.PI ? a - TAU : a;
};
export function createPlayer(crew = 0, x = 0) {
  return {
    x,
    z: 1.2,
    vx: 0,
    vz: 0,
    y: 0,
    vy: 0,
    grounded: true,
    airAge: 0,
    coyote: 0,
    landingLag: 0,
    pushCooldown: 0,
    pushAge: 9,
    kickT: 0,
    kickAge: 9,
    autoKickT: 0,
    sliding: false,
    dragging: false,
    rot: 0,
    rotTotal: 0,
    flip: null,
    grab: 0,
    grind: null,
    lastGrindEnd: -9,
    stumble: 0,
    wipeout: 0,
    invulnerable: 0,
    throwCooldown: 0,
    release: 0,
    ollieAt: -9,
    landAt: -9,
    landClean: false,
    slideAt: -9,
    ramp: false,
    crew,
    towing: false,
  };
}
// Speed cap: cruise, slowed while towing a zombie, raised during FLOW.
export function speedCap(m) {
  return T.cruise * (m.player.towing ? T.towFactor : 1) + (m.flowTime > 0 ? T.flowSpeed : 0);
}
// Top speed for power kicks and perfect pops (raised during FLOW).
const vmax = (m) => T.vmax + (m.flowTime > 0 ? T.flowSpeed : 0);
// `at` is when the press was queued. A press made in the air (jump buffer) skips the
// landing lag and pops on the first grounded tick: a PERFECT pop.
export function ollie(m, at = m.time) {
  const p = m.player;
  if (p.wipeout > 0) return true;
  if (p.grind) {
    leaveGrind(m, true);
    p.ollieAt = m.time;
    m.stats.ollies++;
    m.emit('ollie', null, { from: 'grind' });
    return true;
  }
  if ((!p.grounded && p.coyote <= 0) || (p.landingLag > 1e-9 && !(at < p.landAt))) return false;
  const perfect = p.grounded && p.landClean && m.time - p.landAt <= T.perfectWindow + 1e-9;
  p.vy = T.jumpVelocity;
  p.grounded = false;
  p.coyote = 0;
  p.airAge = 0;
  p.rot = 0;
  p.rotTotal = 0;
  p.ramp = false;
  p.ollieAt = m.time;
  m.stats.ollies++;
  m.emit('ollie', null, { perfect });
  if (perfect) {
    p.vx = Math.max(p.vx, Math.min(vmax(m), p.vx + 0.6)); // a reward never slows you
    comboLink(m, 'PERFECT', TRICKS.perfect);
  }
  return true;
}
export function launch(m) {
  const p = m.player;
  p.vy = T.rampVelocity;
  p.grounded = false;
  p.airAge = 0;
  p.rot = 0;
  p.rotTotal = 0;
  p.ramp = true;
  p.ollieAt = m.time;
  m.emit('ramp', C.ramp);
}
// Shift: a power kick on the ground, a grab in the air, a faster get-up after a wipeout.
export function push(m) {
  const p = m.player;
  if (p.wipeout > 0) {
    p.wipeout = Math.max(1e-6, p.wipeout - T.wipeoutMash);
    m.emit('mash');
    return true;
  }
  if (p.grind || !p.grounded) return true;
  if (p.pushCooldown > 1e-9) return false;
  p.vx = Math.max(p.vx, Math.min(vmax(m), p.vx + T.pushBoost));
  p.pushCooldown = T.pushCooldown;
  p.pushAge = 0;
  m.emit('push');
  return true;
}
// A direction tap: a flip trick in the air, a hop off a rail while grinding.
export function trickTap(m, dir) {
  const p = m.player;
  if (p.wipeout > 0) return true;
  if (p.grind) {
    if (dir === 'up' || dir === 'down') {
      leaveGrind(m, false);
      p.coyote = 0; // a hop is already a jump (coyote time is for rolling off the end)
      p.vy = 4;
      p.vz = dir === 'up' ? -3 : 3;
    }
    return true;
  }
  if (p.grounded || p.flip) return true;
  const [name, dur, points] = T.flipTricks[dir];
  p.flip = { dir, name, t: 0, dur, points };
  m.emit('flip', name, { dir });
  return true;
}
export function wipeout(m, cause) {
  const p = m.player;
  if (p.invulnerable > 0 || p.wipeout > 0) return false;
  p.wipeout = T.wipeout;
  p.vz = 0;
  // Knocked down in the air: no more rising and no BIG AIR later; the body falls.
  p.vy = Math.min(p.vy, 0);
  p.coyote = 0;
  p.ramp = false;
  p.grind = null;
  p.flip = null;
  p.grab = 0;
  p.rot = 0;
  p.rotTotal = 0;
  p.stumble = 0;
  m.stats.wipeouts++;
  comboFail(m, cause === 'bail' ? 'BAILED' : 'WIPEOUT');
  if (m.horde && ['playing', 'rescue'].includes(m.phase) && m.level === 'row') m.horde.gap -= m.diff.lunge;
  m.emit('wipeout', cause === 'bail' ? C.bail : C.wipeout, { cause, speed: p.vx });
  return true;
}
// A bad landing. While shielded (just got up, rescue, continue) it is a sketchy
// landing instead of a wipeout; the trick is lost either way. True if knocked down.
export function bail(m) {
  const p = m.player;
  if (wipeout(m, 'bail')) return true;
  p.flip = null;
  p.grab = 0;
  p.rot = 0;
  p.rotTotal = 0;
  p.ramp = false;
  p.vx *= 0.7;
  p.landClean = false;
  comboFail(m, 'BAILED');
  return false;
}
// Small hazards trip you up instead of stopping you (Canabalt's 30% rule).
export function stumble(m, cause) {
  const p = m.player;
  if (p.invulnerable > 0 || p.wipeout > 0 || p.stumble > 0) return false;
  p.stumble = T.stumble;
  p.vx *= T.stumbleKeep;
  p.invulnerable = 0.4;
  m.stats.stumbles++;
  comboFail(m, 'STUMBLE');
  m.emit('stumble', C.stumble, { cause });
  return true;
}
function land(m) {
  const p = m.player,
    angle = tilt(p.rot),
    flipLeft = p.flip ? p.flip.dur - p.flip.t : 0,
    big = p.ramp;
  p.y = 0;
  p.vy = 0;
  p.grounded = true;
  p.landingLag = T.landingLag;
  p.landAt = m.time;
  if (flipLeft > 0.06 || Math.abs(angle) > T.sketchyLanding) {
    if (!bail(m)) m.emit('land', C.sketchy, { clean: false, big });
    return;
  }
  scoreAir(m);
  const sketchy = Math.abs(angle) > T.cleanLanding;
  if (sketchy) {
    p.vx *= 0.7;
    p.landClean = false;
    m.emit('land', C.sketchy, { clean: false, big: p.ramp });
  } else {
    p.landClean = true;
    m.emit('land', null, { clean: true, big: p.ramp });
  }
  p.rot = 0;
  p.rotTotal = 0;
  p.ramp = false;
  p.grab = 0;
}
// Tricks finished in the air count when you touch down (or catch a rail).
export function scoreAir(m) {
  const p = m.player;
  if (p.flip) {
    addTrick(m, p.flip.name, p.flip.points);
    p.flip = null;
  }
  const flips = Math.round(-p.rot / TAU);
  if (flips >= 1) {
    m.stats.backflips += flips;
    addTrick(m, flips === 1 ? 'BACKFLIP' : `${flips}× BACKFLIP`, TRICKS.backflip * flips * (flips > 1 ? 1.25 : 1));
  }
  if (p.grab >= 0.15) addTrick(m, 'GRAB', TRICKS.grabPerSecond * p.grab);
  if (p.ramp) addTrick(m, 'BIG AIR', TRICKS.bigAir);
  p.grab = 0;
  p.rotTotal = 0;
}
function settle(p) {
  p.y = 0;
  p.vy = 0;
  p.grounded = true;
  p.airAge = 0;
}
export function updatePlayer(m, dt) {
  const p = m.player;
  for (const key of ['landingLag', 'pushCooldown', 'invulnerable', 'throwCooldown', 'release', 'stumble', 'coyote'])
    p[key] = Math.max(0, p[key] - dt);
  p.pushAge += dt;
  p.kickAge += dt;
  if (p.wipeout > 0) {
    // Tumble: speed bleeds off fast, then the skater gets back up and rolls on.
    p.vx = Math.max(0, p.vx - 22 * dt);
    p.wipeout -= dt;
    p.x += p.vx * dt;
    if (!p.grounded) {
      // Knocked down in the air: fall to the street (no landing, no tricks).
      p.y += p.vy * dt - (T.gravity * T.fallGravity * dt * dt) / 2;
      p.vy -= T.gravity * T.fallGravity * dt;
      if (p.y <= 1e-9) settle(p);
    }
    if (p.wipeout <= 1e-9) {
      p.wipeout = 0;
      p.vx = T.getUpSpeed;
      p.invulnerable = T.invulnerable;
      settle(p); // mashed up early: back on your feet on the ground
      m.emit('getup');
    }
    return;
  }
  if (p.grind) {
    updateGrind(m, dt);
    return;
  }
  const x = m.move.x,
    cap = speedCap(m);
  p.sliding = false;
  p.dragging = false;
  if (p.grounded) {
    if (x > 0.15) {
      // Kick-push: a kick lands every half second while you hold forward.
      p.kickT -= dt;
      if (p.kickT <= 1e-9) {
        if (p.vx < cap - 0.05) {
          p.vx = Math.min(cap, p.vx + T.kickImpulse * Math.min(1, x));
          p.kickAge = 0;
          m.emit('kick');
        }
        p.kickT = T.kickEvery;
      }
    } else p.kickT = 0;
    if (x < -0.15) {
      p.sliding = p.vx > T.slideSpeed;
      p.dragging = !p.sliding && p.vx > 0.1;
      if (p.sliding && m.time - p.slideAt > 0.5) {
        p.slideAt = m.time;
        if (p.landClean && m.time - p.landAt <= T.revertWindow) comboLink(m, 'REVERT', TRICKS.revert);
        m.emit('slide');
      }
      p.vx = Math.max(0, p.vx - (p.sliding ? T.slideDecel : T.dragDecel) * Math.min(1, -x) * dt);
    } else if (x <= 0.15) {
      if (p.vx > T.roll) p.vx = Math.max(T.roll, p.vx - T.glideDecel * dt);
      else if (p.vx < T.roll - 0.2) {
        // Gliding never stops: the skater gives a lazy kick now and then.
        p.autoKickT -= dt;
        if (p.autoKickT <= 0) {
          p.autoKickT = T.autoKickEvery;
          p.vx = Math.min(T.roll, p.vx + T.autoKickImpulse);
          p.kickAge = 0;
          m.emit('kick', null, { lazy: true });
        }
      }
    }
    if (p.vx > cap && p.pushAge > 0.4) p.vx = Math.max(cap, p.vx - T.settleDecel * dt);
  }
  const carve = clamp(m.move.z, -1, 1) * T.carve * (p.grounded ? 1 : 0.6);
  p.vz += (carve - p.vz) * (1 - Math.exp(-12 * dt));
  p.x += p.vx * dt;
  p.z = clamp(p.z + p.vz * dt, T.zMin, T.zMax);
  if (p.z === T.zMin || p.z === T.zMax) p.vz = 0;
  if (!p.grounded) {
    p.airAge += dt;
    if (m.held.ollie && p.airAge > T.backflipAfter) {
      const spin = (TAU / T.backflipTime) * dt;
      p.rot -= spin;
      p.rotTotal -= spin;
    } else if (p.rot !== 0) {
      // Spotting the landing: let go and the skater rights to the nearest upright
      // (past halfway, that finishes the flip). Faster on Easy Street.
      const target = Math.round(p.rot / TAU) * TAU,
        step = (m.diff?.rightRate ?? T.rightRate) * dt;
      p.rot = Math.abs(target - p.rot) <= step ? target : p.rot + Math.sign(target - p.rot) * step;
    }
    if (p.flip) {
      p.flip.t += dt;
      if (p.flip.t >= p.flip.dur) {
        addTrick(m, p.flip.name, p.flip.points);
        p.flip = null;
      }
    }
    if (m.held.push) p.grab += dt;
    else if (p.grab > 0) {
      if (p.grab >= 0.15) addTrick(m, 'GRAB', TRICKS.grabPerSecond * p.grab);
      p.grab = 0;
    }
    const prevY = p.y,
      g = p.vy > 0 ? T.gravity : T.gravity * T.fallGravity;
    p.y += p.vy * dt - (g * dt * dt) / 2;
    p.vy -= g * dt;
    if (p.vy < 0 && catchRail(m, prevY)) return;
    if (p.y <= 1e-9) land(m);
  }
}
