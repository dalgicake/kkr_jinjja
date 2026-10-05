// S3 example data (P1). EXAMPLE values for the UI shell — not real lookups. Every screen that renders
// them shows ExampleLabel. Seller names are made up on purpose; product names stay Korean (data, not copy).
// Numbers follow PLAN appendix D where a case exists (#1, #4, #8, #12); fixtures.test.ts checks them.
// TODO(Phase 3): replace with /api/compare + decide() output.
import type { Relation, Unit } from '../../../shared/types';
import type { ResultCandidate, ResultFixture, UncertainReason, VerdictType } from './types';

const NO_PROMO = { type: 'none', text: null } as const;

function cand(
  externalId: string,
  title: string,
  mallName: string,
  price: number,
  relation: Relation,
  spec: { amount: number | null; unit: Unit | null; count: number | null },
  extra: {
    isCatalog?: boolean;
    verified?: boolean;
    variant?: 'yes' | 'unclear';
    reasonCode?: UncertainReason;
  } = {},
): ResultCandidate {
  return {
    externalId,
    title,
    mallName,
    isCatalog: extra.isCatalog ?? false,
    link: '',
    image: '',
    price,
    relation,
    reason: '',
    spec: {
      perItemAmount: spec.amount,
      perItemUnit: spec.unit,
      itemCount: spec.count,
      hasGift: extra.reasonCode === 'giftIncluded',
    },
    evidence: {
      brand: true,
      line: relation !== 'UNCERTAIN' || extra.reasonCode !== 'differentLine',
      variant: extra.variant ?? 'yes',
      amount: spec.amount !== null,
      count: spec.count !== null,
    },
    verifiedLink: extra.verified ?? false,
    reported: false,
    reasonCode: extra.reasonCode,
  };
}

// --- shared items -------------------------------------------------------------------------------
const DOWNY = {
  brand: '다우니',
  productName: '섬유유연제',
  variant: '실내건조',
  perItemAmount: 2600,
  perItemUnit: 'ml',
  itemCount: 1,
} as const;
const downy1 = cand(
  'ex-downy-1',
  '다우니 실내건조 섬유유연제 2.6L',
  '생활잡화몰',
  8900,
  'SAME_ITEM',
  { amount: 2600, unit: 'ml', count: 1 },
  { verified: true },
);
const downy2 = cand(
  'ex-downy-2',
  '다우니 실내건조 섬유유연제 2.6L 2개',
  '알뜰상회',
  16500,
  'SAME_ITEM',
  { amount: 2600, unit: 'ml', count: 2 },
);
const downyRefill = cand(
  'ex-downy-r',
  '다우니 실내건조 리필 기획',
  '모아마켓',
  5000,
  'UNCERTAIN',
  { amount: null, unit: 'ml', count: 1 },
  { reasonCode: 'sizeMissing' },
);
const downySmall = cand(
  'ex-downy-s',
  '다우니 실내건조 섬유유연제 1.6L',
  '생활잡화몰',
  7900,
  'SIZE_DIFF',
  { amount: 1600, unit: 'ml', count: 1 },
);

