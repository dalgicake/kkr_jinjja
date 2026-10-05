import { describe, expect, it } from 'vitest';
import { en } from '../copy/en';
import { ko } from '../copy/ko';
import { DEFAULT_LANG, copyFor, langFromSearch, resolveLang } from './i18n';

describe('language choice', () => {
  it('defaults to English', () => {
    expect(DEFAULT_LANG).toBe('en');
    expect(resolveLang('', null)).toBe('en');
    expect(resolveLang('', 'fr')).toBe('en');
  });
  it('uses the stored choice', () => {
    expect(resolveLang('', 'ko')).toBe('ko');
  });
  it('?lang= wins over the stored choice; junk is ignored', () => {
    expect(resolveLang('?lang=ko', 'en')).toBe('ko');
    expect(resolveLang('?debug&lang=en', 'ko')).toBe('en');
    expect(langFromSearch('?lang=jp')).toBeNull();
    expect(resolveLang('?lang=jp', 'ko')).toBe('ko');
  });
  it('maps languages to their copy', () => {
    expect(copyFor('en')).toBe(en);
    expect(copyFor('ko')).toBe(ko);
  });
});
