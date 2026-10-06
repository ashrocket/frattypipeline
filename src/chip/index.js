// Builds the chip versions of the song in the player's browser. A module worker does the work when it can; otherwise
// the same generator runs on the main thread in ~6 ms slices between frames. `input()` returns
// { pcm, sampleRate, grid, renders } and may be called twice (the worker takes the PCM, so a failed worker needs a
// fresh copy). onResult gets { id: 'score' | render id, pcm?, sampleRate? } in order; onError gets a message.
export function deriveChip(input, onResult, onError = () => {}) {
  let worker = null,
    heard = false;
  const fallback = () => {
    worker?.terminate();
    worker = null;
    Promise.resolve()
      .then(() => sliced(input(), onResult))
      .catch((error) => onError(String(error?.message ?? error)));
  };
  try {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  } catch {
    fallback();
    return;
  }
  const job = input(),
    last = job.renders.at(-1).id;
  worker.onmessage = ({ data }) => {
    heard = true;
    if (data.id === 'error') {
      worker.terminate();
      onError(data.message);
      return;
    }
    onResult(data);
    if (data.id === last) worker.terminate();
  };
  // A worker that never started (no module workers, blocked script) falls back; one that failed midway reports.
  worker.onerror = (event) => {
    event.preventDefault?.();
    if (heard) {
      worker.terminate();
      onError(String(event.message ?? 'worker failed'));
    } else fallback();
  };
  worker.postMessage(job, [job.pcm.buffer]);
}

async function sliced(job, onResult) {
  const { chipJob } = await import('./job.js'),
    steps = chipJob(job);
  for (;;) {
    const until = performance.now() + 6;
    let step;
    do step = steps.next();
    while (!step.done && !step.value && performance.now() < until);
    if (step.done) return;
    if (step.value) onResult(step.value);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
