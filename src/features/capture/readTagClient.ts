// Client for POST /api/read-tag (PLAN 6). The response is validated again here:
// anything that is not a well-formed TagReading is an error, never shown as a reading (P1).
import { z } from 'zod';
import {
  MAX_TAG_IMAGE_BYTES,
  isUnreadableTag,
  tagReadingSchema,
  type TagReading,
} from '../../../shared/tag.js';

export const READ_TAG_ENDPOINT = '/api/read-tag';
/**
 * The server's model phase (both attempts) is capped at 15s (PLAN 7.3) and the function itself at
 * vercel.json maxDuration 30s, so waiting longer than that can never produce a reading.
 */
export const READ_TAG_CLIENT_TIMEOUT_MS = 30_000;
/** PLAN 7.3: the server rejects images over 4MB, so don't upload them (shared with the server). */
export const MAX_IMAGE_BYTES = MAX_TAG_IMAGE_BYTES;

export type ReadFailure =
  | 'unreadable'
  | 'network'
  | 'not_connected'
  | 'auth'
  | 'rate_limited'
  | 'too_large'
  | 'image'
  | 'server';

export interface ReadTagRequest {
  scanId: string;
  imageBase64: string;
  barcodeFromImage?: string;
  mode: 'normal' | 'test' | 'demo';
  participantCode?: string;
  storeName?: string;
}

export type ReadTagOutcome =
  | { ok: true; reading: TagReading; ms: number | null; costKrw: number | null }
  | { ok: false; reason: ReadFailure; status?: number };

const responseSchema = z.object({
  ocr: tagReadingSchema,
  ms: z.number().optional(),
  // the server sends null when the model has no price entry
  costKrw: z.number().nullable().optional(),
});

/** Raw base64 for the request body (drops a `data:...;base64,` prefix if present). */
export function toRawBase64(s: string): string {
  const i = s.indexOf('base64,');
  return s.startsWith('data:') && i >= 0 ? s.slice(i + 'base64,'.length) : s;
}

export function failureForStatus(status: number): ReadFailure {
  if (status === 422) return 'unreadable';
  if (status === 429) return 'rate_limited';
  if (status === 401 || status === 403) return 'auth';
  if (status === 413) return 'too_large';
  // 503 = server env not configured: retaking cannot help, same state as no Supabase
  if (status === 503) return 'not_connected';
  return 'server';
}

async function errorCode(res: Response): Promise<string | null> {
  try {
    const body: unknown = await res.json();
    const code = (body as { error?: unknown } | null)?.error;
    return typeof code === 'string' ? code : null;
  } catch {
    return null;
  }
}

export interface ReadTagOptions {
  accessToken: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  endpoint?: string;
}

export async function postReadTag(
  req: ReadTagRequest,
  {
    accessToken,
    fetchImpl = fetch,
    timeoutMs = READ_TAG_CLIENT_TIMEOUT_MS,
    endpoint = READ_TAG_ENDPOINT,
  }: ReadTagOptions,
): Promise<ReadTagOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ ...req, imageBase64: toRawBase64(req.imageBase64) }),
      signal: controller.signal,
    });
  } catch {
    return { ok: false, reason: 'network' };
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const reason = failureForStatus(res.status);
    if (res.status === 400 && (await errorCode(res)) === 'unsupported_image') {
      return { ok: false, reason: 'image', status: res.status };
    }
    return { ok: false, reason, status: res.status };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, reason: 'server', status: res.status };
  }
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) return { ok: false, reason: 'server', status: res.status };
  // the server should already have answered 422 for these; don't show them as a reading
  if (isUnreadableTag(parsed.data.ocr))
    return { ok: false, reason: 'unreadable', status: res.status };
  return {
    ok: true,
    reading: parsed.data.ocr,
    ms: parsed.data.ms ?? null,
    costKrw: parsed.data.costKrw ?? null,
  };
}
