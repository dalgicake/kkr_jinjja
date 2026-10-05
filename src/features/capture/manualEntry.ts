import { readStoreChoice, storeNameForApi } from '../../components/common/storeChoice';
import { newScanId } from './ids';
import { scanStore } from './scanSession';

/** [직접 입력]: an empty confirm card with a fresh scan id. */
export function startManualEntry(): void {
  scanStore.startManual(() => newScanId(), storeNameForApi(readStoreChoice()));
}
