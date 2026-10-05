import { describe, expect, it } from 'vitest';
import type { TagReading } from '../../../shared/tag.js';
import { newScanId } from './ids';
import {
  MAX_IMAGE_BYTES,
  failureForStatus,
  postReadTag,
  toRawBase64,
  type ReadTagOutcome,
} from './readTagClient';
import { createScanStore, type ScanDeps } from './scanSession';

const reading: TagReading = {
  image_kind: 'shelf_tag',
  product_name_raw: '신라면 5입',
  brand: '농심',
  product_name: '신라면',
  variant: null,
  per_item_amount: 120,
  per_item_unit: 'g',
  item_count: 5,
  store_price: 4980,
  regular_price: null,
  promo: { type: 'none', text: null, n: null, m: null },
  tag_unit_price: null,
  barcode_digits: null,
  multiple_tags_visible: false,
  confidence: { product: 0.9, size: 0.9, price: 0.9 },
  notes: null,
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('postReadTag', () => {
  it('sends the bearer token and raw base64, returns the validated reading', async () => {
    let sent: { url: string; init: RequestInit } | null = null;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      sent = { url, init };
      return json(200, { ocr: reading, ms: 3200, costKrw: 31.5 });
    }) as typeof fetch;
    const out = await postReadTag(
      {
        scanId: 's1',
        imageBase64: 'data:image/jpeg;base64,QUJD',
        mode: 'normal',
        storeName: 'emart',
      },
      { accessToken: 'tok', fetchImpl },
    );
    expect(out).toEqual({ ok: true, reading, ms: 3200, costKrw: 31.5 });
    expect(sent!.url).toBe('/api/read-tag');
    expect((sent!.init.headers as Record<string, string>).authorization).toBe('Bearer tok');
    expect(JSON.parse(sent!.init.body as string)).toEqual({
      scanId: 's1',
      imageBase64: 'QUJD',
      mode: 'normal',
      storeName: 'emart',
    });
  });
  it('maps HTTP errors', async () => {
    for (const [status, reason] of [
      [422, 'unreadable'],
      [429, 'rate_limited'],
      [401, 'auth'],
      [413, 'too_large'],
      [500, 'server'],
      [404, 'server'],
    ] as const) {
      const out = await postReadTag(
        { scanId: 's', imageBase64: 'x', mode: 'normal' },
        { accessToken: 't', fetchImpl: (async () => json(status, { error: 'x' })) as typeof fetch },
      );
      expect(out).toEqual({ ok: false, reason, status });
    }
    expect(failureForStatus(403)).toBe('auth');
    expect(failureForStatus(503)).toBe('not_connected');
    expect(failureForStatus(500)).toBe('server');
    const unsupported = await postReadTag(
      { scanId: 's', imageBase64: 'x', mode: 'normal' },
      {
        accessToken: 't',
        fetchImpl: (async () => json(400, { error: 'unsupported_image' })) as typeof fetch,
      },
    );
    expect(unsupported).toEqual({ ok: false, reason: 'image', status: 400 });
  });
  it('accepts costKrw null (model without a price entry)', async () => {
    const out = await postReadTag(
      { scanId: 's', imageBase64: 'x', mode: 'normal' },
      {
        accessToken: 't',
        fetchImpl: (async () => json(200, { ocr: reading, ms: 10, costKrw: null })) as typeof fetch,
      },
    );
    expect(out).toEqual({ ok: true, reading, ms: 10, costKrw: null });
  });
  it('a malformed or unreadable 200 is never shown as a reading', async () => {
    const call = (body: unknown) =>
      postReadTag(
        { scanId: 's', imageBase64: 'x', mode: 'normal' },
        { accessToken: 't', fetchImpl: (async () => json(200, body)) as typeof fetch },
      );
    expect(await call({ ocr: { ...reading, store_price: 'cheap' } })).toMatchObject({
      ok: false,
      reason: 'server',
    });
    expect(await call({})).toMatchObject({ ok: false, reason: 'server' });
    expect(await call({ ocr: { ...reading, image_kind: 'receipt' } })).toMatchObject({
      ok: false,
      reason: 'unreadable',
    });
    const notJson = (async () => new Response('<html>', { status: 200 })) as typeof fetch;
    expect(
      await postReadTag(
        { scanId: 's', imageBase64: 'x', mode: 'normal' },
        { accessToken: 't', fetchImpl: notJson },
      ),
    ).toMatchObject({ ok: false, reason: 'server' });
  });
  it('network errors and timeouts are "network"', async () => {
    const offline = (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    expect(
      await postReadTag(
        { scanId: 's', imageBase64: 'x', mode: 'normal' },
        { accessToken: 't', fetchImpl: offline },
      ),
    ).toEqual({ ok: false, reason: 'network' });
    const hang = ((_: string, init: RequestInit) =>
      new Promise((_r, reject) =>
        init.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        ),
      )) as typeof fetch;
    expect(
      await postReadTag(
        { scanId: 's', imageBase64: 'x', mode: 'normal' },
        { accessToken: 't', fetchImpl: hang, timeoutMs: 5 },
      ),
    ).toEqual({ ok: false, reason: 'network' });
  });
  it('toRawBase64 leaves raw base64 alone', () => {
    expect(toRawBase64('QUJD')).toBe('QUJD');
    expect(toRawBase64('data:image/jpeg;base64,QUJD')).toBe('QUJD');
  });
});

