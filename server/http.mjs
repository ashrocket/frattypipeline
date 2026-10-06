import { QueueError } from './queue.mjs';

const BODY_LIMIT = 4096;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function jsonResponse(value, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });
}

export function validateQueueRequest(request, { local = false } = {}) {
  const url = new URL(request.url);
  const match = /^\/api\/queue\/(join|heartbeat|leave|status)$/.exec(url.pathname);
  if (!match) throw new QueueError(404, 'NOT_FOUND', 'Queue route not found.');
  if (request.method !== (match[1] === 'status' ? 'GET' : 'POST'))
    throw Object.assign(
      new QueueError(
        405,
        'METHOD_NOT_ALLOWED',
        match[1] === 'status' ? 'Use GET for queue status.' : 'Use POST for queue requests.',
      ),
      { allow: match[1] === 'status' ? 'GET' : 'POST' },
    );
  const origin = request.headers.get('Origin');
  let allowed = !origin || origin === url.origin;
  if (!allowed && local) {
    try {
      const source = new URL(origin);
      allowed =
        ['http:', 'https:'].includes(source.protocol) &&
        LOCAL_HOSTS.has(source.hostname) &&
        LOCAL_HOSTS.has(url.hostname);
    } catch {
      allowed = false;
    }
  }
  if (!allowed || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
    throw new QueueError(403, 'ORIGIN_NOT_ALLOWED', 'Use the waiting room on this site.');
  }
  if (match[1] === 'status') return 'status';
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type') ?? '')) {
    throw new QueueError(415, 'JSON_REQUIRED', 'Send application/json.');
  }
  if (Number(request.headers.get('Content-Length')) > BODY_LIMIT) {
    throw new QueueError(413, 'REQUEST_TOO_LARGE', 'Queue request is too large.');
  }
  return match[1];
}

async function readJson(request) {
  if (!request.body) throw new QueueError(400, 'INVALID_JSON', 'Send a JSON object.');
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let body = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > BODY_LIMIT) {
        await reader.cancel();
        throw new QueueError(413, 'REQUEST_TOO_LARGE', 'Queue request is too large.');
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new QueueError(400, 'INVALID_JSON', 'Send a valid JSON object.');
  }
}

export function queueErrorResponse(error) {
  if (error instanceof QueueError) {
    return jsonResponse(
      { error: error.code, message: error.message },
      error.status,
      error.status === 405
        ? { Allow: error.allow ?? 'POST' }
        : error.status === 429
          ? { 'Retry-After': '15' }
          : {},
    );
  }
  // Do not disclose tokens or storage internals. Fail closed if admission fails.
  console.error('Admission service unavailable:', error?.name ?? 'Error');
  return jsonResponse(
    { error: 'QUEUE_UNAVAILABLE', message: 'The waiting room is reconnecting. Please try again.' },
    503,
    { 'Retry-After': '5' },
  );
}

export async function handleQueueRequest(request, queue, options = {}) {
  try {
    const action = validateQueueRequest(request, options);
    if (action === 'status')
      return jsonResponse(await queue.status(), 200, { 'Cache-Control': 'max-age=5' });
    const input = await readJson(request);
    return jsonResponse(await queue.perform(action, input));
  } catch (error) {
    return queueErrorResponse(error);
  }
}
