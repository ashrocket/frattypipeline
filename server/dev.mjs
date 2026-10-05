import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { AdmissionQueue } from './queue.mjs';
import { handleQueueRequest, queueErrorResponse } from './http.mjs';

/** One shared local room. Production uses the persisted global Durable Object. */
export function createQueueServer({ queue = new AdmissionQueue() } = {}) {
  const server = createServer(async (incoming, outgoing) => {
    try {
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
      }
      const request = new Request(new URL(incoming.url, `http://${incoming.headers.host ?? 'localhost:8787'}`), {
        method: incoming.method,
        headers,
        ...(!['GET', 'HEAD'].includes(incoming.method) ? { body: Readable.toWeb(incoming), duplex: 'half' } : {}),
      });
      const response = await handleQueueRequest(request, queue, { local: true });
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      const response = queueErrorResponse(error);
      if (!outgoing.headersSent) outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(await response.text());
    }
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 10_000;
  const sweep = setInterval(() => queue.perform('sweep').catch(() => {}), 15_000);
  sweep.unref();
  server.once('close', () => clearInterval(sweep));
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.QUEUE_PORT ?? 8787);
  const host = process.env.QUEUE_HOST ?? '127.0.0.1';
  const server = createQueueServer();
  server.listen(port, host, () => console.log(`Fratty Pipeline local admission API: http://${host}:${port} (20 active sessions)`));
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => server.close(() => process.exit(0)));
  }
}
