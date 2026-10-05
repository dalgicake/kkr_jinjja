// POST /api/account — delete my account (PLAN S10). Pure handler with an injected store;
// api/account.ts wires the service-role Supabase client, tests wire a fake.
import { bearerToken } from './auth.js';

/** Tables whose rows belong to a user via `user_id` (PLAN 5), plus profiles (by id). */
export const USER_TABLES = [
  'purchases',
  'corrections',
  'reports',
  'manual_trials',
  'events',
  'scans',
] as const;
export type UserTable = (typeof USER_TABLES)[number];

/** The body the client sends (src/features/account/deleteAccount.ts), so a stray POST does nothing. */
export const DELETE_CONFIRM = 'delete-account';

export interface AccountStore {
  /** Same contract as ServerStore.getUserIdFromToken: null = bad token (401), throw = outage. */
  getUserIdFromToken(accessToken: string): Promise<string | null>;
  /** Storage paths of this user's field-test photos ("test-photos/<name>"), from scans.image_path. */
  listTestPhotoPaths(userId: string): Promise<string[]>;
  removeTestPhotos(paths: readonly string[]): Promise<void>;
  /** Deletes every row of `table` whose user_id is this user. */
  deleteUserRows(table: UserTable, userId: string): Promise<void>;
  deleteProfile(userId: string): Promise<void>;
  /** api_calls keeps its cost rows for /stats, but no longer points at the user. */
  detachApiCalls(userId: string): Promise<void>;
  deleteAuthUser(userId: string): Promise<void>;
}

export interface AccountDeps {
  store: AccountStore;
  /** Where failures are logged (server log only, never the response). */
  onError?: (what: string, e: unknown) => void;
}

const json = (body: unknown, status: number, headers: Record<string, string> = {}): Response =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store', ...headers } });

/** 405 for anything but POST (also used by api/account.ts before any env or client setup). */
export const methodNotAllowed = (): Response =>
  json({ error: 'method_not_allowed' }, 405, { allow: 'POST' });

const defaultLog = (what: string, e: unknown) =>
  console.error(`account: ${what}: ${e instanceof Error ? e.message : String(e)}`);

async function hasConfirmation(request: Request): Promise<boolean> {
  try {
    const body = (await request.json()) as { confirm?: unknown } | null;
    return body?.confirm === DELETE_CONFIRM;
  } catch {
    return false;
  }
}

/**
 * Order matters: photos and rows first, the auth user last. If anything fails the response is a
 * plain 500 and the token still works, so the client can simply retry; every step is idempotent.
 */
export async function handleAccount(request: Request, deps: AccountDeps): Promise<Response> {
  const log = deps.onError ?? defaultLog;
  if (request.method !== 'POST') return methodNotAllowed();

  const token = bearerToken(request);
  if (!token) return json({ error: 'unauthorized' }, 401);

  const { store } = deps;
  let userId: string | null;
  try {
    userId = await store.getUserIdFromToken(token);
  } catch (e) {
    log('verify token', e);
    return json({ error: 'server_error' }, 500);
  }
  if (!userId) return json({ error: 'unauthorized' }, 401);
  if (!(await hasConfirmation(request))) return json({ error: 'bad_request' }, 400);

  try {
    const photos = await store.listTestPhotoPaths(userId);
    if (photos.length) await store.removeTestPhotos(photos);
    for (const table of USER_TABLES) await store.deleteUserRows(table, userId);
    await store.deleteProfile(userId);
    await store.detachApiCalls(userId);
    await store.deleteAuthUser(userId);
  } catch (e) {
    log('delete', e);
    return json({ error: 'server_error' }, 500);
  }
  return json({ ok: true }, 200);
}

export interface AccountEnv {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
}

/** Env for /api/account. Missing keys → names only, never values. */
export function accountEnv(
  raw: Record<string, string | undefined>,
): { ok: true; env: AccountEnv } | { ok: false; missing: string[] } {
  const supabaseUrl = raw.SUPABASE_URL?.trim();
  const supabaseServiceRoleKey = raw.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const missing: string[] = [];
  if (!supabaseUrl) missing.push('SUPABASE_URL');
  if (!supabaseServiceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseServiceRoleKey) return { ok: false, missing };
  return { ok: true, env: { supabaseUrl, supabaseServiceRoleKey } };
}
