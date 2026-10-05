/**
 * Nickname rules and the `profiles` table (supabase/migrations/0002_profiles.sql). RLS lets a user
 * read and write only their own row, so these calls run with the signed-in user's session.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export const NICKNAME_MAX = 20;

export type NicknameCheck =
  { ok: true; value: string } | { ok: false; reason: 'empty' | 'tooLong' | 'invalid' };

// control characters (line breaks, tabs, NUL…) and invisible bidi overrides
// eslint-disable-next-line no-control-regex
const FORBIDDEN = /[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩]/;

/**
 * Trimmed; 1..20 characters counted as code points (Korean syllables and emoji count as one, like
 * Postgres `char_length`), no control characters.
 */
export function validateNickname(raw: string): NicknameCheck {
  const value = raw.trim();
  if (!value) return { ok: false, reason: 'empty' };
  if (FORBIDDEN.test(value)) return { ok: false, reason: 'invalid' };
  if ([...value].length > NICKNAME_MAX) return { ok: false, reason: 'tooLong' };
  return { ok: true, value };
}

type DbError = { message: string } | null;

/** Row access for `profiles` (an in-memory fake in tests; `supabaseProfiles` in the app). */
export interface ProfilesStore {
  selectNickname(userId: string): PromiseLike<{ data: unknown; error: DbError }>;
  upsert(row: { id: string; nickname: string; updated_at: string }): PromiseLike<{
    error: DbError;
  }>;
}

export function supabaseProfiles(client: SupabaseClient): ProfilesStore {
  return {
    selectNickname: (userId) =>
      client.from('profiles').select('nickname').eq('id', userId).maybeSingle(),
    upsert: (row) => client.from('profiles').upsert(row, { onConflict: 'id' }),
  };
}

export type LoadResult = { ok: true; nickname: string | null } | { ok: false };

export async function loadNickname(store: ProfilesStore, userId: string): Promise<LoadResult> {
  try {
    const { data, error } = await store.selectNickname(userId);
    if (error) return { ok: false };
    const nickname = (data as { nickname?: unknown } | null)?.nickname;
    return { ok: true, nickname: typeof nickname === 'string' ? nickname : null };
  } catch {
    return { ok: false };
  }
}

export type SaveResult = { ok: true; nickname: string } | { ok: false; reason: NicknameSaveError };
export type NicknameSaveError = 'empty' | 'tooLong' | 'invalid' | 'failed';

/** Validates first; never sends an invalid value. */
export async function saveNickname(
  store: ProfilesStore,
  userId: string,
  raw: string,
  now: Date = new Date(),
): Promise<SaveResult> {
  const check = validateNickname(raw);
  if (!check.ok) return { ok: false, reason: check.reason };
  try {
    const { error } = await store.upsert({
      id: userId,
      nickname: check.value,
      updated_at: now.toISOString(),
    });
    return error ? { ok: false, reason: 'failed' } : { ok: true, nickname: check.value };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
