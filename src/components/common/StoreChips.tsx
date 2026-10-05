import { useState } from 'react';
import type { Copy } from '../../copy/ko';
import { useCopy } from '../../lib/language';
import { Chip } from './Chip';
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
export function storeDisplayName(t: Copy, storeName: string | null): string | null {
  if (!storeName) return null;
  return (STORE_IDS as readonly string[]).includes(storeName)
    ? t.store.names[storeName as StoreId]
    : storeName;
}

export function StoreChips({
  value,
  onChange,
}: {
  value: StoreChoice | null;
  onChange: (c: StoreChoice | null) => void;
}) {
  const { t } = useCopy();
  const isOther = value?.id === 'other';
  // butter = store (PLAN 13 colour meanings)
  const chip = (id: StoreId | 'other', label: string) => {
    const selected = value?.id === id;
    return (
      <Chip
        key={id}
        tone="butter"
        selected={selected}
        onClick={() => onChange(selected ? null : id === 'other' ? { id, name: '' } : { id })}
      >
        {label}
      </Chip>
    );
  };
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-[17px] font-extrabold">{t.store.title}</legend>
      <p className="text-[13px] text-muted">{t.store.optional}</p>
      <div className="flex flex-wrap gap-2">
        {STORE_IDS.map((id) => chip(id, t.store.names[id]))}
        {chip('other', t.store.names.other)}
      </div>
      {isOther && (
        <label className="flex flex-col gap-1">
          <span className="text-[15px] font-semibold">{t.store.otherLabel}</span>
          <input
            type="text"
            maxLength={40}
            value={value.name}
            placeholder={t.store.otherPlaceholder}
            onChange={(e) => onChange({ id: 'other', name: e.currentTarget.value })}
            className="min-h-12 w-full rounded-md border-2 border-ink bg-receipt px-3 text-[17px] text-ink placeholder:text-muted"
          />
        </label>
      )}
    </fieldset>
  );
}
