// Pure helpers for the S3 result screen: verdict → words, colours and rows. No React; callers pass
// `t` and `won` from useCopy() so everything follows the current language.
import type { Unit } from '../../../shared/types';
import { totalAmount, unitPrice } from '../../../shared/units';
import type { Tone } from '../../components/common/tone';
import type { StoreId } from '../../components/common/storeChoice';
import type { Copy } from '../../copy/ko';
import { fill } from '../../lib/i18n';
import type { PreviewVerdict, ResultCandidate, ResultFixture } from './types';

type Won = (n: number) => string;

/** PLAN 13 colour meanings: lime = a clear cheaper side, butter = buy at the store,
 *  sky = online per unit, pink = needs your input or a check. Words always come with it. */
export function headerTone(v: PreviewVerdict): Tone {
  switch (v.type) {
    case 'STORE_CHEAPER':
    case 'ONLINE_CHEAPER':
      return 'lime';
    case 'SAME_PRICE':
      return 'butter';
    case 'BUNDLE_ONLY':
      return v.unitWinner === 'online' ? 'sky' : 'butter';
    case 'NO_MATCH':
    case 'NEED_STORE_PRICE':
      return 'pink';
  }
}

export function verdictTitle(t: Copy, won: Won, v: PreviewVerdict): string {
  const tv = t.result.verdict;
  const diff = won(v.diff ?? 0);
  switch (v.type) {
    case 'STORE_CHEAPER':
      return fill(tv.storeCheaperTitle, { diff });
    case 'SAME_PRICE':
      return tv.samePriceTitle;
    case 'ONLINE_CHEAPER':
      return fill(tv.onlineCheaperTitle, { diff });
    case 'BUNDLE_ONLY':
      return v.unitWinner === 'online' && v.bundleInsight
        ? fill(tv.bundleOnlineTitle, { pct: v.bundleInsight.pct })
        : tv.bundleStoreTitle;
    case 'NO_MATCH':
      return tv.noMatchTitle;
    case 'NEED_STORE_PRICE':
      return tv.needPriceTitle;
  }
}

export function verdictSub(t: Copy, won: Won, v: PreviewVerdict): string {
  const tv = t.result.verdict;
  switch (v.type) {
    case 'STORE_CHEAPER':
      return tv.storeCheaperSub;
    case 'SAME_PRICE':
      return tv.samePriceSub;
    case 'ONLINE_CHEAPER':
      return fill(tv.onlineCheaperSub, { diff: won(v.breakEvenShipping ?? v.diff ?? 0) });
    case 'BUNDLE_ONLY':
      return tv.bundleSub;
    case 'NO_MATCH':
      return tv.noMatchSub;
    case 'NEED_STORE_PRICE':
      return tv.needPriceSub;
  }
}

/** Which receipt row gets the lime band + "Cheaper" words. null = no cheaper side to claim. */
export function winner(v: PreviewVerdict): 'store' | 'online' | null {
  if (v.type === 'STORE_CHEAPER') return 'store';
  if (v.type === 'ONLINE_CHEAPER') return 'online';
  if (v.type === 'BUNDLE_ONLY') return v.unitWinner ?? null;
  return null;
}

/** P3: when the store wins (or ties) the online link stays a plain text link, never a button. */
export function emphasiseOnline(v: PreviewVerdict): boolean {
  return winner(v) === 'online';
}

/** "100ml당 384원" / "₩384 per 100ml" */
export function unitPriceText(t: Copy, won: Won, price: number, unit: Unit): string {
  return fill(t.result.receipt.unitPrice, { price: won(price), unit: t.result.unit[unit] });
}

/** Unit price of an online item, or null when its size isn't fully known (P1: never guessed). */
export function candidateUnitPrice(c: ResultCandidate): number | null {
  const { perItemAmount, perItemUnit, itemCount } = c.spec;
  if (perItemUnit === null || itemCount === null) return null;
  const total = totalAmount({ perItemAmount, perItemUnit, itemCount });
  return total === null ? null : unitPrice(c.price, total, perItemUnit);
}

export function mallLabel(t: Copy, c: ResultCandidate): string {
  return c.isCatalog ? t.result.receipt.catalogMall : c.mallName;
}

export function storeLabel(t: Copy, key: StoreId | null): string {
  return key ? t.store.names[key] : t.result.receipt.storeUnknown;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** P4/P6: lookup scope and time, always shown. */
export function scopeSentence(t: Copy, f: ResultFixture): string {
  const time = fill(t.result.time, {
    hour: pad2(f.checkedAt.hour),
    minute: pad2(f.checkedAt.minute),
  });
  return fill(t.result.scope, { time, n: f.resultCount });
}

export function lastPurchaseLine(t: Copy, won: Won, f: ResultFixture): string | null {
  const p = f.lastPurchase;
  if (!p) return null;
  const channel = p.channel === 'online' ? t.result.lastOnline : storeLabel(t, p.storeKey ?? null);
  return fill(t.result.lastPurchase, {
    date: fill(t.result.date, { month: p.month, day: p.day }),
    channel,
    price: won(p.price),
  });
}

/** PLAN 9 step 6: same item with another count, or another size — only with a complete size. */
export function bundleCandidates(f: ResultFixture, v: PreviewVerdict): ResultCandidate[] {
  return f.candidates
    .filter(
      (c) =>
        (c.relation === 'SIZE_DIFF' ||
          (c.relation === 'SAME_ITEM' && c.spec.itemCount !== v.store.count)) &&
        candidateUnitPrice(c) !== null,
    )
    .sort((a, b) => (candidateUnitPrice(a) ?? 0) - (candidateUnitPrice(b) ?? 0));
}

/** P2: UNCERTAIN items are only listed, never used in the verdict. */
export function uncertainCandidates(f: ResultFixture): ResultCandidate[] {
  return f.candidates.filter((c) => c.relation === 'UNCERTAIN');
}

/** The verdict on screen: with the promo toggle on, the n+m basis (PLAN 9 step 2). */
export function activeVerdict(f: ResultFixture, promoApplied: boolean): PreviewVerdict {
  return promoApplied && f.verdictWithPromo ? f.verdictWithPromo : f.verdict;
}

/** Items you get for the store price with an n+m deal (1+1 → 2). null when there is no such deal. */
export function promoCount(f: ResultFixture): number | null {
  const { type, n, m } = f.promo;
  if (type !== 'n_plus_m' || !n || !m || !f.verdictWithPromo) return null;
  return f.target.itemCount * (n + m);
}
