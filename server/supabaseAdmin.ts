// Service-role Supabase access for api/ (bypasses RLS — server only).
// Handlers depend on the narrow `ServerStore` interface so tests can pass an in-memory fake.
import {
  createClient,
  isAuthApiError,
  isAuthSessionMissingError,
  type SupabaseClient,
} from '@supabase/supabase-js';
import type { TagDerivedValues, TagReading } from '../shared/tag.js';

export const TEST_PHOTO_BUCKET = 'test-photos';

export type ScanMode = 'normal' | 'test' | 'demo';

/** Columns of public.api_calls written by the server (PLAN 5). */
export interface ApiCallRow {
  user_id: string | null;
  scan_id: string | null;
  endpoint: string;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_krw: number | null;
  ms: number;
  ok: boolean;
  error: string | null;
}

/** Columns of public.scans written by /api/read-tag. Other columns are left untouched on upsert. */
export interface ScanReadTagRow {
  id: string;
  user_id: string;
  mode: ScanMode;
  participant_code: string | null;
  store_name: string | null;
  barcode: string | null;
  /** The normalized reading plus the 7.3 derived values under `derived` (jsonb). */
  ocr: ScanOcr | null;
  store_price: number | null;
  image_path?: string;
}

/** scans.ocr: the reading as returned to the client, plus what the server derived from it (7.3). */
export type ScanOcr = TagReading & { derived: TagDerivedValues };

export interface ServerStore {
  /**
   * Verifies a Supabase access token (auth.getUser). Returns the user id, or null when the token
   * is rejected. Throws when Supabase itself fails (network, 5xx), so that is a 500, not a 401.
   */
  getUserIdFromToken(accessToken: string): Promise<string | null>;
  /**
   * Number of api_calls rows for this user and endpoint(s) created at or after `sinceIso`.
   * With `maxId`, only rows inserted up to that id (bigserial = insertion order).
   */
  countApiCalls(
    userId: string,
    endpoints: readonly string[],
    sinceIso: string,
    maxId?: number,
  ): Promise<number>;
  /** Inserts one api_calls row and returns its id. */
  insertApiCall(row: ApiCallRow): Promise<number>;
  /** Replaces the written columns of a reserved api_calls row (created_at stays). */
  updateApiCall(id: number, row: ApiCallRow): Promise<void>;
  deleteApiCall(id: number): Promise<void>;
  /** Owner of an existing scan, or null if the scan does not exist yet. */
  getScanOwner(scanId: string): Promise<string | null>;
  upsertScan(row: ScanReadTagRow): Promise<void>;
  /** Uploads into the private test-photos bucket; returns the stored path "test-photos/<name>". */
  uploadTestPhoto(objectName: string, bytes: Uint8Array, contentType: string): Promise<string>;
}

export function createAdminClient(
  url: string,
  serviceRoleKey: string,
  fetchImpl?: typeof fetch,
): SupabaseClient {
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(fetchImpl ? { global: { fetch: fetchImpl } } : {}),
  });
}

export class StoreError extends Error {
  constructor(op: string, message: string) {
    super(`${op}: ${message}`);
    this.name = 'StoreError';
  }
}

/**
 * auth.getUser errors that mean "this token is not valid" (→ 401): the auth API answered 4xx
 * (bad/expired JWT, unknown user, session gone). Everything else — network failure, 5xx, 429,
 * an unparseable reply — is Supabase being unavailable and must not look like a bad token.
 */
export function isInvalidTokenError(error: unknown): boolean {
  if (isAuthSessionMissingError(error)) return true;
  if (!isAuthApiError(error)) return false;
  return error.status >= 400 && error.status < 500 && error.status !== 429;
}

/** Real ServerStore backed by supabase-js with the service-role key. */
export function createSupabaseStore(client: SupabaseClient): ServerStore {
  return {
    async getUserIdFromToken(accessToken) {
      const { data, error } = await client.auth.getUser(accessToken);
      if (error) {
        if (isInvalidTokenError(error)) return null;
        throw new StoreError('getUserIdFromToken', error.message);
      }
      return data.user?.id ?? null;
    },

    async countApiCalls(userId, endpoints, sinceIso, maxId) {
      let query = client
        .from('api_calls')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('endpoint', [...endpoints])
        .gte('created_at', sinceIso);
      if (maxId !== undefined) query = query.lte('id', maxId);
      const { count, error } = await query;
      if (error) throw new StoreError('countApiCalls', error.message);
      if (count === null) throw new StoreError('countApiCalls', 'no count returned');
      return count;
    },

    async insertApiCall(row) {
      const { data, error } = await client.from('api_calls').insert(row).select('id').single();
      if (error) throw new StoreError('insertApiCall', error.message);
      // bigserial: PostgREST sends a JSON number (a string only beyond 2^53, never reached here)
      const raw = (data as { id?: unknown } | null)?.id;
      const id = typeof raw === 'number' || typeof raw === 'string' ? Number(raw) : NaN;
      if (!Number.isSafeInteger(id) || id <= 0)
        throw new StoreError('insertApiCall', 'no id returned');
      return id;
    },

    async updateApiCall(id, row) {
      const { error } = await client.from('api_calls').update(row).eq('id', id);
      if (error) throw new StoreError('updateApiCall', error.message);
    },

    async deleteApiCall(id) {
      const { error } = await client.from('api_calls').delete().eq('id', id);
      if (error) throw new StoreError('deleteApiCall', error.message);
    },

    async getScanOwner(scanId) {
      const { data, error } = await client
        .from('scans')
        .select('user_id')
        .eq('id', scanId)
        .maybeSingle();
      if (error) throw new StoreError('getScanOwner', error.message);
      const owner = (data as { user_id?: unknown } | null)?.user_id;
      return typeof owner === 'string' ? owner : null;
    },

    async upsertScan(row) {
      const { error } = await client.from('scans').upsert(row, { onConflict: 'id' });
      if (error) throw new StoreError('upsertScan', error.message);
    },

    async uploadTestPhoto(objectName, bytes, contentType) {
      const { error } = await client.storage
        .from(TEST_PHOTO_BUCKET)
        .upload(objectName, bytes, { contentType, upsert: true });
      if (error) throw new StoreError('uploadTestPhoto', error.message);
      return `${TEST_PHOTO_BUCKET}/${objectName}`;
    },
  };
}
