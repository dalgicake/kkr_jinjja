import { useEffect, useState, type FormEvent } from 'react';
import type { TagReading } from '../../../shared/tag.js';
import { PROMO_TYPES, UNITS } from '../../../shared/tag.js';
import { CheckBadge, VerifiedBadge } from '../../components/common/Badges';
import { Button } from '../../components/common/Button';
import { StoreChips, useStoreChoice } from '../../components/common/StoreChips';
import { storeNameForApi } from '../../components/common/storeChoice';
import { fill } from '../../lib/i18n';
import { useCopy } from '../../lib/language';
import { supabase } from '../../lib/supabase';
import { scanStore, type ScanSession } from '../capture/scanSession';
import { ConfirmField, fieldIds, inputClass, type FieldStatus } from './ConfirmField';
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
  unitPriceWarning,
  validateForm,
  type ConfirmForm,
  type CuratedProduct,
  type FieldName,
} from './confirmForm';
import {
  MAX_SUGGESTIONS,
  findProductByBarcode,
  recordCorrections,
  searchProducts,
  searchQueryFromReading,
} from './curation';
import { ProductSuggestions } from './ProductSuggestions';

interface ProductPick {
  product: CuratedProduct;
  /** true = barcode match (확인된 상품); false = chosen from "혹시 이 상품?" */
  verified: boolean;
}

interface CardState {
  form: ConfirmForm;
  /** values as read (plus verified fills) — the "original" for markers and corrections */
  baseline: ConfirmForm;
  /** form as last saved, so a second submit records only new corrections */
  recorded: ConfirmForm | null;
  pick: ProductPick | null;
}

function initialState(reading: TagReading | null): CardState {
  const form = reading ? formFromReading(reading) : { ...EMPTY_FORM };
  return { form, baseline: form, recorded: null, pick: null };
}

const fieldId = (f: FieldName) => `confirm-${f}`;

