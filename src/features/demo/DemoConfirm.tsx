import { formatWon } from '../../../shared/units.js';
import { useCopy } from '../../lib/language';
import { ConfirmField, fieldIds, inputClass, type FieldStatus } from '../confirm/ConfirmField';
import type { DemoField, DemoScenario } from './fixtures';

const OK: FieldStatus = { check: false };

/**
 * S2 confirm card, filled from the fixture and read-only. One field carries the low-confidence
 * marker (pink border + "Please check" badge, never colour alone). Butter band = the confirm screen.
 */
export function DemoConfirm({ scenario }: { scenario: DemoScenario }) {
  const { t } = useCopy();
  const { target, storePrice, promo, lowConfidence } = scenario;
  const status = (f: DemoField): FieldStatus => (f === lowConfidence ? { check: true } : OK);

  const field = (
    f: DemoField | 'perItemUnit' | 'promoType',
    label: string,
    value: string,
    opts: { optional?: boolean; numeric?: boolean } = {},
  ) => {
    const id = `demo-${f}`;
    const s = f === 'perItemUnit' || f === 'promoType' ? OK : status(f);
    const cls = inputClass(s);
    return (
      <ConfirmField id={id} label={label} optional={opts.optional} status={s}>
        <input
          type="text"
          readOnly
          value={value}
          placeholder={t.confirm.unread}
          {...fieldIds(id, s)}
          className={opts.numeric ? `${cls} tabular-nums` : cls}
        />
      </ConfirmField>
    );
  };

  const f = t.confirm.fields;
  return (
    <div
      className="overflow-hidden rounded-lg border-2 border-ink bg-receipt"
      data-testid="demo-confirm"
    >
      <p className="border-b-2 border-ink bg-butter px-4 py-3 text-[22px] font-extrabold">
        {t.confirm.title}
      </p>
      <div className="flex flex-col gap-5 px-4 py-5">
        {field('brand', f.brand, target.brand)}
        {field('productName', f.productName, target.productName)}
        {field('variant', f.variant, target.variant ?? '', { optional: true })}
        <div className="grid grid-cols-[1fr_7rem] items-start gap-3">
          {field('perItemAmount', f.perItemAmount, target.perItemAmount?.toString() ?? '', {
            numeric: true,
            optional: target.perItemUnit === 'ea',
          })}
          {field('perItemUnit', f.perItemUnit, t.confirm.units[target.perItemUnit])}
        </div>
        {field('itemCount', f.itemCount, String(target.itemCount), { numeric: true })}
        {field('storePrice', f.storePrice, formatWon(storePrice), { numeric: true })}
        {field('promoType', f.promoType, t.confirm.promoTypes[promo.type], { optional: true })}
        <p className="text-[13px] text-muted">{t.demo.readOnly}</p>
      </div>
    </div>
  );
}
