import { useSyncExternalStore } from 'react';
import { EXAMPLE_PURCHASES } from './fixtures';
import { localDay, markBought } from './historyLogic';
import type { PurchaseRecord } from './types';

/**
 * In-memory example records shared by home and /history so 샀어요 shows the same result on both.
 * Nothing is saved: a reload brings the example rows back. Replaced by Supabase `purchases` later.
 */
let records: readonly PurchaseRecord[] = EXAMPLE_PURCHASES;
const listeners = new Set<() => void>();

export const exampleHistory = {
  get: () => records,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  markBought(id: string, pricePaid: number | null, today: string = localDay()) {
    records = records.map((r) => (r.id === id ? markBought(r, pricePaid, today) : r));
    listeners.forEach((fn) => fn());
  },
  reset() {
    records = EXAMPLE_PURCHASES;
    listeners.forEach((fn) => fn());
  },
};

export function useExampleHistory(): readonly PurchaseRecord[] {
  return useSyncExternalStore(exampleHistory.subscribe, exampleHistory.get, exampleHistory.get);
}
