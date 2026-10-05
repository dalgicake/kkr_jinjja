// Phase 1 acceptance: "LTE에서 셔터→확인 카드 중앙값 ≤ 6초" (PLAN 14). Each photo scan's readyMs
// (photo chosen → reading ready, so compression + upload + model + network) is kept on this device
// so a human can run ~10 scans and read the median on /about?debug. Storage may be missing or
// throw; then nothing is kept and nothing is shown as measured.

export const LATENCY_STORAGE_KEY = 'jinjja.scanLatencyMs';
/** Last N samples kept (oldest dropped). */
export const MAX_LATENCY_SAMPLES = 20;

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

const isSample = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

export function parseLatencySamples(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter(isSample).slice(-MAX_LATENCY_SAMPLES) : [];
  } catch {
    return [];
  }
}

export function readLatencySamples(storage: StorageLike | null = defaultStorage()): number[] {
  try {
    return parseLatencySamples(storage?.getItem(LATENCY_STORAGE_KEY) ?? null);
  } catch {
    return [];
  }
}

export function recordLatencySample(
  ms: number,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!isSample(ms) || !storage) return;
  try {
    const next = [...readLatencySamples(storage), Math.round(ms)].slice(-MAX_LATENCY_SAMPLES);
    storage.setItem(LATENCY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable: this sample just isn't kept
  }
}

export function medianMs(samples: readonly number[]): number | null {
  if (!samples.length) return null;
  const s = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  const m = s.length % 2 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
  return Math.round(m);
}

/** `?debug` (any value except "0") turns on measurement read-outs. */
export function isDebugSearch(search: string): boolean {
  const v = new URLSearchParams(search).get('debug');
  return v !== null && v !== '0';
}
