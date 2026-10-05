import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { CheckBadge } from '../../components/common/Badges';
import { Button } from '../../components/common/Button';
import { useCopy } from '../../lib/language';
import { parseWonInput } from './historyLogic';

/**
 * S4 [Bought it] on a planned (online) row. P5: only this tap turns a plan into a purchase.
 * Closed: one lime button. Open: optional "amount you paid" (blank stays "not entered", never guessed).
 */
export function BoughtForm({ onSave }: { onSave: (pricePaid: number | null) => void }) {
  const { t } = useCopy();
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState('');
  const [invalid, setInvalid] = useState(false);
  const id = useId();

  if (!open) {
    return (
      <Button tone="lime" full={false} onClick={() => setOpen(true)}>
        {t.history.bought}
      </Button>
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseWonInput(raw);
    if (!parsed.ok) {
      setInvalid(true);
      return;
    }
    onSave(parsed.value);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 border-l-4 border-ink pl-3" noValidate>
      <label htmlFor={`${id}-price`} className="text-[15px] font-bold">
        {t.history.actualPriceLabel}
      </label>
      <input
        id={`${id}-price`}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        autoFocus
        value={raw}
        aria-invalid={invalid}
        aria-describedby={`${id}-hint${invalid ? ` ${id}-error` : ''}`}
        onChange={(e) => {
          setRaw(e.currentTarget.value);
          setInvalid(false);
        }}
        className={`price min-h-12 w-full rounded-md border-2 bg-receipt px-3 text-[17px] text-ink tabular-nums ${
          invalid ? 'border-pink' : 'border-ink'
        }`}
      />
      <p id={`${id}-hint`} className="text-[13px] text-muted">
        {t.history.actualPriceHint}
      </p>
      {invalid && <CheckBadge id={`${id}-error`}>{t.history.invalidPrice}</CheckBadge>}
      <div className="grid grid-cols-2 gap-3">
        <Button type="submit" tone="lime">
          {t.history.save}
        </Button>
        <Button tone="white" onClick={() => setOpen(false)}>
          {t.history.cancel}
        </Button>
      </div>
    </form>
  );
}
