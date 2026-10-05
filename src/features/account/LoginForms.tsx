import type { User } from '@supabase/supabase-js';
import { useId, useState, type FormEvent } from 'react';
import { Button, TextButton } from '../../components/common/Button';
import type { AuthErrorKey } from '../../lib/authRedirect';
import {
  sendEmailLink,
  startProviderLogin,
  type LoginIntent,
  type OAuthProvider,
} from '../../lib/authFlows';
import { fill } from '../../lib/i18n';
import { useCopy } from '../../lib/language';
import { supabase } from '../../lib/supabase';
import { INPUT_CLASS, Note, WithEmail } from './parts';
import { redirectTo, rememberIntent } from './useAccount';

/** "Already exists" errors come with a way out: sign in to that account instead. */
const OFFERS_SIGN_IN: readonly AuthErrorKey[] = ['identityExists', 'emailExists'];

export function AuthError({
  errorKey,
  onSignInInstead,
}: {
  errorKey: AuthErrorKey;
  onSignInInstead?: () => void;
}) {
  const { t } = useCopy();
  return (
    <Note kind="error" testId="account-error">
      <p>{t.account.errors[errorKey]}</p>
      {onSignInInstead && OFFERS_SIGN_IN.includes(errorKey) && (
        <TextButton onClick={onSignInInstead}>{t.account.errors.signInInstead}</TextButton>
      )}
    </Note>
  );
}

type EmailState =
  | { step: 'idle' }
  | { step: 'sending' }
  | { step: 'sent'; email: string }
  | { step: 'error'; key: AuthErrorKey };

/**
 * Email link. intent 'keep' → updateUser (anonymous user becomes this email, same id, records
 * stay); 'signIn' → signInWithOtp for an account made earlier. Shows "Check your inbox" after.
 */
export function EmailForm({
  user,
  intent,
  available,
  sendLabel,
  onSignInInstead,
}: {
  user: User | null;
  intent: LoginIntent;
  available: boolean;
  sendLabel: string;
  onSignInInstead?: () => void;
}) {
  const { t } = useCopy();
  const id = useId();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<EmailState>({ step: 'idle' });

  if (state.step === 'sent')
    return (
      <Note kind="ok" testId="account-inbox">
        <p className="text-[17px] font-extrabold">{t.account.inbox.title}</p>
        <p>
          <WithEmail template={t.account.inbox.body} email={state.email} />
        </p>
        <TextButton onClick={() => setState({ step: 'idle' })}>{t.account.inbox.again}</TextButton>
      </Note>
    );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || state.step === 'sending') return;
    setState({ step: 'sending' });
    rememberIntent(intent);
    const r = await sendEmailLink(supabase.auth, user, email, intent, redirectTo());
    setState(r.ok ? { step: 'sent', email: email.trim() } : { step: 'error', key: r.key });
  };

  const busy = state.step === 'sending';
  return (
    <form className="flex flex-col gap-2" onSubmit={(e) => void submit(e)} noValidate>
      <label htmlFor={`${id}-email`} className="text-[15px] font-bold">
        {t.account.keep.emailLabel}
      </label>
      <input
        id={`${id}-email`}
        type="email"
        inputMode="email"
        autoComplete="email"
        className={INPUT_CLASS}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-describedby={`${id}-hint`}
        disabled={!available || busy}
      />
      <p id={`${id}-hint`} className="text-[13px] text-muted">
        {available ? t.account.keep.emailHint : t.account.keep.comingSoon}
      </p>
      <Button type="submit" tone="lime" disabled={!available || busy || !email.trim()}>
        {busy ? t.account.keep.sending : sendLabel}
      </Button>
      {state.step === 'error' && (
        <AuthError errorKey={state.key} onSignInInstead={onSignInInstead} />
      )}
    </form>
  );
}

/**
 * Google / Kakao. Unavailable providers stay visible but disabled, with "Coming soon" in words.
 * intent 'keep' → linkIdentity; 'signIn' → signInWithOAuth.
 */
export function ProviderButtons({
  user,
  intent,
  providers,
  availability,
}: {
  user: User | null;
  intent: LoginIntent;
  providers: readonly OAuthProvider[];
  availability: Readonly<Record<OAuthProvider, boolean>> | null;
}) {
  const { t } = useCopy();
  const [leaving, setLeaving] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<AuthErrorKey | null>(null);

  const go = async (provider: OAuthProvider) => {
    if (!supabase) return;
    setError(null);
    setLeaving(provider);
    rememberIntent(intent);
    const r = await startProviderLogin(supabase.auth, user, provider, intent, redirectTo());
    // on success the browser is already navigating away
    if (!r.ok) {
      setLeaving(null);
      setError(r.key);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {providers.map((p) => {
        const on = availability?.[p] === true;
        const label = t.account.keep[p];
        return (
          <Button
            key={p}
            tone="white"
            disabled={!on || leaving !== null}
            onClick={() => void go(p)}
            data-testid={`provider-${p}`}
          >
            {leaving === p
              ? fill(t.account.keep.leaving, { provider: t.account.methods[p] })
              : label}
            {availability && !on && (
              <span className="rounded-md border-2 border-ink bg-paper px-2 text-[13px] font-bold">
                {t.account.keep.comingSoon}
              </span>
            )}
          </Button>
        );
      })}
      {!availability && <p className="text-[13px] text-muted">{t.account.keep.checking}</p>}
      {error && <AuthError errorKey={error} />}
    </div>
  );
}
