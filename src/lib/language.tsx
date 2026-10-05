import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { formatPrice } from '../../shared/units.js';
import type { Copy } from '../copy/ko';
import { DEFAULT_LANG, LANG_STORAGE_KEY, copyFor, langFromSearch, resolveLang } from './i18n';
import type { Lang } from './i18n';

export interface CopyApi {
  /** all UI strings for the current language */
  t: Copy;
  lang: Lang;
  /** switches and remembers the language (localStorage, guarded) */
  setLang: (lang: Lang) => void;
  /** integer won → "₩9,980" (en) or "9,980원" (ko) */
  won: (amount: number) => string;
}

function storage(): Storage | null {
  try {
    // no window (SSR/tests) → no storage
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readStored(): string | null {
  try {
    return storage()?.getItem(LANG_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function writeStored(lang: Lang): void {
  try {
    storage()?.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // private mode or blocked storage: the choice just isn't remembered
  }
}

function initialLang(): Lang {
  if (typeof window === 'undefined') return DEFAULT_LANG;
  const fromQuery = langFromSearch(window.location.search);
  if (fromQuery) writeStored(fromQuery);
  return resolveLang(window.location.search, readStored());
}

function api(lang: Lang, setLang: (l: Lang) => void): CopyApi {
  return { t: copyFor(lang), lang, setLang, won: (n) => formatPrice(n, lang) };
}

const LanguageContext = createContext<CopyApi>(api(DEFAULT_LANG, () => {}));

/**
 * Wrap the app once. `initialLang` is for tests/SSR; in the browser the language comes from
 * `?lang=ko|en` (also persisted), then the stored choice, then English.
 */
export function LanguageProvider({
  initialLang: forced,
  children,
}: {
  initialLang?: Lang;
  children: ReactNode;
}) {
  const [lang, setLangState] = useState<Lang>(() => forced ?? initialLang());
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    writeStored(l);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = copyFor(lang).app.name;
  }, [lang]);
  const value = useMemo(() => api(lang, setLang), [lang, setLang]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/** `const { t, lang, setLang, won } = useCopy();` */
export function useCopy(): CopyApi {
  return useContext(LanguageContext);
}
