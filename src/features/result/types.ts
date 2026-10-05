// S3 result screen view model (PLAN 2 S3, 9). UI shell only: Phase 3 replaces PreviewVerdict with
// `Verdict` from shared/verdict/verdict.ts (decide()). The fields mirror PLAN 9 so the swap is mechanical.
import type { Candidate, Promo, TargetSpec, Unit } from '../../../shared/types';
import type { StoreId } from '../../components/common/storeChoice';
import type { Copy } from '../../copy/ko';

/** PLAN 9 VerdictType (copied here until shared/verdict exists). */
export type VerdictType =
  | 'NEED_STORE_PRICE'
  | 'STORE_CHEAPER'
  | 'SAME_PRICE'
  | 'ONLINE_CHEAPER'
  | 'BUNDLE_ONLY'
  | 'NO_MATCH';

export const VERDICT_TYPES: readonly VerdictType[] = [
  'STORE_CHEAPER',
  'SAME_PRICE',
  'ONLINE_CHEAPER',
  'BUNDLE_ONLY',
  'NO_MATCH',
  'NEED_STORE_PRICE',
];

/** Why an item sits in "Needs check" — shown as words from copy (Candidate.reason is Korean data). */
export type UncertainReason =
  'variantUnclear' | 'sizeMissing' | 'countUnclear' | 'giftIncluded' | 'differentLine';

export interface ResultCandidate extends Candidate {
  /** only for relation UNCERTAIN */
  reasonCode?: UncertainReason;
}

/** Mirrors PLAN 9 `Verdict` (decide() output), with the store basis precomputed. */
export interface PreviewVerdict {
  type: VerdictType;
  diff?: number;
  breakEvenShipping?: number;
  closeCall?: boolean;
  bestExact?: ResultCandidate;
  unitWinner?: 'store' | 'online';
  bundleInsight?: { candidate: ResultCandidate; pct: number; count: number; total: number };
  /** price = what you pay at the store for `count` items (promo already applied) */
  store: { price: number | null; count: number; unitPrice: number | null; unit: Unit };
}

export interface ResultFixture {
  /** route slug: /preview/result/<id> */
  id: string;
  /** label in the "Other example results" list */
  nameKey: keyof Copy['result']['preview']['names'];
  target: TargetSpec;
  storeKey: StoreId | null;
  storePrice: number | null;
  promo: Promo;
  verdict: PreviewVerdict;
  /** present only when promo is n+m: the verdict with the promo applied (toggle) */
  verdictWithPromo?: PreviewVerdict;
  candidates: ResultCandidate[];
  /** lookup time shown in the scope sentence (P4, P6), 24h clock */
  checkedAt: { hour: number; minute: number };
  resultCount: number;
  lastPurchase?: {
    month: number;
    day: number;
    channel: 'store' | 'online';
    storeKey?: StoreId;
    price: number;
  };
}
