import type { TargetSpec } from '../../../shared/types.js';

/**
 * View model of one `purchases` row (PLAN 5). Dates are local calendar days ('YYYY-MM-DD').
 * P5: 'planned' is not a purchase; it becomes 'confirmed' only when the user taps 샀어요.
 * P6: no online price is kept here — only what the user says they paid.
 */
export interface PurchaseRecord {
  id: string;
  productLabel: string;
  spec: TargetSpec;
  channel: 'store' | 'online';
  status: 'confirmed' | 'planned';
  /** What the user says they paid. null = not entered (shown as such, never guessed). */
  pricePaid: number | null;
  quantity: number;
  /** StoreId of a listed store, or a typed name. null for online or when not chosen. */
  storeName: string | null;
  /** Day it became confirmed. null while planned. */
  purchasedOn: string | null;
  nextDueOn: string | null;
  createdOn: string;
}
