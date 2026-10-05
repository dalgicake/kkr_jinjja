import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import banned from '../../../scripts/banned-words.json';
import { en } from '../../copy/en';
import { ko } from '../../copy/ko';
import type { Lang } from '../../lib/i18n';
import { LanguageProvider } from '../../lib/language';
import { AdminBody, AdminPage } from '../admin/AdminPage';
import { EXAMPLE_PRODUCTS } from '../admin/fixtures';
import { FieldTestPage } from '../fieldtest/FieldTestPage';
import { EXAMPLE_STATS } from './fixtures';
import { barWidth, clock, secondsLabel, shortDate } from './format';
import { StatsBody } from './StatsBody';
import { toggleMode } from './StatsFilters';
import { StatsPage } from './StatsPage';

const render = (node: ReactNode, lang?: Lang) =>
  renderToString(
    <LanguageProvider initialLang={lang}>
      <MemoryRouter>{node}</MemoryRouter>
    </LanguageProvider>,
  );

const words: readonly string[] = banned.words;
const noBanned = (html: string) => {
  const lower = html.toLowerCase();
  for (const w of words) expect(lower).not.toContain(w.toLowerCase());
};

describe('ops format helpers', () => {
  it('formats seconds, clock, dates and bar widths', () => {
    expect(secondsLabel(en, 6200)).toBe('6.2s');
    expect(secondsLabel(ko, 74000)).toBe('74초');
    expect(clock(74000)).toBe('1:14');
    expect(clock(8100)).toBe('0:08');
    expect(shortDate('2026-10-05', 'en')).toBe('Oct 5');
    expect(shortDate('2026-10-05', 'ko')).toBe('10월 5일');
    expect(barWidth(0, 10)).toBe('0%');
    expect(barWidth(1, 1000)).toBe('2%');
    expect(barWidth(5, 10)).toBe('50%');
  });
  it('mode filter never ends up empty and keeps a fixed order', () => {
    expect(toggleMode(['normal', 'test'], 'demo')).toEqual(['normal', 'test', 'demo']);
    expect(toggleMode(['test'], 'normal')).toEqual(['normal', 'test']);
    expect(toggleMode(['test'], 'test')).toEqual(['test']);
  });
});

describe('/stats, /admin, /test shells', () => {
  it('gated pages default to English, show the toggle and no example numbers before the gate', () => {
    for (const page of [<StatsPage key="s" />, <AdminPage key="a" />]) {
      const html = render(page);
      expect(html).toContain('data-testid="language-toggle"');
      expect(html).toContain(en.ops.gate.note);
      expect(html).not.toContain('data-testid="example-label"');
      expect(html).not.toContain('₩');
    }
  });

  it('stats body: P1 label, won in the current language, demo excluded by default', () => {
    const enHtml = render(<StatsBody />, 'en');
    expect(enHtml).toContain('data-testid="example-label"');
    expect(enHtml).toContain(en.ui.exampleLabel);
    expect(enHtml).toContain('₩61,400');
    expect(enHtml).toContain(en.ops.stats.savingsSub);
    const koHtml = render(<StatsBody />, 'ko');
    expect(koHtml).toContain(ko.ui.exampleLabel);
    expect(koHtml).toContain('61,400원');
    const storeSaid = EXAMPLE_STATS.verdicts.STORE_CHEAPER + EXAMPLE_STATS.verdicts.SAME_PRICE;
    expect(koHtml).toContain(`${storeSaid}건`);
    for (const v of Object.values(ko.ops.stats.verdictTypes)) expect(koHtml).toContain(v);
    expect(koHtml).toMatch(/aria-pressed="false"[^>]*>(<[^>]+>)*데모/);
    noBanned(enHtml);
    noBanned(koHtml);
  });

  it('admin body: P1 label, every example product and [Search Naver]', () => {
    const html = render(<AdminBody />, 'en');
    expect(html).toContain(en.ui.exampleLabel);
    expect(html).toContain(en.ops.admin.search);
    for (const p of EXAMPLE_PRODUCTS) expect(html).toContain(p.label);
    expect(html).toContain(en.ops.admin.reportKinds.wrong_size);
    noBanned(html);
    expect(render(<AdminBody />, 'ko')).toContain(ko.ops.admin.uploadTitle);
  });

  it('field test: practice label, facilitator notes and consent boxes in both languages', () => {
    for (const [lang, t] of [
      ['en', en],
      ['ko', ko],
    ] as const) {
      const html = render(<FieldTestPage />, lang);
      expect(html).toContain('data-testid="language-toggle"');
      expect(html).toContain(t.ops.practice);
      expect(html).toContain(t.ops.test.guide1);
      expect(html).toContain(t.ops.test.consentPhoto);
      expect(html).toContain(t.ops.test.consentGuardian);
      noBanned(html);
    }
  });
});
