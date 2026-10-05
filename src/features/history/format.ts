import type { Copy } from '../../copy/ko';
import { storeDisplayName } from '../../components/common/StoreChips';
import { fill, monthAbbr } from '../../lib/i18n';
import { monthDay } from './historyLogic';
import type { PurchaseRecord } from './types';

/** 'YYYY-MM-DD' → "Oct 4" (en, same as /stats and /admin) / "10월 4일" (ko). */
export function dayLabel(t: Copy, isoDay: string): string {
  const { month, day } = monthDay(isoDay);
  return fill(t.history.date, { month, day, mon: monthAbbr(month) });
}

/** Where and when it was bought ("Bought at E-Mart, Oct 1"), or when the online plan was made. */
export function placeLine(t: Copy, r: PurchaseRecord): string {
  if (r.status === 'planned') return fill(t.history.plannedOn, { date: dayLabel(t, r.createdOn) });
  const date = dayLabel(t, r.purchasedOn ?? r.createdOn);
  if (r.channel === 'online') return fill(t.history.boughtOnline, { date });
  const place = storeDisplayName(t, r.storeName);
  return place
    ? fill(t.history.boughtOn, { place, date })
    : fill(t.history.boughtInStore, { date });
}

/** Next due line for confirmed rows. */
export function dueLine(t: Copy, r: PurchaseRecord): string {
  return r.nextDueOn
    ? fill(t.history.nextDue, { date: dayLabel(t, r.nextDueOn) })
    : t.history.noNextDue;
}
