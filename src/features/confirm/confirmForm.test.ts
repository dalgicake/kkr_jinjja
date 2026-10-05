import { describe, expect, it } from 'vitest';
import type { TagReading } from '../../../shared/tag.js';
import {
  EMPTY_FORM,
  applyProductChoice,
  applyVerifiedFill,
  barcodeMatchAgrees,
  diffCorrections,
  fieldOrder,
  firstInvalidField,
  formFromReading,
  lowConfidenceFields,
  matchesProduct,
  needsCheck,
  normalizedValue,
  parseAmountInput,
  parseCountInput,
  parseWonInput,
  unitPriceWarning,
  validateForm,
  type ConfirmForm,
  type CuratedProduct,
} from './confirmForm';

function reading(overrides: Partial<TagReading> = {}): TagReading {
  return {
    image_kind: 'shelf_tag',
    product_name_raw: '다우니 실내건조 2.6L',
    brand: '다우니',
    product_name: '섬유유연제 실내건조',
    variant: '실내건조',
    per_item_amount: 2600,
    per_item_unit: 'ml',
    item_count: 1,
    store_price: 9980,
    regular_price: null,
    promo: { type: 'none', text: null, n: null, m: null },
    tag_unit_price: { price: 384, per_amount: 100, per_unit: 'ml' },
    barcode_digits: null,
    multiple_tags_visible: false,
    confidence: { product: 0.95, size: 0.9, price: 0.98 },
    notes: null,
    ...overrides,
  };
}

const filled: ConfirmForm = formFromReading(reading());

const downy: CuratedProduct = {
  id: 'p1',
  barcode: '8801234567893',
  brand: '다우니',
  name: '섬유유연제 실내건조',
  variant: '실내건조',
  perItemAmount: 2600,
  perItemUnit: 'ml',
  itemCount: 1,
};

describe('number parsing never guesses', () => {
  it('won: integers only, commas and 원 allowed', () => {
    expect(parseWonInput('9,980')).toBe(9980);
    expect(parseWonInput(' 9980원 ')).toBe(9980);
    expect(parseWonInput('9980.5')).toBeNull();
    expect(parseWonInput('0')).toBeNull();
    expect(parseWonInput('-100')).toBeNull();
    expect(parseWonInput('약 1만')).toBeNull();
    expect(parseWonInput('')).toBeNull();
  });
  it('amount: positive decimals allowed', () => {
    expect(parseAmountInput('2.6')).toBe(2.6);
    expect(parseAmountInput('1,000')).toBe(1000);
    expect(parseAmountInput('0')).toBeNull();
    expect(parseAmountInput('2.6L')).toBeNull();
  });
  it('count: positive integers only', () => {
    expect(parseCountInput('30')).toBe(30);
    expect(parseCountInput('1.5')).toBeNull();
    expect(parseCountInput('0')).toBeNull();
  });
});

describe('formFromReading', () => {
  it('fills read values and formats the price', () => {
    expect(filled).toMatchObject({
      brand: '다우니',
      productName: '섬유유연제 실내건조',
      perItemAmount: '2600',
      perItemUnit: 'ml',
      itemCount: '1',
      storePrice: '9,980',
      promoType: 'none',
    });
  });
  it('leaves unread values empty (shown as 미확인), never invented', () => {
    const f = formFromReading(
      reading({ brand: null, store_price: null, per_item_unit: null, per_item_amount: null }),
    );
    expect(f.brand).toBe('');
    expect(f.storePrice).toBe('');
    expect(f.perItemUnit).toBe('');
    expect(f.perItemAmount).toBe('');
  });
  it('keeps promo n/m', () => {
    const f = formFromReading(reading({ promo: { type: 'n_plus_m', text: '1+1', n: 1, m: 1 } }));
    expect([f.promoType, f.promoText, f.promoN, f.promoM]).toEqual(['n_plus_m', '1+1', '1', '1']);
  });
});

