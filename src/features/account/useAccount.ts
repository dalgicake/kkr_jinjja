import { useEffect, useState } from 'react';
import {
  NOTHING_AVAILABLE,
  accountRedirectUrl,
  fetchProviderAvailability,
  type LoginIntent,
  type OAuthProvider,
  type ProviderAvailability,
} from '../../lib/authFlows';
import { hasUnusedCode, type AuthErrorKey, type AuthRedirect } from '../../lib/authRedirect';
import { supabaseConfig } from '../../lib/supabase';

/**
 * Which sign-in methods the Supabase project has on, read at runtime, so Google/Kakao switch on
 * by themselves once they're configured. null while checking. If the settings can't be read,
 * email stays usable (it is on in this project) and Google/Kakao show "Coming soon".
 */
export function useProviderAvailability(): ProviderAvailability | null {
  const [state, setState] = useState<ProviderAvailability | null>(
    supabaseConfig ? null : NOTHING_AVAILABLE,
  );
  useEffect(() => {
    if (!supabaseConfig) return;
    let alive = true;
    void fetchProviderAvailability(supabaseConfig).then((a) => {
      if (alive) setState(a ?? { email: true, google: false, kakao: false });
    });
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

const INTENT_KEY = 'jinjja.authIntent';
const PROVIDER_KEY = 'jinjja.authProvider';

/**
 * Remembered across the Google/Kakao/email round trip, to word the success message and to name
 * the provider in "That Google login is already used…". No provider = the email link.
 */
export function rememberIntent(intent: LoginIntent, provider?: OAuthProvider): void {
  try {
    window.localStorage.setItem(INTENT_KEY, intent);
    if (provider) window.localStorage.setItem(PROVIDER_KEY, provider);
    else window.localStorage.removeItem(PROVIDER_KEY);
  } catch {
    // storage blocked: the success message is just the generic one
  }
}

export function takeProvider(): OAuthProvider | null {
  try {
    const v = window.localStorage.getItem(PROVIDER_KEY);
    window.localStorage.removeItem(PROVIDER_KEY);
    return v === 'google' || v === 'kakao' ? v : null;
  } catch {
    return null;
  }
}

/** Seconds between email-link sends from this screen (Supabase refuses faster resends). */
export const RESEND_COOLDOWN_S = 60;

/**
 * Seconds left before the link may be sent again, 0 when it may. `sentAt` = ms of the last send
 * (from this screen, or the user's `email_change_sent_at`); unknown → 0.
 */
export function resendWaitSeconds(
  sentAt: number | null,
  now: number,
  cooldownS = RESEND_COOLDOWN_S,
): number {
  if (sentAt === null || !Number.isFinite(sentAt)) return 0;
  const left = Math.ceil((sentAt + cooldownS * 1000 - now) / 1000);
  return Math.min(Math.max(left, 0), cooldownS);
}

export function takeIntent(): LoginIntent | null {
  try {
    const v = window.localStorage.getItem(INTENT_KEY);
    window.localStorage.removeItem(INTENT_KEY);
    return v === 'keep' || v === 'signIn' ? v : null;
  } catch {
    return null;
  }
}

/** Where the email link and Google/Kakao send the user back to. */
export const redirectTo = (): string =>
  accountRedirectUrl(typeof window === 'undefined' ? '' : window.location.origin);

export type RedirectOutcome =
  | { kind: 'error'; key: AuthErrorKey; provider: OAuthProvider | null }
  | { kind: 'otherBrowser' }
  | { kind: 'success'; kept: boolean };

let latched: RedirectOutcome | null = null;

/**
 * What to tell the user after coming back from an auth link, decided once per page load: an
 * error from the auth server; a PKCE code that was left unused (opened in another browser); or
 * success. `ready` = the auth client has finished reading the address bar.
 */
export function redirectOutcome(
  redirect: AuthRedirect,
  ready: boolean,
  anonymous: boolean,
): RedirectOutcome | null {
  if (latched) return latched;
  if (redirect.kind === 'none') return null;
  if (redirect.kind === 'error') {
    takeIntent();
    latched = { kind: 'error', key: redirect.key, provider: takeProvider() };
    return latched;
  }
  if (!ready || typeof window === 'undefined') return null;
  const intent = takeIntent();
  takeProvider();
  latched = hasUnusedCode(window.location.href)
    ? { kind: 'otherBrowser' }
    : { kind: 'success', kept: intent === 'keep' && !anonymous };
  return latched;
}
