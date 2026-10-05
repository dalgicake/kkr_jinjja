import { en } from '../copy/en';
import { ko, type Copy } from '../copy/ko';

/**
 * Pure language helpers (no React). Components use `useCopy()` from `./language` instead.
 * Default UI language is English; Korean via the ko/en toggle (PLAN 13, 2026-10-05).
 */
export type Lang = 'en' | 'ko';
export const LANGS: readonly Lang[] = ['en', 'ko'];
export const DEFAULT_LANG: Lang = 'en';
export const LANG_STORAGE_KEY = 'jinjja.lang';

const COPIES: Readonly<Record<Lang, Copy>> = { en, ko };

export function copyFor(lang: Lang): Copy {
  return COPIES[lang];
}

export function isLang(v: unknown): v is Lang {
  return v === 'en' || v === 'ko';
}

/** `?lang=ko|en` in a location.search string, or null. */
export function langFromSearch(search: string): Lang | null {
  const v = new URLSearchParams(search).get('lang');
  return isLang(v) ? v : null;
}

/** Order: ?lang= query → stored choice → English. */
export function resolveLang(search: string, stored: string | null): Lang {
  return langFromSearch(search) ?? (isLang(stored) ? stored : DEFAULT_LANG);
}

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 1-12 → "Jan".."Dec", for `{mon}` in en date templates (ko templates ignore it). */
export function monthAbbr(month: number): string {
  return EN_MONTHS[month - 1] ?? String(month);
}

/** Replace `{name}` placeholders. Unknown placeholders are left as-is. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

/**
 * Split a template around its first `{name}` placeholder → [before, after], so the caller can
 * render the value in its own element (e.g. an email that may wrap anywhere). If the
 * placeholder is missing, `before` is the whole template and `after` is ''.
 */
export function splitAt(template: string, name: string): [string, string] {
  const token = `{${name}}`;
  const i = template.indexOf(token);
  return i < 0 ? [template, ''] : [template.slice(0, i), template.slice(i + token.length)];
}
