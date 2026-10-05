import { describe, expect, it } from 'vitest';
import {
  DELETE_CONFIRM,
  USER_TABLES,
  accountEnv,
  handleAccount,
  type AccountStore,
  type UserTable,
} from '../../server/account.js';
import { POST as apiPost, GET as apiGet } from '../../api/account.js';
import { DELETE_ACCOUNT_BODY } from '../../src/features/account/deleteAccount.js';
import { TOKEN_A, USER_A, USER_B } from './fakes.js';

type Row = { user_id: string | null; id?: string };

class FakeAccountStore implements AccountStore {
  tokens = new Map([[TOKEN_A, USER_A]]);
  tables: Record<UserTable | 'profiles' | 'api_calls', Row[]>;
  photos = new Set(['a1.jpg', 'b1.jpg']);
  authUsers = new Set([USER_A, USER_B]);
  failOn: string | null = null;
  authDown = false;
  log: string[] = [];

  constructor() {
    const both = (): Row[] => [{ user_id: USER_A }, { user_id: USER_B }, { user_id: USER_A }];
    this.tables = {
      purchases: both(),
      corrections: both(),
      reports: both(),
      manual_trials: both(),
      events: both(),
      scans: both(),
      profiles: [
        { user_id: null, id: USER_A },
        { user_id: null, id: USER_B },
      ],
      api_calls: both(),
    };
  }
  private step(name: string) {
    this.log.push(name);
    if (this.failOn === name)
      throw new Error(`${name}: permission denied for table secret_internal_name`);
  }
  async getUserIdFromToken(token: string) {
    if (this.authDown) throw new Error('fetch failed');
    return this.tokens.get(token) ?? null;
  }
  async listTestPhotoPaths(userId: string) {
    this.step('listTestPhotoPaths');
    return userId === USER_A ? ['test-photos/a1.jpg'] : ['test-photos/b1.jpg'];
  }
  async removeTestPhotos(paths: readonly string[]) {
    this.step('removeTestPhotos');
    for (const p of paths) this.photos.delete(p.replace('test-photos/', ''));
  }
  async deleteUserRows(table: UserTable, userId: string) {
    this.step(`delete ${table}`);
    this.tables[table] = this.tables[table].filter((r) => r.user_id !== userId);
  }
  async deleteProfile(userId: string) {
    this.step('delete profiles');
    this.tables.profiles = this.tables.profiles.filter((r) => r.id !== userId);
  }
  async detachApiCalls(userId: string) {
    this.step('detachApiCalls');
    this.tables.api_calls = this.tables.api_calls.map((r) =>
      r.user_id === userId ? { ...r, user_id: null } : r,
    );
  }
  async deleteAuthUser(userId: string) {
    this.step('deleteAuthUser');
    this.authUsers.delete(userId);
  }
}

const req = (init: { method?: string; token?: string | null; body?: unknown } = {}): Request => {
  const method = init.method ?? 'POST';
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (init.token !== null) headers.authorization = `Bearer ${init.token ?? TOKEN_A}`;
  return new Request('http://localhost/api/account', {
    method,
    headers,
    body:
      method === 'GET' || method === 'HEAD'
        ? undefined
        : JSON.stringify(init.body ?? { confirm: DELETE_CONFIRM }),
  });
};

const quiet = () => {};

describe('POST /api/account (delete my account)', () => {
  it('client and server agree on the confirmation body', () => {
    expect(DELETE_ACCOUNT_BODY.confirm).toBe(DELETE_CONFIRM);
  });

  it('401 without a token, or with a token Supabase rejects; nothing is deleted', async () => {
    const store = new FakeAccountStore();
    for (const token of [null, 'forged'] as const) {
      const res = await handleAccount(req({ token }), { store, onError: quiet });
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'unauthorized' });
    }
    expect(store.log).toEqual([]);
    expect(store.authUsers.size).toBe(2);
  });

  it('405 for other methods, before touching the store', async () => {
    const store = new FakeAccountStore();
    for (const method of ['GET', 'PUT', 'PATCH', 'DELETE']) {
      const res = await handleAccount(req({ method }), { store, onError: quiet });
      expect(res.status).toBe(405);
      expect(res.headers.get('allow')).toBe('POST');
    }
    expect(store.log).toEqual([]);
    // the deployed function answers 405 too, even with no env configured
    expect((await apiGet(req({ method: 'GET' }))).status).toBe(405);
  });

  it('400 without the confirmation body', async () => {
    const store = new FakeAccountStore();
    const res = await handleAccount(req({ body: { confirm: 'yes' } }), { store, onError: quiet });
    expect(res.status).toBe(400);
    expect(store.log).toEqual([]);
  });

  it("deletes only the caller's rows, photos, profile and auth user; keeps api_calls unlinked", async () => {
    const store = new FakeAccountStore();
    const res = await handleAccount(req(), { store, onError: quiet });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    for (const t of USER_TABLES) expect(store.tables[t]).toEqual([{ user_id: USER_B }]);
    expect(store.tables.profiles).toEqual([{ user_id: null, id: USER_B }]);
    expect(store.tables.api_calls).toEqual([
      { user_id: null },
      { user_id: USER_B },
      { user_id: null },
    ]);
    expect([...store.photos]).toEqual(['b1.jpg']);
    expect([...store.authUsers]).toEqual([USER_B]);
    // the auth user goes last, so a failed run can be retried with the same token
    expect(store.log.at(-1)).toBe('deleteAuthUser');
    expect(store.log).toEqual([
      'listTestPhotoPaths',
      'removeTestPhotos',
      ...USER_TABLES.map((t) => `delete ${t}`),
      'delete profiles',
      'detachApiCalls',
      'deleteAuthUser',
    ]);
  });

  it('a store failure → 500 with no internal detail, auth user kept for a retry', async () => {
    const store = new FakeAccountStore();
    store.failOn = 'delete events';
    const logged: string[] = [];
    const res = await handleAccount(req(), {
      store,
      onError: (what, e) => logged.push(`${what}: ${String(e)}`),
    });
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: 'server_error' });
    expect(text).not.toContain('secret_internal_name');
    expect(logged[0]).toContain('secret_internal_name'); // server log only
    expect(store.authUsers.has(USER_A)).toBe(true);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('Supabase auth outage → 500, not 401', async () => {
    const store = new FakeAccountStore();
    store.authDown = true;
    const res = await handleAccount(req(), { store, onError: quiet });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'server_error' });
  });

  it('env: names only when missing', () => {
    expect(accountEnv({})).toEqual({
      ok: false,
      missing: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
    });
    expect(accountEnv({ SUPABASE_URL: ' u ', SUPABASE_SERVICE_ROLE_KEY: 's' })).toEqual({
      ok: true,
      env: { supabaseUrl: 'u', supabaseServiceRoleKey: 's' },
    });
  });

  it('the deployed function answers 503 when server env is missing, naming no values', async () => {
    const saved = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const origError = console.error;
    console.error = () => {};
    try {
      const res = await apiPost(req());
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: 'not_configured' });
    } finally {
      console.error = origError;
      if (saved.url !== undefined) process.env.SUPABASE_URL = saved.url;
      if (saved.key !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = saved.key;
    }
  });
});
