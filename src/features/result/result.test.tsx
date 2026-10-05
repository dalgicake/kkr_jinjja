import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import banned from '../../../scripts/banned-words.json';
import { totalAmount, unitPrice, UNIT_BASE } from '../../../shared/units';
import { en } from '../../copy/en';
import { ko } from '../../copy/ko';
import type { Lang } from '../../lib/i18n';
import { LanguageProvider } from '../../lib/language';
import { findFixture, RESULT_FIXTURES } from './fixtures';
import { ResultPage } from './ResultPage';
import {
  bundleCandidates,
  candidateUnitPrice,
  emphasiseOnline,
  headerTone,
  uncertainCandidates,
  winner,
} from './resultView';
import { VERDICT_TYPES, type PreviewVerdict, type ResultFixture } from './types';

const BANNED: string[] = banned.words;

function get(id: string): ResultFixture {
  const f = RESULT_FIXTURES.find((x) => x.id === id);
  if (!f) throw new Error(id);
  return f;
}

/** Unrounded store unit price for a verdict basis. */
function storeUnitExact(f: ResultFixture, v: PreviewVerdict): number {
  const total = totalAmount({ ...f.target, itemCount: v.store.count });
  if (total === null || v.store.price === null) throw new Error(f.id);
  return (v.store.price / total) * UNIT_BASE[v.store.unit];
}

/** renderToString escapes text; compare against the escaped form. */
const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

function render(path: string, lang?: Lang): string {
  return renderToString(
    <LanguageProvider initialLang={lang}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/result" element={<ResultPage />} />
          <Route path="/preview/result/:type" element={<ResultPage />} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );
}

describe('result fixtures', () => {
  it('cover every PLAN 9 verdict type, with unique ids', () => {
    expect(RESULT_FIXTURES.length).toBeGreaterThanOrEqual(6);
    const types = new Set(RESULT_FIXTURES.map((f) => f.verdict.type));
    for (const type of VERDICT_TYPES) expect(types.has(type), type).toBe(true);
    expect(new Set(RESULT_FIXTURES.map((f) => f.id)).size).toBe(RESULT_FIXTURES.length);
  });

  it('numbers agree with PLAN 9 arithmetic (diff, break-even, close call, unit prices)', () => {
    for (const f of RESULT_FIXTURES) {
      for (const v of [f.verdict, f.verdictWithPromo].filter((x) => x !== undefined)) {
        if (v.store.price !== null) {
          const total = totalAmount({ ...f.target, itemCount: v.store.count });
          expect(v.store.unitPrice, f.id).toBe(unitPrice(v.store.price, total ?? 0, v.store.unit));
        }
        if (v.bestExact && v.store.price !== null) {
          expect(v.bestExact.spec.itemCount, f.id).toBe(v.store.count);
          expect(v.bestExact.relation).toBe('SAME_ITEM');
          expect(v.diff, f.id).toBe(Math.abs(v.store.price - v.bestExact.price));
        }
        if (v.type === 'ONLINE_CHEAPER') {
          expect(v.breakEvenShipping).toBe(v.diff);
          expect(v.closeCall).toBe((v.diff ?? 0) < 3000);
        }
        if (v.bundleInsight) {
          const c = v.bundleInsight.candidate;
          const per =
            (c.price / ((c.spec.perItemAmount ?? 0) * (c.spec.itemCount ?? 0))) *
            UNIT_BASE[v.store.unit];
          expect(v.bundleInsight.pct, f.id).toBe(
            Math.round((1 - per / storeUnitExact(f, v)) * 100),
          );
          expect(v.bundleInsight.total).toBe(c.price);
        }
      }
    }
  });

  it('matches appendix D #1, #4, #8, #12', () => {
    const d1 = get('online-close-call');
    expect([
      d1.verdict.diff,
      d1.verdict.store.unitPrice,
      candidateUnitPrice(d1.candidates[0]!),
    ]).toEqual([1080, 384, 342]);
    const d4 = get('bundle-only-online');
    expect(d4.verdict.store.unitPrice).toBe(177);
    expect(candidateUnitPrice(d4.candidates[0]!)).toBe(154);
    expect(d4.verdict.bundleInsight?.pct).toBe(13);
    const d8 = get('promo-1plus1');
    expect(d8.verdictWithPromo).toMatchObject({
      type: 'STORE_CHEAPER',
      diff: 6520,
      store: { unitPrice: 192 },
    });
    expect(d8.verdictWithPromo?.bundleInsight).toBeUndefined();
    const d12 = get('bundle-only-store');
    expect(d12.verdict.unitWinner).toBe('store');
    expect(candidateUnitPrice(d12.candidates[0]!)).toBe(494);
  });

  it('UNCERTAIN items never reach the verdict (P2)', () => {
    for (const f of RESULT_FIXTURES) {
      for (const v of [f.verdict, f.verdictWithPromo]) {
        expect(v?.bestExact?.relation ?? 'SAME_ITEM').not.toBe('UNCERTAIN');
        expect(v?.bundleInsight?.candidate.relation ?? 'SAME_ITEM').not.toBe('UNCERTAIN');
        if (v) expect(bundleCandidates(f, v).some((c) => c.relation === 'UNCERTAIN')).toBe(false);
      }
    }
    expect(uncertainCandidates(get('no-match')).length).toBe(3);
  });

  it('routes: fixture id, VerdictType (demo links) and fallback', () => {
    expect(findFixture('online-cheaper')?.id).toBe('online-cheaper');
    expect(findFixture('STORE_CHEAPER')?.id).toBe('store-cheaper');
    expect(findFixture('ONLINE_CHEAPER')?.verdict.closeCall).toBe(true); // demo D2
    expect(findFixture('BUNDLE_ONLY')?.id).toBe('bundle-only-online'); // demo D3
    expect(findFixture('nope')).toBeNull();
  });
});

