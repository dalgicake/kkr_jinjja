// Supabase access-token verification and the per-user hourly limit (CLAUDE.md 보안, PLAN 6).
import type { ApiCallRow, ServerStore } from './supabaseAdmin.js';

/** read-tag·compare: at most this many requests per user per rolling hour, counted from api_calls. */
export const RATE_LIMIT_PER_HOUR = 60;
const HOUR_MS = 60 * 60 * 1000;

/** "Authorization: Bearer <token>" → token, or null. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const m = /^Bearer\s+(\S+)\s*$/i.exec(header);
  return m?.[1] ?? null;
}

/** Verifies the Supabase access token server-side (auth.getUser). Null → respond 401. */
export async function authenticate(request: Request, store: ServerStore): Promise<string | null> {
  const token = bearerToken(request);
  if (!token) return null;
  return store.getUserIdFromToken(token);
}

export interface RateLimitResult {
  allowed: boolean;
  used: number;
  limit: number;
}

/** True when the user still has budget for one more request in the last hour. */
export async function checkRateLimit(
  store: ServerStore,
  userId: string,
  endpoints: readonly string[],
  now: Date,
  limit: number = RATE_LIMIT_PER_HOUR,
): Promise<RateLimitResult> {
  const since = new Date(now.getTime() - HOUR_MS).toISOString();
  const used = await store.countApiCalls(userId, endpoints, since);
  return { allowed: used < limit, used, limit };
}

export type RateLimitSlot = { allowed: true; id: number } | { allowed: false };

/**
 * Reserves one request in the hourly budget before any model call: inserts `pending` into
 * api_calls first, then counts this user's rows in the window up to and including that row's id.
 * Ids are handed out in insertion order, so of N parallel requests the k-th insert sees k more
 * rows — at most `limit − used` of them pass, instead of all of them reading the same stale count.
 * (Only an earlier insert still uncommitted at the moment of our count can slip by; that window is
 * a few ms, not the 15 s model call.) Over the limit → the reserved row is removed again.
 * Throws if the insert or count fails: the caller must not call the model unlogged.
 */
export async function reserveRateLimitSlot(
  store: ServerStore,
  pending: ApiCallRow,
  endpoints: readonly string[],
  now: Date,
  onReleaseError: (e: unknown) => void,
  limit: number = RATE_LIMIT_PER_HOUR,
): Promise<RateLimitSlot> {
  if (!pending.user_id) throw new Error('reserveRateLimitSlot: pending row needs a user_id');
  const id = await store.insertApiCall(pending);
  const since = new Date(now.getTime() - HOUR_MS).toISOString();
  let used: number;
  try {
    used = await store.countApiCalls(pending.user_id, endpoints, since, id);
  } catch (e) {
    await store.deleteApiCall(id).catch(onReleaseError);
    throw e;
  }
  if (used <= limit) return { allowed: true, id };
  // a refused request is not a model call; don't let it extend the user's own lockout
  await store.deleteApiCall(id).catch(onReleaseError);
  return { allowed: false };
}
