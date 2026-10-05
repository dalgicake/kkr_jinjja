import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  createApiMiddleware,
  selectHandler,
  type ApiModule,
} from '../scripts/dev-api/middleware.js';
import { applyServerEnv, clearInjectedEnv, devApi } from '../scripts/dev-api/plugin.js';
import { listApiFiles, resolveApiRoute } from '../scripts/dev-api/routes.js';

describe('dev-api routes', () => {
  const files = [
    'health.ts',
    'read-tag.ts',
    'admin/index.ts',
    'admin/[id].ts',
    'docs/[...slug].ts',
  ];

  it('maps /api/<path> to api/<path>.ts', () => {
    expect(resolveApiRoute('/api/health', files)).toEqual({ file: 'health.ts', params: {} });
    expect(resolveApiRoute('/api/health/', files)?.file).toBe('health.ts');
    expect(resolveApiRoute('/api/read-tag', files)?.file).toBe('read-tag.ts');
  });
  it('index, [param] and [...rest] like Vercel; static wins', () => {
    expect(resolveApiRoute('/api/admin', files)?.file).toBe('admin/index.ts');
    expect(resolveApiRoute('/api/admin/links', files)).toEqual({
      file: 'admin/[id].ts',
      params: { id: 'links' },
    });
    expect(resolveApiRoute('/api/docs/a/b', files)?.params).toEqual({ slug: ['a', 'b'] });
    expect(resolveApiRoute('/api/docs', files)).toBeNull();
  });
  it('404s unknown, nested-too-deep, traversal and non-/api paths', () => {
    expect(resolveApiRoute('/api/nope', files)).toBeNull();
    expect(resolveApiRoute('/api/health/extra', files)).toBeNull();
    expect(resolveApiRoute('/api/health.ts', files)).toBeNull();
    expect(resolveApiRoute('/api/%2e%2e/vite.config', files)).toBeNull();
    expect(resolveApiRoute('/apix/health', files)).toBeNull();
    expect(resolveApiRoute('/health', files)).toBeNull();
  });
  it('lists the real api/ directory', () => {
    const real = listApiFiles(join(import.meta.dirname, '..', 'api'));
    expect(real).toContain('health.ts');
    expect(resolveApiRoute('/api/health', real)?.file).toBe('health.ts');
  });
});

describe('dev-api selectHandler', () => {
  const GET = () => new Response('ok');
  it('uses the named method export, HEAD falls back to GET', () => {
    expect(selectHandler({ GET }, 'GET')).toMatchObject({ kind: 'web', head: false });
    expect(selectHandler({ GET }, 'HEAD')).toMatchObject({ kind: 'web', head: true });
  });
  it('405 with Allow when the method is not exported', () => {
    expect(selectHandler({ GET, POST: GET }, 'DELETE')).toEqual({
      kind: 'method_not_allowed',
      allow: ['GET', 'POST', 'HEAD'],
    });
  });
  it('default function = Node (req, res); default { fetch } = web', () => {
    expect(selectHandler({ default: () => {} }, 'POST').kind).toBe('node');
    expect(selectHandler({ default: { fetch: GET } }, 'POST').kind).toBe('web');
  });
});

