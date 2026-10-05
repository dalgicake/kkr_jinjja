// S1 → S2 scan session. A tiny external store (useSyncExternalStore) so the home screen can
// start a scan and the confirm route can read it without a provider.
// The pipeline is dependency-injected so it runs in tests with fakes; nothing here invents data.
import type { TagReading } from '../../../shared/tag.js';
import type { Promo, TargetSpec } from '../../../shared/types.js';
import {
  MAX_IMAGE_BYTES,
  type ReadFailure,
  type ReadTagOutcome,
  type ReadTagRequest,
} from './readTagClient';

export interface ScanSession {
  scanId: string;
  source: 'photo' | 'manual';
  /** epoch ms when the photo was chosen (S1 t0); null for manual entry. */
  t0: number | null;
  status: 'reading' | 'ready' | 'failed';
  reading: TagReading | null;
  failure: ReadFailure | null;
  /** decoded from the photo; arrives independently of the OCR result. */
  barcode: string | null;
  /** t0 → OCR result in ms (shutter → confirm card). */
  readyMs: number | null;
  storeName: string | null;
}

/** What the confirm card hands to the next step (Phase 2 compare). */
export interface ConfirmedScan {
  scanId: string;
  target: TargetSpec;
  storePrice: number;
  promo: Promo;
  /** only when the confirmed spec still equals a curated product (P2). */
  productId: string | null;
  verified: boolean;
  barcode: string | null;
  storeName: string | null;
}

export interface ScanState {
  session: ScanSession | null;
  confirmed: ConfirmedScan | null;
}

export type AccessTokenResult = { token: string } | { failure: 'not_connected' | 'auth' };

export interface ScanDeps {
  compressImage(file: Blob): Promise<{ base64: string; bytes: number; blob: Blob }>;
  decodeBarcode(file: Blob): Promise<string | null>;
  getAccessToken(): Promise<AccessTokenResult>;
  readTag(req: ReadTagRequest, accessToken: string): Promise<ReadTagOutcome>;
  now(): number;
  newId(): string;
  /** Called with readyMs when a photo scan's reading is ready (latency log for PLAN 14). */
  onReady?(readyMs: number): void;
}

export function createScanStore() {
  let state: ScanState = { session: null, confirmed: null };
  let generation = 0;
  const listeners = new Set<() => void>();

  const set = (next: ScanState) => {
    state = next;
    for (const l of listeners) l();
  };
  /** Patch the session only if it is still the scan `gen` started. */
  const patch = (gen: number, p: Partial<ScanSession>) => {
    if (gen !== generation || !state.session) return;
    set({ ...state, session: { ...state.session, ...p } });
  };

  return {
    getState: (): ScanState => state,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** S1: photo chosen. Records t0, compresses, then barcode ∥ POST /api/read-tag. */
    async startPhotoScan(file: Blob, deps: ScanDeps, storeName: string | null): Promise<void> {
      const gen = ++generation;
      const t0 = deps.now();
      const scanId = deps.newId();
      set({
        confirmed: null,
        session: {
          scanId,
          source: 'photo',
          t0,
          status: 'reading',
          reading: null,
          failure: null,
          barcode: null,
          readyMs: null,
          storeName,
        },
      });
      const fail = (failure: ReadFailure) => patch(gen, { status: 'failed', failure });

      const [compressed, auth] = await Promise.all([
        deps.compressImage(file).catch(() => null),
        deps.getAccessToken().catch((): AccessTokenResult => ({ failure: 'auth' })),
      ]);
      if (gen !== generation) return;
      if (!compressed) return fail('image');
      if (compressed.bytes > MAX_IMAGE_BYTES) return fail('too_large');
      if ('failure' in auth) return fail(auth.failure);

      // PLAN S1: after compression, (a) barcode and (b) read-tag run in parallel.
      // The barcode goes to the confirm card (verified match); read-tag never waits for it.
      void deps
        .decodeBarcode(compressed.blob)
        .catch(() => null)
        .then((code) => {
          if (code) patch(gen, { barcode: code });
        });

      const req: ReadTagRequest = { scanId, imageBase64: compressed.base64, mode: 'normal' };
      if (storeName) req.storeName = storeName;

      const outcome = await deps
        .readTag(req, auth.token)
        .catch((): ReadTagOutcome => ({ ok: false, reason: 'network' }));
      if (gen !== generation) return;
      if (!outcome.ok) return fail(outcome.reason);
      const readyMs = deps.now() - t0;
      patch(gen, { status: 'ready', reading: outcome.reading, readyMs });
      try {
        deps.onReady?.(readyMs);
      } catch {
        // measurement must never break the scan
      }
    },

    /** [직접 입력]: an empty card with a fresh scan id; no reading, no photo. */
    startManual(newId: () => string, storeName: string | null): void {
      generation++;
      set({
        confirmed: null,
        session: {
          scanId: newId(),
          source: 'manual',
          t0: null,
          status: 'ready',
          reading: null,
          failure: null,
          barcode: null,
          readyMs: null,
          storeName,
        },
      });
    },

    confirm(confirmed: ConfirmedScan): void {
      if (state.session?.scanId !== confirmed.scanId) return;
      set({ ...state, confirmed });
    },
    unconfirm(): void {
      set({ ...state, confirmed: null });
    },
    reset(): void {
      generation++;
      set({ session: null, confirmed: null });
    },
  };
}

export type ScanStore = ReturnType<typeof createScanStore>;

/** The app-wide store. */
export const scanStore: ScanStore = createScanStore();
