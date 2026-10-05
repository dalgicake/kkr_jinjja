import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NO_REDIRECT, readAuthRedirect, type AuthRedirect } from './authRedirect';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Public client settings (the anon key is public by design). null when env vars are missing. */
export const supabaseConfig: { url: string; anonKey: string } | null =
  url && anonKey ? { url, anonKey } : null;

/**
 * What the auth redirect brought back (email link, Google/Kakao), read from the address bar
 * BEFORE the client below parses and cleans it. /account shows success or the error from this.
 */
export const initialRedirect: AuthRedirect =
  typeof window === 'undefined' ? NO_REDIRECT : readAuthRedirect(window.location.href);

/**
 * null when env vars are missing — the app still renders and shows "not connected".
 * PKCE: email links and Google/Kakao come back to /account?code=…, which the client exchanges on
 * load (detectSessionInUrl). The code verifier lives in this browser's storage, so a link must be
 * opened in the same browser that asked for it.
 */
export const supabase: SupabaseClient | null = supabaseConfig
  ? createClient(supabaseConfig.url, supabaseConfig.anonKey, {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export type AuthState =
  | { status: 'loading' }
  | { status: 'not_connected' }
  | { status: 'signed_in'; userId: string }
  /** No UI text here: the screen maps `code` to copy. `detail` is the raw technical message. */
  | { status: 'error'; code: 'no_user' }
  | { status: 'error'; code: 'request_failed'; detail: string };

let pending: Promise<AuthState> | null = null;

/**
 * The current session's user, or a new anonymous one when there is no session (first visit, or
 * right after sign-out / account deletion). Concurrent callers share one request; once it settles
 * the next call checks again, so a sign-in to another account or a sign-out is never served stale.
 */
export function ensureAnonymousSession(): Promise<AuthState> {
  pending ??= signIn().finally(() => {
    pending = null;
  });
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
    return {
      status: 'error',
      code: 'request_failed',
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}
