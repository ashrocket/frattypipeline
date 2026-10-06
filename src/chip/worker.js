import { chipJob } from './job.js';
// Module worker: derives the chip versions off the main thread and posts each render (zero-copy) as soon as it exists.
self.onmessage = ({ data }) => {
  try {
    for (const result of chipJob(data)) if (result) self.postMessage(result, result.pcm ? [result.pcm.buffer] : []);
  } catch (error) {
    self.postMessage({ id: 'error', message: String(error?.message ?? error) });
  }
};
