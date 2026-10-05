import { describe, expect, it } from 'vitest';
import {
  LOW_CONFIDENCE_THRESHOLD,
  RECORD_TAG_TOOL,
  RECORD_TAG_TOOL_CHOICE,
  UNIT_PRICE_TOLERANCE_PCT,
  checkTagUnitPrice,
  deriveTagValues,
  isLowConfidence,
  isUnreadableTag,
  normalizeTagReading,
  parseRecordTag,
  recordTagInputSchema,
  renormalizeRawUnits,
  tagReadingSchema,
  toPromo,
  type RecordTagInput,
  type TagReading,
} from './tag.js';

/** A legible Downy shelf tag: 2.6L, 9,980원, "100ml당 384원". */
function validInput(): RecordTagInput {
  return {
    image_kind: 'shelf_tag',
    product_name_raw: '다우니 섬유유연제 실내건조 2.6L',
    brand: '다우니',
    product_name: '섬유유연제 실내건조',
    variant: '실내건조',
    per_item_amount: 2600,
    per_item_unit: 'ml',
    item_count: 1,
    store_price: 9980,
    regular_price: 12900,
    promo: { type: 'none', text: null, n: null, m: null },
    tag_unit_price: { price: 384, per_amount: 100, per_unit: 'ml' },
    barcode_digits: '8001090000000',
    multiple_tags_visible: false,
    confidence: { product: 0.95, size: 0.9, price: 0.98 },
    notes: null,
  };
}

const clone = <T>(v: T): T => structuredClone(v);

describe('RECORD_TAG_TOOL', () => {
  it('is the forced record_tag tool from PLAN 7.1', () => {
    expect(RECORD_TAG_TOOL.name).toBe('record_tag');
    expect(RECORD_TAG_TOOL.input_schema.type).toBe('object');
    expect(RECORD_TAG_TOOL_CHOICE).toEqual({ type: 'tool', name: 'record_tag' });
  });
  it('requires exactly the keys the zod schema knows', () => {
    const zodKeys = Object.keys(recordTagInputSchema.shape).sort();
    expect([...RECORD_TAG_TOOL.input_schema.required].sort()).toEqual(zodKeys);
    expect(Object.keys(RECORD_TAG_TOOL.input_schema.properties).sort()).toEqual(zodKeys);
  });
  it('is plain JSON (serialisable without loss)', () => {
    expect(JSON.parse(JSON.stringify(RECORD_TAG_TOOL))).toEqual(RECORD_TAG_TOOL);
  });
});

describe('recordTagInputSchema', () => {
  it('accepts a valid sample', () => {
    expect(recordTagInputSchema.safeParse(validInput()).success).toBe(true);
  });

  it('accepts an all-null reading (unreadable is not invalid)', () => {
    const input: RecordTagInput = {
      ...validInput(),
      image_kind: 'other',
      product_name_raw: null,
      brand: null,
      product_name: null,
      variant: null,
      per_item_amount: null,
      per_item_unit: null,
      item_count: null,
      store_price: null,
      regular_price: null,
      promo: { type: 'none', text: null },
      tag_unit_price: null,
      barcode_digits: null,
      confidence: { product: 0, size: 0, price: 0 },
    };
    expect(recordTagInputSchema.safeParse(input).success).toBe(true);
  });

  it('accepts promo without n/m (not required in 7.1)', () => {
    const input = validInput();
    input.promo = { type: 'card_discount', text: '삼성카드 10%' };
    expect(recordTagInputSchema.safeParse(input).success).toBe(true);
  });

  const invalid: Array<[string, (i: Record<string, unknown>) => void]> = [
    ['missing required key', (i) => delete i.notes],
    ['unknown image_kind', (i) => (i.image_kind = 'flyer')],
    ['unknown unit', (i) => (i.per_item_unit = 'oz')],
    ['non-integer store_price', (i) => (i.store_price = 9980.5)],
    ['negative store_price', (i) => (i.store_price = -1)],
    ['string store_price', (i) => (i.store_price = '9,980')],
    ['non-integer item_count', (i) => (i.item_count = 1.5)],
    ['zero item_count', (i) => (i.item_count = 0)],
    ['zero per_item_amount', (i) => (i.per_item_amount = 0)],
    ['confidence above 1', (i) => (i.confidence = { product: 1.2, size: 0.9, price: 0.9 })],
    ['confidence missing price', (i) => (i.confidence = { product: 0.9, size: 0.9 })],
    ['promo missing text', (i) => (i.promo = { type: 'none' })],
    ['unknown promo type', (i) => (i.promo = { type: 'bogo', text: null })],
    ['non-integer promo n', (i) => (i.promo = { type: 'n_plus_m', text: '1+1', n: 1.5, m: 1 })],
    ['multiple_tags_visible not boolean', (i) => (i.multiple_tags_visible = 'no')],
    [
      'tag_unit_price unit not allowed',
      (i) => (i.tag_unit_price = { price: 384, per_amount: 100, per_unit: 'L' }),
    ],
  ];
  it.each(invalid)('rejects: %s', (_label, mutate) => {
    const input = clone(validInput()) as unknown as Record<string, unknown>;
    mutate(input);
    expect(recordTagInputSchema.safeParse(input).success).toBe(false);
  });
});

