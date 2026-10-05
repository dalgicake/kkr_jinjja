/**
 * Optional sign-in for /account (PLAN S10): email link, Google, Kakao. Anonymous first; signing in
 * LINKS the method to the current user so the same user id (and all records) is kept.
 * Takes a narrow slice of supabase.auth so tests can pass a fake.
 */
import { authErrorKey, type AuthErrorKey } from './authRedirect';

export type OAuthProvider = 'google' | 'kakao';
export const OAUTH_PROVIDERS: readonly OAuthProvider[] = ['google', 'kakao'];

/**
 * 'keep'   attach the method to the current user (anonymous → permanent; records stay)
 * 'signIn' switch to an account made earlier (this device's anonymous records do NOT move)
 */
export type LoginIntent = 'keep' | 'signIn';

/** Just the user fields this module reads. */
export interface UserLike {
  id: string;
  is_anonymous?: boolean;
  email?: string;
  new_email?: string;
  identities?: { provider: string }[];
}

type AuthResult = { error: { code?: string; message: string } | null };

/** The supabase.auth methods used here (structurally satisfied by SupabaseAuthClient). */
export interface AuthClientLike {
  updateUser(
    attributes: { email: string },
    options: { emailRedirectTo: string },
  ): Promise<AuthResult>;
  signInWithOtp(credentials: {
    email: string;
    options: { emailRedirectTo: string; shouldCreateUser: boolean };
  }): Promise<AuthResult>;
  linkIdentity(credentials: {
    provider: OAuthProvider;
    options: { redirectTo: string };
  }): Promise<AuthResult>;
  signInWithOAuth(credentials: {
    provider: OAuthProvider;
    options: { redirectTo: string };
  }): Promise<AuthResult>;
}

export type FlowResult = { ok: true } | { ok: false; key: AuthErrorKey };

/** Linking needs a session; with none there is nothing to keep, so it is a plain sign-in. */
export function effectiveIntent(user: UserLike | null, intent: LoginIntent): LoginIntent {
  return user ? intent : 'signIn';
}

/**
 * Which API sends the email link:
 *  - keep (anonymous, or a signed-in user adding an email) → updateUser({ email }): same user id
 *  - signIn (or no session)                                → signInWithOtp, existing accounts only
 */
export function emailMethod(user: UserLike | null, intent: LoginIntent): 'updateUser' | 'otp' {
  return effectiveIntent(user, intent) === 'keep' ? 'updateUser' : 'otp';
}

/** keep → linkIdentity (adds Google/Kakao to this user); signIn → signInWithOAuth. */
export function providerMethod(
  user: UserLike | null,
  intent: LoginIntent,
): 'linkIdentity' | 'signInWithOAuth' {
  return effectiveIntent(user, intent) === 'keep' ? 'linkIdentity' : 'signInWithOAuth';
}

const result = ({ error }: AuthResult): FlowResult =>
  error ? { ok: false, key: authErrorKey(error.code, error.message) } : { ok: true };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trimmed, lower-cased address, or null when it can't be one. */
export function normalizeEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase();
  return e.length <= 254 && EMAIL_RE.test(e) ? e : null;
}

/** Sends the email link. On ok the screen shows "Check your inbox". */
export async function sendEmailLink(
  auth: AuthClientLike,
  user: UserLike | null,
  rawEmail: string,
  intent: LoginIntent,
  redirectTo: string,
): Promise<FlowResult> {
  const email = normalizeEmail(rawEmail);
  if (!email) return { ok: false, key: 'badEmail' };
  try {
    if (emailMethod(user, intent) === 'updateUser')
      return result(await auth.updateUser({ email }, { emailRedirectTo: redirectTo }));
    return result(
      await auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
      }),
    );
  } catch {
    return { ok: false, key: 'generic' };
  }
}

/** Leaves for Google/Kakao (the browser navigates away on success). */
export async function startProviderLogin(
  auth: AuthClientLike,
  user: UserLike | null,
  provider: OAuthProvider,
  intent: LoginIntent,
  redirectTo: string,
): Promise<FlowResult> {
  const credentials = { provider, options: { redirectTo } };
  try {
    return result(
      providerMethod(user, intent) === 'linkIdentity'
        ? await auth.linkIdentity(credentials)
        : await auth.signInWithOAuth(credentials),
    );
  } catch {
    return { ok: false, key: 'generic' };
  }
}

/** Sign-in methods on this user, for the status chips. 'anonymous' is not a method. */
export function linkedMethods(user: UserLike | null): string[] {
  const names = (user?.identities ?? []).map((i) => i.provider).filter((p) => p !== 'anonymous');
  return [...new Set(names)];
}

export function isAnonymous(user: UserLike | null): boolean {
  return !user || user.is_anonymous === true;
}

// ---- provider availability (turns on by itself once Kiryeong enables Google/Kakao) ----

export type ProviderAvailability = Readonly<Record<OAuthProvider | 'email', boolean>>;

export const NOTHING_AVAILABLE: ProviderAvailability = {
  email: false,
  google: false,
  kakao: false,
};

/** GET {SUPABASE_URL}/auth/v1/settings body → which methods are on. Anything odd → off. */
export function parseProviderSettings(body: unknown): ProviderAvailability {
  const external =
    typeof body === 'object' && body !== null
      ? (body as { external?: unknown }).external
      : undefined;
  if (typeof external !== 'object' || external === null) return NOTHING_AVAILABLE;
  const on = (k: string) => (external as Record<string, unknown>)[k] === true;
  return { email: on('email'), google: on('google'), kakao: on('kakao') };
}

/** null when the settings can't be read (offline, server down): the caller decides the fallback. */
export async function fetchProviderAvailability(
  config: { url: string; anonKey: string },
  fetchImpl: typeof fetch = fetch,
): Promise<ProviderAvailability | null> {
  try {
    const res = await fetchImpl(`${config.url.replace(/\/+$/, '')}/auth/v1/settings`, {
      headers: { apikey: config.anonKey },
    });
    if (!res.ok) return null;
    return parseProviderSettings(await res.json());
  } catch {
    return null;
  }
}

/** Where every auth link returns to (must be on the Supabase redirect allow-list). */
export function accountRedirectUrl(origin: string): string {
  return `${origin.replace(/\/+$/, '')}/account`;
}
