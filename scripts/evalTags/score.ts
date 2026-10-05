// PLAN 7.4 eval: per-field scoring and aggregation (pure).
import type { TagReading } from '../../shared/tag.js';
import { normalizeText } from '../../shared/text.js';

export { normalizeText };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 7.4: per-item amount counts as correct within 1% (and same unit). */
export const SIZE_TOLERANCE = 0.01;
/** Phase 1 acceptance targets (PLAN 14). */
export const TARGETS = { storePrice: 0.95, brand: 0.85, sizeAndCount: 0.85 } as const;

// ---------------------------------------------------------------------------
// Scoring (7.4)
// ---------------------------------------------------------------------------

export function scoreStorePrice(pred: number | null, truth: number | null): boolean {
  return pred === truth;
}

export function scoreBrand(pred: string | null, truth: string | null): boolean {
  return normalizeText(pred) === normalizeText(truth);
}

/** Within 1% of the true amount AND same unit. Both amounts null (e.g. "ea") counts when units match. */
export function scoreSize(
  pred: { amount: number | null; unit: string | null },
  truth: { amount: number | null; unit: string | null },
): boolean {
  if (pred.unit !== truth.unit) return false;
  if (pred.amount === null || truth.amount === null) return pred.amount === truth.amount;
  if (truth.amount <= 0) return pred.amount === truth.amount;
  return Math.abs(pred.amount - truth.amount) <= truth.amount * SIZE_TOLERANCE + 1e-9;
}

export function scoreCount(pred: number | null, truth: number | null): boolean {
  return pred === truth;
}

export function scorePromoType(pred: string, truth: string): boolean {
  return pred === truth;
}

/** Reference only (not an acceptance metric). */
export function scoreVariant(pred: string | null, truth: string | null): boolean {
  return normalizeText(pred) === normalizeText(truth);
}

export const FIELDS = [
  'storePrice',
  'brand',
  'size',
  'count',
  'sizeAndCount',
  'promoType',
  'variant',
] as const;
export type Field = (typeof FIELDS)[number];
export type FieldScores = Record<Field, boolean>;

/** pred null (error / unreadable) → every field is wrong. */
export function scoreReading(pred: TagReading | null, truth: TagReading): FieldScores {
  if (!pred) {
    return Object.fromEntries(FIELDS.map((f) => [f, false])) as FieldScores;
  }
  const size = scoreSize(
    { amount: pred.per_item_amount, unit: pred.per_item_unit },
    { amount: truth.per_item_amount, unit: truth.per_item_unit },
  );
  const count = scoreCount(pred.item_count, truth.item_count);
  return {
    storePrice: scoreStorePrice(pred.store_price, truth.store_price),
    brand: scoreBrand(pred.brand, truth.brand),
    size,
    count,
    sizeAndCount: size && count,
    promoType: scorePromoType(pred.promo.type, truth.promo.type),
    variant: scoreVariant(pred.variant, truth.variant),
  };
}

export interface FieldAccuracy {
  correct: number;
  total: number;
  /** null when there is nothing to score (shown as "미확인", never 0% or 100%). */
  rate: number | null;
}

export function aggregate(scores: readonly FieldScores[]): Record<Field, FieldAccuracy> {
  const out = {} as Record<Field, FieldAccuracy>;
  for (const f of FIELDS) {
    const correct = scores.filter((s) => s[f]).length;
    out[f] = {
      correct,
      total: scores.length,
      rate: scores.length ? correct / scores.length : null,
    };
  }
  return out;
}

export interface ImageResult {
  id: string;
  storeName: string | null;
  truth: TagReading;
  pred: TagReading | null;
  /** why pred is null, or why it was not usable (unreadable → the app would show 422). */
  error: string | null;
  scores: FieldScores;
  ms: number | null;
  costKrw: number | null;
}

export function groupByStore(
  rows: readonly ImageResult[],
): { storeName: string; accuracy: Record<Field, FieldAccuracy> }[] {
  const groups = new Map<string, FieldScores[]>();
  for (const r of rows) {
    if (!r.storeName) continue;
    const list = groups.get(r.storeName) ?? [];
    list.push(r.scores);
    groups.set(r.storeName, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'ko'))
    .map(([storeName, scores]) => ({ storeName, accuracy: aggregate(scores) }));
}

export function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}
