/**
 * EXAMPLE numbers only (P1). /stats is not wired to GET /api/stats yet, so it renders this snapshot
 * and always shows the pink ExampleLabel above it. None of these are real measurements.
 * Shape follows PLAN 10.2 so the real API response can replace it field by field.
 */

export type VerdictKind =
  | 'NEED_STORE_PRICE'
  | 'STORE_CHEAPER'
  | 'SAME_PRICE'
  | 'ONLINE_CHEAPER'
  | 'BUNDLE_ONLY'
  | 'NO_MATCH';

export const VERDICT_ORDER: readonly VerdictKind[] = [
  'STORE_CHEAPER',
  'SAME_PRICE',
  'ONLINE_CHEAPER',
  'BUNDLE_ONLY',
  'NO_MATCH',
  'NEED_STORE_PRICE',
];

export type Period = 'today' | 'd7' | 'd30' | 'all';
export type Mode = 'normal' | 'test' | 'demo';
export type EditField = 'price' | 'brand' | 'amount' | 'count';
export type ManualApp = 'coupang' | 'naver' | 'mart' | 'other';
export type TrustPick = 'manual' | 'app' | 'same';
export type ExportTable =
  'events' | 'scans' | 'corrections' | 'purchases' | 'reports' | 'manual_trials' | 'api_calls';

export const PERIODS: readonly Period[] = ['today', 'd7', 'd30', 'all'];
export const MODES: readonly Mode[] = ['normal', 'test', 'demo'];
/** PLAN 10.2: demo is excluded by default. */
export const DEFAULT_MODES: readonly Mode[] = ['normal', 'test'];
export const EDIT_FIELDS: readonly EditField[] = ['price', 'brand', 'amount', 'count'];
export const MANUAL_APPS: readonly ManualApp[] = ['coupang', 'naver', 'mart', 'other'];
export const TRUST_PICKS: readonly TrustPick[] = ['manual', 'app', 'same'];
export const EXPORT_TABLES: readonly ExportTable[] = [
  'events',
  'scans',
  'corrections',
  'purchases',
  'reports',
  'manual_trials',
  'api_calls',
];

/** Percentages are whole numbers 0–100; times are ms; money is integer won. */
export interface StatsSnapshot {
  scans: number;
  users: number;
  daily: readonly { date: string; scans: number }[];
  shutterToVerdictMs: { median: number; p90: number };
  editRatePct: Readonly<Record<EditField, number>>;
  match: { anySamePct: number; exactCountPct: number };
  verdicts: Readonly<Record<VerdictKind, number>>;
  reports: { ratePct: number; notSamePct: number };
  potentialSavingsWon: number;
  purchases: { storeConfirmed: number; onlinePlanned: number; plannedToConfirmed: number };
  reusePct: number;
  cost: { perScanWon: number; totalWon: number };
  field: {
    manualMedianMs: number;
    appMedianMs: number;
    manualFoundPct: number;
    appFoundPct: number;
    apps: Readonly<Record<ManualApp, number>>;
    trust: Readonly<Record<TrustPick, number>>;
  };
}

export const EXAMPLE_STATS: StatsSnapshot = {
  scans: 128,
  users: 23,
  daily: [
    { date: '2026-09-29', scans: 9 },
    { date: '2026-09-30', scans: 14 },
    { date: '2026-10-01', scans: 11 },
    { date: '2026-10-02', scans: 22 },
    { date: '2026-10-03', scans: 31 },
    { date: '2026-10-04', scans: 26 },
    { date: '2026-10-05', scans: 15 },
  ],
  shutterToVerdictMs: { median: 6200, p90: 9800 },
  editRatePct: { price: 6, brand: 9, amount: 14, count: 11 },
  match: { anySamePct: 71, exactCountPct: 58 },
  verdicts: {
    STORE_CHEAPER: 31,
    SAME_PRICE: 7,
    ONLINE_CHEAPER: 36,
    BUNDLE_ONLY: 19,
    NO_MATCH: 27,
    NEED_STORE_PRICE: 8,
  },
  reports: { ratePct: 4, notSamePct: 9 },
  potentialSavingsWon: 61400,
  purchases: { storeConfirmed: 18, onlinePlanned: 12, plannedToConfirmed: 5 },
  reusePct: 35,
  cost: { perScanWon: 21, totalWon: 2688 },
  field: {
    manualMedianMs: 74000,
    appMedianMs: 8100,
    manualFoundPct: 62,
    appFoundPct: 70,
    apps: { coupang: 11, naver: 6, mart: 2, other: 1 },
    trust: { manual: 5, app: 9, same: 6 },
  },
};
