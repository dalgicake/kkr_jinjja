import type { ChangeEvent } from 'react';
import { useNavigate } from 'react-router';
import { buttonClass } from '../../components/common/Button';
import { readStoreChoice, storeNameForApi } from '../../components/common/storeChoice';
import { preloadBarcodeDetector } from '../../lib/barcode';
import { useCopy } from '../../lib/language';
import { browserScanDeps } from '../capture/browserScanDeps';
import { scanStore } from '../capture/scanSession';

/**
 * S0 [Find by barcode]: opens the phone camera for a photo of the barcode. The photo scan already
 * decodes barcodes (S1 (a)), so this reuses it; a package photo opens the store price field first (S2).
 * Live barcode scanning (S1b) is not built.
 */
export function BarcodeButton() {
  const navigate = useNavigate();
  const { t } = useCopy();
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    void scanStore.startPhotoScan(file, browserScanDeps, storeNameForApi(readStoreChoice()));
    void navigate('/confirm');
  };
  return (
    <label className={buttonClass({ tone: 'white' })}>
      {t.home.barcode}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={onChange}
        onClick={preloadBarcodeDetector}
        data-testid="barcode-input"
      />
    </label>
  );
}
