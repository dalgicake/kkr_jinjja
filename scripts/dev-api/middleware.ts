// DEV ONLY — Connect middleware that runs api/*.ts Vercel functions under `vite dev`.
// Supports web-standard exports (GET/POST/... returning Response), `export default { fetch }`,
// and Node-style `export default function (req, res)`. Never part of the production build.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import {
  BodyTooLargeError,
  DEFAULT_BODY_LIMIT,
  parseNodeBody,
  readBody,
  sendJson,
  sendWebResponse,
  toWebRequest,
} from './http.js';
import { listApiFiles, resolveApiRoute, type ApiRoute } from './routes.js';

export type ApiModule = Record<string, unknown>;
type WebHandler = (request: Request) => unknown;
type NodeHandler = (req: IncomingMessage, res: ServerResponse) => unknown;

export interface DevApiOptions {
  /** Absolute path of the api/ directory. */
  apiDir: string;
  /** Loads a handler module by absolute file path (Vite: server.ssrLoadModule). */
  loadModule: (file: string) => Promise<ApiModule>;
  bodyLimit?: number;
  /** Full error (with stack) goes here — the terminal, never the HTTP response. */
  onError?: (error: unknown, file: string | null) => void;
  /** Override the api/ listing (tests). */
  listFiles?: () => readonly string[];
}

const METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const;

export type Dispatch =
  | { kind: 'web'; handler: WebHandler; head: boolean }
  | { kind: 'node'; handler: NodeHandler }
  | { kind: 'method_not_allowed'; allow: string[] };

/** Picks the handler for `method` from a module's exports. */
export function selectHandler(mod: ApiModule, method: string): Dispatch {
  const own = mod[method];
  if (typeof own === 'function') return { kind: 'web', handler: own as WebHandler, head: false };
  if (method === 'HEAD' && typeof mod.GET === 'function')
    return { kind: 'web', handler: mod.GET as WebHandler, head: true };

  const def = mod.default;
  if (typeof def === 'function') return { kind: 'node', handler: def as NodeHandler };
  if (def && typeof def === 'object' && typeof (def as { fetch?: unknown }).fetch === 'function') {
    const target = def as { fetch: WebHandler };
    return { kind: 'web', handler: (r) => target.fetch(r), head: method === 'HEAD' };
  }
  const allow = METHODS.filter((m) => typeof mod[m] === 'function');
  if (allow.includes('GET') && !allow.includes('HEAD')) allow.push('HEAD');
  return { kind: 'method_not_allowed', allow };
}

/** Adds the small subset of Vercel's Node helpers a (req, res) handler is likely to use. */
function decorateNode(
  req: IncomingMessage,
  res: ServerResponse,
  body: Buffer,
  params: ApiRoute['params'],
): void {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const query: Record<string, string | string[]> = { ...params };
  for (const key of new Set(url.searchParams.keys())) {
    const all = url.searchParams.getAll(key);
    query[key] = all.length > 1 ? all : (all[0] as string);
  }
  const r = res as ServerResponse & Record<string, unknown>;
  Object.assign(req, { query, body: parseNodeBody(body, req.headers['content-type']) });
  r.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  r.json = (value: unknown) => {
    if (!res.getHeader('content-type'))
      res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(value));
    return res;
  };
  r.send = (value: unknown) => {
    if (value !== null && typeof value === 'object' && !Buffer.isBuffer(value))
      return (r.json as (v: unknown) => ServerResponse)(value);
    res.end(value as string | Buffer | undefined);
    return res;
  };
}

export function createApiMiddleware(options: DevApiOptions) {
  const limit = options.bodyLimit ?? DEFAULT_BODY_LIMIT;
  const list = options.listFiles ?? (() => listApiFiles(options.apiDir));

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
    const route = resolveApiRoute(pathname, list());
    if (!route) return sendJson(res, 404, { error: 'not_found' });

    const method = (req.method ?? 'GET').toUpperCase();
    const declared = Number(req.headers['content-length'] ?? 0);
    if (declared > limit) {
      req.resume();
      return sendJson(res, 413, { error: 'payload_too_large' }, { connection: 'close' });
    }
    let body: Buffer = Buffer.alloc(0);
    if (method !== 'GET' && method !== 'HEAD') {
      try {
        body = await readBody(req, limit);
      } catch (e) {
        if (e instanceof BodyTooLargeError)
          return sendJson(res, 413, { error: 'payload_too_large' }, { connection: 'close' });
        throw e;
      }
    }

    const file = join(options.apiDir, route.file);
    let dispatch: Dispatch;
    try {
      dispatch = selectHandler(await options.loadModule(file), method);
    } catch (e) {
      options.onError?.(e, route.file);
      return sendJson(res, 500, { error: 'internal_error' });
    }

    if (dispatch.kind === 'method_not_allowed')
      return sendJson(
        res,
        405,
        { error: 'method_not_allowed' },
        { allow: dispatch.allow.join(', ') },
      );

    try {
      if (dispatch.kind === 'node') {
        try {
          decorateNode(req, res, body, route.params);
        } catch {
          return sendJson(res, 400, { error: 'invalid_body' });
        }
        const out = await dispatch.handler(req, res);
        if (out instanceof Response && !res.headersSent) await sendWebResponse(res, out);
        return;
      }
      const aborter = new AbortController();
      res.once('close', () => {
        if (!res.writableFinished) aborter.abort();
      });
      const out = await dispatch.handler(toWebRequest(req, body, aborter.signal));
      if (!(out instanceof Response))
        throw new TypeError(`${route.file} did not return a Response`);
      await sendWebResponse(res, out, dispatch.head);
    } catch (e) {
      options.onError?.(e, route.file);
      if (res.headersSent) res.end();
      else sendJson(res, 500, { error: 'internal_error' });
    }
  }

  return (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void): void => {
    const url = req.url ?? '';
    if (url !== '/api' && !url.startsWith('/api/') && !url.startsWith('/api?')) return next();
    handle(req, res).catch((e: unknown) => {
      options.onError?.(e, null);
      if (res.headersSent) res.end();
      else sendJson(res, 500, { error: 'internal_error' });
    });
  };
}
