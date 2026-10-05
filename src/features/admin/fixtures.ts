/**
 * EXAMPLE rows only (P1). /admin is not wired to the admin API or Naver yet, so it renders these
 * under the pink ExampleLabel. Candidate prices are made up to show the layout — not Naver results.
 */

import type { Copy } from '../../copy/ko';
import type { Unit } from '../../../shared/types.js';

export type LinkRelation = 'same_item' | 'size_diff' | 'wrong';
export type ReportKind = 'wrong_product' | 'wrong_size' | 'wrong_price' | 'other';
export type ReportAction = 'recheck' | 'markWrong';

export const RELATIONS: readonly LinkRelation[] = ['same_item', 'size_diff', 'wrong'];

/** products.csv header (PLAN appendix B). Column names are a file format, not UI copy. */
export const CSV_COLUMNS: readonly string[] = [
  'barcode',
  'brand',
  'name',
  'variant',
  'category',
  'per_item_amount',
  'per_item_unit',
  'item_count',
  'search_query',
  'notes',
];

export interface AdminCandidate {
  externalId: string;
  title: string;
  mallName: string | null; // null = Naver catalog (multiple sellers)
  price: number;
  perItemAmount: number | null;
  perItemUnit: Unit;
  itemCount: number;
}

export interface AdminProduct {
  id: string;
  barcode: string | null;
  label: string; // Korean original, shown as-is in both languages
  linkCount: number;
  candidates: readonly AdminCandidate[];
}

export interface AdminReport {
  id: string;
  kind: ReportKind;
  productLabel: string;
  /** Example notes are copy keys so they read in the UI language (real notes will be user text). */
  note: keyof Copy['ops']['admin']['exampleNotes'] | null;
  createdOn: string; // YYYY-MM-DD
}

export const EXAMPLE_PRODUCTS: readonly AdminProduct[] = [
  {
    id: 'example-p1',
    barcode: '0000000000001',
    label: '다우니 섬유유연제 실내건조 2.6L 1개',
    linkCount: 2,
    candidates: [
      {
        externalId: 'example-c1',
        title: '다우니 실내건조 섬유유연제 2.6L',
        mallName: null,
        price: 8900,
        perItemAmount: 2600,
        perItemUnit: 'ml',
        itemCount: 1,
      },
      {
        externalId: 'example-c2',
        title: '다우니 실내건조 2.6L x 2개',
        mallName: '예시상점',
        price: 17400,
        perItemAmount: 2600,
        perItemUnit: 'ml',
        itemCount: 2,
      },
      {
        externalId: 'example-c3',
        title: '다우니 엑스퍼트 실내건조 1L',
        mallName: '예시마켓',
        price: 5200,
        perItemAmount: 1000,
        perItemUnit: 'ml',
        itemCount: 1,
      },
    ],
  },
  {
    id: 'example-p2',
    barcode: null,
    label: '코디 3겹 데코 화장지 30m 30롤',
    linkCount: 0,
    candidates: [
      {
        externalId: 'example-c4',
        title: '코디 데코 3겹 30m 30롤',
        mallName: '예시상점',
        price: 15900,
        perItemAmount: 30,
        perItemUnit: 'm',
        itemCount: 30,
      },
      {
        externalId: 'example-c5',
        title: '코디 데코 3겹 27m 30롤',
        mallName: null,
        price: 14200,
        perItemAmount: 27,
        perItemUnit: 'm',
        itemCount: 30,
      },
    ],
  },
  {
    id: 'example-p3',
    barcode: '0000000000002',
    label: '맥심 모카골드 마일드 커피믹스 180개',
    linkCount: 1,
    candidates: [
      {
        externalId: 'example-c6',
        title: '맥심 모카골드 마일드 180T',
        mallName: null,
        price: 26800,
        perItemAmount: null,
        perItemUnit: 'ea',
        itemCount: 180,
      },
    ],
  },
];

export const EXAMPLE_REPORTS: readonly AdminReport[] = [
  {
    id: 'example-r1',
    kind: 'wrong_size',
    productLabel: '다우니 섬유유연제 실내건조 2.6L 1개',
    note: 'twoPackSameItem',
    createdOn: '2026-10-04',
  },
  {
    id: 'example-r2',
    kind: 'wrong_product',
    productLabel: '코디 3겹 데코 화장지 30m 30롤',
    note: null,
    createdOn: '2026-10-05',
  },
];
