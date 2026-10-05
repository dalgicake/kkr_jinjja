// Price-tag reading contract (PLAN 7.1 tool schema, 7.3 post-processing, S2 unit-price cross-check).
// Pure: no env, no network. Used by api/read-tag (server) and the S2 confirm card (client).
import { z } from 'zod';
import type { Promo, Unit } from './types.js';
import { normalizeAmount, totalAmount as specTotalAmount, unitPrice } from './units.js';

export const UNITS = ['ml', 'g', 'm', 'sheet', 'ea'] as const satisfies readonly Unit[];
export const TAG_IMAGE_KINDS = ['shelf_tag', 'product_package', 'receipt', 'other'] as const;
export const PROMO_TYPES = [
  'none',
  'n_plus_m',
  'percent_off',
  'card_discount',
  'multi_buy',
  'other',
] as const satisfies readonly Promo['type'][];

export type TagImageKind = (typeof TAG_IMAGE_KINDS)[number];
export type TagPromoType = (typeof PROMO_TYPES)[number];

/** S2: fields below this confidence get the "확인해 주세요" marker. */
export const LOW_CONFIDENCE_THRESHOLD = 0.7;
/** S2: (store price ÷ total amount) vs printed unit price — more than this % apart → warn. */
export const UNIT_PRICE_TOLERANCE_PCT = 5;
/** 7.3: tag photos over 4MB (decoded bytes) are rejected. One value for the client pre-check and the server. */
export const MAX_TAG_IMAGE_BYTES = 4 * 1024 * 1024;

// ---------------------------------------------------------------------------
// 7.1 record_tag tool definition (one source for server, tests and eval script)
// ---------------------------------------------------------------------------

export interface RecordTagToolDefinition {
  name: 'record_tag';
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

export const RECORD_TAG_TOOL: RecordTagToolDefinition = {
  name: 'record_tag',
  description:
    'Record what is printed on the photographed Korean supermarket price tag or package.',
  input_schema: {
    type: 'object',
    properties: {
      image_kind: { type: 'string', enum: ['shelf_tag', 'product_package', 'receipt', 'other'] },
      product_name_raw: { type: ['string', 'null'] },
      brand: { type: ['string', 'null'] },
      product_name: { type: ['string', 'null'] },
      variant: { type: ['string', 'null'] },
      per_item_amount: { type: ['number', 'null'] },
      per_item_unit: { type: ['string', 'null'], enum: ['ml', 'g', 'm', 'sheet', 'ea', null] },
      item_count: { type: ['integer', 'null'] },
      store_price: { type: ['integer', 'null'] },
      regular_price: { type: ['integer', 'null'] },
      promo: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['none', 'n_plus_m', 'percent_off', 'card_discount', 'multi_buy', 'other'],
          },
          text: { type: ['string', 'null'] },
          n: { type: ['integer', 'null'] },
          m: { type: ['integer', 'null'] },
        },
        required: ['type', 'text'],
      },
      tag_unit_price: {
        type: ['object', 'null'],
        properties: {
          price: { type: 'number' },
          per_amount: { type: 'number' },
          per_unit: { type: 'string', enum: ['ml', 'g', 'm', 'sheet', 'ea'] },
        },
      },
      barcode_digits: { type: ['string', 'null'] },
      multiple_tags_visible: { type: 'boolean' },
      confidence: {
        type: 'object',
        properties: {
          product: { type: 'number' },
          size: { type: 'number' },
          price: { type: 'number' },
        },
        required: ['product', 'size', 'price'],
      },
      notes: { type: ['string', 'null'] },
    },
    required: [
      'image_kind',
      'product_name_raw',
      'brand',
      'product_name',
      'variant',
      'per_item_amount',
      'per_item_unit',
      'item_count',
      'store_price',
      'regular_price',
      'promo',
      'tag_unit_price',
      'barcode_digits',
      'multiple_tags_visible',
      'confidence',
      'notes',
    ],
  },
};

export const RECORD_TAG_TOOL_CHOICE: { type: 'tool'; name: 'record_tag' } = {
  type: 'tool',
  name: 'record_tag',
};

// ---------------------------------------------------------------------------
// zod schemas
// ---------------------------------------------------------------------------

const unitSchema = z.enum(UNITS);
const nullableString = z.string().nullable();
const won = z.number().int().nonnegative(); // integer KRW
const confidenceValue = z.number().min(0).max(1);

const confidenceSchema = z.object({
  product: confidenceValue,
  size: confidenceValue,
  price: confidenceValue,
});