describe('renormalizeRawUnits', () => {
  it('converts L→ml and kg→g on the item size', () => {
    const raw = { ...validInput(), per_item_amount: 2.6, per_item_unit: 'L' };
    const out = renormalizeRawUnits(raw) as Record<string, unknown>;
    expect(out.per_item_amount).toBe(2600);
    expect(out.per_item_unit).toBe('ml');

    const kg = renormalizeRawUnits({ ...validInput(), per_item_amount: 1.2, per_item_unit: 'kg' });
    expect(kg).toMatchObject({ per_item_amount: 1200, per_item_unit: 'g' });
  });

  it('maps case and Korean counters to canonical units', () => {
    expect(
      renormalizeRawUnits({ ...validInput(), per_item_amount: 500, per_item_unit: 'mL' }),
    ).toMatchObject({ per_item_amount: 500, per_item_unit: 'ml' });
    expect(
      renormalizeRawUnits({ ...validInput(), per_item_amount: 80, per_item_unit: '매' }),
    ).toMatchObject({ per_item_amount: 80, per_item_unit: 'sheet' });
  });

  it('converts the printed unit price basis (1L당 → 1000ml당, price unchanged)', () => {
    const raw = { ...validInput(), tag_unit_price: { price: 3840, per_amount: 1, per_unit: 'L' } };
    expect(renormalizeRawUnits(raw)).toMatchObject({
      tag_unit_price: { price: 3840, per_amount: 1000, per_unit: 'ml' },
    });
  });

  it('leaves unknown units alone so validation rejects them (no guessing)', () => {
    const raw = { ...validInput(), per_item_amount: 12, per_item_unit: 'oz' };
    expect(renormalizeRawUnits(raw)).toMatchObject({ per_item_amount: 12, per_item_unit: 'oz' });
  });

  it('passes non-objects through unchanged', () => {
    expect(renormalizeRawUnits(null)).toBeNull();
    expect(renormalizeRawUnits('x')).toBe('x');
  });
});

