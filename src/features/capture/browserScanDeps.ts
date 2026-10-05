// Real (browser) implementations of ScanDeps. Kept apart from scanSession.ts so tests use fakes.
import { detectBarcode } from '../../lib/barcode';
import { compressImage } from '../../lib/image';
import { ensureAnonymousSession, supabase } from '../../lib/supabase';
import { newScanId } from './ids';
import { recordLatencySample } from './latencyLog';
import { postReadTag } from './readTagClient';
import type { AccessTokenResult, ScanDeps } from './scanSession';

/** Supabase access token for `Authorization: Bearer`. No Supabase env → not_connected. */
export async function getAccessToken(): Promise<AccessTokenResult> {
  if (!supabase) return { failure: 'not_connected' };
  const auth = await ensureAnonymousSession();
  if (auth.status === 'not_connected') return { failure: 'not_connected' };
  if (auth.status !== 'signed_in') return { failure: 'auth' };
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return !error && token ? { token } : { failure: 'auth' };
}

export const browserScanDeps: ScanDeps = {
  compressImage: (file) => compressImage(file),
  decodeBarcode: async (blob) => (await detectBarcode(blob))?.code ?? null,
  getAccessToken,
  readTag: (req, accessToken) => postReadTag(req, { accessToken }),
  now: () => Date.now(),
  newId: () => newScanId(),
  onReady: (ms) => recordLatencySample(ms),
};
