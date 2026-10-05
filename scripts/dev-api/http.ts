// DEV ONLY — Node http <-> web-standard Request/Response conversion for the dev API middleware.
import type { IncomingMessage, ServerResponse } from 'node:http';

export const DEFAULT_BODY_LIMIT = 6 * 1024 * 1024; // 6MB

export class BodyTooLargeError extends Error {
  constructor() {
    super('payload_too_large');
  }
}

/** Buffers the request body; rejects with BodyTooLargeError past `limit` (keeps draining the socket). */
export function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let tooLarge = false;
    req.on('data', (chunk: Buffer) => {
      if (tooLarge) return;
      size += chunk.length;
      if (size > limit) {
        tooLarge = true;
        chunks.length = 0;
        reject(new BodyTooLargeError());
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!tooLarge) resolve(Buffer.concat(chunks));
    });
    req.on('error', reject);
  });
}

export function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): void {
  if (res.headersSent) {
    res.end();
    return;
  }
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

/** Builds a web Request from the Node request + already-buffered body. */
export function toWebRequest(req: IncomingMessage, body: Buffer, signal?: AbortSignal): Request {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (key.startsWith(':') || value === undefined) continue;
    if (Array.isArray(value)) for (const v of value) headers.append(key, v);
    else headers.set(key, value);
  }
  // Vercel always sets these; handlers may read them for logging / rate limits.
  if (!headers.has('x-forwarded-for') && req.socket.remoteAddress)
    headers.set('x-forwarded-for', req.socket.remoteAddress);
  if (!headers.has('x-forwarded-proto')) headers.set('x-forwarded-proto', 'http');

  const method = (req.method ?? 'GET').toUpperCase();
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const hasBody = method !== 'GET' && method !== 'HEAD' && body.length > 0;
  return new Request(url, {
    method,
    headers,
    body: hasBody ? new Uint8Array(body) : undefined,
    signal,
  });
}

/** Streams a web Response back through the Node response. `head` drops the body. */
export async function sendWebResponse(
  res: ServerResponse,
  response: Response,
  head = false,
): Promise<void> {
  res.statusCode = response.status;
  if (response.statusText) res.statusMessage = response.statusText;
  response.headers.forEach((value, key) => {
    if (key !== 'set-cookie') res.setHeader(key, value);
  });
  const cookies = response.headers.getSetCookie();
  if (cookies.length) res.setHeader('set-cookie', cookies);

  if (head || !response.body) {
    res.end();
    return;
  }
  const reader = response.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done || res.destroyed) break;
      if (!res.write(value))
        await new Promise<void>((r) => {
          res.once('drain', r);
          res.once('close', r); // client went away: stop instead of waiting forever
        });
    }
  } finally {
    if (res.destroyed) void reader.cancel().catch(() => {});
    else reader.releaseLock();
  }
  res.end();
}

/** Parsed body for (req, res)-style handlers, like Vercel's req.body helper. */
export function parseNodeBody(body: Buffer, contentType: string | undefined): unknown {
  if (body.length === 0) return undefined;
  const type = (contentType ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (type === 'application/json' || type.endsWith('+json'))
    return JSON.parse(body.toString('utf8'));
  if (type === 'application/x-www-form-urlencoded')
    return Object.fromEntries(new URLSearchParams(body.toString('utf8')));
  if (type.startsWith('text/')) return body.toString('utf8');
  return body;
}