describe('normalizeTagReading', () => {
  it('returns a TagReading that satisfies tagReadingSchema', () => {
    const out = normalizeTagReading(recordTagInputSchema.parse(validInput()));
    expect(tagReadingSchema.safeParse(out).success).toBe(true);
    expect(out.promo).toEqual({ type: 'none', text: null, n: null, m: null });
  });

  it('fills missing promo n/m with null', () => {
    const input = validInput();
    input.promo = { type: 'other', text: '행사' };
    expect(normalizeTagReading(input).promo).toEqual({
      type: 'other',
      text: '행사',
      n: null,
      m: null,
    });
  });

  it('drops an incomplete printed unit price instead of guessing', () => {
    const input = validInput();
    input.tag_unit_price = { price: 384, per_unit: 'ml' };
    expect(normalizeTagReading(input).tag_unit_price).toBeNull();
  });

  it('drops a non-positive unit price basis', () => {
    const input = validInput();
    input.tag_unit_price = { price: 384, per_amount: 0, per_unit: 'ml' };
    expect(normalizeTagReading(input).tag_unit_price).toBeNull();
  });

  it('trims strings and turns blank strings into null', () => {
    const input = validInput();
    input.brand = '  다우니 ';
    input.variant = '   ';
    input.notes = '';
    const out = normalizeTagReading(input);
    expect(out.brand).toBe('다우니');
    expect(out.variant).toBeNull();
    expect(out.notes).toBeNull();
  });
});