describe('validateForm', () => {
  it('a complete reading validates into a TargetSpec and integer price', () => {
    const r = validateForm(filled);
    expect(r.errors).toEqual({});
    expect(r.value).toEqual({
      target: {
        brand: '다우니',
        productName: '섬유유연제 실내건조',
        variant: '실내건조',
        perItemAmount: 2600,
        perItemUnit: 'ml',
        itemCount: 1,
      },
      storePrice: 9980,
      promo: { type: 'none', text: null },
    });
  });
  it('empty form: every required field is flagged, optional ones are not', () => {
    const r = validateForm(EMPTY_FORM);
    expect(r.value).toBeNull();
    expect(r.errors).toEqual({
      brand: 'required',
      productName: 'required',
      perItemAmount: 'required',
      perItemUnit: 'required',
      itemCount: 'required',
      storePrice: 'required',
    });
  });
  it("size may be empty only when the unit is 'ea'", () => {
    const ea = validateForm({ ...filled, perItemAmount: '', perItemUnit: 'ea', itemCount: '180' });
    expect(ea.errors).toEqual({});
    expect(ea.value?.target.perItemAmount).toBeNull();
    expect(validateForm({ ...filled, perItemAmount: '' }).errors).toEqual({
      perItemAmount: 'required',
    });
  });
  it('whitespace-only text counts as empty', () => {
    expect(validateForm({ ...filled, brand: '   ' }).errors).toEqual({ brand: 'required' });
  });
  it('unparseable numbers are invalid, not rounded', () => {
    expect(validateForm({ ...filled, storePrice: '9980.5', itemCount: 'two' }).errors).toEqual({
      itemCount: 'invalid',
      storePrice: 'invalid',
    });
  });
  it('promo n/m are optional and only checked for n_plus_m', () => {
    const plus = validateForm({
      ...filled,
      promoType: 'n_plus_m',
      promoText: '2+1',
      promoN: '2',
      promoM: '1',
    });
    expect(plus.value?.promo).toEqual({ type: 'n_plus_m', text: '2+1', n: 2, m: 1 });
    expect(validateForm({ ...filled, promoType: 'n_plus_m', promoN: 'x' }).errors).toEqual({
      promoN: 'invalid',
    });
    const card = validateForm({ ...filled, promoType: 'card_discount', promoN: 'x' });
    expect(card.errors).toEqual({});
    expect(card.value?.promo).toEqual({ type: 'card_discount', text: null });
  });
});

describe('focus order', () => {
  it('first invalid field follows screen order', () => {
    const { errors } = validateForm({ ...filled, storePrice: '', brand: '' });
    expect(firstInvalidField(errors)).toBe('brand');
    expect(firstInvalidField({})).toBeNull();
  });
  it('package photos put the store price first', () => {
    const order = fieldOrder('product_package');
    expect(order[0]).toBe('storePrice');
    expect(fieldOrder('shelf_tag')[0]).toBe('brand');
    const { errors } = validateForm({ ...filled, storePrice: '', brand: '' });
    expect(firstInvalidField(errors, order)).toBe('storePrice');
  });
});

describe('low confidence (< 0.7)', () => {
  it('maps product/size/price confidence to their fields', () => {
    const low = lowConfidenceFields(
      reading({ confidence: { product: 0.69, size: 0.7, price: 0.2 } }),
    );
    expect([...low].sort()).toEqual(['brand', 'productName', 'storePrice', 'variant']);
  });
  it('exactly 0.7 is not low', () => {
    expect(
      lowConfidenceFields(reading({ confidence: { product: 0.7, size: 0.7, price: 0.7 } })).size,
    ).toBe(0);
  });
  it('manual entry has no markers', () => {
    expect(lowConfidenceFields(null).size).toBe(0);
  });
  it('a verified barcode fill clears product and size markers but keeps price', () => {
    const r = reading({ confidence: { product: 0.1, size: 0.1, price: 0.1 } });
    expect([...lowConfidenceFields(r, { verifiedSpec: true })]).toEqual(['storePrice']);
  });
  it('the marker stays until the user changes the value', () => {
    const low = lowConfidenceFields(reading({ confidence: { product: 1, size: 1, price: 0.5 } }));
    expect(needsCheck('storePrice', filled, filled, low)).toBe(true);
    expect(needsCheck('storePrice', { ...filled, storePrice: '9980' }, filled, low)).toBe(true);
    expect(needsCheck('storePrice', { ...filled, storePrice: '8980' }, filled, low)).toBe(false);
    expect(needsCheck('brand', filled, filled, low)).toBe(false);
  });
});

