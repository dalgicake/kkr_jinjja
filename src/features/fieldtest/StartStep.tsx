import { useId, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { CheckBadge } from '../../components/common/Badges';
import { Button } from '../../components/common/Button';
import { SectionBlock } from '../../components/common/SectionBlock';
import { useCopy } from '../../lib/language';
import { canStart } from './session';

export const fieldClass =
  'min-h-12 w-full rounded-md border-2 border-ink bg-receipt px-3 text-[17px] text-ink placeholder:text-muted';

function Checkbox({
  checked,
  onChange,
  children,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <label
      className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border-2 border-ink px-3 py-3 ${
        checked ? 'bg-lime' : 'bg-receipt'
      } text-ink`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-6 shrink-0 accent-ink"
      />
      <span className="flex flex-col gap-1">
        <span className="text-[15px] font-bold">{children}</span>
        {hint && <span className="text-[13px]">{hint}</span>}
      </span>
    </label>
  );
}

/** Participant code + two consent boxes (PLAN 11). Photo consent is required; guardian is for minors. */
export function StartStep({ onStart }: { onStart: (code: string) => void }) {
  const { t } = useCopy();
  const s = t.ops.test;
  const [code, setCode] = useState('');
  const [photo, setPhoto] = useState(false);
  const [guardian, setGuardian] = useState(false);
  const [tried, setTried] = useState(false);
  const codeId = useId();
  const codeErrId = useId();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (canStart(code, photo)) onStart(code.trim().toUpperCase());
  };
  const codeMissing = tried && !code.trim();

  return (
    <SectionBlock tone="lime" id="test-start" title={s.start}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor={codeId} className="text-[15px] font-bold">
            {s.code}
          </label>
          <input
            id={codeId}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={s.codeHint}
            autoCapitalize="characters"
            autoComplete="off"
            aria-invalid={codeMissing || undefined}
            aria-describedby={codeMissing ? codeErrId : undefined}
            className={fieldClass}
          />
          {codeMissing && (
            <div className="flex">
              <CheckBadge id={codeErrId}>{s.needCode}</CheckBadge>
            </div>
          )}
        </div>
        <Checkbox checked={photo} onChange={setPhoto}>
          {s.consentPhoto}
        </Checkbox>
        <Checkbox checked={guardian} onChange={setGuardian} hint={s.guardianHint}>
          {s.consentGuardian}
        </Checkbox>
        {tried && !photo && (
          <div role="alert" className="flex">
            <CheckBadge>{s.needConsent}</CheckBadge>
          </div>
        )}
        <Button type="submit" tone="lime" size="lg">
          {s.start}
        </Button>
      </form>
    </SectionBlock>
  );
}
