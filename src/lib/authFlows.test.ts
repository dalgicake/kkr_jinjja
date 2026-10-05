import { describe, expect, it } from 'vitest';
import {
  accountRedirectUrl,
  emailMethod,
  fetchProviderAvailability,
  linkedMethods,
  normalizeEmail,
  parseProviderSettings,
  providerMethod,
  sendEmailLink,
  startProviderLogin,
  type AuthClientLike,
  type UserLike,
} from './authFlows';
import { authErrorKey, hasUnusedCode, readAuthRedirect, withoutAuthParams } from './authRedirect';

const ANON: UserLike = { id: 'u-anon', is_anonymous: true, identities: [] };
const PERMANENT: UserLike = {
  id: 'u-perm',
  is_anonymous: false,
  email: 'a@b.co',
  identities: [{ provider: 'email' }],
};
const REDIRECT = 'http://localhost:5173/account';

type Call = { method: string; args: unknown[] };

function fakeAuth(error: { code?: string; message: string } | null = null) {
  const calls: Call[] = [];
  const rec =
    (method: string) =>
    async (...args: unknown[]) => {
      calls.push({ method, args });
      return { error };
    };
  const auth: AuthClientLike = {
    updateUser: rec('updateUser'),
    signInWithOtp: rec('signInWithOtp'),
    linkIdentity: rec('linkIdentity'),
    signInWithOAuth: rec('signInWithOAuth'),
  };
  return { auth, calls };
}

describe('choosing the auth API', () => {
  it('email: keep → updateUser (anonymous or adding an email); signIn or no session → OTP', () => {
    expect(emailMethod(ANON, 'keep')).toBe('updateUser');
    expect(emailMethod({ ...PERMANENT, email: undefined }, 'keep')).toBe('updateUser');
    expect(emailMethod(ANON, 'signIn')).toBe('otp');
    expect(emailMethod(PERMANENT, 'signIn')).toBe('otp');
    expect(emailMethod(null, 'keep')).toBe('otp');
  });

  it('provider: keep → linkIdentity; signIn or no session → signInWithOAuth', () => {
    expect(providerMethod(ANON, 'keep')).toBe('linkIdentity');
    expect(providerMethod(PERMANENT, 'keep')).toBe('linkIdentity');
    expect(providerMethod(ANON, 'signIn')).toBe('signInWithOAuth');
    expect(providerMethod(null, 'keep')).toBe('signInWithOAuth');
  });

  it('anonymous keep: updateUser({ email }, { emailRedirectTo }) — same user, no OTP call', async () => {
    const { auth, calls } = fakeAuth();
    expect(await sendEmailLink(auth, ANON, '  Me@Example.com ', 'keep', REDIRECT)).toEqual({
      ok: true,
    });
    expect(calls).toEqual([
      { method: 'updateUser', args: [{ email: 'me@example.com' }, { emailRedirectTo: REDIRECT }] },
    ]);
  });

  it('existing account: signInWithOtp that never creates a user', async () => {
    const { auth, calls } = fakeAuth();
    await sendEmailLink(auth, ANON, 'me@example.com', 'signIn', REDIRECT);
    expect(calls).toEqual([
      {
        method: 'signInWithOtp',
        args: [
          {
            email: 'me@example.com',
            options: { emailRedirectTo: REDIRECT, shouldCreateUser: false },
          },
        ],
      },
    ]);
  });

  it('a bad address is rejected before any request', async () => {
    const { auth, calls } = fakeAuth();
    expect(await sendEmailLink(auth, ANON, 'not-an-email', 'keep', REDIRECT)).toEqual({
      ok: false,
      key: 'badEmail',
    });
    expect(calls).toHaveLength(0);
  });

  it('email already used by another account → emailExists (offers sign-in instead)', async () => {
    const { auth } = fakeAuth({ code: 'email_exists', message: 'exists' });
    expect(await sendEmailLink(auth, ANON, 'me@example.com', 'keep', REDIRECT)).toEqual({
      ok: false,
      key: 'emailExists',
    });
  });

  it('Google/Kakao: linkIdentity for keep, signInWithOAuth for an existing account', async () => {
    const a = fakeAuth();
    await startProviderLogin(a.auth, ANON, 'google', 'keep', REDIRECT);
    expect(a.calls).toEqual([
      { method: 'linkIdentity', args: [{ provider: 'google', options: { redirectTo: REDIRECT } }] },
    ]);
    const b = fakeAuth();
    await startProviderLogin(b.auth, ANON, 'kakao', 'signIn', REDIRECT);
    expect(b.calls).toEqual([
      {
        method: 'signInWithOAuth',
        args: [{ provider: 'kakao', options: { redirectTo: REDIRECT } }],
      },
    ]);
  });

  it('a thrown client error becomes generic, not a crash', async () => {
    const auth: AuthClientLike = {
      ...fakeAuth().auth,
      linkIdentity: () => Promise.reject(new Error('network')),
    };
    expect(await startProviderLogin(auth, ANON, 'google', 'keep', REDIRECT)).toEqual({
      ok: false,
      key: 'generic',
    });
  });
});

