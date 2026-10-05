import type { ChangeEvent } from 'react';
import { useNavigate } from 'react-router';
import { buttonClass } from '../../components/common/Button';
import { readStoreChoice, storeNameForApi } from '../../components/common/storeChoice';
import { preloadBarcodeDetector } from '../../lib/barcode';
import { useCopy } from '../../lib/language';
import { browserScanDeps } from './browserScanDeps';
import { scanStore } from './scanSession';

// PLAN 13: a price-tag shape — one corner cut diagonally, a punch hole on the left.
// Outer ink layer + inner lime layer inset by the 3px "border" (clip-path cuts real borders off).
const CUT = 28;
const TAG_CLIP = `polygon(0 0, calc(100% - ${CUT}px) 0, 100% ${CUT}px, 100% 100%, 0 100%)`;
const INNER_CLIP = `polygon(0 0, calc(100% - ${CUT - 1}px) 0, 100% ${CUT - 1}px, 100% 100%, 0 100%)`;

/**
 * S1: opens the phone's own camera (`capture="environment"`). The moment a photo is chosen is t0;
 * the scan starts right away and the confirm route shows its progress.
 */
export function CaptureButton({ variant = 'tag' }: { variant?: 'tag' | 'retake' }) {
  const navigate = useNavigate();
  const { t } = useCopy();

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
      <label className={buttonClass({ tone: 'lime' })}>
        {t.capture.retake}
        {fileInput}
      </label>
    );
  }

  return (
    <label
      // clip-path hides outlines, so focus shows as a butter fill + thick underline instead
      className="group block w-full cursor-pointer bg-ink p-[3px]"
      style={{ clipPath: TAG_CLIP }}
    >
      <span
        className="relative flex min-h-24 items-center bg-lime py-6 pr-10 pl-16 text-ink group-focus-within:bg-butter active:bg-butter"
        style={{ clipPath: INNER_CLIP }}
      >
        <span
          aria-hidden="true"
          className="absolute top-1/2 left-6 size-5 -translate-y-1/2 rounded-full border-2 border-ink bg-paper"
        />
        <span className="text-[30px] leading-tight font-extrabold decoration-4 underline-offset-4 group-focus-within:underline">
          {t.home.cta}
        </span>
      </span>
      {fileInput}
    </label>
  );
}
