import { renderToString } from 'react-dom/server';
import { MemoryRouter, matchPath } from 'react-router';
import { describe, expect, it } from 'vitest';
import banned from '../../../scripts/banned-words.json';
import { en } from '../../copy/en';
import { ko } from '../../copy/ko';
import type { Lang } from '../../lib/i18n';
import { LanguageProvider } from '../../lib/language';
import { ROUTES } from '../../routes';
import { HomePage } from '../home/HomePage';
import { RESULT_FIXTURES } from '../result/fixtures';
import { ScreensPage } from './ScreensPage';
import { tourGroups } from './tour';

const render = (node: React.ReactNode, lang: Lang = 'en') =>
  renderToString(
    <LanguageProvider initialLang={lang}>
      <MemoryRouter>{node}</MemoryRouter>
    </LanguageProvider>,
  );

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/'/g, '&#x27;');

describe('/screens tour', () => {
  it('links every route in the route table', () => {
    const stops = tourGroups(en).flatMap((g) => g.stops.map((s) => s.to.split('?')[0] ?? ''));
    for (const r of ROUTES) {
      if (r.path === 'screens' || r.path === 'result') continue; // itself; same as the first example
      expect(
        stops.some((p) => matchPath(`/${r.path}`, p)),
        r.path,
      ).toBe(true);
    }
    for (const p of stops)
      expect(p === '/' || ROUTES.some((r) => matchPath(`/${r.path}`, p)), p).toBe(true);
  });

  it('lists every result example with its one-line description, in English by default', () => {
    const html = render(<ScreensPage />);
    expect(html).toContain(en.screens.title);
    for (const f of RESULT_FIXTURES) {
      expect(html).toContain(`href="/preview/result/${f.id}"`);
      expect(html).toContain(esc(en.screens.verdicts[f.nameKey]));
    }
    expect(html).toContain('data-testid="language-toggle"');
  });

  it('switches to Korean and never uses banned P4 words', () => {
    const koHtml = render(<ScreensPage />, 'ko');
    expect(koHtml).toContain(ko.screens.title);
    for (const html of [koHtml, render(<ScreensPage />)].map((h) => h.toLowerCase()))
      for (const w of banned.words) expect(html).not.toContain(w.toLowerCase());
  });

  it('colours follow fixed meanings: 1+1 row is tangerine (promo), demo rows never tangerine/sky', () => {
    const groups = tourGroups(en);
    const results = groups.find((g) => g.id === 'results');
    const promo = results?.stops.find((s) => s.to === '/preview/result/promo-1plus1');
    expect(promo?.tone).toBe('tangerine');
    for (const s of results?.stops ?? [])
      if (s !== promo) expect(s.tone).not.toBe('tangerine');
    const demo = groups.find((g) => g.id === 'demo');
    expect(demo?.tone).not.toMatch(/tangerine|sky/);
    for (const s of demo?.stops ?? []) expect(s.tone).not.toMatch(/tangerine|sky/);
  });

  it('is linked from home', () => {
    expect(render(<HomePage />)).toContain('href="/screens"');
  });
});