/** Raw tool input — mirrors 7.1 (promo n/m and tag_unit_price fields are optional there). */
export const recordTagInputSchema = z.object({
  image_kind: z.enum(TAG_IMAGE_KINDS),
  product_name_raw: nullableString,
  brand: nullableString,
  product_name: nullableString,
  variant: nullableString,
  per_item_amount: z.number().positive().nullable(),
  per_item_unit: unitSchema.nullable(),
  item_count: z.number().int().positive().nullable(),
  store_price: won.nullable(),
  regular_price: won.nullable(),
  promo: z.object({
    type: z.enum(PROMO_TYPES),
    text: nullableString,
    n: z.number().int().positive().nullable().optional(),
    m: z.number().int().positive().nullable().optional(),
  }),
  tag_unit_price: z
    .object({
      price: z.number().optional(),
      per_amount: z.number().optional(),
      per_unit: unitSchema.optional(),
    })
    .nullable(),
  barcode_digits: nullableString,
  multiple_tags_visible: z.boolean(),
  confidence: confidenceSchema,
  notes: nullableString,
});
export type RecordTagInput = z.infer<typeof recordTagInputSchema>;

export const tagUnitPriceSchema = z.object({
  price: z.number().positive(),
  per_amount: z.number().positive(),
  per_unit: unitSchema,
});
export type TagUnitPrice = z.infer<typeof tagUnitPriceSchema>;

/** Normalized reading returned by /api/read-tag as `ocr` and stored in scans.ocr. */
export const tagReadingSchema = recordTagInputSchema.extend({
  promo: z.object({
    type: z.enum(PROMO_TYPES),
    text: nullableString,
    n: z.number().int().positive().nullable(),
    m: z.number().int().positive().nullable(),
  }),
  tag_unit_price: tagUnitPriceSchema.nullable(),
});
export type TagReading = z.infer<typeof tagReadingSchema>;
export type TagConfidence = TagReading['confidence'];

// ---------------------------------------------------------------------------
// 7.3 post-processing
// ---------------------------------------------------------------------------

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Canonical unit for a raw unit string ('L'→ml, 'kg'→g, '매'→sheet …), or null if unknown. */
function canonicalUnit(raw: string): { unit: Unit; factor: number } | null {
  const n = normalizeAmount(1, raw);
  return n ? { unit: n.unit, factor: n.amount } : null;
}

function renormalizePair(amount: unknown, unit: unknown): { amount: unknown; unit: unknown } {
  if (typeof unit !== 'string') return { amount, unit };
  const canon = canonicalUnit(unit);
  if (!canon) return { amount, unit }; // unknown unit: leave it so validation rejects it
  if (typeof amount === 'number') {
    const n = normalizeAmount(amount, unit);
    // non-positive amounts: keep the value, let validation decide
    return n ? { amount: n.amount, unit: n.unit } : { amount, unit: canon.unit };
  }
  return { amount, unit: canon.unit };
}

/**
 * Re-normalizes units on raw tool output BEFORE validation: L→ml(×1000), kg→g(×1000),
 * case and Korean counters ('mL', '매', '개'). Applies to the item size and the printed
 * unit-price basis (price itself is unchanged: "1L당 3,840원" → 1000ml당 3,840원).
 * Unknown units are left untouched so validation fails (never guessed).
 */
export function renormalizeRawUnits(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  const out: Record<string, unknown> = { ...raw };
  const item = renormalizePair(raw.per_item_amount, raw.per_item_unit);
  out.per_item_amount = item.amount;
  out.per_item_unit = item.unit;
  if (isRecord(raw.tag_unit_price)) {
    const t = raw.tag_unit_price;
    const basis = renormalizePair(t.per_amount, t.per_unit);
    out.tag_unit_price = { ...t, per_amount: basis.amount, per_unit: basis.unit };
  }
  return out;
}

const cleanString = (s: string | null): string | null => {
  if (s === null) return null;
  const t = s.trim();
  return t === '' ? null : t;
};

/** Validated tool input → TagReading: trims strings, fills promo n/m, drops incomplete unit price. */
export function normalizeTagReading(input: RecordTagInput): TagReading {
  const t = input.tag_unit_price;
  const parsedUnitPrice = t ? tagUnitPriceSchema.safeParse(t) : null;
  return {
    ...input,
    product_name_raw: cleanString(input.product_name_raw),
    brand: cleanString(input.brand),
    product_name: cleanString(input.product_name),
    variant: cleanString(input.variant),
    barcode_digits: cleanString(input.barcode_digits),
    notes: cleanString(input.notes),
    promo: {
      type: input.promo.type,
      text: cleanString(input.promo.text),
      n: input.promo.n ?? null,
      m: input.promo.m ?? null,
    },
    tag_unit_price: parsedUnitPrice?.success ? parsedUnitPrice.data : null,
  };
}

