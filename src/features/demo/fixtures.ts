// /demo sample data (PLAN 12). These are EXAMPLE values for a UI walkthrough — not real lookups.
// Every screen that renders them shows <ExampleLabel/> (P1). Product names stay in Korean
// on purpose (PLAN 12: "상품명은 원문 그대로"), so they live here as data, not in src/copy/.
// TODO(Phase 5): replace with fixtures/demo/D*.json recorded by scripts/record-demo.ts.
import type { Promo, TargetSpec, Unit } from '../../../shared/types';
import type { StoreId } from '../../components/common/storeChoice';

export const DEMO_SCENARIO_IDS = ['D1', 'D2', 'D3'] as const;
export type DemoScenarioId = (typeof DEMO_SCENARIO_IDS)[number];

/** PLAN 9 VerdictType values used by the demo (the result screen is /preview/result/<type>). */
export type DemoVerdictKey = 'STORE_CHEAPER' | 'ONLINE_CHEAPER' | 'BUNDLE_ONLY';

/** Confirm-card fields the demo can mark as low confidence (S2: confidence < 0.7). */
export type DemoField =
  'brand' | 'productName' | 'variant' | 'perItemAmount' | 'itemCount' | 'storePrice';

export interface DemoScenario {
  id: DemoScenarioId;
  verdictKey: DemoVerdictKey;
  /** Store chip key → name comes from copy.store.names */
  storeKey: StoreId;
  /** What is printed on the tag, as drawn by DemoPriceTag */
  tag: {
    /** product name as printed (Korean original) */
    nameLine: string;
    /** size as printed, e.g. "2.6L" */
    sizeLine: string;
    /** printed unit price (integer won) for unitBase */
    unitPrice: number;
    unitBase: Unit;
  };
  /** What the confirm card is filled with (shared/types TargetSpec) */
  target: TargetSpec;
  storePrice: number;
  promo: Promo;
  /** One field shown with the "확인해 주세요" marker */
  lowConfidence: DemoField;
}

export const DEMO_SCENARIOS: Readonly<Record<DemoScenarioId, DemoScenario>> = {
  D1: {
    id: 'D1',
    verdictKey: 'STORE_CHEAPER',
    storeKey: 'emart',
    tag: { nameLine: '햇반 백미 210g×12', sizeLine: '210g × 12개', unitPrice: 555, unitBase: 'g' },
    target: {
      brand: 'CJ',
      productName: '햇반 백미',
      variant: null,
      perItemAmount: 210,
      perItemUnit: 'g',
      itemCount: 12,
    },
    storePrice: 13980,
    promo: { type: 'none', text: null },
    lowConfidence: 'itemCount',
  },
  D2: {
    id: 'D2',
    verdictKey: 'ONLINE_CHEAPER',
    storeKey: 'emart',
    tag: {
      nameLine: '다우니 실내건조 2.6L',
      sizeLine: '2.6L × 1개',
      unitPrice: 384,
      unitBase: 'ml',
    },
    target: {
      brand: '다우니',
      productName: '섬유유연제',
      variant: '실내건조',
      perItemAmount: 2600,
      perItemUnit: 'ml',
      itemCount: 1,
    },
    storePrice: 9980,
    promo: { type: 'none', text: null },
    lowConfidence: 'variant',
  },
  D3: {
    id: 'D3',
    verdictKey: 'BUNDLE_ONLY',
    storeKey: 'homeplus',
    tag: {
      nameLine: '깨끗한나라 3겹 화장지 30m×30롤',
      sizeLine: '30m × 30롤',
      unitPrice: 177,
      unitBase: 'm',
    },
    target: {
      brand: '깨끗한나라',
      productName: '3겹 화장지',
      variant: null,
      perItemAmount: 30,
      perItemUnit: 'm',
      itemCount: 30,
    },
    storePrice: 15900,
    promo: { type: 'none', text: null },
    lowConfidence: 'perItemAmount',
  },
};

export function isDemoScenarioId(value: string | null): value is DemoScenarioId {
  return value !== null && (DEMO_SCENARIO_IDS as readonly string[]).includes(value);
}

/** Result step: the result-preview screen is built elsewhere and keyed by PLAN 9 VerdictType. */
export function resultPreviewPath(s: DemoScenario): string {
  return `/preview/result/${s.verdictKey}?demo=${s.id}`;
}