describe('dev-api middleware over HTTP', () => {
  const modules: Record<string, ApiModule> = {
    'health.ts': { GET: () => Response.json({ ok: true, version: 'x' }) },
    'echo.ts': {
      POST: async (req: Request) =>
        Response.json(
          { got: await req.json(), ct: req.headers.get('content-type') },
          { status: 201 },
        ),
    },
    'boom.ts': {
      GET: () => {
        throw new Error('secret detail');
      },
    },
    'legacy.ts': {
      default: (
        req: { body: unknown; query: unknown },
        res: Record<string, (v: unknown) => unknown>,
      ) => {
        (res.status?.(202) as typeof res).json?.({ body: req.body, query: req.query });
      },
    },
    'cookies.ts': {
      GET: () => {
        const headers = new Headers();
        headers.append('set-cookie', 'a=1');
        headers.append('set-cookie', 'b=2');
        return new Response(null, { status: 204, headers });
      },
    },
  };
  const onError = vi.fn();
  let server: Server;
  let base = '';

  beforeAll(async () => {
    const mw = createApiMiddleware({
      apiDir: '/virtual/api',
      bodyLimit: 1024,
      listFiles: () => Object.keys(modules),
      loadModule: async (file) => {
        const mod = modules[file.replace('/virtual/api/', '')];
        if (!mod) throw new Error('no module');
        return mod;
      },
      onError,
    });
    server = createServer((req, res) =>
      mw(req, res, () => {
        res.statusCode = 299;
        res.end('next');
      }),
    );
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it('GET web handler returns its JSON', async () => {
    const res = await fetch(`${base}/api/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, version: 'x' });
  });
  it('passes JSON bodies through and keeps the status', async () => {
    const res = await fetch(`${base}/api/echo`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ a: 1 }),
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ got: { a: 1 }, ct: 'application/json' });
  });
  it('405 for a method the module does not export', async () => {
    const res = await fetch(`${base}/api/health`, { method: 'DELETE' });
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('GET, HEAD');
  });
  it('413 above the body limit', async () => {
    const res = await fetch(`${base}/api/echo`, { method: 'POST', body: 'x'.repeat(2048) });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'payload_too_large' });
  });
  it('413 for a chunked body (no content-length) that grows past the limit', async () => {
    const chunk = new TextEncoder().encode('y'.repeat(600));
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(chunk);
        c.enqueue(chunk);
        c.close();
      },
    });
    const res = await fetch(`${base}/api/echo`, {
      method: 'POST',
      body,
      duplex: 'half',
    } as RequestInit);
    expect(res.status).toBe(413);
  });
  it('handler errors become 500 JSON without stack or message', async () => {
    const res = await fetch(`${base}/api/boom`);
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: 'internal_error' });
    expect(text).not.toContain('secret detail');
    expect(onError).toHaveBeenCalled();
  });
  it('unknown /api path is a JSON 404, other paths go to next()', async () => {
    const miss = await fetch(`${base}/api/missing`);
    expect(miss.status).toBe(404);
    expect(await miss.json()).toEqual({ error: 'not_found' });
    const other = await fetch(`${base}/history`);
    expect(other.status).toBe(299);
  });
  it('Node-style default (req, res) gets body, query and helpers', async () => {
    const res = await fetch(`${base}/api/legacy?q=1`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"x":2}',
    });
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ body: { x: 2 }, query: { q: '1' } });
  });
  it('keeps multiple set-cookie headers', async () => {
    const res = await fetch(`${base}/api/cookies`);
    expect(res.status).toBe(204);
    expect(res.headers.getSetCookie()).toEqual(['a=1', 'b=2']);
  });
});

describe('dev-api server env', () => {
  it('injects server keys only, never VITE_ keys, never overrides the shell', () => {
    const target: Record<string, string | undefined> = { SHELL_SET: 'shell' };
    const injected = new Map<string, string>();
    const n = applyServerEnv(
      { SECRET: 's1', VITE_PUBLIC: 'p', SHELL_SET: 'file' },
      target,
      injected,
      ['VITE_'],
    );
    expect(n).toBe(1);
    expect(target).toEqual({ SHELL_SET: 'shell', SECRET: 's1' });
  });
  it('a restart replaces injected values instead of keeping stale ones', () => {
    const target: Record<string, string | undefined> = {};
    const injected = new Map<string, string>();
    applyServerEnv({ SECRET: 'old' }, target, injected, ['VITE_']);
    clearInjectedEnv(target, injected);
    applyServerEnv({ SECRET: 'new' }, target, injected, ['VITE_']);
    expect(target.SECRET).toBe('new');
  });
  it('plugin applies to `vite dev` only (not build, not Vitest)', () => {
    const apply = devApi().apply as (c: object, e: { command: string; mode: string }) => boolean;
    expect(apply({}, { command: 'build', mode: 'production' })).toBe(false);
    expect(apply({}, { command: 'serve', mode: 'test' })).toBe(false);
  });
});
