import { DurableObject } from 'cloudflare:workers';
import { AdmissionQueue } from '../server/queue.mjs';
import { handleQueueRequest, queueErrorResponse, validateQueueRequest } from '../server/http.mjs';

export class AdmissionRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.queue = new AdmissionQueue({
      store: {
        load: () => ctx.storage.get('queue-v1'),
        save: (state, nextExpiry) => ctx.storage.transaction(async () => {
          await ctx.storage.put('queue-v1', state);
          if (nextExpiry !== null) await ctx.storage.setAlarm(nextExpiry);
          else await ctx.storage.deleteAlarm();
        }),
      },
    });
  }

  fetch(request) { return handleQueueRequest(request, this.queue); }
  async alarm() { await this.queue.perform('sweep'); }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        validateQueueRequest(request);
        // Keep this name constant: every region and domain shares ONE 20-seat room.
        return await env.ADMISSION_ROOM.getByName('fratty-pipeline-global-v1').fetch(request);
      } catch (error) { return queueErrorResponse(error); }
    }
    return env.ASSETS.fetch(request);
  },
};
