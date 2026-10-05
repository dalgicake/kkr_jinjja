/**
 * Pure helpers for the auth redirect return (email link, Google, Kakao → /account). No React, no
 * Supabase client: supabase.ts reads the address bar once at load, /account maps the result to copy.
 */

/** Copy keys under t.account.errors. The screen never shows Supabase's raw message. */
export type AuthErrorKey =
  | 'identityExists'
  | 'emailExists'
  | 'badEmail'
  | 'tooMany'
  | 'linkExpired'
  | 'otherBrowser'
  | 'cancelled'
  | 'providerOff'
  | 'noAccount'
  | 'generic';

export type AuthRedirect =
  /** an ordinary page load */
  | { kind: 'none' }
  /** came back with a PKCE code or tokens: success if the session is in place after load */
  | { kind: 'callback' }
  /** the auth server sent the user back with an error */
  | { kind: 'error'; key: AuthErrorKey; code: string };

export const NO_REDIRECT: AuthRedirect = { kind: 'none' };

/** Query and hash parameters together (Supabase uses either, depending on flow and error). */
function params(href: string): URLSearchParams {
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return new URLSearchParams();
  }
  const all = new URLSearchParams(u.search);
  const hash = u.hash.startsWith('#') ? u.hash.slice(1) : u.hash;
  // a hash like "#section" has no "=" and is not auth data
  if (hash.includes('=')) for (const [k, v] of new URLSearchParams(hash)) all.set(k, v);
  return all;
}

export function readAuthRedirect(href: string): AuthRedirect {
  const p = params(href);
  const error = p.get('error');
  const errorCode = p.get('error_code');
  const description = p.get('error_description');
  if (error || errorCode || description) {
    const code = errorCode || error || 'unknown';
    return { kind: 'error', code, key: authErrorKey(code, description ?? '') };
  }
  if (p.get('code') || p.get('access_token')) return { kind: 'callback' };
  return NO_REDIRECT;
}

/** True while the address bar still has a PKCE code: it was not exchanged (another browser). */
export function hasUnusedCode(href: string): boolean {
  return params(href).has('code');
}

/** Address without auth parameters, for history.replaceState after showing the result. */
export function withoutAuthParams(href: string): string {
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return href;
  }
  const AUTH = ['code', 'error', 'error_code', 'error_description', 'sb', 'type'];
  for (const k of AUTH) u.searchParams.delete(k);
  if (u.hash.includes('access_token=') || u.hash.includes('error')) u.hash = '';
  return u.pathname + u.search + u.hash;
}

/**
 * Supabase error code (or the message, for old servers) → which explanation to show.
 * Unknown codes fall back to 'generic'; the raw text is never shown to the user.
 */
export function authErrorKey(code: string | undefined, message = ''): AuthErrorKey {
  const c = (code ?? '').toLowerCase();
  const m = message.toLowerCase();
  if (c === 'identity_already_exists' || m.includes('identity is already linked'))
    return 'identityExists';
  if (c === 'email_exists' || c === 'user_already_exists' || m.includes('already been registered'))
    return 'emailExists';
  if (
    c === 'provider_disabled' ||
    c === 'oauth_provider_not_supported' ||
    c === 'manual_linking_disabled' ||
    m.includes('provider is not enabled') ||
    m.includes('unsupported provider')
  )
    return 'providerOff';
  if (c === 'email_address_invalid' || c === 'validation_failed' || m.includes('invalid format'))
    return 'badEmail';
  if (
    c === 'over_email_send_rate_limit' ||
    c === 'over_request_rate_limit' ||
    m.includes('rate limit')
  )
    return 'tooMany';
  if (c === 'otp_expired' || c === 'flow_state_expired' || m.includes('expired'))
    return 'linkExpired';
  if (c === 'bad_code_verifier' || c === 'flow_state_not_found' || m.includes('code verifier'))
    return 'otherBrowser';
  if (c === 'access_denied' || m.includes('access_denied')) return 'cancelled';
  if (c === 'otp_disabled' || c === 'signup_disabled' || m.includes('signups not allowed'))
    return 'noAccount';
  return 'generic';
}
