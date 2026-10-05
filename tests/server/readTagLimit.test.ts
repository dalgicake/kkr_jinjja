// /api/read-tag: token check, the per-user hourly limit (reserved before the model call), scan owner.
import { describe, expect, it } from 'vitest';
import { handleReadTag } from '../../server/readTag.js';
import {
  FakeStore,
  SCAN_ID,
  USER_A,
  USER_B,
  baseBody,
  readTagRequest,
  setupReadTag as setup,
  toolCall,
  validToolInput,
  type StoredApiCall,
} from './fakes.js';

describe('POST /api/read-tag — auth and rate limit', () => {
  it('401 without a token, nothing called or logged', async () => {
    const { store, anthropic, deps } = setup([]);
    const res = await handleReadTag(readTagRequest(baseBody(), null), deps);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
    expect(anthropic.calls).toHaveLength(0);
    expect(store.apiCalls).toHaveLength(0);
  });

  it('500 (not 401) when Supabase auth itself is down', async () => {
    const { store, anthropic, deps, sideEffects } = setup([]);
    store.authDown = true;
    const res = await handleReadTag(readTagRequest(baseBody()), deps);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'server_error' });
    expect(sideEffects).toContain('auth');
    expect(anthropic.calls).toHaveLength(0);
  });

  it('401 with a token Supabase does not accept', async () => {
    const { anthropic, deps } = setup([]);
    const res = await handleReadTag(readTagRequest(baseBody(), 'forged'), deps);
    expect(res.status).toBe(401);
    expect(anthropic.calls).toHaveLength(0);
  });

  const seedCalls = (store: FakeStore, n: number, at: number, endpoint = 'read-tag') => {
    for (let i = 0; i < n; i++)
      store.apiCalls.push({
        user_id: USER_A,
        scan_id: null,
        endpoint,
        model: 'claude-sonnet-5-5',
        input_tokens: 1,
        output_tokens: 1,
        cost_krw: 0,
        ms: 1,
        ok: true,
        error: null,
        created_at: new Date(at).toISOString(),
      });
  };

  it('429 once the user has 60 read-tag calls in the last hour', async () => {
    const now = Date.parse('2026-10-05T12:00:00Z');
    const { store, anthropic, deps } = setup([], { now: () => now });
    seedCalls(store, 60, now - 10 * 60 * 1000);
    const res = await handleReadTag(readTagRequest(baseBody()), deps);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: 'rate_limited' });
    expect(anthropic.calls).toHaveLength(0);
  });

  it('59 recent calls (plus older or other users’) still pass', async () => {
    const now = Date.parse('2026-10-05T12:00:00Z');
    const { store, deps } = setup([toolCall(validToolInput())], { now: () => now });
    store.clock = () => now;
    seedCalls(store, 59, now - 59 * 60 * 1000);
    seedCalls(store, 30, now - 61 * 60 * 1000); // older than an hour
    store.apiCalls.push({ ...store.apiCalls[0]!, user_id: USER_B });
    const res = await handleReadTag(readTagRequest(baseBody()), deps);
    expect(res.status).toBe(200);
  });

  it('parallel requests cannot overrun the limit: 30 at once with 59 used → 1 model call', async () => {
    const now = Date.parse('2026-10-05T12:00:00Z');
    const script = Array.from({ length: 30 }, () => toolCall(validToolInput()));
    const { store, anthropic, deps } = setup(script, { now: () => now });
    store.clock = () => now;
    seedCalls(store, 59, now - 10 * 60 * 1000);
    const scanIds = Array.from(
      { length: 30 },
      (_, i) => `44444444-4444-4444-8444-${String(i).padStart(12, '0')}`,
    );
    const results = await Promise.all(
      scanIds.map((scanId) => handleReadTag(readTagRequest(baseBody({ scanId })), deps)),
    );
    const statuses = results.map((r) => r.status);
    expect(anthropic.calls).toHaveLength(1);
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 429)).toHaveLength(29);
    // refused requests leave no row behind; the one that ran is filled in, not left pending
    const readTagRows = store.apiCalls.filter((r) => r.endpoint === 'read-tag');
    expect(readTagRows).toHaveLength(60);
    expect(readTagRows.some((r) => r.error === 'pending')).toBe(false);
  });

  it('the api_calls row is reserved before the model call and filled in afterwards', async () => {
    let seen: StoredApiCall[] = [];
    const { store, deps } = setup([
      () => {
        seen = store.apiCalls.map((r) => ({ ...r }));
        return toolCall(validToolInput());
      },
    ]);
    await handleReadTag(readTagRequest(baseBody()), deps);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ ok: false, error: 'pending', scan_id: SCAN_ID });
    expect(store.apiCalls).toHaveLength(1);
    expect(store.apiCalls[0]).toMatchObject({ id: seen[0]!.id, ok: true, error: null });
  });

  it('no model call when the reservation cannot be written (500)', async () => {
    const { store, anthropic, deps } = setup([toolCall(validToolInput())]);
    store.insertApiCall = async () => {
      throw new Error('db down');
    };
    const res = await handleReadTag(readTagRequest(baseBody()), deps);
    expect(res.status).toBe(500);
    expect(anthropic.calls).toHaveLength(0);
  });

  it('403 when the scan id belongs to another user', async () => {
    const { store, anthropic, deps } = setup([toolCall(validToolInput())]);
    store.scans.set(SCAN_ID, {
      id: SCAN_ID,
      user_id: USER_B,
      mode: 'normal',
      participant_code: null,
      store_name: null,
      barcode: null,
      ocr: null,
      store_price: null,
    });
    const res = await handleReadTag(readTagRequest(baseBody()), deps);
    expect(res.status).toBe(403);
    expect(anthropic.calls).toHaveLength(0);
  });
});