describe('parseRecordTag', () => {
  it('re-normalizes units, validates and normalizes in one step', () => {
    const res = parseRecordTag({ ...validInput(), per_item_amount: 2.6, per_item_unit: 'L' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.reading.per_item_amount).toBe(2600);
      expect(res.reading.per_item_unit).toBe('ml');
    }
  });

  it('returns a readable error for the retry prompt on invalid input', () => {
    const res = parseRecordTag({ ...validInput(), store_price: '9,980원' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain('store_price');
  });

  it('rejects non-objects', () => {
    expect(parseRecordTag(undefined).ok).toBe(false);
  });
});

describe('isUnreadableTag (7.3 → 422)', () => {
  const reading = (): TagReading => normalizeTagReading(validInput());
  it('is false for a normal shelf tag or package', () => {
    expect(isUnreadableTag(reading())).toBe(false);
    expect(
      isUnreadableTag({ ...reading(), image_kind: 'product_package', store_price: null }),
    ).toBe(false);
  });
  it('is true for receipts and other photos', () => {
    expect(isUnreadableTag({ ...reading(), image_kind: 'receipt' })).toBe(true);
    expect(isUnreadableTag({ ...reading(), image_kind: 'other' })).toBe(true);
  });
  it('is true when both store_price and product_name are null', () => {
    expect(isUnreadableTag({ ...reading(), store_price: null, product_name: null })).toBe(true);
    expect(isUnreadableTag({ ...reading(), store_price: null })).toBe(false);
    expect(isUnreadableTag({ ...reading(), product_name: null })).toBe(false);
  });
});

describe('checkTagUnitPrice (S2 cross-check, 5% tolerance)', () => {
  const tag = { price: 400, per_amount: 100, per_unit: 'ml' as const };
  const size = { perItemAmount: 1000, perItemUnit: 'ml' as const, itemCount: 1 };

  it('uses a 5% tolerance', () => {
    expect(UNIT_PRICE_TOLERANCE_PCT).toBe(5);
  });

  it('is ok when the store price matches the printed unit price', () => {
    expect(checkTagUnitPrice({ ...size, storePrice: 4000 }, tag)).toEqual({ ok: true, diffPct: 0 });
  });

  it('is ok at exactly 5% (420 vs 400)', () => {
    expect(checkTagUnitPrice({ ...size, storePrice: 4200 }, tag)).toEqual({ ok: true, diffPct: 5 });
    expect(checkTagUnitPrice({ ...size, storePrice: 3800 }, tag)).toEqual({ ok: true, diffPct: 5 });
  });

  it('warns at 5.01% (420.04 vs 400)', () => {
    const big = { perItemAmount: 10000, perItemUnit: 'ml' as const, itemCount: 1 };
    expect(checkTagUnitPrice({ ...big, storePrice: 42004 }, tag)).toEqual({
      ok: false,
      diffPct: 5.01,
    });
    expect(checkTagUnitPrice({ ...big, storePrice: 37996 }, tag)).toEqual({
      ok: false,
      diffPct: 5.01,
    });
  });

  it('catches a misread count (30 rolls read as 3)', () => {
    const roll = { price: 159, per_amount: 10, per_unit: 'm' as const };
    const res = checkTagUnitPrice(
      { storePrice: 12900, perItemAmount: 27, perItemUnit: 'm', itemCount: 3 },
      roll,
    );
    expect(res?.ok).toBe(false);
    expect(
      checkTagUnitPrice(
        { storePrice: 12900, perItemAmount: 27, perItemUnit: 'm', itemCount: 30 },
        roll,
      )?.ok,
    ).toBe(true);
  });

  it('works for ea items without a per-item amount', () => {
    const ea = { price: 100, per_amount: 1, per_unit: 'ea' as const };
    expect(
      checkTagUnitPrice(
        { storePrice: 18000, perItemAmount: null, perItemUnit: 'ea', itemCount: 180 },
        ea,
      ),
    ).toEqual({ ok: true, diffPct: 0 });
  });

  it('returns null (cannot check) instead of guessing', () => {
    expect(checkTagUnitPrice({ ...size, storePrice: 4000 }, null)).toBeNull();
    expect(checkTagUnitPrice({ ...size, storePrice: null }, tag)).toBeNull();
    expect(checkTagUnitPrice({ ...size, storePrice: 4000.5 }, tag)).toBeNull();
    expect(checkTagUnitPrice({ ...size, perItemUnit: 'g', storePrice: 4000 }, tag)).toBeNull();
    expect(checkTagUnitPrice({ ...size, perItemUnit: null, storePrice: 4000 }, tag)).toBeNull();
    expect(checkTagUnitPrice({ ...size, itemCount: null, storePrice: 4000 }, tag)).toBeNull();
    expect(checkTagUnitPrice({ ...size, perItemAmount: null, storePrice: 4000 }, tag)).toBeNull();
    expect(checkTagUnitPrice({ ...size, storePrice: 4000 }, { ...tag, price: 0 })).toBeNull();
  });
});

describe('deriveTagValues (7.3 derived values)', () => {
  it('computes total amount, store unit price and the cross-check', () => {
    const r = normalizeTagReading(validInput());
    expect(deriveTagValues(r)).toEqual({
      totalAmount: 2600,
      storeUnitPrice: 384,
      unitPriceCheck: { ok: true, diffPct: 0.04 },
    });
  });

  it('multiplies by item count', () => {
    const r: TagReading = {
      ...normalizeTagReading(validInput()),
      per_item_amount: 27,
      per_item_unit: 'm',
      item_count: 30,
      store_price: 12900,
      tag_unit_price: null,
    };
    expect(deriveTagValues(r)).toEqual({
      totalAmount: 810,
      storeUnitPrice: 159,
      unitPriceCheck: null,
    });
  });

  it('leaves everything null when size or price is unreadable', () => {
    const r: TagReading = {
      ...normalizeTagReading(validInput()),
      per_item_unit: null,
      store_price: null,
    };
    expect(deriveTagValues(r)).toEqual({
      totalAmount: null,
      storeUnitPrice: null,
      unitPriceCheck: null,
    });
  });
});

describe('confidence helpers', () => {
  it('flags values below 0.7 only', () => {
    expect(LOW_CONFIDENCE_THRESHOLD).toBe(0.7);
    expect(isLowConfidence(0.69)).toBe(true);
    expect(isLowConfidence(0.7)).toBe(false);
    expect(isLowConfidence(1)).toBe(false);
  });
});

describe('toPromo', () => {
  it('maps n_plus_m with counts and drops null counts', () => {
    expect(toPromo({ type: 'n_plus_m', text: '1+1', n: 1, m: 1 })).toEqual({
      type: 'n_plus_m',
      text: '1+1',
      n: 1,
      m: 1,
    });
    expect(toPromo({ type: 'none', text: null, n: null, m: null })).toEqual({
      type: 'none',
      text: null,
    });
  });
});
