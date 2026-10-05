import type { User } from '@supabase/supabase-js';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { en } from '../../copy/en';
import { ko } from '../../copy/ko';
import { fill, splitAt, type Lang } from '../../lib/i18n';
import { LanguageProvider } from '../../lib/language';
import { isRateLimited } from '../../lib/supabase';
import { AuthError } from './LoginForms';
import { LoginSection } from './LoginSection';
import { RESEND_COOLDOWN_S, resendWaitSeconds } from './useAccount';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/'/g, '&#x27;').replace(/"/g, '&quot;');

const anonymousUser = (extra: Partial<User> = {}): User =>
  ({
    id: 'u1',
    is_anonymous: true,
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-10-01T00:00:00Z',
    identities: [],
    ...extra,
  }) as User;

const renderLogin = (user: User, lang: Lang = 'en') =>
  renderToString(
    <LanguageProvider initialLang={lang}>
      <LoginSection user={user} existingOpen={false} setExistingOpen={() => {}} />
    </LanguageProvider>,
  );

describe('Keep your records: email waiting for confirmation', () => {
  it('without a pending email, shows the email form', () => {
    const html = renderLogin(anonymousUser());
    expect(html).toContain('type="email"');
    expect(html).not.toContain('data-testid="account-inbox"');
  });

  it('with user.new_email, keeps "Check your inbox" with the same-browser step and a way back', () => {
    const html = renderLogin(anonymousUser({ new_email: 'typo@exmaple.com' }));
    expect(html).toContain('data-testid="account-inbox"');
    expect(html).toContain(esc(en.account.inbox.title));
    const [before, after] = splitAt(en.account.inbox.body, 'email');
    expect(html).toContain(esc(before));
    expect(html).toContain('typo@exmaple.com');
    expect(html).toContain(esc(after)); // "Open it on this phone, in this browser, to finish."
    expect(html).toContain(esc(en.account.inbox.again)); // "Use a different email"
    expect(html).toContain('data-testid="account-resend"');
    // the form is folded away until "Use a different email"
    expect(html).not.toContain('type="email"');
  });

  it('just after sending, resend waits out the cooldown (no repeated emails)', () => {
    const html = renderLogin(
      anonymousUser({
        new_email: 'me@example.com',
        email_change_sent_at: new Date(Date.now() - 5_000).toISOString(),
      }),
    );
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*data-testid="account-resend"/);
    expect(html).toContain(esc(splitAt(en.account.inbox.resendWait, 'seconds')[0]));
  });

  it('long ago, resend is available right away', () => {
    const html = renderLogin(
      anonymousUser({
        new_email: 'me@example.com',
        email_change_sent_at: new Date(Date.now() - 10 * 60_000).toISOString(),
      }),
    );
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*data-testid="account-resend"/);
    expect(html).not.toContain(esc(splitAt(en.account.inbox.resendWait, 'seconds')[0]));
  });

  it('Korean copy', () => {
    const html = renderLogin(anonymousUser({ new_email: 'me@example.com' }), 'ko');
    expect(html).toContain(ko.account.inbox.title);
    expect(html).toContain(ko.account.inbox.again);
  });
});

describe('resendWaitSeconds', () => {
  it('counts down from the cooldown and never goes negative', () => {
    expect(resendWaitSeconds(null, 1_000)).toBe(0);
    expect(resendWaitSeconds(NaN, 1_000)).toBe(0);
    expect(resendWaitSeconds(0, 0)).toBe(RESEND_COOLDOWN_S);
    expect(resendWaitSeconds(0, 1_500)).toBe(RESEND_COOLDOWN_S - 1);
    expect(resendWaitSeconds(0, RESEND_COOLDOWN_S * 1000)).toBe(0);
    expect(resendWaitSeconds(0, 10 * RESEND_COOLDOWN_S * 1000)).toBe(0);
    // a clock that is behind the server never asks for more than the cooldown
    expect(resendWaitSeconds(10_000_000, 0)).toBe(RESEND_COOLDOWN_S);
  });
});

describe('identityExists names the provider', () => {
  const render = (provider: 'google' | 'kakao' | null, lang: Lang = 'en') =>
    renderToString(
      <LanguageProvider initialLang={lang}>
        <AuthError errorKey="identityExists" provider={provider} />
      </LanguageProvider>,
    );
  it('fills Google / Kakao, or both when unknown', () => {
    expect(render('google')).toContain(
      esc(fill(en.account.errors.identityExists, { provider: 'Google' })),
    );
    expect(render('kakao', 'ko')).toContain(
      esc(fill(ko.account.errors.identityExists, { provider: '카카오' })),
    );
    expect(render(null)).toContain(
      esc(fill(en.account.errors.identityExists, { provider: en.account.errors.someProvider })),
    );
    expect(render('google')).not.toContain('{provider}');
  });
});

describe('isRateLimited', () => {
  it('is true for a 429 or the rate-limit code only', () => {
    expect(isRateLimited({ status: 429, message: 'Too many requests' })).toBe(true);
    expect(isRateLimited({ code: 'over_request_rate_limit' })).toBe(true);
    expect(isRateLimited({ status: 500 })).toBe(false);
    expect(isRateLimited(new Error('Failed to fetch'))).toBe(false);
    expect(isRateLimited(null)).toBe(false);
  });
});