export type ParseRecordTagResult = { ok: true; reading: TagReading } | { ok: false; error: string };

/**
 * Full 7.3 pipeline for one tool_use input: unit re-normalization → zod validation →
 * normalization. On failure `error` lists issues ("path: message; …") for the single retry.
 */
export function parseRecordTag(raw: unknown): ParseRecordTagResult {
  const parsed = recordTagInputSchema.safeParse(renormalizeRawUnits(raw));
  if (!parsed.success) {
    const error = parsed.error.issues
      .map((i) => `${i.path.length ? i.path.join('.') : '(root)'}: ${i.message}`)
      .join('; ');
    return { ok: false, error };
  }
  return { ok: true, reading: normalizeTagReading(parsed.data) };
}

/** 7.3: receipt/other photos, or neither price nor name read → 422 unreadable. */
export function isUnreadableTag(
  reading: Pick<TagReading, 'image_kind' | 'store_price' | 'product_name'>,
): boolean {
  if (reading.image_kind === 'receipt' || reading.image_kind === 'other') return true;
  return reading.store_price === null && reading.product_name === null;
}

export function isLowConfidence(value: number): boolean {
  return value < LOW_CONFIDENCE_THRESHOLD;
}

/** TagReading promo → shared Promo (null n/m dropped). */
export function toPromo(promo: TagReading['promo']): Promo {
  const out: Promo = { type: promo.type, text: promo.text };
  if (promo.n !== null) out.n = promo.n;
  if (promo.m !== null) out.m = promo.m;
  return out;
}

// ---------------------------------------------------------------------------
// S2 unit-price cross-check and derived values
// ---------------------------------------------------------------------------

export interface UnitPriceCheck {
  /** false → warn on the size/count fields (diff > UNIT_PRICE_TOLERANCE_PCT). */
  ok: boolean;
  /** |computed − printed| ÷ printed × 100, rounded to 2 decimals. */
  diffPct: number;
}

/** Size/price as currently shown on the S2 card (may be user-edited). */
export interface UnitPriceCheckInput {
  storePrice: number | null;
  perItemAmount: number | null;
  perItemUnit: Unit | null;
  itemCount: number | null;
}

const EPS = 1e-9;

/**
 * Store price ÷ total amount, scaled to the printed basis, vs the printed unit price.
 * Exactly 5% → ok; above → warn. Returns null when it cannot be checked
 * (no printed unit price, missing/invalid size or price, unit mismatch) — never guessed.
 */
export function checkTagUnitPrice(
  input: UnitPriceCheckInput,
  tag: TagUnitPrice | null,
): UnitPriceCheck | null {
  if (!tag || !(tag.price > 0) || !(tag.per_amount > 0)) return null;
  const { storePrice, perItemAmount, perItemUnit, itemCount } = input;
  if (storePrice === null || !Number.isInteger(storePrice) || storePrice <= 0) return null;
  if (perItemUnit === null || itemCount === null || perItemUnit !== tag.per_unit) return null;
  const total = specTotalAmount({ perItemAmount, perItemUnit, itemCount });
  if (total === null) return null;
  const computed = (storePrice / total) * tag.per_amount;
  const raw = (Math.abs(computed - tag.price) / tag.price) * 100;
  return {
    ok: raw <= UNIT_PRICE_TOLERANCE_PCT + EPS,
    diffPct: Math.round((raw + EPS) * 100) / 100,
  };
}

export interface TagDerivedValues {
  /** per-item amount × count in the canonical unit; null if size unreadable. */
  totalAmount: number | null;
  /** integer won per UNIT_BASE of the unit; null if price or size unreadable. */
  storeUnitPrice: number | null;
  unitPriceCheck: UnitPriceCheck | null;
}

/** 7.3 derived values from a normalized reading. */
export function deriveTagValues(reading: TagReading): TagDerivedValues {
  const unit = reading.per_item_unit;
  const count = reading.item_count;
  const total =
    unit === null || count === null
      ? null
      : specTotalAmount({
          perItemAmount: reading.per_item_amount,
          perItemUnit: unit,
          itemCount: count,
        });
  const storeUnitPrice =
    total === null || unit === null || reading.store_price === null
      ? null
      : unitPrice(reading.store_price, total, unit);
  return {
    totalAmount: total,
    storeUnitPrice,
    unitPriceCheck: checkTagUnitPrice(
      {
        storePrice: reading.store_price,
        perItemAmount: reading.per_item_amount,
        perItemUnit: unit,
        itemCount: count,
      },
      reading.tag_unit_price,
    ),
  };
}