describe('corrections diff', () => {
  it('records only changed fields as original → edited with DB field names', () => {
    const edited = { ...filled, storePrice: '8,980', variant: '', itemCount: '2' };
    expect(diffCorrections(filled, edited)).toEqual([
      { field: 'variant', from_value: '실내건조', to_value: null },
      { field: 'item_count', from_value: '1', to_value: '2' },
      { field: 'store_price', from_value: '9980', to_value: '8980' },
    ]);
  });
  it('formatting-only changes are not corrections', () => {
    expect(diffCorrections(filled, { ...filled, storePrice: '9980원', brand: ' 다우니 ' })).toEqual(
      [],
    );
  });
  it('filling an unread value is recorded with from_value null', () => {
    const original = formFromReading(reading({ store_price: null }));
    expect(diffCorrections(original, { ...original, storePrice: '9980' })).toEqual([
      { field: 'store_price', from_value: null, to_value: '9980' },
    ]);
  });
  it('normalizedValue keeps unparseable input as typed', () => {
    expect(normalizedValue('storePrice', { ...filled, storePrice: '9,98o' })).toBe('9,98o');
  });
});

describe('curated products', () => {
  const misread = formFromReading(
    reading({
      per_item_amount: 260,
      brand: '다우나',
      confidence: { product: 0.4, size: 0.4, price: 0.9 },
    }),
  );
  // what the tag left unread (brand, size) — nothing here contradicts the barcode product
  const partial = formFromReading(
    reading({ brand: null, per_item_amount: null, product_name: '실내건조' }),
  );
  it('a verified fill replaces untouched spec fields and moves the baseline', () => {
    const out = applyVerifiedFill({ form: partial, baseline: partial }, downy);
    expect(out.form.brand).toBe('다우니');
    expect(out.form.productName).toBe('섬유유연제 실내건조');
    expect(out.form.perItemAmount).toBe('2600');
    expect(out.form.storePrice).toBe(partial.storePrice);
    expect(diffCorrections(out.baseline, out.form)).toEqual([]);
  });
  it('a verified fill never overwrites a field the user already edited', () => {
    const edited = { ...partial, itemCount: '3' };
    const out = applyVerifiedFill({ form: edited, baseline: partial }, downy);
    expect(out.form.itemCount).toBe('3');
    expect(out.form.brand).toBe('다우니');
    expect(diffCorrections(out.baseline, out.form)).toEqual([
      { field: 'item_count', from_value: '1', to_value: '3' },
    ]);
  });
  it('choosing a suggestion is a user correction', () => {
    const chosen = applyProductChoice(misread, downy);
    expect(diffCorrections(misread, chosen).map((r) => r.field)).toEqual([
      'brand',
      'per_item_amount',
    ]);
  });
  it('the product stops matching once a spec field differs', () => {
    const chosen = applyProductChoice(misread, downy);
    expect(matchesProduct(chosen, downy)).toBe(true);
    expect(matchesProduct({ ...chosen, storePrice: '1' }, downy)).toBe(true);
    expect(matchesProduct({ ...chosen, itemCount: '2' }, downy)).toBe(false);
    expect(matchesProduct({ ...chosen, variant: '' }, downy)).toBe(false);
  });
});

