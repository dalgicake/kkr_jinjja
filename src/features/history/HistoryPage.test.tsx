import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import banned from '../../../scripts/banned-words.json';
import { en } from '../../copy/en';
import { ko } from '../../copy/ko';
import type { Lang } from '../../lib/i18n';
import { LanguageProvider } from '../../lib/language';
import { HomePage } from '../home/HomePage';
import { HistoryPage, HistoryView } from './HistoryPage';

const render = (node: React.ReactNode, lang: Lang = 'en') =>
  renderToString(
    <LanguageProvider initialLang={lang}>
      <MemoryRouter>{node}</MemoryRouter>
    </LanguageProvider>,
  );
const text = (s: string) => s.replace(/'/g, '&#x27;').replace(/"/g, '&quot;');

describe('S4 /history', () => {
  it('example rows always carry the P1 label, planned on top with Bought it, prices in won', () => {
    const html = render(<HistoryPage />);
    expect(html).toContain('data-testid="example-label"');
    expect(html).toContain(text(en.history.exampleBadge));
    expect(html).toContain('data-testid="language-toggle"');
    expect(html.indexOf(en.history.plannedTitle)).toBeLessThan(
      html.indexOf(en.history.confirmedTitle),
    );
    expect(html.split(`>${en.history.bought}<`).length - 1).toBe(2);
    expect(html).toContain('₩9,980');
    expect(html).toContain(en.history.priceUnknown); // online purchase without an amount
  });
  it('Korean uses 원 after the number', () => {
    const html = render(<HistoryPage />, 'ko');
    expect(html).toContain('9,980원');
    expect(html).toContain(ko.history.exampleBadge);
  });
  it('confirmed list is sorted by next due date', () => {
    const html = render(<HistoryPage />);
    const order = ['코카콜라', '서울우유', '크리넥스', '신라면'].map((s) => html.indexOf(s));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
  it('empty state has no example label and no prices', () => {
    const html = render(<HistoryView records={[]} example onBought={() => {}} />);
    expect(html).toContain('data-testid="history-empty"');
    expect(html).toContain(en.history.emptyTitle);
    expect(html).not.toContain('data-testid="example-label"');
    expect(html).not.toContain('₩');
  });
});

describe('S0 home', () => {
  it('shows 3 labelled example records, Bought it on planned rows, and the other ways in', () => {
    const html = render(<HomePage />);
    expect(html).toContain(en.home.recentExample);
    expect(html.match(/data-testid="home-recent"[\s\S]*?<\/ul>/)?.[0].split('<li').length).toBe(4);
    expect(html).toContain(`>${en.history.bought}<`);
    for (const label of [en.home.cta, en.home.barcode, en.home.manualEntry, en.home.demo])
      expect(html).toContain(label);
    expect(html).toContain('data-testid="capture-input"');
    expect(html).toContain('data-testid="barcode-input"');
  });
  it('never uses banned P4 words in either language', () => {
    for (const lang of ['en', 'ko'] as const) {
      const html = render(
        <>
          <HomePage />
          <HistoryPage />
        </>,
        lang,
      ).toLowerCase();
      for (const w of banned.words) expect(html).not.toContain(w.toLowerCase());
    }
  });
});
