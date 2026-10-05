import { describe, expect, it } from 'vitest';
import {
  LATENCY_STORAGE_KEY,
  MAX_LATENCY_SAMPLES,
  isDebugSearch,
  medianMs,
  parseLatencySamples,
  readLatencySamples,
  recordLatencySample,
} from './latencyLog';

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    raw: m,
  };
}

describe('scan latency log (PLAN 14: shutter → card median)', () => {
  it('keeps the last N samples, rounded', () => {
    const s = memoryStorage();
    for (let i = 1; i <= MAX_LATENCY_SAMPLES + 3; i++) recordLatencySample(i * 100 + 0.4, s);
    const got = readLatencySamples(s);
    expect(got).toHaveLength(MAX_LATENCY_SAMPLES);
    expect(got[0]).toBe(400);
    expect(got.at(-1)).toBe((MAX_LATENCY_SAMPLES + 3) * 100);
  });
  it('median of odd and even counts; none → null (never a made-up number)', () => {
    expect(medianMs([5000, 3000, 9000])).toBe(5000);
    expect(medianMs([4000, 6000, 3000, 9000])).toBe(5000);
    expect(medianMs([])).toBeNull();
  });
  it('ignores junk and broken storage', () => {
    expect(parseLatencySamples('{"a":1}')).toEqual([]);
    expect(parseLatencySamples('[1, -5, "x", null, 2]')).toEqual([1, 2]);
    expect(parseLatencySamples('not json')).toEqual([]);
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readLatencySamples(throwing)).toEqual([]);
    expect(() => recordLatencySample(1000, throwing)).not.toThrow();
    const s = memoryStorage();
    recordLatencySample(Number.NaN, s);
    expect(s.raw.has(LATENCY_STORAGE_KEY)).toBe(false);
  });
  it('?debug turns the read-out on', () => {
    expect(isDebugSearch('?debug')).toBe(true);
    expect(isDebugSearch('?debug=1')).toBe(true);
    expect(isDebugSearch('?debug=0')).toBe(false);
    expect(isDebugSearch('')).toBe(false);
  });
});
