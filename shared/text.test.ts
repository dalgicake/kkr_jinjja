import { describe, expect, it } from 'vitest';
import { normalizeText } from './text.js';

describe('normalizeText', () => {
  it('drops case, width, spaces, punctuation and symbols', () => {
    expect(normalizeText(' P&G  다우니 ')).toBe('pg다우니');
    expect(normalizeText('ＣＪ 햇반')).toBe('cj햇반');
    expect(normalizeText('Downy')).toBe(normalizeText('downy'));
  });
  it('empty or null → null (unread, not "")', () => {
    expect(normalizeText(null)).toBeNull();
    expect(normalizeText(' - ')).toBeNull();
  });
});