describe('result view rules', () => {
  it('store wins → online is not emphasised (P3); colours carry fixed meanings', () => {
    const store = get('store-cheaper').verdict;
    expect(winner(store)).toBe('store');
    expect(emphasiseOnline(store)).toBe(false);
    expect(emphasiseOnline(get('same-price').verdict)).toBe(false);
    expect(emphasiseOnline(get('online-cheaper').verdict)).toBe(true);
    expect(headerTone(store)).toBe('lime');
    expect(headerTone(get('no-match').verdict)).toBe('pink');
    expect(headerTone(get('need-store-price').verdict)).toBe('pink');
  });
});

describe('result screen', () => {
  for (const f of RESULT_FIXTURES) {
    for (const lang of ['en', 'ko'] as const) {
      it(`${f.id} (${lang}) renders with the P1 label, toggle and scope sentence`, () => {
        const t = lang === 'en' ? en : ko;
        const html = render(`/preview/result/${f.id}`, lang);
        expect(html).toContain('data-testid="example-label"');
        expect(html).toContain(esc(t.ui.exampleLabel));
        expect(html).toContain('data-testid="language-toggle"');
        expect(html).toContain('data-testid="receipt"');
        expect(html).toContain('data-testid="action-bar"');
        expect(html).toMatch(lang === 'en' ? /Naver Shopping results/ : /네이버 쇼핑 검색 결과/);
        const lower = html.toLowerCase();
        for (const w of BANNED) expect(lower.includes(w.toLowerCase()), w).toBe(false);
        if (f.verdict.bestExact || f.verdict.type === 'BUNDLE_ONLY')
          expect(html).toContain(esc(t.result.receipt.shippingUnknown));
      });
    }
  }

  it('English is the default and prices use the shared won formatter', () => {
    const html = render('/result');
    expect(html).toContain(esc(en.result.receipt.title));
    expect(html).toContain('The store is ₩540 cheaper');
    expect(render('/result', 'ko')).toContain('마트가 540원 더 싸요');
  });

  it('store-cheaper: lime band on the store row only; online link stays plain', () => {
    const html = render('/preview/result/store-cheaper');
    expect(html).toContain('data-testid="row-store-cheaper"');
    expect(html).not.toContain('row-online-cheaper');
    expect(html).not.toMatch(/sticker[^"]*bg-sky/);
  });

  it('small online gap shows the pink "shipping could flip this" badge', () => {
    expect(render('/preview/result/online-close-call')).toContain(esc(en.result.verdict.closeCall));
    expect(render('/preview/result/online-cheaper')).not.toContain(
      esc(en.result.verdict.closeCall),
    );
  });

  it('pink headers get a white strip so the pink example label stands alone', () => {
    for (const id of ['no-match', 'need-store-price']) {
      const html = render(`/preview/result/${id}`);
      expect(html.indexOf('data-testid="label-gap"'), id).toBeGreaterThan(-1);
      expect(html.indexOf('data-testid="label-gap"')).toBeLessThan(
        html.indexOf('data-testid="example-label"'),
      );
    }
    expect(render('/preview/result/store-cheaper')).not.toContain('label-gap');
  });

  it('seller link reads naturally and the same-item chips use one selected style', () => {
    expect(render('/preview/result/online-cheaper')).toContain(esc(en.result.link.view));
    expect(en.result.link.view).toBe('Open seller page');
  });

  it('promo example shows the tangerine banner; no-match never names a cheaper side', () => {
    expect(render('/preview/result/promo-1plus1')).toContain('data-testid="promo-banner"');
    const none = render('/preview/result/no-match');
    expect(none).not.toContain('row-store-cheaper');
    expect(none).not.toContain('row-online-cheaper');
    expect(none).toContain(esc(en.result.uncertain.reasons.countUnclear));
  });
});
