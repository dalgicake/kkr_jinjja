import { useEffect, useState } from 'react';
import {
  NOTHING_AVAILABLE,
  accountRedirectUrl,
  fetchProviderAvailability,
  type LoginIntent,
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

/** Remembered across the Google/Kakao/email round trip, to word the success message. */
export function rememberIntent(intent: LoginIntent): void {
  try {
    window.localStorage.setItem(INTENT_KEY, intent);
  } catch {
    // storage blocked: the success message is just the generic one
  }
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
  | { kind: 'error'; key: AuthErrorKey }
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
    latched = { kind: 'error', key: redirect.key };
    return latched;
  }
  if (!ready || typeof window === 'undefined') return null;
  const intent = takeIntent();
  latched = hasUnusedCode(window.location.href)
    ? { kind: 'otherBrowser' }
    : { kind: 'success', kept: intent === 'keep' && !anonymous };
  return latched;
}