export const RESULT_FIXTURES: readonly ResultFixture[] = [
  // Demo D1. The store wins: say so plainly, online link not emphasised (P3).
  {
    id: 'store-cheaper',
    nameKey: 'storeCheaper',
    target: {
      brand: 'CJ',
      productName: '햇반 백미',
      variant: null,
      perItemAmount: 210,
      perItemUnit: 'g',
      itemCount: 12,
    },
    storeKey: 'emart',
    storePrice: 13980,
    promo: NO_PROMO,
    candidates: [
      cand(
        'ex-rice-12',
        '햇반 백미 210g 12개',
        '바른식품몰',
        14520,
        'SAME_ITEM',
        { amount: 210, unit: 'g', count: 12 },
        { verified: true },
      ),
      cand('ex-rice-24', '햇반 백미 210g 24개', '알뜰상회', 27900, 'SAME_ITEM', {
        amount: 210,
        unit: 'g',
        count: 24,
      }),
      cand(
        'ex-rice-black',
        '햇반 흑미밥 210g 12개',
        '모아마켓',
        13200,
        'UNCERTAIN',
        { amount: 210, unit: 'g', count: 12 },
        { variant: 'unclear', reasonCode: 'variantUnclear' },
      ),
    ],
    verdict: {
      type: 'STORE_CHEAPER',
      diff: 540,
      store: { price: 13980, count: 12, unitPrice: 555, unit: 'g' },
    },
    checkedAt: { hour: 14, minute: 32 },
    resultCount: 40,
    lastPurchase: { month: 9, day: 14, channel: 'store', storeKey: 'emart', price: 13480 },
  },
  {
    id: 'same-price',
    nameKey: 'samePrice',
    target: {
      brand: '농심',
      productName: '신라면',
      variant: null,
      perItemAmount: 120,
      perItemUnit: 'g',
      itemCount: 5,
    },
    storeKey: 'homeplus',
    storePrice: 4480,
    promo: NO_PROMO,
    candidates: [
      cand(
        'ex-ramen-5',
        '농심 신라면 120g 5개입',
        '네이버 가격비교',
        4480,
        'SAME_ITEM',
        { amount: 120, unit: 'g', count: 5 },
        { isCatalog: true },
      ),
      cand('ex-ramen-40', '농심 신라면 120g 40개 박스', '라면창고', 33900, 'SAME_ITEM', {
        amount: 120,
        unit: 'g',
        count: 40,
      }),
    ],
    verdict: {
      type: 'SAME_PRICE',
      diff: 0,
      store: { price: 4480, count: 5, unitPrice: 747, unit: 'g' },
    },
    checkedAt: { hour: 10, minute: 5 },
    resultCount: 32,
  },
  // Big gap: online wins, shipping still unknown.
  {
    id: 'online-cheaper',
    nameKey: 'onlineCheaper',
    target: {
      brand: '피죤',
      productName: '섬유유연제',
      variant: '실내제습',
      perItemAmount: 3100,
      perItemUnit: 'ml',
      itemCount: 4,
    },
    storeKey: 'lottemart',
    storePrice: 32900,
    promo: NO_PROMO,
    candidates: [
      cand(
        'ex-pigeon-4',
        '피죤 실내제습 섬유유연제 3.1L 4개',
        '네이버 가격비교',
        27400,
        'SAME_ITEM',
        { amount: 3100, unit: 'ml', count: 4 },
        { isCatalog: true, verified: true },
      ),
      cand(
        'ex-pigeon-gift',
        '피죤 실내제습 3.1L 4개 + 사은품',
        '모아마켓',
        25900,
        'UNCERTAIN',
        { amount: 3100, unit: 'ml', count: 4 },
        { reasonCode: 'giftIncluded' },
      ),
    ],
    verdict: {
      type: 'ONLINE_CHEAPER',
      diff: 5500,
      breakEvenShipping: 5500,
      closeCall: false,
      store: { price: 32900, count: 4, unitPrice: 265, unit: 'ml' },
    },
    checkedAt: { hour: 19, minute: 48 },
    resultCount: 40,
    lastPurchase: { month: 8, day: 30, channel: 'online', price: 28100 },
  },
  // Demo D2 / appendix D #1, #7. Small gap: pink "shipping could flip this".
  {
    id: 'online-close-call',
    nameKey: 'onlineCloseCall',
    target: { ...DOWNY },
    storeKey: 'emart',
    storePrice: 9980,
    promo: NO_PROMO,
    candidates: [downy1, downyRefill],
    verdict: {
      type: 'ONLINE_CHEAPER',
      diff: 1080,
      breakEvenShipping: 1080,
      closeCall: true,
      store: { price: 9980, count: 1, unitPrice: 384, unit: 'ml' },
    },
    checkedAt: { hour: 14, minute: 32 },
    resultCount: 40,
  },
  // Demo D3 / appendix D #4. No same count; the 60-roll pack is cheaper per 10m.
  {
    id: 'bundle-only-online',
    nameKey: 'bundleOnline',
    target: {
      brand: '깨끗한나라',
      productName: '3겹 화장지',
      variant: null,
      perItemAmount: 30,
      perItemUnit: 'm',
      itemCount: 30,
    },
    storeKey: 'homeplus',
    storePrice: 15900,
    promo: NO_PROMO,
    candidates: [
      cand('ex-tissue-60', '깨끗한나라 3겹 화장지 30m 60롤', '두루마리마트', 27800, 'SAME_ITEM', {
        amount: 30,
        unit: 'm',
        count: 60,
      }),
      cand(
        'ex-tissue-big',
        '깨끗한나라 화장지 대용량 기획',
        '모아마켓',
        16500,
        'UNCERTAIN',
        { amount: 30, unit: 'm', count: null },
        { reasonCode: 'countUnclear' },
      ),
    ],
    verdict: {
      type: 'BUNDLE_ONLY',
      unitWinner: 'online',
      store: { price: 15900, count: 30, unitPrice: 177, unit: 'm' },
    },
    checkedAt: { hour: 11, minute: 20 },
    resultCount: 38,
  },
  // Appendix D #12. Only a smaller size online; per unit the store is cheaper.
  {
    id: 'bundle-only-store',
    nameKey: 'bundleStore',
    target: { ...DOWNY },
    storeKey: 'emart',
    storePrice: 9980,
    promo: NO_PROMO,
    candidates: [downySmall],
    verdict: {
      type: 'BUNDLE_ONLY',
      unitWinner: 'store',
      store: { price: 9980, count: 1, unitPrice: 384, unit: 'ml' },
    },
    checkedAt: { hour: 16, minute: 2 },
    resultCount: 27,
  },
  // Appendix D #6. Everything is UNCERTAIN: never call any of them cheaper.
  {
    id: 'no-match',
    nameKey: 'noMatch',
    target: {
      brand: '풀무원',
      productName: '국산콩 부침두부',
      variant: null,
      perItemAmount: 300,
      perItemUnit: 'g',
      itemCount: 1,
    },
    storeKey: 'hanaro',
    storePrice: 2980,
    promo: NO_PROMO,
    candidates: [
      cand(
        'ex-tofu-2',
        '풀무원 국산콩 두부 300g 2개',
        '바른식품몰',
        5400,
        'UNCERTAIN',
        { amount: 300, unit: 'g', count: null },
        { reasonCode: 'countUnclear' },
      ),
      cand(
        'ex-tofu-soup',
        '풀무원 국산콩 찌개두부',
        '모아마켓',
        2650,
        'UNCERTAIN',
        { amount: 300, unit: 'g', count: 1 },
        { variant: 'unclear', reasonCode: 'variantUnclear' },
      ),
      cand(
        'ex-tofu-set',
        '풀무원 두부 기획세트',
        '알뜰상회',
        7900,
        'UNCERTAIN',
        { amount: null, unit: 'g', count: null },
        { reasonCode: 'differentLine' },
      ),
    ],
    verdict: { type: 'NO_MATCH', store: { price: 2980, count: 1, unitPrice: 993, unit: 'g' } },
    checkedAt: { hour: 9, minute: 41 },
    resultCount: 22,
  },
  // Appendix D #10. The tag had no readable price: ask for it, compare nothing yet (P1).
  {
    id: 'need-store-price',
    nameKey: 'needPrice',
    target: {
      brand: '동원',
      productName: '라이트 스탠다드 참치',
      variant: null,
      perItemAmount: 85,
      perItemUnit: 'g',
      itemCount: 4,
    },
    storeKey: null,
    storePrice: null,
    promo: NO_PROMO,
    candidates: [
      cand('ex-tuna-4', '동원참치 라이트 스탠다드 85g 4개', '바른식품몰', 8980, 'SAME_ITEM', {
        amount: 85,
        unit: 'g',
        count: 4,
      }),
    ],
    verdict: {
      type: 'NEED_STORE_PRICE',
      store: { price: null, count: 4, unitPrice: null, unit: 'g' },
    },
    checkedAt: { hour: 13, minute: 15 },
    resultCount: 36,
  },
  // Appendix D #8. 1+1 at the store: off → online by 1,080 (close call); on → store by 6,520.
  {
    id: 'promo-1plus1',
    nameKey: 'promo',
    target: { ...DOWNY },
    storeKey: 'emart',
    storePrice: 9980,
    promo: { type: 'n_plus_m', text: '1+1', n: 1, m: 1 },
    candidates: [downy1, downy2],
    verdict: {
      type: 'ONLINE_CHEAPER',
      diff: 1080,
      breakEvenShipping: 1080,
      closeCall: true,
      store: { price: 9980, count: 1, unitPrice: 384, unit: 'ml' },
    },
    verdictWithPromo: {
      type: 'STORE_CHEAPER',
      diff: 6520,
      store: { price: 9980, count: 2, unitPrice: 192, unit: 'ml' },
    },
    checkedAt: { hour: 15, minute: 7 },
    resultCount: 40,
  },
];