describe('provider availability (GET /auth/v1/settings)', () => {
  it('reads external.google / kakao / email; anything else is off', () => {
    expect(
      parseProviderSettings({ external: { email: true, google: false, kakao: true, apple: true } }),
    ).toEqual({ email: true, google: false, kakao: true });
    expect(parseProviderSettings({ external: { google: 'true' } })).toEqual({
      email: false,
      google: false,
      kakao: false,
    });
    for (const odd of [null, 'x', {}, { external: null }, []])
      expect(parseProviderSettings(odd)).toEqual({ email: false, google: false, kakao: false });
  });

  it('fetches with the apikey header; failure → null', async () => {
    const seen: { url: string; init?: RequestInit }[] = [];
    const ok = (async (url: string, init?: RequestInit) => {
      seen.push({ url, init });
      return Response.json({ external: { email: true, google: true, kakao: false } });
    }) as typeof fetch;
    const cfg = { url: 'https://x.supabase.co/', anonKey: 'anon' };
    expect(await fetchProviderAvailability(cfg, ok)).toEqual({
      email: true,
      google: true,
      kakao: false,
    });
    expect(seen[0]?.url).toBe('https://x.supabase.co/auth/v1/settings');
    expect(seen[0]?.init?.headers).toEqual({ apikey: 'anon' });

    const down = (async () => new Response('no', { status: 503 })) as typeof fetch;
    expect(await fetchProviderAvailability(cfg, down)).toBeNull();
    const offline = (async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;
    expect(await fetchProviderAvailability(cfg, offline)).toBeNull();
  });
});

describe('redirect return', () => {
  it('identity_already_exists in the query → identityExists', () => {
    expect(
      readAuthRedirect(
        'http://localhost:5173/account?error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked+to+another+user',
      ),
    ).toEqual({ kind: 'error', code: 'identity_already_exists', key: 'identityExists' });
  });

  it('errors in the hash, cancellations and expired links', () => {
    expect(
      readAuthRedirect('http://h/account#error=access_denied&error_description=denied'),
    ).toMatchObject({ kind: 'error', key: 'cancelled' });
    expect(
      readAuthRedirect('http://h/account#error=access_denied&error_code=otp_expired'),
    ).toMatchObject({ kind: 'error', key: 'linkExpired' });
  });

  it('a PKCE code or tokens → callback; plain loads and #anchors → none', () => {
    expect(readAuthRedirect('http://h/account?code=abc')).toEqual({ kind: 'callback' });
    expect(readAuthRedirect('http://h/account#access_token=t&type=magiclink')).toEqual({
      kind: 'callback',
    });
    expect(readAuthRedirect('http://h/account')).toEqual({ kind: 'none' });
    expect(readAuthRedirect('http://h/about#about-privacy')).toEqual({ kind: 'none' });
    expect(readAuthRedirect('not a url')).toEqual({ kind: 'none' });
  });

  it('cleans auth parameters but keeps the rest', () => {
    expect(withoutAuthParams('http://h/account?code=abc&lang=ko')).toBe('/account?lang=ko');
    expect(withoutAuthParams('http://h/account?error=x&error_code=y&error_description=z')).toBe(
      '/account',
    );
    expect(hasUnusedCode('http://h/account?code=abc')).toBe(true);
    expect(hasUnusedCode('http://h/account')).toBe(false);
  });

  it('maps codes and old-style messages; unknown → generic', () => {
    expect(authErrorKey('over_email_send_rate_limit')).toBe('tooMany');
    expect(authErrorKey('validation_failed', 'Unsupported provider: provider is not enabled')).toBe(
      'providerOff',
    );
    expect(authErrorKey('otp_disabled', 'Signups not allowed for otp')).toBe('noAccount');
    expect(authErrorKey('bad_code_verifier')).toBe('otherBrowser');
    expect(
      authErrorKey(undefined, 'A user with this email address has already been registered'),
    ).toBe('emailExists');
    expect(authErrorKey('something_new', 'boom')).toBe('generic');
  });
});

describe('small helpers', () => {
  it('linked methods drop "anonymous" and duplicates', () => {
    expect(
      linkedMethods({
        id: 'x',
        identities: [
          { provider: 'anonymous' },
          { provider: 'email' },
          { provider: 'google' },
          { provider: 'email' },
        ],
      }),
    ).toEqual(['email', 'google']);
    expect(linkedMethods(null)).toEqual([]);
  });
  it('emails and redirect URL', () => {
    expect(normalizeEmail(' A@B.CO ')).toBe('a@b.co');
    expect(normalizeEmail('a@b')).toBeNull();
    expect(normalizeEmail('a b@c.co')).toBeNull();
    expect(accountRedirectUrl('http://192.168.50.153:5173/')).toBe(
      'http://192.168.50.153:5173/account',
    );
  });
});