function fakeDeps(over: Partial<ScanDeps> = {}): ScanDeps & { requests: unknown[] } {
  const requests: unknown[] = [];
  let clock = 1000;
  return {
    requests,
    compressImage: async () => ({ base64: 'QUJD', bytes: 3, blob: new Blob(['x']) }),
    decodeBarcode: async () => null,
    getAccessToken: async () => ({ token: 'tok' }),
    readTag: async (req): Promise<ReadTagOutcome> => {
      requests.push(req);
      return { ok: true, reading, ms: 1, costKrw: 1 };
    },
    now: () => (clock += 500),
    newId: () => 'scan-1',
    ...over,
  };
}

describe('scan session pipeline', () => {
  it('records t0, reads the tag and measures shutter → card', async () => {
    const store = createScanStore();
    const deps = fakeDeps();
    const p = store.startPhotoScan(new Blob(['img']), deps, 'emart');
    expect(store.getState().session).toMatchObject({
      status: 'reading',
      t0: 1500,
      scanId: 'scan-1',
    });
    await p;
    expect(store.getState().session).toMatchObject({
      status: 'ready',
      reading,
      readyMs: 500,
      failure: null,
    });
    expect(deps.requests).toEqual([
      { scanId: 'scan-1', imageBase64: 'QUJD', mode: 'normal', storeName: 'emart' },
    ]);
  });
  it('reports readyMs for the latency log, only for a ready reading', async () => {
    const seen: number[] = [];
    const store = createScanStore();
    await store.startPhotoScan(
      new Blob(['img']),
      fakeDeps({ onReady: (ms) => seen.push(ms) }),
      null,
    );
    expect(seen).toEqual([500]);
    await store.startPhotoScan(
      new Blob(['img']),
      fakeDeps({
        onReady: (ms) => seen.push(ms),
        readTag: async () => ({ ok: false, reason: 'unreadable' }),
      }),
      null,
    );
    expect(seen).toEqual([500]);
    // a throwing logger never breaks the scan
    const s2 = createScanStore();
    await s2.startPhotoScan(
      new Blob(['img']),
      fakeDeps({
        onReady: () => {
          throw new Error('storage');
        },
      }),
      null,
    );
    expect(s2.getState().session?.status).toBe('ready');
  });
  it('not connected: fails without calling the API and without a fake reading', async () => {
    const store = createScanStore();
    const deps = fakeDeps({ getAccessToken: async () => ({ failure: 'not_connected' }) });
    await store.startPhotoScan(new Blob(['img']), deps, null);
    expect(store.getState().session).toMatchObject({
      status: 'failed',
      failure: 'not_connected',
      reading: null,
    });
    expect(deps.requests).toEqual([]);
  });
  it('image errors and oversized photos fail before upload', async () => {
    const store = createScanStore();
    const broken = fakeDeps({
      compressImage: async () => Promise.reject(new Error('decode_failed')),
    });
    await store.startPhotoScan(new Blob(['img']), broken, null);
    expect(store.getState().session?.failure).toBe('image');
    const huge = fakeDeps({
      compressImage: async () => ({
        base64: 'x',
        bytes: MAX_IMAGE_BYTES + 1,
        blob: new Blob(['x']),
      }),
    });
    await store.startPhotoScan(new Blob(['img']), huge, null);
    expect(store.getState().session?.failure).toBe('too_large');
    expect([...broken.requests, ...huge.requests]).toEqual([]);
  });
  it('passes API failures through (422 unreadable) and survives a throwing client', async () => {
    const store = createScanStore();
    await store.startPhotoScan(
      new Blob(['img']),
      fakeDeps({ readTag: async () => ({ ok: false, reason: 'unreadable', status: 422 }) }),
      null,
    );
    expect(store.getState().session).toMatchObject({
      status: 'failed',
      failure: 'unreadable',
      reading: null,
    });
    await store.startPhotoScan(
      new Blob(['img']),
      fakeDeps({ readTag: async () => Promise.reject(new Error('boom')) }),
      null,
    );
    expect(store.getState().session?.failure).toBe('network');
  });
  it('the decoded barcode lands on the session independently', async () => {
    const store = createScanStore();
    await store.startPhotoScan(
      new Blob(['img']),
      fakeDeps({ decodeBarcode: async () => '8801043014809' }),
      null,
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(store.getState().session).toMatchObject({ status: 'ready', barcode: '8801043014809' });
  });
  it('a retake ignores the late result of the previous scan', async () => {
    const store = createScanStore();
    let release: (o: ReadTagOutcome) => void = () => undefined;
    const slow = fakeDeps({
      newId: () => 'old',
      readTag: () => new Promise((r) => (release = r)),
    });
    const first = store.startPhotoScan(new Blob(['a']), slow, null);
    await new Promise((r) => setTimeout(r, 0));
    await store.startPhotoScan(new Blob(['b']), fakeDeps({ newId: () => 'new' }), null);
    release({ ok: false, reason: 'unreadable' });
    await first;
    expect(store.getState().session).toMatchObject({ scanId: 'new', status: 'ready' });
  });
  it('manual entry starts an empty card; confirm only applies to the current scan', () => {
    const store = createScanStore();
    const seen: number[] = [];
    const off = store.subscribe(() => seen.push(1));
    store.startManual(() => 'manual-1', 'homeplus');
    expect(store.getState().session).toMatchObject({
      source: 'manual',
      status: 'ready',
      reading: null,
      t0: null,
    });
    const confirmed = {
      scanId: 'other',
      target: {
        brand: 'a',
        productName: 'b',
        variant: null,
        perItemAmount: null,
        perItemUnit: 'ea' as const,
        itemCount: 1,
      },
      storePrice: 1000,
      promo: { type: 'none' as const, text: null },
      productId: null,
      verified: false,
      barcode: null,
      storeName: null,
    };
    store.confirm(confirmed);
    expect(store.getState().confirmed).toBeNull();
    store.confirm({ ...confirmed, scanId: 'manual-1' });
    expect(store.getState().confirmed?.scanId).toBe('manual-1');
    store.unconfirm();
    expect(store.getState().confirmed).toBeNull();
    off();
    store.reset();
    expect(seen.length).toBe(3); // start, confirm, unconfirm — not the rejected confirm, not after unsubscribe
  });
});

describe('newScanId', () => {
  it('uses randomUUID when present, else builds a v4 UUID', () => {
    expect(
      newScanId({
        randomUUID: () => 'a-b-c-d-e' as `${string}-${string}-${string}-${string}-${string}`,
        getRandomValues: (a) => a,
      }),
    ).toBe('a-b-c-d-e');
    const id = newScanId({ getRandomValues: <T extends ArrayBufferView | null>(a: T) => a });
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(newScanId()).toMatch(/^[0-9a-f-]{36}$/);
  });
});