/** S2 "이 상품 맞아요?" */
export function ConfirmCard({ session }: { session: ScanSession }) {
  const { t } = useCopy();
  const reading = session.reading;
  const [state, setState] = useState(() => initialState(reading));
  const [suggestions, setSuggestions] = useState<CuratedProduct[]>([]);
  /** barcode product that the reading does not back up → offered as a chip, never auto-filled */
  const [barcodeChip, setBarcodeChip] = useState<CuratedProduct | null>(null);
  const [store, setStore] = useStoreChoice();
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);

  // barcode → curated product (absent without Supabase). "확인된 상품" + verified fill only when
  // the reading agrees with it; a barcode that may be a neighbouring tag's is just a chip (P1/P2).
  useEffect(() => {
    const barcode = session.barcode;
    if (!barcode) return;
    let alive = true;
    void findProductByBarcode(supabase, barcode).then((product) => {
      if (!alive || !product) return;
      if (!barcodeMatchAgrees(reading, product)) {
        setBarcodeChip(product);
        return;
      }
      setState((s) => ({
        ...s,
        ...applyVerifiedFill(s, product),
        pick: { product, verified: true },
      }));
    });
    return () => {
      alive = false;
    };
  }, [session.barcode, reading]);

  // name similarity → up to 3 "혹시 이 상품?" chips
  useEffect(() => {
    const q = searchQueryFromReading(reading);
    if (!q) return;
    let alive = true;
    void searchProducts(supabase, q).then((list) => {
      if (alive) setSuggestions(list);
    });
    return () => {
      alive = false;
    };
  }, [reading]);

  const { form, baseline } = state;
  // a product only counts while the spec still equals it (P2)
  const pick = state.pick && matchesProduct(form, state.pick.product) ? state.pick : null;
  const verified = pick?.verified ?? false;
  const low = lowConfidenceFields(reading, { verifiedSpec: verified });
  const warning = unitPriceWarning(form, reading);
  const errors = showErrors ? validateForm(form).errors : {};
  const order = fieldOrder(reading?.image_kind ?? null);
  const packageFirst = order[0] === 'storePrice';
  const unread = reading ? t.confirm.unread : undefined;
  const chips = (
    barcodeChip ? [barcodeChip, ...suggestions.filter((p) => p.id !== barcodeChip.id)] : suggestions
  ).slice(0, MAX_SUGGESTIONS);

  const status = (f: FieldName): FieldStatus => ({
    check:
      needsCheck(f, form, baseline, low) ||
      (warning !== null && (f === 'perItemAmount' || f === 'itemCount')),
    error: errors[f],
  });
  const setField = <K extends FieldName>(f: K, value: ConfirmForm[K]) =>
    setState((s) => ({ ...s, form: { ...s.form, [f]: value } }));
  const bind = (f: FieldName) => {
    const s = status(f);
    return { ...fieldIds(fieldId(f), s), className: inputClass(s) };
  };
  type TextField = Exclude<FieldName, 'perItemUnit' | 'promoType'>;
  const text = (
    f: TextField,
    extra: { inputMode?: 'numeric' | 'decimal'; autoFocus?: boolean; numeric?: boolean } = {},
  ) => {
    const b = bind(f);
    return (
      <input
        type="text"
        value={form[f]}
        onChange={(e) => setField(f, e.currentTarget.value)}
        placeholder={unread}
        inputMode={extra.inputMode}
        autoFocus={extra.autoFocus}
        autoComplete="off"
        {...b}
        className={extra.numeric ? `${b.className} tabular-nums` : b.className}
      />
    );
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const result = validateForm(form);
    if (!result.value) {
      setShowErrors(true);
      const first = firstInvalidField(result.errors, order);
      // S2: focus the first empty/invalid field (in on-screen order)
      if (first) document.getElementById(fieldId(first))?.focus();
      return;
    }
    setSaving(true);
    let recorded = state.recorded;
    if (reading) {
      const rows = diffCorrections(state.recorded ?? baseline, form);
      if (await recordCorrections(supabase, session.scanId, rows)) recorded = form;
    }
    setState((s) => ({ ...s, recorded }));
    setSaving(false);
    scanStore.confirm({
      scanId: session.scanId,
      target: result.value.target,
      storePrice: result.value.storePrice,
      promo: result.value.promo,
      productId: pick?.product.id ?? null,
      verified,
      barcode: session.barcode,
      storeName: storeNameForApi(store),
    });
  }

  const priceField = (
    <ConfirmField
      id="confirm-storePrice"
      label={t.confirm.fields.storePrice}
      status={status('storePrice')}
    >
      {text('storePrice', { inputMode: 'numeric', autoFocus: packageFirst, numeric: true })}
    </ConfirmField>
  );

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      {verified && (
        <div className="flex flex-col gap-1">
          <VerifiedBadge>{t.confirm.verified}</VerifiedBadge>
          <p className="text-[13px] text-muted">{t.confirm.verifiedSub}</p>
        </div>
      )}
      {packageFirst && <p className="text-[15px]">{t.confirm.packagePhoto}</p>}
      {reading?.multiple_tags_visible && (
        <p className="text-[13px] text-muted">{t.confirm.multipleTags}</p>
      )}
      {reading?.notes && (
        <p className="text-[13px] text-muted">{fill(t.confirm.notes, { notes: reading.notes })}</p>
      )}
      {!verified && (
        <ProductSuggestions
          products={chips}
          onPick={(p) =>
            setState((s) => ({
              ...s,
              form: applyProductChoice(s.form, p),
              pick: { product: p, verified: false },
            }))
          }
        />
      )}

      {packageFirst && priceField}

      <ConfirmField id="confirm-brand" label={t.confirm.fields.brand} status={status('brand')}>
        {text('brand')}
      </ConfirmField>
      <ConfirmField
        id="confirm-productName"
        label={t.confirm.fields.productName}
        status={status('productName')}
      >
        {text('productName')}
      </ConfirmField>
      <ConfirmField
        id="confirm-variant"
        label={t.confirm.fields.variant}
        optional
        status={status('variant')}
      >
        {text('variant')}
      </ConfirmField>

      <div className="grid grid-cols-[1fr_8rem] items-start gap-3">
        <ConfirmField
          id="confirm-perItemAmount"
          label={t.confirm.fields.perItemAmount}
          optional={form.perItemUnit === 'ea'}
          status={status('perItemAmount')}
          hint={form.perItemUnit === 'ea' ? t.confirm.eaAmountOptional : undefined}
        >
          {text('perItemAmount', { inputMode: 'decimal', numeric: true })}
        </ConfirmField>
        <ConfirmField
          id="confirm-perItemUnit"
          label={t.confirm.fields.perItemUnit}
          status={status('perItemUnit')}
        >
          <select
            value={form.perItemUnit}
            onChange={(e) =>
              setField('perItemUnit', e.currentTarget.value as ConfirmForm['perItemUnit'])
            }
            {...bind('perItemUnit')}
          >
            <option value="">{unread ?? t.confirm.unitPlaceholder}</option>
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {t.confirm.units[u]}
              </option>
            ))}
          </select>
        </ConfirmField>
      </div>
      {warning && (
        <p className="flex flex-col items-start gap-1 text-[15px]" role="status">
          <CheckBadge>{t.confirm.check}</CheckBadge>
          <span className="tabular-nums">
            {fill(t.confirm.unitPriceWarning, { pct: warning.diffPct })}
          </span>
        </p>
      )}
      <ConfirmField
        id="confirm-itemCount"
        label={t.confirm.fields.itemCount}
        status={status('itemCount')}
      >
        {text('itemCount', { inputMode: 'numeric', numeric: true })}
      </ConfirmField>

      {!packageFirst && priceField}

      <ConfirmField
        id="confirm-promoType"
        label={t.confirm.fields.promoType}
        optional
        status={status('promoType')}
      >
        <select
          value={form.promoType}
          onChange={(e) => setField('promoType', e.currentTarget.value as ConfirmForm['promoType'])}
          {...bind('promoType')}
        >
          {PROMO_TYPES.map((p) => (
            <option key={p} value={p}>
              {t.confirm.promoTypes[p]}
            </option>
          ))}
        </select>
      </ConfirmField>
      {form.promoType !== 'none' && (
        <ConfirmField
          id="confirm-promoText"
          label={t.confirm.fields.promoText}
          optional
          status={status('promoText')}
        >
          {text('promoText')}
        </ConfirmField>
      )}
      {form.promoType === 'n_plus_m' && (
        <div className="grid grid-cols-2 gap-3">
          <ConfirmField
            id="confirm-promoN"
            label={t.confirm.fields.promoN}
            optional
            status={status('promoN')}
          >
            {text('promoN', { inputMode: 'numeric', numeric: true })}
          </ConfirmField>
          <ConfirmField
            id="confirm-promoM"
            label={t.confirm.fields.promoM}
            optional
            status={status('promoM')}
          >
            {text('promoM', { inputMode: 'numeric', numeric: true })}
          </ConfirmField>
        </div>
      )}

      <StoreChips value={store} onChange={setStore} />

      <Button type="submit" size="lg" disabled={saving} className="mt-2">
        {saving ? t.confirm.saving : t.confirm.cta}
      </Button>
    </form>
  );
}
