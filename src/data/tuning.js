import BEATMAP from './fratty-pipeline.beatmap.json' with { type: 'json' };
export { BEATMAP };
export const STEP = 1 / 60;
export const BEAT_S = BEATMAP.beatS;
export const FIRST_BEAT_S = BEATMAP.firstBeatS;
export const TUNING = Object.freeze({
  forward: 6.5,
  backward: 3,
  carve: 7,
  coast: 0.6,
  jumpVelocity: 8.4,
  gravity: 24,
  landingLag: 0.1,
  pushStartup: 0.083,
  pushInvulnerable: 0.25,
  pushRecovery: 0.2,
  pushBoost: 5,
  pushDuration: 0.55,
  pushCooldown: 1.8,
  ammo: 5,
  regen: 0.2,
  inputBuffer: 0.1,
  stripClock: 20,
  telegraph: [0.975, 0.65, 0.488],
  caps: [3, 4, 5],
  tokens: [1, 2, 2],
  chunkHp: [2.5, 11, 10],
  bossChunkHp: [10, 9, 10],
});
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export function seededRandom(seed = 1) {
  let state = seed >>> 0;
  return () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296;
}
