// S2 confirm card state logic (pure, no React, no network).
// Form values are the raw input strings; parsing never guesses — an unparseable value is an error.
import {
  checkTagUnitPrice,
  isLowConfidence,
  type TagConfidence,
  type TagImageKind,
  type TagPromoType,
  type TagReading,
  type UnitPriceCheck,
} from '../../../shared/tag.js';
import type { Promo, TargetSpec, Unit } from '../../../shared/types.js';
import { normalizeText } from '../../../shared/text.js';
import { formatWon } from '../../../shared/units.js';

export const FIELDS = [
  'brand',
  'productName',
  'variant',
  'perItemAmount',
  'perItemUnit',
  'itemCount',
  'storePrice',
  'promoType',
  'promoText',
  'promoN',
  'promoM',
] as const;
export type FieldName = (typeof FIELDS)[number];

export const SPEC_FIELDS = [
  'brand',
  'productName',
  'variant',
  'perItemAmount',
  'perItemUnit',
  'itemCount',
] as const satisfies readonly FieldName[];
export type SpecField = (typeof SPEC_FIELDS)[number];

export interface ConfirmForm {
  brand: string;
  productName: string;
  variant: string;
  perItemAmount: string;
  perItemUnit: Unit | '';
  itemCount: string;
  storePrice: string;
  promoType: TagPromoType;
  promoText: string;
  promoN: string;
  promoM: string;
}

export const EMPTY_FORM: Readonly<ConfirmForm> = Object.freeze({
  brand: '',
  productName: '',
  variant: '',
  perItemAmount: '',
  perItemUnit: '',
  itemCount: '',
  storePrice: '',
  promoType: 'none',
  promoText: '',
  promoN: '',
  promoM: '',
});

// ---------------------------------------------------------------------------
// parsing (strings → numbers). null = empty or not a valid number.
// ---------------------------------------------------------------------------

const stripNumber = (s: string): string => s.replace(/[\s,]/g, '');

