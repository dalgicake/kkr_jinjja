import { Badge } from '../../components/common/Badges';
import { useCopy } from '../../lib/language';
import { BoughtForm } from './BoughtForm';
import { dueLine, placeLine } from './format';
import type { PurchaseRecord } from './types';

/**
 * One record line (S0 recent, S4 history). Not a boxed card: rows sit on the page, split by dotted rules.
 * Channel is a word on a fill (sky = online, butter = store); planned rows carry a lilac "Planned" tag
 * and [Bought it]. Planned rows show no price — online prices are never stored (P6).
 */
export function RecordRow({
  record: r,
  showDue = true,
  onBought,
}: {
  record: PurchaseRecord;
  showDue?: boolean;
  onBought: (id: string, pricePaid: number | null) => void;
}) {
  const { t, won } = useCopy();
  const planned = r.status === 'planned';
  return (
    <li className="flex flex-col gap-3 border-b-2 border-dotted border-ink py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={r.channel === 'online' ? 'sky' : 'butter'}>
              {r.channel === 'online' ? t.history.online : t.history.store}
            </Badge>
            {planned && <Badge tone="lilac">{t.history.plannedTag}</Badge>}
          </div>
          <p className="text-[17px] leading-snug font-bold break-keep">{r.productLabel}</p>
          <p className="text-[13px] text-muted tabular-nums">{placeLine(t, r)}</p>
          {!planned && showDue && (
            <p className="text-[13px] font-semibold tabular-nums">{dueLine(t, r)}</p>
          )}
        </div>
        {!planned &&
          (r.pricePaid === null ? (
            <p className="shrink-0 pt-1 text-right text-[13px] text-muted">
              {t.history.priceUnknown}
            </p>
          ) : (
            <p className="price shrink-0 text-right text-[22px] font-extrabold tabular-nums">
              {won(r.pricePaid)}
            </p>
          ))}
      </div>
      {planned && <BoughtForm onSave={(price) => onBought(r.id, price)} />}
    </li>
  );
}
