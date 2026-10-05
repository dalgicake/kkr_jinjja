import { useSyncExternalStore } from 'react';
import { scanStore, type ScanState } from './scanSession';

export function useScanState(): ScanState {
  return useSyncExternalStore(scanStore.subscribe, scanStore.getState, scanStore.getState);
}
