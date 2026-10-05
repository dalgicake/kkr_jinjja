// S0/S2 "오늘의 매장" choice, remembered per device. Storage may be missing or throw
// (private mode, blocked site data), so every access is guarded and the app works without it.

export const STORE_IDS = [
  'emart',
  'homeplus',
  'lottemart',
  'megamart',
  'nobrand',
  'hanaro',
] as const;
export type StoreId = (typeof STORE_IDS)[number];

export type StoreChoice = { id: StoreId } | { id: 'other'; name: string };

export const STORE_STORAGE_KEY = 'jinjja.lastStore';
const MAX_NAME_LENGTH = 40;

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): StorageLike | null {
  try {
    // no window (SSR/tests) → no storage; avoids touching Node's experimental localStorage
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

const isStoreId = (v: unknown): v is StoreId =>
  typeof v === 'string' && (STORE_IDS as readonly string[]).includes(v);

export function parseStoreChoice(raw: string | null): StoreChoice | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== 'object' || v === null) return null;
    const { id, name } = v as { id?: unknown; name?: unknown };
    if (isStoreId(id)) return { id };
    if (id === 'other' && typeof name === 'string')
      return { id, name: name.slice(0, MAX_NAME_LENGTH) };
    return null;
  } catch {
    return null;
  }
}

export function readStoreChoice(
  storage: StorageLike | null = defaultStorage(),
): StoreChoice | null {
  try {
    return parseStoreChoice(storage?.getItem(STORE_STORAGE_KEY) ?? null);
  } catch {
    return null;
  }
}

export function writeStoreChoice(
  choice: StoreChoice | null,
  storage: StorageLike | null = defaultStorage(),
): void {
  try {
    if (!storage) return;
    if (choice === null) storage.removeItem(STORE_STORAGE_KEY);
    else storage.setItem(STORE_STORAGE_KEY, JSON.stringify(choice));
  } catch {
    // storage unavailable: the choice just isn't remembered
  }
}

/**
 * Value sent as `storeName`: the stable id for listed stores, the typed name for "기타".
 * An empty "기타" name counts as no store.
 */
export function storeNameForApi(choice: StoreChoice | null): string | null {
  if (!choice) return null;
  if (choice.id !== 'other') return choice.id;
  const name = choice.name.trim();
  return name === '' ? null : name.slice(0, MAX_NAME_LENGTH);
}
