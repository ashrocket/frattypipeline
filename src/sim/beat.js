import { BEAT_S, STEP } from '../data/tuning.js';
export const nextBeat = (value) => Math.ceil(value - 1e-8);
export const nextBar = (value) => Math.ceil((value - 1e-8) / 4) * 4;
export function advanceBeat(model, dt, supplied) {
  model.clockTicks = (model.clockTicks ?? 0) + dt / STEP;
  model.time = model.clockTicks * STEP;
  // Quantization eliminates different floating accumulation routes on the ideal grid.
  model.beat = Math.round((supplied ?? model.time / BEAT_S) * 1e9) / 1e9;
  model.beatPulse = Math.exp(-8 * (model.beat % 1));
}
export function judge(model, beat) {
  const error = Math.abs(beat - Math.round(beat)) * BEAT_S;
  const scale = model.beatAssist ? 1.5 : 1;
  const extra = model.timingWindowExtra ?? 0;
  const grade =
    error <= 0.045 * scale + extra ? 'tight' : error <= 0.08 * scale + extra ? 'onbeat' : 'off';
  if (grade === 'off' || Math.floor(beat) === model.lastJudgedBeat) model.groove = 0;
  else model.groove++;
  model.lastJudgedBeat = Math.floor(beat);
  return { grade, multiplier: grade === 'tight' ? 1.5 : grade === 'onbeat' ? 1.25 : 1, error };
}
