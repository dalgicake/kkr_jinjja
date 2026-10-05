import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { TextButton } from '../../components/common/Button';
import { LanguageToggle } from '../../components/common/LanguageToggle';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { SectionBlock } from '../../components/common/SectionBlock';
import { useAuth, useAuthUser } from '../../lib/auth';
import { isAnonymous } from '../../lib/authFlows';
import { withoutAuthParams } from '../../lib/authRedirect';
import { useCopy } from '../../lib/language';
import { initialRedirect } from '../../lib/supabase';
import { DeleteSection, SignOutSection, type LeaveOutcome } from './LeaveSections';
import { LoginSection } from './LoginSection';
import { AuthError } from './LoginForms';
import { NicknameSection } from './NicknameSection';
import { Note } from './parts';
import { StatusSection } from './StatusSection';
import { redirectOutcome, type RedirectOutcome } from './useAccount';

/**
 * S10 /account (lilac header). Anonymous first; signing in is optional and keeps the records by
 * linking the method to the current user. Also nickname, language, sign out and delete account.
 */
export function AccountPage() {
  const { t } = useCopy();
  const auth = useAuth();
  const user = useAuthUser();
  const navigate = useNavigate();
  const [existingOpen, setExistingOpen] = useState(false);
  const [leave, setLeave] = useState<LeaveOutcome | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const ready = auth.status === 'signed_in' || auth.status === 'error';
  const anonymous = isAnonymous(user);
  const outcome = redirectOutcome(initialRedirect, ready, anonymous);

  // once the result is decided, take the auth parameters out of the address bar
  useEffect(() => {
    if (!outcome || typeof window === 'undefined') return;
    const clean = withoutAuthParams(window.location.href);
    if (clean !== window.location.pathname + window.location.search + window.location.hash)
      void navigate(clean, { replace: true });
  }, [outcome, navigate]);

  const signedIn = auth.status === 'signed_in';
  return (
    <section className="flex flex-col gap-8">
      <ScreenHeader
        tone="lilac"
        title={t.account.title}
        sub={t.account.sub}
        back={{ to: '/', label: t.account.back }}
      />

      {outcome && !dismissed && (
        <RedirectNotice
          outcome={outcome}
          onSignInInstead={() => {
            setExistingOpen(true);
            setDismissed(true);
          }}
          onDismiss={() => setDismissed(true)}
        />
      )}
      {leave && (
        <Note kind="ok" testId="account-left">
          <p>{leave === 'deleted' ? t.account.remove.done : t.account.signOut.done}</p>
        </Note>
      )}

      {auth.status === 'loading' && <Note kind="info">{t.account.status.loading}</Note>}
      {auth.status === 'not_connected' && (
        <Note kind="info" testId="account-not-connected">
          {t.account.status.notConnected}
        </Note>
      )}
      {auth.status === 'error' && <Note kind="error">{t.account.status.error}</Note>}

      {signedIn && (
        <>
          <StatusSection user={user} />
          <LoginSection user={user} existingOpen={existingOpen} setExistingOpen={setExistingOpen} />
          <NicknameSection key={auth.userId} userId={auth.userId} />
        </>
      )}

      <SectionBlock tone="sky" id="account-language" title={t.account.language.title}>
        <div className="self-start">
          <LanguageToggle />
        </div>
      </SectionBlock>

      {signedIn && !anonymous && <SignOutSection onDone={setLeave} />}
      {signedIn && <DeleteSection onDone={setLeave} />}
    </section>
  );
}

function RedirectNotice({
  outcome,
  onSignInInstead,
  onDismiss,
}: {
  outcome: RedirectOutcome;
  onSignInInstead: () => void;
  onDismiss: () => void;
}) {
  const { t } = useCopy();
  if (outcome.kind === 'error')
    return (
      <div className="flex flex-col gap-1">
        <AuthError errorKey={outcome.key} onSignInInstead={onSignInInstead} />
        <TextButton onClick={onDismiss}>{t.account.redirect.dismiss}</TextButton>
      </div>
    );
  return (
    <Note kind={outcome.kind === 'success' ? 'ok' : 'error'} testId="account-redirect">
      <p>
        {outcome.kind === 'otherBrowser'
          ? t.account.redirect.otherBrowser
          : outcome.kept
            ? t.account.redirect.kept
            : t.account.redirect.success}
      </p>
      <TextButton onClick={onDismiss}>{t.account.redirect.dismiss}</TextButton>
    </Note>
  );
}
