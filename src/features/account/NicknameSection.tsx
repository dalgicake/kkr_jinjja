import { useEffect, useId, useState, type FormEvent } from 'react';
import { Button } from '../../components/common/Button';
import { SectionBlock } from '../../components/common/SectionBlock';
import { useCopy } from '../../lib/language';
import { supabase } from '../../lib/supabase';
import { NICKNAME_MAX, loadNickname, saveNickname, supabaseProfiles } from './nickname';
import { INPUT_CLASS, Note } from './parts';

type Status =
  'idle' | 'saving' | 'saved' | 'loadError' | 'saveError' | 'empty' | 'tooLong' | 'invalid';

/** profiles.nickname for this user (RLS: own row only). Mount with key={userId}. */
export function NicknameSection({ userId }: { userId: string }) {
  const { t } = useCopy();
  const id = useId();
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    void loadNickname(supabaseProfiles(supabase), userId).then((r) => {
      if (!alive) return;
      if (r.ok) setValue(r.nickname ?? '');
      else setStatus('loadError');
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || status === 'saving') return;
    setStatus('saving');
    const r = await saveNickname(supabaseProfiles(supabase), userId, value);
    if (r.ok) {
      setValue(r.nickname);
      setStatus('saved');
    } else setStatus(r.reason === 'failed' ? 'saveError' : r.reason);
  };

  const message: Record<
    Exclude<Status, 'idle' | 'saving'>,
    { kind: 'ok' | 'error'; text: string }
  > = {
    saved: { kind: 'ok', text: t.account.nickname.saved },
    loadError: { kind: 'error', text: t.account.nickname.loadError },
    saveError: { kind: 'error', text: t.account.nickname.saveError },
    empty: { kind: 'error', text: t.account.nickname.empty },
    tooLong: { kind: 'error', text: t.account.nickname.tooLong },
    invalid: { kind: 'error', text: t.account.nickname.invalid },
  };
  const shown = status === 'idle' || status === 'saving' ? null : message[status];

  return (
    <SectionBlock tone="lilac" id="account-nickname" title={t.account.nickname.title}>
      <form className="flex flex-col gap-2" onSubmit={(e) => void submit(e)} noValidate>
        <label htmlFor={`${id}-nick`} className="text-[15px] font-bold">
          {t.account.nickname.label}
        </label>
        <input
          id={`${id}-nick`}
          className={INPUT_CLASS}
          value={value}
          // a soft cap; the real rule (20 characters, trimmed) is validateNickname
          maxLength={NICKNAME_MAX * 2}
          autoComplete="nickname"
          onChange={(e) => {
            setValue(e.target.value);
            if (status !== 'saving') setStatus('idle');
          }}
          aria-describedby={`${id}-hint`}
          aria-invalid={shown?.kind === 'error' && status !== 'loadError'}
        />
        <p id={`${id}-hint`} className="text-[13px] text-muted">
          {t.account.nickname.hint}
        </p>
        <Button type="submit" tone="lime" disabled={status === 'saving'}>
          {status === 'saving' ? t.account.nickname.saving : t.account.nickname.save}
        </Button>
        {shown && <Note kind={shown.kind}>{shown.text}</Note>}
      </form>
    </SectionBlock>
  );
}
