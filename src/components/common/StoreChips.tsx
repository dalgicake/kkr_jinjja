import { useState } from 'react';
import { copy } from '../../lib/i18n';
import { CheckIcon } from './Icons';
import {
  STORE_IDS,
  readStoreChoice,
  writeStoreChoice,
  type StoreChoice,
  type StoreId,
} from './storeChoice';

/** Remembered "오늘의 매장" (localStorage, guarded). Choosing is optional. */
export function useStoreChoice(): [StoreChoice | null, (c: StoreChoice | null) => void] {
  const [choice, setChoice] = useState<StoreChoice | null>(() => readStoreChoice());
  const update = (c: StoreChoice | null) => {
    setChoice(c);
    writeStoreChoice(c);
  };
  return [choice, update];
}

/** Display name for a stored storeName (id of a listed store, or a typed name). */
export function storeDisplayName(storeName: string | null): string | null {
  if (!storeName) return null;
  return (STORE_IDS as readonly string[]).includes(storeName)
    ? copy.store.names[storeName as StoreId]
    : storeName;
}

function chipClass(selected: boolean): string {
  const base =
    'inline-flex min-h-12 items-center gap-1 rounded-full border-2 border-ink px-4 text-[15px] font-semibold focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ink';
  return selected ? `${base} bg-ink text-receipt` : `${base} bg-transparent text-ink`;
}

export function StoreChips({
  value,
  onChange,
}: {
  value: StoreChoice | null;
  onChange: (c: StoreChoice | null) => void;
}) {
  const isOther = value?.id === 'other';
  const chip = (id: StoreId | 'other', label: string) => {
    const selected = value?.id === id;
    return (
      <button
        key={id}
        type="button"
        aria-pressed={selected}
        className={chipClass(selected)}
        onClick={() => onChange(selected ? null : id === 'other' ? { id, name: '' } : { id })}
      >
        {selected && <CheckIcon />}
        {label}
      </button>
    );
  };
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-[17px] font-semibold">{copy.store.title}</legend>
      <p className="text-[13px] text-muted">{copy.store.optional}</p>
      <div className="flex flex-wrap gap-2">
        {STORE_IDS.map((id) => chip(id, copy.store.names[id]))}
        {chip('other', copy.store.names.other)}
      </div>
      {isOther && (
        <label className="flex flex-col gap-1">
          <span className="text-[15px] font-semibold">{copy.store.otherLabel}</span>
          <input
            type="text"
            maxLength={40}
            value={value.name}
            placeholder={copy.store.otherPlaceholder}
            onChange={(e) => onChange({ id: 'other', name: e.currentTarget.value })}
            className="min-h-12 w-full rounded-md border border-muted bg-receipt px-3 text-[17px] text-ink placeholder:text-muted"
          />
        </label>
      )}
    </fieldset>
  );
}
