import type { PurchaseRecord } from './types';

/** Online plans waiting for 샀어요, newest first. */
export function plannedRecords(list: readonly PurchaseRecord[]): PurchaseRecord[] {
  return list
    .filter((r) => r.status === 'planned')
    .sort((a, b) => b.createdOn.localeCompare(a.createdOn));
}

/** Confirmed purchases, nearest next due date first; no due date last (latest purchase first). */
export function confirmedRecords(list: readonly PurchaseRecord[]): PurchaseRecord[] {
  return list
    .filter((r) => r.status === 'confirmed')
    .sort((a, b) => {
      if (a.nextDueOn !== b.nextDueOn) {
        if (a.nextDueOn === null) return 1;
        if (b.nextDueOn === null) return -1;
        return a.nextDueOn.localeCompare(b.nextDueOn);
      }
      return (b.purchasedOn ?? '').localeCompare(a.purchasedOn ?? '');
    });
}

const lastActivity = (r: PurchaseRecord) => r.purchasedOn ?? r.createdOn;

/** Home "최근 기록": the latest `n` rows by last activity. */
export function recentRecords(list: readonly PurchaseRecord[], n = 3): PurchaseRecord[] {
  return [...list].sort((a, b) => lastActivity(b).localeCompare(lastActivity(a))).slice(0, n);
}

/** P5: only the user's 샀어요 turns a plan into a purchase. */
export function markBought(
  record: PurchaseRecord,
  pricePaid: number | null,
  today: string,
): PurchaseRecord {
  if (record.status !== 'planned') return record;
  return { ...record, status: 'confirmed', pricePaid, purchasedOn: today };
}

export type WonInput = { ok: true; value: number | null } | { ok: false };

/** Optional amount field: blank → null (not entered); digits with optional commas → integer won. */
export function parseWonInput(raw: string): WonInput {
  const s = raw.trim();
  if (s === '') return { ok: true, value: null };
  if (!/^\d[\d,]*$/.test(s)) return { ok: false };
  const value = Number(s.replace(/,/g, ''));
  if (!Number.isSafeInteger(value) || value <= 0) return { ok: false };
  return { ok: true, value };
}

/** 'YYYY-MM-DD' → { month, day } without timezone shifts. */
export function monthDay(isoDay: string): { month: number; day: number } {
  const [, m, d] = isoDay.slice(0, 10).split('-');
  return { month: Number(m), day: Number(d) };
}

/** Local calendar day as 'YYYY-MM-DD'. */
export function localDay(date: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}
