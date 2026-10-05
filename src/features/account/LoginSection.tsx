import type { User } from '@supabase/supabase-js';
import { TextButton } from '../../components/common/Button';
import { AlertIcon } from '../../components/common/Icons';
import { SectionBlock } from '../../components/common/SectionBlock';
import { OAUTH_PROVIDERS, isAnonymous, linkedMethods } from '../../lib/authFlows';
import { useCopy } from '../../lib/language';
import { EmailForm, ProviderButtons } from './LoginForms';
import { useProviderAvailability } from './useAccount';

/**
 * Anonymous: "Keep your records" (link email/Google/Kakao to this user) and, folded away,
 * "Already have an account?" with a clear warning that this device's records don't move.
 * Signed in: "Add a sign-in method" for the methods not linked yet.
 */
export function LoginSection({
  user,
  existingOpen,
  setExistingOpen,
}: {
  user: User | null;
  existingOpen: boolean;
  setExistingOpen: (open: boolean) => void;
}) {
  const { t } = useCopy();
  const availability = useProviderAvailability();
  const emailOn = availability?.email ?? false;
  const openExisting = () => setExistingOpen(true);

  if (!isAnonymous(user)) {
    const linked = linkedMethods(user);
    const needsEmail = !user?.email && !user?.new_email;
    const providers = OAUTH_PROVIDERS.filter((p) => !linked.includes(p));
    return (
      <SectionBlock
        tone="lime"
        id="account-add"
        title={t.account.keep.addTitle}
        sub={t.account.keep.addSub}
      >
        {needsEmail && (
          <EmailForm
            user={user}
            intent="keep"
            available={emailOn}
            sendLabel={t.account.keep.emailSend}
          />
        )}
        {providers.length > 0 && (
          <ProviderButtons
            user={user}
            intent="keep"
            providers={providers}
            availability={availability}
          />
        )}
        {!needsEmail && providers.length === 0 && (
          <p className="text-[15px]">{t.account.keep.allLinked}</p>
        )}
      </SectionBlock>
    );
  }

  return (
    <>
      <SectionBlock
        tone="lime"
        id="account-keep"
        title={t.account.keep.title}
        sub={t.account.keep.sub}
      >
        {user?.new_email ? null : (
          <EmailForm
            user={user}
            intent="keep"
            available={emailOn}
            sendLabel={t.account.keep.emailSend}
            onSignInInstead={openExisting}
          />
        )}
        <ProviderButtons
          user={user}
          intent="keep"
          providers={OAUTH_PROVIDERS}
          availability={availability}
        />
      </SectionBlock>

      <SectionBlock
        tone="white"
        id="account-existing"
        title={t.account.existing.title}
        sub={t.account.existing.sub}
      >
        {existingOpen ? (
          <>
            <p
              role="note"
              className="flex items-start gap-2 rounded-md border-2 border-ink bg-pink px-3 py-2 text-[15px] font-bold text-ink"
              data-testid="existing-warning"
            >
              <AlertIcon className="mt-0.5 size-4 shrink-0" />
              <span>{t.account.existing.warning}</span>
            </p>
            <EmailForm
              user={user}
              intent="signIn"
              available={emailOn}
              sendLabel={t.account.existing.emailSend}
            />
            <ProviderButtons
              user={user}
              intent="signIn"
              providers={OAUTH_PROVIDERS}
              availability={availability}
            />
            <TextButton onClick={() => setExistingOpen(false)}>
              {t.account.existing.close}
            </TextButton>
          </>
        ) : (
          <TextButton onClick={openExisting}>{t.account.existing.open}</TextButton>
        )}
      </SectionBlock>
    </>
  );
}
