import { describe, expect, it } from 'vitest';
import {
  STORE_STORAGE_KEY,
  parseStoreChoice,
  readStoreChoice,
  storeNameForApi,
  writeStoreChoice,
} from './storeChoice';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    map,
  };
}

const throwing = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
  removeItem: () => {
    throw new Error('SecurityError');
  },
};

describe('store choice', () => {
  it('remembers the last choice', () => {
    const s = memoryStorage();
    writeStoreChoice({ id: 'emart' }, s);
    expect(readStoreChoice(s)).toEqual({ id: 'emart' });
    writeStoreChoice({ id: 'other', name: '동네마트' }, s);
    expect(readStoreChoice(s)).toEqual({ id: 'other', name: '동네마트' });
    writeStoreChoice(null, s);
    expect(s.map.has(STORE_STORAGE_KEY)).toBe(false);
    expect(readStoreChoice(s)).toBeNull();
  });
  it('survives storage that throws or is missing', () => {
    expect(() => writeStoreChoice({ id: 'emart' }, throwing)).not.toThrow();
    expect(readStoreChoice(throwing)).toBeNull();
    expect(readStoreChoice(null)).toBeNull();
  });
  it('ignores corrupt or unknown stored values', () => {
    expect(parseStoreChoice('{')).toBeNull();
    expect(parseStoreChoice('"emart"')).toBeNull();
    expect(parseStoreChoice('{"id":"costco"}')).toBeNull();
    expect(parseStoreChoice('{"id":"other"}')).toBeNull();
  });
  it('storeName for the API: id, typed name, or null', () => {
    expect(storeNameForApi({ id: 'homeplus' })).toBe('homeplus');
    expect(storeNameForApi({ id: 'other', name: ' 동네마트 ' })).toBe('동네마트');
    expect(storeNameForApi({ id: 'other', name: '  ' })).toBeNull();
    expect(storeNameForApi(null)).toBeNull();
  });
});
