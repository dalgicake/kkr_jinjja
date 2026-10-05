import type { ChangeEvent } from 'react';
import { useNavigate } from 'react-router';
import { buttonClass } from '../../components/common/Button';
import { readStoreChoice, storeNameForApi } from '../../components/common/storeChoice';
import { preloadBarcodeDetector } from '../../lib/barcode';
import { copy } from '../../lib/i18n';
import { browserScanDeps } from './browserScanDeps';
import { scanStore } from './scanSession';

// PLAN 13: a price-tag shape — one corner cut diagonally, a punch hole on the left.
const TAG_CLIP = 'polygon(0 0, calc(100% - 28px) 0, 100% 28px, 100% 100%, 0 100%)';

/**
 * S1: opens the phone's own camera (`capture="environment"`). The moment a photo is chosen is t0;
 * the scan starts right away and the confirm route shows its progress.
 */
export function CaptureButton({ variant = 'tag' }: { variant?: 'tag' | 'retake' }) {
  const navigate = useNavigate();

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.value = ''; // same photo can be chosen again
    if (!file) return;
    void scanStore.startPhotoScan(file, browserScanDeps, storeNameForApi(readStoreChoice()));
    void navigate('/confirm');
  };

  const fileInput = (
    <input
      type="file"
      accept="image/*"
      capture="environment"
      className="sr-only"
      onChange={onChange}
      // the camera takes a few seconds; load the barcode decoder meanwhile
      onClick={preloadBarcodeDetector}
      data-testid="capture-input"
    />
  );

  if (variant === 'retake') {
    return (
      <label className={buttonClass('primary')}>
        {copy.capture.retake}
        {fileInput}
      </label>
    );
  }

  return (
    <label
      className="relative flex min-h-24 w-full cursor-pointer items-center bg-ink py-6 pr-10 pl-16 text-receipt focus-within:ring-4 focus-within:ring-receipt focus-within:ring-inset"
      style={{ clipPath: TAG_CLIP }}
    >
      <span
        aria-hidden="true"
        className="absolute top-1/2 left-6 size-5 -translate-y-1/2 rounded-full bg-paper"
      />
      <span className="text-[30px] leading-tight font-extrabold">{copy.home.cta}</span>
      {fileInput}
    </label>
  );
}
