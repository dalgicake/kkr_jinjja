import { useId, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Button } from '../../components/common/Button';
import { AlertIcon } from '../../components/common/Icons';
import { useCopy } from '../../lib/language';

/**
 * Passcode gate for /stats and /admin — UI ONLY for now.
 * Any non-empty input opens the screen; the note says the server check comes later.
 * No passcode is stored or compared here (ADMIN_PASSCODE lives on the server only).
 * Later: send the value as `x-admin-passcode` and open only on a 200 from the API.
 */
export function PasscodeGate({ children }: { children: (passcode: string) => ReactNode }) {
  const { t } = useCopy();
  const [value, setValue] = useState('');
  const [passcode, setPasscode] = useState<string | null>(null);
  const [showEmpty, setShowEmpty] = useState(false);
  const inputId = useId();
  const errorId = useId();
  const noteId = useId();

  if (passcode !== null) return <>{children(passcode)}</>;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (!v) {
      setShowEmpty(true);
      return;
    }
    setPasscode(v);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <h2 className="text-[22px] font-extrabold">{t.ops.gate.title}</h2>
      <div className="flex flex-col gap-2">
        <label htmlFor={inputId} className="text-[15px] font-bold">
          {t.ops.gate.label}
        </label>
        <input
          id={inputId}
          type="password"
          autoComplete="current-password"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (showEmpty) setShowEmpty(false);
          }}
          aria-invalid={showEmpty || undefined}
          aria-describedby={`${showEmpty ? errorId + ' ' : ''}${noteId}`}
          className="min-h-12 w-full rounded-md border-2 border-ink bg-receipt px-3 text-[17px] text-ink"
        />
        {showEmpty && (
          <p
            id={errorId}
            role="alert"
            className="flex items-center gap-1 self-start rounded-md border-2 border-ink bg-pink px-2 py-0.5 text-[15px] font-bold text-ink"
          >
            <AlertIcon />
            {t.ops.gate.empty}
          </p>
        )}
      </div>
      <Button type="submit" tone="lime">
        {t.ops.gate.submit}
      </Button>
      <p
        id={noteId}
        className="rounded-md border-2 border-ink bg-sky px-3 py-2 text-[15px] text-ink"
      >
        {t.ops.gate.note}
      </p>
    </form>
  );
}
