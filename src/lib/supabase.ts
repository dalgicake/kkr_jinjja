import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** null when env vars are missing — the app still renders and shows "not connected". */
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;

export type AuthState =
  | { status: 'loading' }
  | { status: 'not_connected' }
  | { status: 'signed_in'; userId: string }
  /** No UI text here: the screen maps `code` to copy. `detail` is the raw technical message. */
  | { status: 'error'; code: 'no_user' }
  | { status: 'error'; code: 'request_failed'; detail: string };

let pending: Promise<AuthState> | null = null;

/** Reuse the stored session, or sign in anonymously on first visit. Runs once per page load. */
export function ensureAnonymousSession(): Promise<AuthState> {
  pending ??= signIn();
  return pending;
}

async function signIn(): Promise<AuthState> {
  if (!supabase) return { status: 'not_connected' };
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const existing = sessionData.session?.user.id;
    if (existing) return { status: 'signed_in', userId: existing };

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    const userId = data.user?.id;
    if (!userId) return { status: 'error', code: 'no_user' };
    return { status: 'signed_in', userId };
  } catch (e) {
    pending = null; // allow a retry on next call
    return {
      status: 'error',
      code: 'request_failed',
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}
