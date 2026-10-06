import BEATMAP from './fratty-pipeline.beatmap.json' with { type: 'json' };
export { BEATMAP };
export const STEP = 1 / 60;
export const BEAT_S = BEATMAP.beatS;
export const FIRST_BEAT_S = BEATMAP.firstBeatS;
// Every gameplay number lives here, named by meaning. Rates are per second and
// converted per tick with 1 - exp(-rate * dt) so results do not depend on frame rate.
export const TUNING = Object.freeze({
  // Skating: kick to go, glide, drag a foot or powerslide to slow down
  roll: 4.8, // gliding never drops below this on its own (small auto-kicks)
  cruise: 7.5, // holding forward kick-pushes up to this speed
  vmax: 10.5, // power kicks can briefly exceed cruise
  kickEvery: 0.5,
  kickImpulse: 1.15,
  autoKickEvery: 0.9,
  autoKickImpulse: 0.8,
  glideDecel: 0.25, // above roll speed, coasting slowly bleeds speed
  settleDecel: 0.9, // above cruise, power-kick bursts settle back
  dragDecel: 4, // ← below powerslide speed
  slideDecel: 7, // ← powerslide
  slideSpeed: 5,
  pushBoost: 2.6, // power kick (Shift)
  pushCooldown: 0.6,
  carve: 5.5,
  zMin: -4.2,
  zMax: 2.3,
  jumpVelocity: 7.2,
  rampVelocity: 9.6,
  gravity: 22,
  fallGravity: 1.3, // snappier landings
  coyote: 0.1,
  landingLag: 0.06,
  backflipAfter: 0.12, // hold Space this long in the air to start rotating (a tap never spins)
  backflipTime: 0.5, // seconds per full rotation: a held flat-ground ollie is one clean backflip
  rightRate: 6, // rad/s: let go and the skater spots the landing, righting to the nearest upright
  cleanLanding: 0.52, // radians from upright
  sketchyLanding: 1.05,
  perfectWindow: 0.12,
  revertWindow: 0.3,
  flipTricks: { up: ['KICKFLIP', 0.36, 150], down: ['HEELFLIP', 0.36, 150], right: ['360 FLIP', 0.48, 300], left: ['SHOVE-IT', 0.3, 100] },
  grindDecel: 0.2,
  grindMinSpeed: 3,
  railSnapZ: 0.4,
  stumble: 0.35,
  stumbleKeep: 0.65,
  wipeout: 0.9,
  wipeoutMash: 0.15,
  getUpSpeed: 2.2,
  invulnerable: 1,
  towFactor: 0.85,
  flowTime: 8,
  flowSpeed: 1.5,
  comboBank: 1,
  // The Pipeline horde: standing still lets it close the gap
  hordeGap: 10,
  wipeoutLunge: 3, // the recruiters rush you while you're down
  hordeSpeed: 3.6,
  hordeLapStep: 0.3,
  hordeMax: 5.4,
  hordeRescue: 3,
  hordeWarn: 5.5,
  // Throwing
  bottles: 6,
  maxBottles: 9,
  crateBottles: 3,
  shopBottles: 2,
  trickle: 8, // seconds per free bottle while you hold fewer than trickleCap
  trickleCap: 3,
  throwBase: 0.32,
  throwPerMeter: 0.045,
  throwCooldown: 0.25,
  throwAhead: [1.5, 18],
  canRadius: 0.6,
  assistRadius: 0.85,
  airMultiplier: 1.5,
  // Fire
  canBurn: 16,
  canIgniteRadius: 1.25,
  igniteBase: 0.25,
  igniteDrunk: 0.55,
  attractBase: 0.25,
  attractDrunk: 0.65,
  spreadRadius: 1,
  spreadRate: 0.6,
  burnTime: [5, 7],
  burnToHouse: 0.7,
  burnRoll: 0.2,
  rollOut: 0.8,
  charredTime: 4,
  immuneTime: 6,
  extinguishBase: 0.1,
  extinguishSober: 1.2,
  extinguisherSeconds: 6,
  sprayRange: 1.6,
  fumbleDrunk: 0.5,
  houseFireStart: 0.3,
  houseFireGrow: 0.07,
  houseFireDamage: 6.5,
  houseFireDouse: 0.16,
  // Destruction states
  harmed: 75,
  reallyHarmed: 40,
  // Fire department (owner rule: exactly 15% for couch-burning houses)
  fdChance: 0.15,
  fdDelay: 2,
  fdSpray: 3,
  fdStay: 6,
  // Shop methods
  rot: 2.4,
  subBeats: 16,
  subDamage: 1.5,
  subRadius: 7,
  fryerDamage: 30,
  fryerRadius: 2.5,
  fryerBlast: 3,
  raccoonDelay: 2.5,
  liftTime: 4,
  // Rescue and bonus
  captureTime: 2.2,
  rescueBehind: 14,
  ambulanceAhead: 34,
  zombieShamble: 0.5,
  bonusSpeed: 8,
  bonusFlight: 0.42,
  bonusCard: 1,
  bonusLead: 2,
  bonusTail: 1,
  bonusResult: 0.8,
  continueTime: 10,
});
// Paperboy's three routes. Points multiply like the arcade original.
export const DIFFICULTY = Object.freeze({
  easy: { id: 'easy', name: 'EASY STREET', points: 1, hordeSpeed: 2.6, hordeLapStep: 0.2, hordeMax: 4.4, hordeRescue: 2.2, lunge: 2, notice: 3, canRadius: 0.75, assistRadius: 1, hazards: 0.6, rightRate: 8, fire: 1.35, douse: 0.6 },
  medium: { id: 'medium', name: 'MIDDLE ROAD', points: 2, hordeSpeed: 3.4, hordeLapStep: 0.3, hordeMax: 5, hordeRescue: 2.8, lunge: 3, notice: 2, canRadius: 0.6, assistRadius: 0.85, hazards: 1, rightRate: 6, fire: 1, douse: 1 },
  hard: { id: 'hard', name: 'HARD WAY', points: 3, hordeSpeed: 3.9, hordeLapStep: 0.35, hordeMax: 5.6, hordeRescue: 3.2, lunge: 3.5, notice: 1.2, canRadius: 0.5, assistRadius: 0.7, hazards: 1.3, rightRate: 4.5, fire: 0.9, douse: 1.15 },
});
export const TRICKS = Object.freeze({ backflip: 400, grabPerSecond: 150, grind: 100, grindPerSecond: 120, bigAir: 100, gap: 200, perfect: 50, revert: 50, maxMultiplier: 8 });
export const SCORE = Object.freeze({
  can: 100,
  bro: 250,
  chainWindow: 4,
  chainMax: 8,
  harmed: 500,
  reallyHarmed: 1000,
  gone: 2500, // n-th destroyed house scores gone × n
  bees: 750,
  sub: 250,
  subBeat: 50,
  fryer: 1000,
  raccoons: 500,
  airlift: 1500,
  rescue: 2000,
  bonusHit: 100,
  bonusMultiplier: 10,
  bonusPerfect: 10000,
  shop: 250,
  hive: 150,
  smash: 100,
  lifeLeft: 5000,
});
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const chance = (rate, dt) => 1 - Math.exp(-rate * dt);
// mulberry32 with a scrambled seed, so neighbouring seeds give unrelated streams.
export function seededRandom(seed = 1) {
  let a = (seed >>> 0) ^ 0x9e3779b9;
  a = Math.imul(a ^ (a >>> 16), 0x85ebca6b);
  a = Math.imul(a ^ (a >>> 13), 0xc2b2ae35);
  a = (a ^ (a >>> 16)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
