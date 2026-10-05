import type { User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { TextButton } from '../../components/common/Button';
import type { AuthErrorKey } from '../../lib/authRedirect';
import { sendEmailLink } from '../../lib/authFlows';
import { fill } from '../../lib/i18n';
import { useCopy } from '../../lib/language';
import { supabase } from '../../lib/supabase';
import { AuthError, EmailForm } from './LoginForms';
import { Note, WithEmail } from './parts';
import { redirectTo, rememberIntent, resendWaitSeconds } from './useAccount';

/**
 * "Keep your records" by email. While an address waits for confirmation (`user.new_email`, or one
 * just sent from here) the "Check your inbox" panel stays up — also after a reload — with the
 * same-browser instruction, a resend (after a cooldown) and "Use a different email".
 */
export function KeepEmail({
  user,
  available,
  sendLabel,
  onSignInInstead,
}: {
  user: User | null;
  available: boolean;
  sendLabel: string;
  onSignInInstead?: () => void;
}) {
  const [changing, setChanging] = useState(false);
  const [sent, setSent] = useState<{ email: string; at: number } | null>(null);
  const pending = sent?.email ?? user?.new_email ?? null;

  if (pending && !changing) {
    const serverSentAt = user?.email_change_sent_at ? Date.parse(user.email_change_sent_at) : NaN;
    const sentAt = sent?.at ?? (Number.isFinite(serverSentAt) ? serverSentAt : null);
    return (
      <PendingEmail
        user={user}
        email={pending}
        sentAt={sentAt}
        onResent={(at) => setSent({ email: pending, at })}
        onChange={() => setChanging(true)}
      />
    );
  }
  return (
    <EmailForm
      user={user}
      intent="keep"
      available={available}
      sendLabel={sendLabel}
      onSignInInstead={onSignInInstead}
      onSent={(email) => {
        setSent({ email, at: Date.now() });
        setChanging(false);
      }}
    />
  );
}

type ResendState =
  { step: 'idle' } | { step: 'sending' } | { step: 'done' } | { step: 'error'; key: AuthErrorKey };

export function PendingEmail({
  user,
  email,
  sentAt,
  onResent,
  onChange,
}: {
  user: User | null;
  email: string;
  /** ms of the last send; null when unknown (resend allowed right away). */
  sentAt: number | null;
  onResent: (at: number) => void;
  onChange: () => void;
}) {
  const { t } = useCopy();
  const [now, setNow] = useState(() => Date.now());
  const [resend, setResend] = useState<ResendState>({ step: 'idle' });
  const wait = resendWaitSeconds(sentAt, now);

  // tick the countdown only while there is one
  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [wait]);

  const send = async () => {
    if (!supabase || wait > 0 || resend.step === 'sending') return;
    setResend({ step: 'sending' });
    rememberIntent('keep');
    const r = await sendEmailLink(supabase.auth, user, email, 'keep', redirectTo());
    const at = Date.now();
    setNow(at);
    if (r.ok) onResent(at);
    setResend(r.ok ? { step: 'done' } : { step: 'error', key: r.key });
  };

  return (
    <div className="flex flex-col gap-2">
      <Note kind="ok" testId="account-inbox">
        <p className="text-[17px] font-extrabold">{t.account.inbox.title}</p>
        <p>
          <WithEmail template={t.account.inbox.body} email={email} />
        </p>
        {resend.step === 'done' && <p>{t.account.inbox.resent}</p>}
        <TextButton
          onClick={() => void send()}
          disabled={wait > 0 || resend.step === 'sending'}
          aria-describedby={wait > 0 ? 'account-resend-wait' : undefined}
          data-testid="account-resend"
        >
          {resend.step === 'sending' ? t.account.keep.sending : t.account.inbox.resend}
        </TextButton>
        {wait > 0 && (
          <p id="account-resend-wait" className="text-[13px] font-normal">
            {fill(t.account.inbox.resendWait, { seconds: wait })}
          </p>
        )}
        <TextButton onClick={onChange}>{t.account.inbox.again}</TextButton>
      </Note>
      {resend.step === 'error' && <AuthError errorKey={resend.key} />}
    </div>
  );
}
