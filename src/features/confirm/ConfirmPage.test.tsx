import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import type { TagReading } from '../../../shared/tag.js';
import { ko } from '../../copy/ko';
import { LanguageProvider } from '../../lib/language';
import { HomePage } from '../home/HomePage';
import type { ReadTagOutcome } from '../capture/readTagClient';
import { scanStore, type ScanDeps } from '../capture/scanSession';
import { ConfirmPage } from './ConfirmPage';

const render = (node: React.ReactNode) =>
  renderToString(
    <LanguageProvider initialLang="ko">
      <MemoryRouter>{node}</MemoryRouter>
    </LanguageProvider>,
  );

const base: TagReading = {
  image_kind: 'shelf_tag',
  product_name_raw: '다우니 실내건조 2.6L',
  brand: '다우니',
  product_name: '섬유유연제 실내건조',
  variant: '실내건조',
  per_item_amount: 2600,
  per_item_unit: 'ml',
  item_count: 1,
  store_price: 9980,
  regular_price: null,
  promo: { type: 'none', text: null, n: null, m: null },
  tag_unit_price: { price: 384, per_amount: 100, per_unit: 'ml' },
  barcode_digits: null,
  multiple_tags_visible: false,
  confidence: { product: 0.95, size: 0.95, price: 0.95 },
  notes: null,
};

function deps(outcome: ReadTagOutcome): ScanDeps {
  return {
    compressImage: async () => ({ base64: 'QUJD', bytes: 3, blob: new Blob(['x']) }),
    decodeBarcode: async () => null,
    getAccessToken: async () => ({ token: 't' }),
    readTag: async () => outcome,
    now: () => 0,
    newId: () => '00000000-0000-4000-8000-000000000001',
  };
}

const scan = (reading: TagReading) =>
  scanStore.startPhotoScan(new Blob(['x']), deps({ ok: true, reading, ms: 1, costKrw: 1 }), null);

const count = (html: string, needle: string) => html.split(needle).length - 1;

afterEach(() => scanStore.reset());

describe('S0 home', () => {
  it('shows the price-tag capture button with the camera input and the one-line hint', () => {
    const html = render(<HomePage />);
    expect(html).toContain(ko.home.cta);
    expect(html).toContain(ko.capture.hint);
    expect(html).toMatch(/<input[^>]*type="file"[^>]*accept="image\/\*"[^>]*capture="environment"/);
    expect(html).toContain(ko.store.names.emart);
    expect(html).toContain(ko.home.manualEntry);
  });
  it('store chips are 48px toggle buttons', () => {
    const html = render(<HomePage />);
    const chip = html.match(/<button[^>]*aria-pressed="false"[^>]*>/)?.[0] ?? '';
    expect(chip).toContain('min-h-12');
  });
});

describe('S2 confirm', () => {
  it('without a scan: says so and offers capture or manual entry', () => {
    const html = render(<ConfirmPage />);
    expect(html).toContain(ko.confirm.noSession);
    expect(html).toContain(ko.home.manualEntry);
  });

  it('a confident reading shows filled fields and no markers', async () => {
    await scan(base);
    const html = render(<ConfirmPage />);
    expect(html).toContain(ko.confirm.title);
    expect(html).toContain('value="다우니"');
    expect(html).toContain('value="9,980"');
    expect(html).not.toContain(ko.confirm.check);
    expect(html).toContain(ko.confirm.cta);
  });

  it('low confidence → pink border AND the words, on the affected fields only', async () => {
    await scan({ ...base, confidence: { product: 0.95, size: 0.95, price: 0.5 } });
    const html = render(<ConfirmPage />);
    expect(count(html, ko.confirm.check)).toBe(1);
    expect(html).toMatch(
      /id="confirm-storePrice"[^>]*border-pink|border-pink[^>]*id="confirm-storePrice"/,
    );
    expect(html).toContain('confirm-storePrice-check');
  });

  it('printed unit price off by more than 5% → warning on size and count', async () => {
    await scan({ ...base, item_count: 2 });
    const html = render(<ConfirmPage />);
    expect(html).toContain('% 달라요');
    expect(html).toContain('confirm-perItemAmount-check');
    expect(html).toContain('confirm-itemCount-check');
    expect(html).not.toContain('confirm-storePrice-check');
  });

  it('unread values are shown as 미확인, never filled in', async () => {
    await scan({
      ...base,
      brand: null,
      per_item_unit: null,
      per_item_amount: null,
      tag_unit_price: null,
    });
    const html = render(<ConfirmPage />);
    expect(html).toContain(`placeholder="${ko.confirm.unread}"`);
    expect(html).not.toContain('value="다우니"');
  });

  it('a package photo puts the store price first with a numeric keypad', async () => {
    await scan({ ...base, image_kind: 'product_package', store_price: null });
    const html = render(<ConfirmPage />);
    expect(html).toContain(ko.confirm.packagePhoto);
    const priceAt = html.indexOf('id="confirm-storePrice"');
    expect(priceAt).toBeGreaterThan(-1);
    expect(priceAt).toBeLessThan(html.indexOf('id="confirm-brand"'));
    expect(html).toMatch(
      /inputMode="numeric"[^>]*id="confirm-storePrice"|id="confirm-storePrice"[^>]*inputMode="numeric"/i,
    );
  });

  it('unreadable (422) → message + [다시 찍기] [직접 입력]', async () => {
    await scanStore.startPhotoScan(
      new Blob(['x']),
      deps({ ok: false, reason: 'unreadable', status: 422 }),
      null,
    );
    const html = render(<ConfirmPage />);
    expect(html).toContain(ko.error.unreadable);
    expect(html).toContain(ko.capture.retake);
    expect(html).toContain(ko.home.manualEntry);
    expect(html).not.toContain(ko.confirm.cta);
  });

  it('not connected → says so, offers manual entry only, no fake reading', async () => {
    await scanStore.startPhotoScan(
      new Blob(['x']),
      {
        ...deps({ ok: true, reading: base, ms: 1, costKrw: 1 }),
        getAccessToken: async () => ({ failure: 'not_connected' }),
      },
      null,
    );
    const html = render(<ConfirmPage />);
    expect(html).toContain(ko.error.notConnected);
    expect(html).not.toContain(ko.capture.retake);
    expect(html).not.toContain('value="다우니"');
  });

  it('manual entry: empty card, no markers, no 미확인 placeholders', () => {
    scanStore.startManual(() => 'm-1', null);
    const html = render(<ConfirmPage />);
    expect(html).toContain(ko.confirm.manualTitle);
    expect(html).not.toContain(ko.confirm.check);
    expect(html).not.toContain(`placeholder="${ko.confirm.unread}"`);
  });

  it('after confirming: a plain "next step" note, no comparison or online price', async () => {
    await scan(base);
    scanStore.confirm({
      scanId: '00000000-0000-4000-8000-000000000001',
      target: {
        brand: '다우니',
        productName: '섬유유연제 실내건조',
        variant: '실내건조',
        perItemAmount: 2600,
        perItemUnit: 'ml',
        itemCount: 1,
      },
      storePrice: 9980,
      promo: { type: 'none', text: null },
      productId: null,
      verified: false,
      barcode: null,
      storeName: 'emart',
    });
    const html = render(<ConfirmPage />);
    expect(html).toContain(ko.next.body);
    expect(html).toContain('9,980');
    expect(html).toContain(ko.store.names.emart);
    // nothing that looks like a comparison result
    expect(html).not.toMatch(/싸요|비교 영수증/);
  });
});
