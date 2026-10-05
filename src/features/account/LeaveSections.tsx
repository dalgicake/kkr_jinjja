import { useId, useState } from 'react';
import { Button, TextButton } from '../../components/common/Button';
import { AlertIcon } from '../../components/common/Icons';
import { SectionBlock } from '../../components/common/SectionBlock';
import { fill } from '../../lib/i18n';
import { useCopy } from '../../lib/language';
import { supabase } from '../../lib/supabase';
import { confirmWordMatches, requestAccountDeletion } from './deleteAccount';
import { INPUT_CLASS, Note } from './parts';

export type LeaveOutcome = 'signedOut' | 'deleted';

/**
 * Sign out (signed-in users only: for an anonymous user it would just lose the records). The
 * AuthProvider starts a fresh anonymous session on SIGNED_OUT, so the app keeps working.
 */
export function SignOutSection({ onDone }: { onDone: (o: LeaveOutcome) => void }) {
  const { t } = useCopy();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const signOut = async () => {
    if (!supabase) return;
    setBusy(true);
    setFailed(false);
    const { error } = await supabase.auth.signOut();
    setBusy(false);
    if (error) setFailed(true);
    else onDone('signedOut');
  };
  return (
    <SectionBlock
      tone="white"
      id="account-signout"
      title={t.account.signOut.title}
      sub={t.account.signOut.body}
    >
      <Button tone="white" disabled={busy} onClick={() => void signOut()}>
        {busy ? t.account.signOut.busy : t.account.signOut.button}
      </Button>
      {failed && <Note kind="error">{t.account.signOut.error}</Note>}
    </SectionBlock>
  );
}

type DeleteStep = 'closed' | 'confirm' | 'busy' | 'error';

/**
 * Two steps: [Delete account] opens the confirmation, then the copy's word must be typed before
 * [Delete everything] works. POST /api/account deletes rows + auth user; then local sign-out.
 */
export function DeleteSection({ onDone }: { onDone: (o: LeaveOutcome) => void }) {
  const { t } = useCopy();
  const id = useId();
  const [step, setStep] = useState<DeleteStep>('closed');
  const [typed, setTyped] = useState('');
  const word = t.account.remove.word;
  const matches = confirmWordMatches(typed, word);

  const run = async () => {
    if (!supabase || !matches) return;
    setStep('busy');
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const r = token ? await requestAccountDeletion(token) : ({ ok: false } as const);
    if (!r.ok) {
      setStep('error');
      return;
    }
    // the user no longer exists on the server: only clear this device's session
    await supabase.auth.signOut({ scope: 'local' });
    setTyped('');
    setStep('closed');
    onDone('deleted');
  };

  return (
    <SectionBlock
      tone="pink"
      id="account-delete"
      title={t.account.remove.title}
      sub={t.account.remove.body}
    >
      {step === 'closed' ? (
        <Button tone="white" onClick={() => setStep('confirm')}>
          {t.account.remove.start}
        </Button>
      ) : (
        <div className="flex flex-col gap-2" data-testid="delete-confirm">
          <p className="text-[17px] font-extrabold">{t.account.remove.confirmTitle}</p>
          <p id={`${id}-body`} className="text-[15px]">
            {fill(t.account.remove.confirmBody, { word })}
          </p>
          <label htmlFor={`${id}-word`} className="text-[15px] font-bold">
            {t.account.remove.inputLabel}
          </label>
          <input
            id={`${id}-word`}
            className={INPUT_CLASS}
            value={typed}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            onChange={(e) => setTyped(e.target.value)}
            aria-describedby={`${id}-body ${id}-state`}
          />
          <p id={`${id}-state`} className="text-[13px] text-muted">
            {matches ? '' : fill(t.account.remove.mismatch, { word })}
          </p>
          <Button tone="pink" disabled={!matches || step === 'busy'} onClick={() => void run()}>
            <AlertIcon className="size-4 shrink-0" />
            {step === 'busy' ? t.account.remove.busy : t.account.remove.confirm}
          </Button>
          <TextButton
            disabled={step === 'busy'}
            onClick={() => {
              setTyped('');
              setStep('closed');
            }}
          >
            {t.account.remove.cancel}
          </TextButton>
          {step === 'error' && <Note kind="error">{t.account.remove.error}</Note>}
        </div>
      )}
    </SectionBlock>
  );
}