/** Integer won > 0. Accepts "9,980" and a trailing "원". Decimals are rejected, not rounded. */
export function parseWonInput(s: string): number | null {
  const t = stripNumber(s).replace(/원$/, '');
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Positive amount, decimals allowed ("2.6"). */
export function parseAmountInput(s: string): number | null {
  const t = stripNumber(s);
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Positive integer count. */
export function parseCountInput(s: string): number | null {
  const t = stripNumber(s);
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

// ---------------------------------------------------------------------------
// reading → form
// ---------------------------------------------------------------------------

const text = (v: string | null): string => v ?? '';
const num = (v: number | null): string => (v === null ? '' : String(v));

/** Fills only what the tag reading has; unread values stay empty (shown as "미확인"). */
export function formFromReading(r: TagReading): ConfirmForm {
  return {
    brand: text(r.brand),
    productName: text(r.product_name),
    variant: text(r.variant),
    perItemAmount: num(r.per_item_amount),
    perItemUnit: r.per_item_unit ?? '',
    itemCount: num(r.item_count),
    storePrice: r.store_price === null ? '' : formatWon(r.store_price),
    promoType: r.promo.type,
    promoText: text(r.promo.text),
    promoN: num(r.promo.n),
    promoM: num(r.promo.m),
  };
}

/** S2: a package photo opens the store-price field first (numeric keypad). */
export function fieldOrder(imageKind: TagImageKind | null): readonly FieldName[] {
  if (imageKind !== 'product_package') return FIELDS;
  return ['storePrice', ...FIELDS.filter((f) => f !== 'storePrice')];
}

// ---------------------------------------------------------------------------
// validation
// ---------------------------------------------------------------------------

export type FieldError = 'required' | 'invalid';
export type FieldErrors = Partial<Record<FieldName, FieldError>>;

export interface ConfirmedValues {
  target: TargetSpec;
  storePrice: number;
  promo: Promo;
}

export interface ValidationResult {
  errors: FieldErrors;
  /** null while any field has an error. */
  value: ConfirmedValues | null;
}

function checkNumber(
  raw: string,
  parse: (s: string) => number | null,
  required: boolean,
): { error: FieldError | null; value: number | null } {
  if (raw.trim() === '') return { error: required ? 'required' : null, value: null };
  const value = parse(raw);
  return value === null ? { error: 'invalid', value: null } : { error: null, value };
}

/**
 * S2 required: brand, product name, size+unit (size may be empty when unit is 'ea'),
 * count, store price. Promo is optional; its N/M only count for the n_plus_m type.
 */
export function validateForm(form: ConfirmForm): ValidationResult {
  const errors: FieldErrors = {};
  const brand = form.brand.trim();
  const productName = form.productName.trim();
  if (!brand) errors.brand = 'required';
  if (!productName) errors.productName = 'required';
  if (form.perItemUnit === '') errors.perItemUnit = 'required';

  const amount = checkNumber(form.perItemAmount, parseAmountInput, form.perItemUnit !== 'ea');
  if (amount.error) errors.perItemAmount = amount.error;
  const count = checkNumber(form.itemCount, parseCountInput, true);
  if (count.error) errors.itemCount = count.error;
  const price = checkNumber(form.storePrice, parseWonInput, true);
  if (price.error) errors.storePrice = price.error;

  const isNPlusM = form.promoType === 'n_plus_m';
  const promoN = checkNumber(isNPlusM ? form.promoN : '', parseCountInput, false);
  if (promoN.error) errors.promoN = promoN.error;
  const promoM = checkNumber(isNPlusM ? form.promoM : '', parseCountInput, false);
  if (promoM.error) errors.promoM = promoM.error;

  if (Object.keys(errors).length > 0 || form.perItemUnit === '') return { errors, value: null };
  if (count.value === null || price.value === null) return { errors, value: null };

  const promo: Promo = { type: form.promoType, text: form.promoText.trim() || null };
  if (promoN.value !== null) promo.n = promoN.value;
  if (promoM.value !== null) promo.m = promoM.value;

  return {
    errors,
    value: {
      target: {
        brand,
        productName,
        variant: form.variant.trim() || null,
        perItemAmount: amount.value,
        perItemUnit: form.perItemUnit,
        itemCount: count.value,
      },
      storePrice: price.value,
      promo,
    },
  };
}

/** The field to focus after a failed submit, in on-screen order. */
export function firstInvalidField(
  errors: FieldErrors,
  order: readonly FieldName[] = FIELDS,
): FieldName | null {
  return order.find((f) => errors[f] !== undefined) ?? null;
}

// ---------------------------------------------------------------------------
// low confidence ("확인해 주세요")
// ---------------------------------------------------------------------------

const CONFIDENCE_GROUP: Readonly<Record<FieldName, keyof TagConfidence | null>> = {
  brand: 'product',
  productName: 'product',
  variant: 'product',
  perItemAmount: 'size',
  perItemUnit: 'size',
  itemCount: 'size',
  storePrice: 'price',
  promoType: null,
  promoText: null,
  promoN: null,
  promoM: null,
};

/**
 * Fields whose confidence group is below 0.7. A verified barcode match replaces the
 * product and size values with checked ones, so only the price can stay flagged then.
 */
export function lowConfidenceFields(
  reading: TagReading | null,
  opts: { verifiedSpec?: boolean } = {},
): ReadonlySet<FieldName> {
  const out = new Set<FieldName>();
  if (!reading) return out;
  for (const field of FIELDS) {
    const group = CONFIDENCE_GROUP[field];
    if (group === null) continue;
    if (opts.verifiedSpec && group !== 'price') continue;
    if (isLowConfidence(reading.confidence[group])) out.add(field);
  }
  return out;
}

/** Show the marker while a low-confidence field still holds the value as read. */
export function needsCheck(
  field: FieldName,
  form: ConfirmForm,
  baseline: ConfirmForm,
  low: ReadonlySet<FieldName>,
): boolean {
  return low.has(field) && normalizedValue(field, form) === normalizedValue(field, baseline);
}

// ---------------------------------------------------------------------------
// corrections (original → edited), rows for the `corrections` table
// ---------------------------------------------------------------------------

export const CORRECTION_FIELD: Readonly<Record<FieldName, string>> = {
  brand: 'brand',
  productName: 'product_name',
  variant: 'variant',
  perItemAmount: 'per_item_amount',
  perItemUnit: 'per_item_unit',
  itemCount: 'item_count',
  storePrice: 'store_price',
  promoType: 'promo.type',
  promoText: 'promo.text',
  promoN: 'promo.n',
  promoM: 'promo.m',
};

const PARSERS: Partial<Record<FieldName, (s: string) => number | null>> = {
  perItemAmount: parseAmountInput,
  itemCount: parseCountInput,
  storePrice: parseWonInput,
  promoN: parseCountInput,
  promoM: parseCountInput,
};

/** Comparable value: trimmed text or null; numbers in canonical form ("9,980" → "9980"). */
export function normalizedValue(field: FieldName, form: ConfirmForm): string | null {
  const raw = form[field].trim();
  if (raw === '') return null;
  const parse = PARSERS[field];
  if (!parse) return raw;
  const n = parse(raw);
  return n === null ? raw : String(n);
}

export interface CorrectionRow {
  field: string;
  from_value: string | null;
  to_value: string | null;
}

export function diffCorrections(original: ConfirmForm, edited: ConfirmForm): CorrectionRow[] {
  const rows: CorrectionRow[] = [];
  for (const field of FIELDS) {
    const from = normalizedValue(field, original);
    const to = normalizedValue(field, edited);
    if (from !== to) rows.push({ field: CORRECTION_FIELD[field], from_value: from, to_value: to });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// curated products (verified barcode fill / "혹시 이 상품?" chips)
// ---------------------------------------------------------------------------

export interface CuratedProduct {
  id: string;
  barcode: string | null;
  brand: string;
  name: string;
  variant: string | null;
  perItemAmount: number | null;
  perItemUnit: Unit;
  itemCount: number;
}

export function productFields(p: CuratedProduct): Pick<ConfirmForm, SpecField> {
  return {
    brand: p.brand,
    productName: p.name,
    variant: p.variant ?? '',
    perItemAmount: num(p.perItemAmount),
    perItemUnit: p.perItemUnit,
    itemCount: String(p.itemCount),
  };
}

export interface FormWithBaseline {
  form: ConfirmForm;
  baseline: ConfirmForm;
}

/** Read size within this fraction of the product's size counts as the same (7.4 uses 1%). */
const SIZE_AGREE_TOLERANCE = 0.01;

/**
 * A text field as read vs the product's: unread → nothing to contradict; otherwise equal or one
 * contains the other after normalizeText ("P&G 다우니" vs "다우니"). Read but missing on the
 * product counts as a contradiction.
 */
function sameText(read: string | null, product: string | null): boolean {
  const a = normalizeText(read);
  const b = normalizeText(product);
  if (a === null) return true;
  if (b === null) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function sameSize(r: TagReading, p: CuratedProduct): boolean {
  if (r.per_item_unit !== null && r.per_item_unit !== p.perItemUnit) return false;
  if (r.per_item_amount !== null) {
    if (p.perItemAmount === null) return false;
    const diff = Math.abs(r.per_item_amount - p.perItemAmount);
    if (diff > p.perItemAmount * SIZE_AGREE_TOLERANCE + 1e-9) return false;
  }
  return r.item_count === null || r.item_count === p.itemCount;
}

/**
 * Whether a barcode match may be shown as "확인된 상품" and fill the card (P1/P2).
 * The barcode is decoded anywhere in the photo and can belong to a neighbouring tag — on a shelf
 * usually the same brand and size in another scent — so it only counts when the reading backs it
 * up: a single tag in view, a confident product reading, and the brand, product name, variant and
 * size as read are each either unread or the same as the product's. Otherwise the product is only
 * a "혹시 이 상품?" chip and the values as read (with their markers) stay.
 */
export function barcodeMatchAgrees(reading: TagReading | null, product: CuratedProduct): boolean {
  if (!reading || reading.multiple_tags_visible) return false;
  if (isLowConfidence(reading.confidence.product)) return false;
  return (
    sameText(reading.brand, product.brand) &&
    sameText(reading.product_name, product.name) &&
    sameText(reading.variant, product.variant) &&
    sameSize(reading, product)
  );
}

/**
 * Automatic fill from a verified barcode match (only after barcodeMatchAgrees). Only fields the user has not edited are
 * replaced, and the baseline moves with them (a system fill is not a user correction).
 */
export function applyVerifiedFill(
  { form, baseline }: FormWithBaseline,
  product: CuratedProduct,
): FormWithBaseline {
  const fill = productFields(product);
  const nextForm = { ...form };
  const nextBaseline = { ...baseline };
  for (const field of SPEC_FIELDS) {
    if (normalizedValue(field, form) !== normalizedValue(field, baseline)) continue;
    Object.assign(nextForm, { [field]: fill[field] });
    Object.assign(nextBaseline, { [field]: fill[field] });
  }
  return { form: nextForm, baseline: nextBaseline };
}

/** The user tapped a "혹시 이 상품?" chip: overwrite the spec fields (a user correction). */
export function applyProductChoice(form: ConfirmForm, product: CuratedProduct): ConfirmForm {
  return { ...form, ...productFields(product) };
}

/** False once any spec field differs from the product — then the product id is not used (P2). */
export function matchesProduct(form: ConfirmForm, product: CuratedProduct): boolean {
  const fill = { ...form, ...productFields(product) };
  return SPEC_FIELDS.every((f) => normalizedValue(f, form) === normalizedValue(f, fill));
}

// ---------------------------------------------------------------------------
// printed unit-price cross-check on the current form values
// ---------------------------------------------------------------------------

/** Non-null only when the check can run AND fails (>5% apart) — then warn on size and count. */
export function unitPriceWarning(
  form: ConfirmForm,
  reading: TagReading | null,
): UnitPriceCheck | null {
  if (!reading) return null;
  const check = checkTagUnitPrice(
    {
      storePrice: parseWonInput(form.storePrice),
      perItemAmount: parseAmountInput(form.perItemAmount),
      perItemUnit: form.perItemUnit === '' ? null : form.perItemUnit,
      itemCount: parseCountInput(form.itemCount),
    },
    reading.tag_unit_price,
  );
  return check && !check.ok ? check : null;
}