describe('barcode match vs what was read (P1/P2)', () => {
  it('agrees when brand and size match or were not read', () => {
    expect(barcodeMatchAgrees(reading(), downy)).toBe(true);
    expect(barcodeMatchAgrees(reading({ brand: ' P&G 다우니 ' }), downy)).toBe(true);
    expect(barcodeMatchAgrees(reading({ per_item_amount: 2610 }), downy)).toBe(true); // within 1%
    expect(
      barcodeMatchAgrees(
        reading({ brand: null, per_item_amount: null, per_item_unit: null, item_count: null }),
        downy,
      ),
    ).toBe(true);
  });
  it('a barcode that contradicts the reading is not a verified product', () => {
    // a neighbouring tag's barcode: high-confidence reading of another product
    expect(barcodeMatchAgrees(reading({ brand: '피죤' }), downy)).toBe(false);
    expect(barcodeMatchAgrees(reading({ per_item_amount: 1000 }), downy)).toBe(false);
    expect(barcodeMatchAgrees(reading({ per_item_unit: 'g' }), downy)).toBe(false);
    expect(barcodeMatchAgrees(reading({ item_count: 2 }), downy)).toBe(false);
    // even a likely misread is not silently replaced — the user can tap the chip
    expect(barcodeMatchAgrees(reading({ brand: '다우나' }), downy)).toBe(false);
  });
  it('a neighbouring tag of the same brand and size in another scent is not verified', () => {
    // read: 다우니 라벤더 2600ml x1 (low product confidence); barcode product: 다우니 실내건조 2600ml x1
    const lavender = reading({
      product_name_raw: '다우니 라벤더 2.6L',
      product_name: '섬유유연제 라벤더',
      variant: '라벤더',
      confidence: { product: 0.5, size: 0.9, price: 0.98 },
    });
    expect(barcodeMatchAgrees(lavender, downy)).toBe(false);
    // the variant alone contradicts it, even with a confident reading
    const confident = { ...lavender, confidence: { product: 0.95, size: 0.9, price: 0.98 } };
    expect(barcodeMatchAgrees(confident, downy)).toBe(false);
    expect(barcodeMatchAgrees({ ...confident, product_name: null }, downy)).toBe(false);
    // the product name alone contradicts it
    expect(
      barcodeMatchAgrees(reading({ product_name: '섬유유연제 라벤더', variant: null }), downy),
    ).toBe(false);
    // a read variant the product does not have is a contradiction too
    expect(barcodeMatchAgrees(reading(), { ...downy, variant: null })).toBe(false);
    // the values as read and their markers stay (the card offers the product as a chip instead)
    const form = formFromReading(lavender);
    expect(form.variant).toBe('라벤더');
    expect(lowConfidenceFields(lavender).has('variant')).toBe(true);
    expect(lowConfidenceFields(lavender).has('productName')).toBe(true);
  });
  it('a low product confidence never backs a barcode up', () => {
    expect(
      barcodeMatchAgrees(reading({ confidence: { product: 0.69, size: 0.9, price: 0.98 } }), downy),
    ).toBe(false);
    expect(
      barcodeMatchAgrees(reading({ confidence: { product: 0.7, size: 0.9, price: 0.98 } }), downy),
    ).toBe(true);
  });
  it('product name and variant agree when unread or one contains the other', () => {
    expect(barcodeMatchAgrees(reading({ product_name: null, variant: null }), downy)).toBe(true);
    expect(barcodeMatchAgrees(reading({ product_name: '다우니 섬유유연제 실내건조' }), downy)).toBe(
      true,
    );
    expect(
      barcodeMatchAgrees(reading({ product_name: '실내건조', variant: ' 실내 건조 ' }), downy),
    ).toBe(true);
  });
  it('several tags in the photo → never verified, whatever matches', () => {
    expect(barcodeMatchAgrees(reading({ multiple_tags_visible: true }), downy)).toBe(false);
  });
  it('no reading → nothing backs the barcode up', () => {
    expect(barcodeMatchAgrees(null, downy)).toBe(false);
  });
  it('a product without an amount only agrees with a reading without one', () => {
    const eaProduct: CuratedProduct = {
      ...downy,
      perItemAmount: null,
      perItemUnit: 'ea',
      itemCount: 4,
    };
    const ea = reading({ per_item_amount: null, per_item_unit: 'ea', item_count: 4 });
    expect(barcodeMatchAgrees(ea, eaProduct)).toBe(true);
    expect(barcodeMatchAgrees({ ...ea, per_item_amount: 3 }, eaProduct)).toBe(false);
  });
});

describe('unit-price warning (S2)', () => {
  it('no warning when the printed unit price agrees', () => {
    // 9980 / 2600ml * 100 = 383.8 vs 384
    expect(unitPriceWarning(filled, reading())).toBeNull();
  });
  it('warns when size or count make the unit price disagree by more than 5%', () => {
    const w = unitPriceWarning({ ...filled, itemCount: '2' }, reading());
    expect(w?.ok).toBe(false);
    expect(w?.diffPct).toBeGreaterThan(5);
  });
  it('is silent when it cannot check (no printed unit price, missing values, manual entry)', () => {
    expect(
      unitPriceWarning({ ...filled, itemCount: '2' }, reading({ tag_unit_price: null })),
    ).toBeNull();
    expect(unitPriceWarning({ ...filled, storePrice: '' }, reading())).toBeNull();
    expect(unitPriceWarning({ ...filled, perItemUnit: '' }, reading())).toBeNull();
    expect(unitPriceWarning({ ...filled, itemCount: '2' }, null)).toBeNull();
  });
});
