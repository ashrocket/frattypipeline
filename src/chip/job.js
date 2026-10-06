import { analyzing } from './analyze.js';
import { rendering } from './synth.js';
// The whole derivation as one generator: analysis, then each render in the order asked (training first). Bare
// yields mark safe pause points for the sliced main-thread fallback; results come out as yielded objects.
export function* chipJob(job) {
  const started = Date.now(),
    analysis = analyzing(job.pcm, job.sampleRate, job.grid);
  job.pcm = null; // the analysis holds the only reference and lets the full-rate copy go once it has decimated it
  const score = yield* analysis;
  yield { id: 'score', key: score.key.name, tuning: score.tuning, beats: score.beats, ms: Date.now() - started };
  for (const r of job.renders) {
    const out = yield* rendering(score, { ...r, grid: job.grid });
    yield { id: r.id, pcm: out, sampleRate: r.sampleRate, ms: Date.now() - started };
  }
}
