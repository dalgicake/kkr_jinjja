import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../../api/read-tag.js';
import { PRICES, costKrw, recordTagRequest } from '../../server/anthropic.js';
import { bearerToken } from '../../server/auth.js';
import { readTagEnv } from '../../server/env.js';
import { READ_TAG_SYSTEM_PROMPT } from '../../server/prompts/readTag.js';
import { baseBody, readTagRequest } from './fakes.js';

const plan = readFileSync(new URL('../../PLAN.md', import.meta.url), 'utf8');

describe('PLAN 7.2 system prompt', () => {
  it('is verbatim', () => {
    const start = plan.indexOf('### 7.2');
    const block = /```\n([\s\S]*?)\n```/.exec(plan.slice(start));
    expect(start).toBeGreaterThan(-1);
    expect(READ_TAG_SYSTEM_PROMPT).toBe(block?.[1]);
  });
});

describe('cost (PLAN 3)', () => {
  it('PRICES matches the PLAN 3 table', () => {
    expect(PRICES).toEqual({
      'claude-sonnet-5-5': { in: 2, out: 10 },
      'claude-haiku-4-5-20251001': { in: 1, out: 5 },
      'claude-opus-5-5': { in: 4, out: 20 },
    });
  });

  it('cost_krw = (in*in + out*out) / 1e6 * USD_KRW', () => {
    expect(costKrw('claude-sonnet-5-5', { input_tokens: 1000, output_tokens: 500 }, 1400)).toBe(
      9.8,
    );
    expect(
      costKrw('claude-haiku-4-5-20251001', { input_tokens: 2000, output_tokens: 300 }, 1400),
    ).toBe(4.9);
    expect(costKrw('claude-opus-5-5', { input_tokens: 1_000_000, output_tokens: 0 }, 1400)).toBe(
      5600,
    );
    // rounded to 2 decimals (numeric(10,2))
    expect(costKrw('claude-sonnet-5-5', { input_tokens: 1, output_tokens: 1 }, 1400)).toBe(0.02);
    expect(costKrw('claude-sonnet-5-5', { input_tokens: 0, output_tokens: 0 }, 1400)).toBe(0);
  });

  it('unknown model → null, never a guessed price', () => {
    expect(costKrw('claude-unknown', { input_tokens: 1000, output_tokens: 1000 }, 1400)).toBeNull();
  });
});

describe('recordTagRequest', () => {
  it('sets low effort only on models that take it', () => {
    expect(recordTagRequest('claude-sonnet-5-5', 's').output_config).toEqual({ effort: 'low' });
    expect(recordTagRequest('claude-haiku-4-5-20251001', 's').output_config).toBeUndefined();
  });
});

describe('env', () => {
  it('lists missing server keys by name and applies defaults', () => {
    expect(readTagEnv({})).toEqual({
      ok: false,
      missing: ['ANTHROPIC_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
    });
    const r = readTagEnv({
      ANTHROPIC_API_KEY: 'k',
      SUPABASE_URL: 'https://x.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 's',
    });
    expect(r).toEqual({
      ok: true,
      env: {
        anthropicApiKey: 'k',
        modelTag: 'claude-sonnet-5-5',
        supabaseUrl: 'https://x.supabase.co',
        supabaseServiceRoleKey: 's',
        usdKrw: 1400,
      },
    });
  });

  it('rejects a non-numeric USD_KRW instead of guessing', () => {
    const r = readTagEnv({
      ANTHROPIC_API_KEY: 'k',
      SUPABASE_URL: 'u',
      SUPABASE_SERVICE_ROLE_KEY: 's',
      USD_KRW: 'abc',
    });
    expect(r).toEqual({ ok: false, missing: ['USD_KRW'] });
  });
});

describe('api/read-tag without env', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('503 not_configured, no crash; the missing names go to the server log only', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // no Authorization header: an anonymous caller learns nothing about the env
    const res = await POST(readTagRequest(baseBody(), null));
    expect(res.status).toBe(503);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: 'not_configured' });
    expect(text).not.toMatch(/ANTHROPIC|SUPABASE/);
    const logged = spy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logged).toContain('ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    spy.mockRestore();
  });
});

describe('bearerToken', () => {
  const req = (h?: string) =>
    new Request('http://x', h === undefined ? {} : { headers: { authorization: h } });
  it('parses Bearer tokens only', () => {
    expect(bearerToken(req('Bearer abc.def'))).toBe('abc.def');
    expect(bearerToken(req('bearer abc'))).toBe('abc');
    expect(bearerToken(req('Basic abc'))).toBeNull();
    expect(bearerToken(req('Bearer '))).toBeNull();
    expect(bearerToken(req())).toBeNull();
  });
});