// Wire bestExact / bundleInsight to the candidate objects above (decide() would return these).
function link(id: string, patch: (f: ResultFixture) => void) {
  const f = RESULT_FIXTURES.find((x) => x.id === id);
  if (f) patch(f);
}
function nth(f: ResultFixture, i: number): ResultCandidate {
  const c = f.candidates[i];
  if (!c) throw new Error(`fixture ${f.id} has no candidate ${i}`);
  return c;
}
link('store-cheaper', (f) => (f.verdict.bestExact = nth(f, 0)));
link('same-price', (f) => {
  f.verdict.bestExact = nth(f, 0);
  f.verdict.bundleInsight = { candidate: nth(f, 1), pct: 5, count: 40, total: 33900 };
});
link('online-cheaper', (f) => (f.verdict.bestExact = nth(f, 0)));
link('online-close-call', (f) => (f.verdict.bestExact = downy1));
link('bundle-only-online', (f) => {
  f.verdict.bundleInsight = { candidate: nth(f, 0), pct: 13, count: 60, total: 27800 };
});
link('promo-1plus1', (f) => {
  f.verdict.bestExact = downy1;
  f.verdict.bundleInsight = { candidate: downy2, pct: 17, count: 2, total: 16500 };
  if (f.verdictWithPromo) f.verdictWithPromo.bestExact = downy2;
});

export const FIRST_FIXTURE_ID = 'store-cheaper';

/** /preview/result/<VerdictType> (used by /demo) → the matching example. Demo D1–D3 line up. */
const BY_TYPE: Readonly<Record<VerdictType, string>> = {
  STORE_CHEAPER: 'store-cheaper',
  SAME_PRICE: 'same-price',
  ONLINE_CHEAPER: 'online-close-call',
  BUNDLE_ONLY: 'bundle-only-online',
  NO_MATCH: 'no-match',
  NEED_STORE_PRICE: 'need-store-price',
};

/** Accepts a fixture id ("online-close-call") or a PLAN 9 VerdictType ("ONLINE_CHEAPER"). */
export function findFixture(param: string | undefined): ResultFixture | null {
  if (!param) return null;
  const direct = RESULT_FIXTURES.find((f) => f.id === param);
  if (direct) return direct;
  const id = (BY_TYPE as Record<string, string | undefined>)[param.toUpperCase()];
  return RESULT_FIXTURES.find((f) => f.id === id) ?? null;
}
