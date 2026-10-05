import { describe, expect, it } from 'vitest';
import { ko } from './ko';
import { en } from './en';
import { fill, splitAt } from '../lib/i18n';

function keyPaths(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keyPaths(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('copy', () => {
  it('ko and en have exactly the same keys', () => {
    expect(keyPaths(en).sort()).toEqual(keyPaths(ko).sort());
  });
  it('every string is non-empty', () => {
    for (const lang of [ko, en]) {
      for (const path of keyPaths(lang)) {
        const value = path
          .split('.')
          .reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], lang);
        expect(typeof value === 'string' && value.length > 0, path).toBe(true);
      }
    }
  });
  it('splitAt splits around one placeholder', () => {
    expect(splitAt('Signed in as {email}.', 'email')).toEqual(['Signed in as ', '.']);
    expect(splitAt('{email} 계정', 'email')).toEqual(['', ' 계정']);
    expect(splitAt('no token', 'email')).toEqual(['no token', '']);
  });

  it('fill replaces placeholders', () => {
    expect(fill(ko.version, { version: '0.001' })).toBe('v0.001');
    expect(fill('{a} {b}', { a: 1 })).toBe('1 {b}');
  });
});
