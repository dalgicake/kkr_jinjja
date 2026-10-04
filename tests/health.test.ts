import { describe, expect, it } from 'vitest';
import { GET } from '../api/health.js';
import { APP_VERSION } from '../src/constants/version.js';

describe('GET /api/health', () => {
  it('returns { ok: true, version }', async () => {
    const res = GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, version: APP_VERSION });
  });
});
