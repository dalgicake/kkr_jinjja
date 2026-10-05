import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import banned from '../../../scripts/banned-words.json';
import { formatPrice } from '../../../shared/units.js';
import { en } from '../../copy/en';
import { ko } from '../../copy/ko';
import { AuthProvider } from '../../lib/auth';
import type { Lang } from '../../lib/i18n';
import { LanguageProvider } from '../../lib/language';
import { AboutPage } from '../about/AboutPage';
import { DemoPage } from './DemoPage';
import { demoParams, parseDemoState } from './demoFlow';
import { DEMO_SCENARIOS, DEMO_SCENARIO_IDS, resultPreviewPath } from './fixtures';

const render = (url: string, lang: Lang = 'en', node: React.ReactNode = <DemoPage />) =>
  renderToString(
    <LanguageProvider initialLang={lang}>
      <AuthProvider>
        <MemoryRouter initialEntries={[url]}>{node}</MemoryRouter>
      </AuthProvider>
    </LanguageProvider>,
  );

// renderToString escapes quotes/apostrophes; compare against the escaped form.
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

describe('demoFlow', () => {
  it('reads scenario and step from the URL, defaulting safely', () => {
    expect(parseDemoState(new URLSearchParams(''))).toEqual({ scenario: null, step: 1 });
    expect(parseDemoState(new URLSearchParams('s=D2&step=3'))).toEqual({ scenario: 'D2', step: 3 });
    expect(parseDemoState(new URLSearchParams('s=D9&step=2'))).toEqual({ scenario: null, step: 1 });
    expect(parseDemoState(new URLSearchParams('s=D1&step=7'))).toEqual({ scenario: 'D1', step: 1 });
    expect(parseDemoState(new URLSearchParams('s=D3'))).toEqual({ scenario: 'D3', step: 1 });
    expect(demoParams('D1', 2)).toEqual({ s: 'D1', step: '2' });
  });
  it('links each scenario to the result preview keyed by a PLAN 9 verdict type', () => {
    expect(DEMO_SCENARIO_IDS.map((id) => resultPreviewPath(DEMO_SCENARIOS[id]))).toEqual([
      '/preview/result/STORE_CHEAPER?demo=D1',
      '/preview/result/ONLINE_CHEAPER?demo=D2',
      '/preview/result/BUNDLE_ONLY?demo=D3',
    ]);
  });
  it('fixture tag unit prices match price ÷ total size (sanity, not a lookup)', () => {
    const base = { ml: 100, g: 100, m: 10, sheet: 100, ea: 1 } as const;
    for (const s of Object.values(DEMO_SCENARIOS)) {
      const total = (s.target.perItemAmount ?? 1) * s.target.itemCount;
      expect(Math.round((s.storePrice / total) * base[s.tag.unitBase])).toBe(s.tag.unitPrice);
    }
  });
});

describe('/demo screen', () => {
  it('defaults to English with the toggle, banner, example label and three scenarios', () => {
    const html = render('/demo');
    expect(html).toContain(esc(en.demo.title));
    expect(html).toContain('data-testid="language-toggle"');
    expect(html).toContain(esc(en.demo.banner));
    expect(html).toContain('data-testid="example-label"');
    expect(html).toContain(esc(en.ui.exampleLabel));
    for (const id of DEMO_SCENARIO_IDS) expect(html).toContain(esc(en.demo.scenarios[id].title));
    expect(html).not.toContain('demo-price-tag');
  });
  it('step 1 draws the price tag with the shared won formatter (en ₩, ko 원)', () => {
    const s = DEMO_SCENARIOS.D2;
    const enHtml = render('/demo?s=D2&step=1');
    expect(enHtml).toContain('data-testid="demo-price-tag"');
    expect(enHtml).toContain(esc(formatPrice(s.storePrice, 'en')));
    expect(enHtml).toContain('aria-current="step"');
    const koHtml = render('/demo?s=D2&step=1', 'ko');
    expect(koHtml).toContain(formatPrice(s.storePrice, 'ko'));
    expect(koHtml).toContain(ko.demo.banner);
    expect(koHtml).toContain(ko.ui.exampleLabel);
  });
  it('step 2 is a read-only confirm card with exactly one "Please check" field', () => {
    const html = render('/demo?s=D1&step=2');
    expect(html).toContain('data-testid="demo-confirm"');
    expect(html.match(/id="demo-[A-Za-z]+-check"/g)).toEqual(['id="demo-itemCount-check"']);
    expect(html).toContain(esc(en.confirm.check));
    expect(html).not.toMatch(/<input(?![^>]*readOnly)(?![^>]*readonly)[^>]*>/);
  });
  it('step 3 links to /preview/result/<VerdictType>', () => {
    const html = render('/demo?s=D3&step=3');
    expect(html).toContain('href="/preview/result/BUNDLE_ONLY?demo=D3"');
    expect(html).toContain(esc(en.demo.verdicts.BUNDLE_ONLY));
  });
  it('never uses banned P4 words in either language', () => {
    for (const lang of ['en', 'ko'] as const) {
      for (const url of ['/demo', '/demo?s=D1&step=1', '/demo?s=D2&step=2', '/demo?s=D3&step=3']) {
        const html = render(url, lang).toLowerCase();
        for (const w of banned.words) expect(html).not.toContain(w);
      }
    }
  });
});

describe('/about screen', () => {
  it('shows P1~P7 with number chips, the data source and connection status in both languages', () => {
    for (const [lang, c] of [
      ['en', en],
      ['ko', ko],
    ] as const) {
      const html = render('/about', lang, <AboutPage />);
      for (let n = 1; n <= 7; n++) expect(html).toContain(`>P${n}</span>`);
      expect(html).toContain(esc(c.about.source));
      expect(html).toContain('data-testid="connection-status"');
      expect(html).toContain('data-testid="language-toggle"');
    }
  });
});
