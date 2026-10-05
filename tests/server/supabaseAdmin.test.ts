// The real ServerStore over supabase-js, driven by a fake fetch (no network, no keys).
import { describe, expect, it } from 'vitest';
import { createAdminClient, createSupabaseStore } from '../../server/supabaseAdmin.js';
import { SCAN_ID, USER_A } from './fakes.js';

interface Seen {
  method: string;
  url: URL;
  headers: Headers;
  body: string | null;
}

function fakeFetch(respond: (req: Seen) => Response) {
  const seen: Seen[] = [];
  const impl: typeof fetch = async (input, init) => {
    const req = new Request(input, init);
    const body = req.method === 'GET' || req.method === 'HEAD' ? null : await req.text();
    const s = { method: req.method, url: new URL(req.url), headers: req.headers, body };
    seen.push(s);
    return respond(s);
  };
  return { seen, impl };
}

const URL_BASE = 'https://example.supabase.co';
const store = (respond: (req: Seen) => Response) => {
  const f = fakeFetch(respond);
  return {
    seen: f.seen,
    store: createSupabaseStore(createAdminClient(URL_BASE, 'service-key', f.impl)),
  };
};

describe('createSupabaseStore', () => {
  it('verifies the access token with auth.getUser', async () => {
    const { seen, store: s } = store((r) =>
      r.headers.get('authorization') === 'Bearer user-jwt'
        ? Response.json({
            id: USER_A,
            aud: 'authenticated',
            role: 'authenticated',
            app_metadata: {},
            user_metadata: {},
            created_at: '',
          })
        : Response.json({ code: 401, msg: 'invalid JWT' }, { status: 401 }),
    );
    expect(await s.getUserIdFromToken('user-jwt')).toBe(USER_A);
    expect(seen[0]!.url.pathname).toBe('/auth/v1/user');
    expect(await s.getUserIdFromToken('bad')).toBeNull();
  });

  it('a Supabase outage is an error, not an invalid token (→ 500, never 401)', async () => {
    const down = createSupabaseStore(
      createAdminClient(URL_BASE, 'service-key', async () => {
        throw new TypeError('fetch failed');
      }),
    );
    await expect(down.getUserIdFromToken('user-jwt')).rejects.toThrow(/getUserIdFromToken/);
    const { store: s5xx } = store(() => Response.json({ msg: 'boom' }, { status: 503 }));
    await expect(s5xx.getUserIdFromToken('user-jwt')).rejects.toThrow(/getUserIdFromToken/);
    const { store: s429 } = store(() => Response.json({ msg: 'slow down' }, { status: 429 }));
    await expect(s429.getUserIdFromToken('user-jwt')).rejects.toThrow(/getUserIdFromToken/);
    const { store: s403 } = store(() =>
      Response.json({ code: 403, msg: 'invalid claim: missing sub claim' }, { status: 403 }),
    );
    expect(await s403.getUserIdFromToken('user-jwt')).toBeNull();
  });

  it('counts api_calls for the user in the window', async () => {
    const { seen, store: s } = store(
      () => new Response(null, { status: 200, headers: { 'content-range': '*/42' } }),
    );
    expect(await s.countApiCalls(USER_A, ['read-tag'], '2026-10-05T11:00:00.000Z')).toBe(42);
    const q = seen[0]!.url;
    expect(q.pathname).toBe('/rest/v1/api_calls');
    expect(q.searchParams.get('user_id')).toBe(`eq.${USER_A}`);
    expect(q.searchParams.get('endpoint')).toBe('in.(read-tag)');
    expect(q.searchParams.get('created_at')).toBe('gte.2026-10-05T11:00:00.000Z');
    expect(seen[0]!.headers.get('prefer')).toContain('count=exact');

    await s.countApiCalls(USER_A, ['read-tag'], '2026-10-05T11:00:00.000Z', 77);
    expect(seen[1]!.url.searchParams.get('id')).toBe('lte.77');
  });

  it('throws when the count query fails (handler turns it into 500, not a free pass)', async () => {
    const { store: s } = store(() => Response.json({ message: 'boom' }, { status: 500 }));
    await expect(s.countApiCalls(USER_A, ['read-tag'], 'x')).rejects.toThrow(/countApiCalls/);
  });

  it('upserts scans on id; inserts, updates and deletes api_calls by id', async () => {
    const { seen, store: s } = store((r) =>
      r.url.pathname === '/rest/v1/api_calls' && r.method === 'POST'
        ? Response.json({ id: 41 }, { status: 201 })
        : new Response(null, { status: 204 }),
    );
    await s.upsertScan({
      id: SCAN_ID,
      user_id: USER_A,
      mode: 'normal',
      participant_code: null,
      store_name: null,
      barcode: null,
      ocr: null,
      store_price: null,
    });
    expect(seen[0]!.method).toBe('POST');
    expect(seen[0]!.url.pathname).toBe('/rest/v1/scans');
    expect(seen[0]!.url.searchParams.get('on_conflict')).toBe('id');
    expect(seen[0]!.headers.get('prefer')).toContain('resolution=merge-duplicates');

    const row = {
      user_id: USER_A,
      scan_id: SCAN_ID,
      endpoint: 'read-tag',
      model: 'claude-sonnet-5-5',
      input_tokens: 1,
      output_tokens: 1,
      cost_krw: 0.02,
      ms: 10,
      ok: true,
      error: null,
    };
    expect(await s.insertApiCall(row)).toBe(41);
    expect(seen[1]!.url.pathname).toBe('/rest/v1/api_calls');
    expect(seen[1]!.url.searchParams.get('select')).toBe('id');
    expect(JSON.parse(seen[1]!.body ?? '{}')).toMatchObject({ endpoint: 'read-tag', ok: true });

    await s.updateApiCall(41, { ...row, ms: 99 });
    expect(seen[2]!.method).toBe('PATCH');
    expect(seen[2]!.url.searchParams.get('id')).toBe('eq.41');
    expect(JSON.parse(seen[2]!.body ?? '{}')).toMatchObject({ ms: 99 });

    await s.deleteApiCall(41);
    expect(seen[3]!.method).toBe('DELETE');
    expect(seen[3]!.url.searchParams.get('id')).toBe('eq.41');
  });

  it('insertApiCall fails loudly when no id comes back', async () => {
    const { store: s } = store(() => Response.json(null, { status: 201 }));
    await expect(
      s.insertApiCall({
        user_id: USER_A,
        scan_id: null,
        endpoint: 'read-tag',
        model: null,
        input_tokens: null,
        output_tokens: null,
        cost_krw: null,
        ms: 0,
        ok: false,
        error: 'pending',
      }),
    ).rejects.toThrow(/insertApiCall/);
  });

  it('reads the scan owner', async () => {
    const { store: s } = store(() => Response.json({ user_id: USER_A }));
    expect(await s.getScanOwner(SCAN_ID)).toBe(USER_A);
    const { store: empty } = store(() => Response.json(null));
    expect(await empty.getScanOwner(SCAN_ID)).toBeNull();
  });

  it('uploads test photos to the private test-photos bucket', async () => {
    const { seen, store: s } = store(() => Response.json({ Key: `test-photos/${SCAN_ID}.jpg` }));
    const path = await s.uploadTestPhoto(
      `${SCAN_ID}.jpg`,
      new Uint8Array([0xff, 0xd8, 0xff]),
      'image/jpeg',
    );
    expect(path).toBe(`test-photos/${SCAN_ID}.jpg`);
    expect(seen[0]!.url.pathname).toBe(`/storage/v1/object/test-photos/${SCAN_ID}.jpg`);
    expect(seen[0]!.headers.get('x-upsert')).toBe('true');
  });
});
