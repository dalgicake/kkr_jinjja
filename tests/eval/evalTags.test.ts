import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import type { MessagesClient } from '../../server/anthropic.js';
import type { TagReading } from '../../shared/tag.js';
import {
  FIELDS,
  aggregate,
  allModelApiErrors,
  buildDraft,
  groupByStore,
  createReadTagCore,
  interpretReadTagBody,
  median,
  normalizeText,
  parseArgs,
  parseGroundTruth,
  planFixtures,
  readMeta,
  renderReport,
  scoreBrand,
  scoreCount,
  scorePromoType,
  scoreReading,
  scoreSize,
  scoreStorePrice,
  scoreVariant,
  type ImageResult,
} from '../../scripts/evalTags/index.js';

/** Test data only (Downy shelf tag shape from shared/tag.test.ts). */
function reading(over: Partial<TagReading> = {}): TagReading {
  return {
    image_kind: 'shelf_tag',
    product_name_raw: '다우니 섬유유연제 실내건조 2.6L',
    brand: '다우니',
    product_name: '섬유유연제 실내건조',
    variant: '실내건조',
    per_item_amount: 2600,
    per_item_unit: 'ml',
    item_count: 1,
    store_price: 9980,
    regular_price: 12900,
    promo: { type: 'none', text: null, n: null, m: null },
    tag_unit_price: { price: 384, per_amount: 100, per_unit: 'ml' },
    barcode_digits: null,
    multiple_tags_visible: false,
    confidence: { product: 0.95, size: 0.9, price: 0.98 },
    notes: null,
    ...over,
  };
}

function row(
  id: string,
  scores: ImageResult['scores'],
  storeName: string | null = null,
): ImageResult {
  return {
    id,
    storeName,
    truth: reading(),
    pred: reading(),
    error: null,
    scores,
    ms: 1000,
    costKrw: 30,
  };
}

const allTrue = Object.fromEntries(FIELDS.map((f) => [f, true])) as ImageResult['scores'];

describe('7.4 field scoring', () => {
  it('store price: exact integer match only', () => {
    expect(scoreStorePrice(9980, 9980)).toBe(true);
    expect(scoreStorePrice(9980, 9990)).toBe(false);
    expect(scoreStorePrice(null, 9980)).toBe(false);
    expect(scoreStorePrice(null, null)).toBe(true);
  });

  it('brand: normalized (case, spaces, punctuation, NFKC) match', () => {
    expect(normalizeText(' P&G  다우니 ')).toBe('pg다우니');
    expect(scoreBrand('다우니', ' 다우니 ')).toBe(true);
    expect(scoreBrand('CJ 제일제당', 'cj제일제당')).toBe(true);
    expect(scoreBrand('ＣＪ', 'cj')).toBe(true); // full-width
    expect(scoreBrand('다우니', '피죤')).toBe(false);
    expect(scoreBrand(null, '다우니')).toBe(false);
    expect(scoreBrand('', null)).toBe(true); // blank is "not printed"
    expect(scoreBrand(null, null)).toBe(true);
  });

  it('per-item amount: within 1% AND same unit', () => {
    const t = { amount: 2600, unit: 'ml' };
    expect(scoreSize({ amount: 2600, unit: 'ml' }, t)).toBe(true);
    expect(scoreSize({ amount: 2626, unit: 'ml' }, t)).toBe(true); // exactly 1%
    expect(scoreSize({ amount: 2574, unit: 'ml' }, t)).toBe(true);
    expect(scoreSize({ amount: 2627, unit: 'ml' }, t)).toBe(false);
    expect(scoreSize({ amount: 2600, unit: 'g' }, t)).toBe(false); // unit differs
    expect(scoreSize({ amount: null, unit: 'ml' }, t)).toBe(false);
    expect(scoreSize({ amount: null, unit: 'ea' }, { amount: null, unit: 'ea' })).toBe(true);
    expect(scoreSize({ amount: 1, unit: 'ea' }, { amount: null, unit: 'ea' })).toBe(false);
  });

  it('count and promo type: exact', () => {
    expect(scoreCount(30, 30)).toBe(true);
    expect(scoreCount(1, 30)).toBe(false);
    expect(scoreCount(null, 1)).toBe(false);
    expect(scorePromoType('n_plus_m', 'n_plus_m')).toBe(true);
    expect(scorePromoType('none', 'n_plus_m')).toBe(false);
  });

  it('variant: normalized match (reference only)', () => {
    expect(scoreVariant('실내 건조', '실내건조')).toBe(true);
    expect(scoreVariant('라벤더', '실내건조')).toBe(false);
  });

  it('scoreReading combines fields; size+count needs both', () => {
    const truth = reading();
    expect(scoreReading(reading(), truth)).toEqual(allTrue);
    const s = scoreReading(reading({ item_count: 2, brand: '다우니 ' }), truth);
    expect(s).toMatchObject({ count: false, size: true, sizeAndCount: false, brand: true });
  });

  it('a failed read (null) is wrong on every field', () => {
    const s = scoreReading(null, reading());
    expect(Object.values(s).every((v) => v === false)).toBe(true);
    expect(Object.keys(s).sort()).toEqual([...FIELDS].sort());
  });
});

describe('aggregation', () => {
  it('counts correct / total per field', () => {
    const a = aggregate([allTrue, { ...allTrue, storePrice: false }]);
    expect(a.storePrice).toEqual({ correct: 1, total: 2, rate: 0.5 });
    expect(a.brand).toEqual({ correct: 2, total: 2, rate: 1 });
  });

  it('nothing scored → rate null (shown as 미확인), never 0 or 100%', () => {
    expect(aggregate([]).storePrice).toEqual({ correct: 0, total: 0, rate: null });
  });

  it('groups by storeName and skips unknown stores', () => {
    const groups = groupByStore([
      row('001', allTrue, '이마트'),
      row('002', { ...allTrue, brand: false }, '이마트'),
      row('003', allTrue, '홈플러스'),
      row('004', allTrue, null),
    ]);
    expect(groups.map((g) => g.storeName)).toEqual(['이마트', '홈플러스']);
    expect(groups[0]?.accuracy.brand).toEqual({ correct: 1, total: 2, rate: 0.5 });
  });

  it('median', () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });
});

describe('fixtures and ground truth', () => {
  it('pairs NNN images with NNN.json / NNN.draft.json and ignores other files', () => {
    const plan = planFixtures([
      '002.jpg',
      '001.JPG',
      '001.json',
      '002.draft.json',
      '003.png',
      '_report.md',
      'README.md',
      '.gitkeep',
      'photo.jpg',
    ]);
    expect(plan.map((p) => [p.id, p.image, p.truthFile, p.draftFile])).toEqual([
      ['001', '001.JPG', '001.json', null],
      ['002', '002.jpg', null, '002.draft.json'],
      ['003', '003.png', null, null],
    ]);
    expect(planFixtures(['.gitkeep', 'README.md'])).toEqual([]);
  });

  it('reads storeName from _meta', () => {
    expect(readMeta({ _meta: { storeName: ' 이마트 ' } })).toEqual({
      storeName: '이마트',
      draft: false,
    });
    expect(readMeta({ _meta: { storeName: '' } }).storeName).toBeNull();
    expect(readMeta({})).toEqual({ storeName: null, draft: false });
  });

  it('accepts ground truth in the shared schema (units re-normalized) and keeps _meta out', () => {
    const json = {
      _meta: { storeName: '홈플러스', draft: false },
      ...reading(),
      per_item_amount: 2.6,
      per_item_unit: 'L',
    };
    const gt = parseGroundTruth(json);
    expect(gt.ok).toBe(true);
    if (gt.ok) {
      expect(gt.truth.per_item_amount).toBe(2600);
      expect(gt.truth.per_item_unit).toBe('ml');
      expect(gt.meta.storeName).toBe('홈플러스');
      expect('_meta' in gt.truth).toBe(false);
    }
  });

  it('refuses a file still marked as draft (7.4: a human must check each field)', () => {
    const gt = parseGroundTruth(
      buildDraft(reading(), { model: 'm', createdAt: 't', unreadable: false }),
    );
    expect(gt.ok).toBe(false);
    if (!gt.ok) expect(gt.error).toMatch(/draft/);
  });

  it('rejects invalid ground truth with the zod path', () => {
    const gt = parseGroundTruth({ ...reading(), store_price: 99.5 });
    expect(gt.ok).toBe(false);
    if (!gt.ok) expect(gt.error).toMatch(/store_price/);
  });

  it('draft keeps the model reading and is flagged draft with storeName to fill', () => {
    const d = buildDraft(reading(), {
      model: 'claude-x',
      createdAt: '2026-10-05T00:00:00Z',
      unreadable: false,
    });
    expect(d._meta).toMatchObject({ draft: true, storeName: null, model: 'claude-x' });
    expect(d.store_price).toBe(9980);
    expect(Object.keys(d)[0]).toBe('_meta');
  });
});

describe('read-tag core (real handleReadTag, fake model, in-memory store)', () => {
  // 4 bytes of JPEG magic is all the handler sniffs; the fake model never looks at pixels.
  const JPEG_BASE64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]).toString('base64');

  function fakeModel(
    replies: ((body: unknown) => unknown)[],
  ): MessagesClient & { calls: unknown[] } {
    const calls: unknown[] = [];
    return {
      calls,
      messages: {
        create: async (body: unknown) => {
          calls.push(body);
          const next = replies.shift();
          if (!next) throw new Error('no scripted reply');
          return next(body) as Anthropic.Message;
        },
      },
    };
  }
  const toolUse = (input: unknown) => () => ({
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'test',
    content: [{ type: 'tool_use', id: 'tu_1', name: 'record_tag', input }],
    stop_reason: 'tool_use',
    stop_sequence: null,
    usage: { input_tokens: 1000, output_tokens: 200 },
  });

  it('returns the validated reading, cost and latency for a readable tag', async () => {
    const model = fakeModel([toolUse({ ...reading(), per_item_amount: 2.6, per_item_unit: 'L' })]);
    const core = createReadTagCore({ anthropic: model, usdKrw: 1400 });
    const o = await core({ imageBase64: JPEG_BASE64, model: 'claude-sonnet-5-5' });
    expect(o.ok).toBe(true);
    if (o.ok) {
      expect(o.reading.per_item_amount).toBe(2600); // same 7.3 re-normalization as the app
      expect(o.costKrw).toBeCloseTo(((1000 * 2 + 200 * 10) / 1e6) * 1400, 6);
      expect(typeof o.ms).toBe('number');
    }
    expect(model.calls).toHaveLength(1);
  });

  it('retries once on invalid output, then reports the failure (never fills values in)', async () => {
    const bad = { ...reading(), store_price: 'about 10,000' };
    const model = fakeModel([toolUse(bad), toolUse(bad)]);
    const o = await createReadTagCore({ anthropic: model, usdKrw: 1400 })({
      imageBase64: JPEG_BASE64,
      model: 'claude-sonnet-5-5',
    });
    expect(model.calls).toHaveLength(2);
    expect(o.ok).toBe(false);
    if (!o.ok) {
      expect(o.error).toMatch(/^422 unreadable — validation failed twice: .*store_price/);
      expect(o.modelReading).toBeNull();
      expect(o.costKrw).toBeGreaterThan(0);
    }
  });

  it('a 422 unreadable photo keeps the validated model output for --draft only', async () => {
    const receipt = { ...reading(), image_kind: 'receipt' };
    const o = await createReadTagCore({ anthropic: fakeModel([toolUse(receipt)]), usdKrw: 1400 })({
      imageBase64: JPEG_BASE64,
      model: 'claude-sonnet-5-5',
    });
    expect(o.ok).toBe(false);
    if (!o.ok) {
      expect(o.error).toMatch(/^422 unreadable — unreadable: image_kind=receipt/);
      expect(o.modelReading?.image_kind).toBe('receipt');
    }
  });

  it('rejects a non-image the same way the app does', async () => {
    const model = fakeModel([]);
    const o = await createReadTagCore({ anthropic: model, usdKrw: 1400 })({
      imageBase64: Buffer.from('hello').toString('base64'),
      model: 'm',
    });
    expect(o).toMatchObject({ ok: false, error: '400 unsupported_image' });
    expect(model.calls).toHaveLength(0);
  });

  it('aborts only when every read failed at the model API (bad key / network), not on real misses', () => {
    expect(allModelApiErrors(['502 model_error — anthropic 401', '502 model_error — x'])).toBe(
      true,
    );
    expect(allModelApiErrors(['502 model_error', null])).toBe(false);
    expect(allModelApiErrors(['502 model_error', '422 unreadable — receipt'])).toBe(false);
    expect(allModelApiErrors(['504 timeout'])).toBe(false); // a timeout is part of real accuracy
    expect(allModelApiErrors([])).toBe(false);
  });

  it('a rejected image costs nothing (no model call)', async () => {
    const o = await createReadTagCore({ anthropic: fakeModel([]), usdKrw: 1400 })({
      imageBase64: Buffer.from('hello').toString('base64'),
      model: 'm',
    });
    expect(o.costKrw).toBe(0);
  });

  it('interpretReadTagBody rejects a 200 body without a valid ocr', () => {
    expect(interpretReadTagBody({ ocr: reading(), ms: 4200, costKrw: 31.5 })).toMatchObject({
      ok: true,
      ms: 4200,
      costKrw: 31.5,
    });
    const odd = interpretReadTagBody({ hello: 1 });
    expect(odd.ok).toBe(false);
    if (!odd.ok) expect(odd.error).toMatch(/unexpected read-tag body/);
    expect(interpretReadTagBody(null).ok).toBe(false);
  });
});

describe('report', () => {
  const failedRow: ImageResult = {
    id: '003',
    storeName: '이마트',
    truth: reading(),
    pred: null,
    error: 'timeout',
    scores: scoreReading(null, reading()),
    ms: 15000,
    costKrw: null,
  };

  it('renders the field table with targets, per-store table and per-image rows', () => {
    const md = renderReport({
      model: 'claude-sonnet-5-5',
      generatedAt: '2026-10-05T00:00:00.000Z',
      imageCount: 4,
      rows: [
        row('001', allTrue, '이마트'),
        {
          ...row('002', scoreReading(reading({ brand: '피죤' }), reading()), null),
          pred: reading({ brand: '피죤' }),
        },
        failedRow,
      ],
      skipped: [{ id: '004', reason: '정답 JSON 없음' }],
    });
    expect(md).toContain('`claude-sonnet-5-5`');
    expect(md).toContain('| 매장가 (정확히 일치) | 2/3 | 66.7% | ≥ 95% | 미달 |');
    expect(md).toContain('| 브랜드 (정규화 후 일치) | 1/3 | 33.3% | ≥ 85% | 미달 |');
    expect(md).toContain('| 종류 (참고용) |');
    expect(md).toContain('## 매장별 정확도');
    expect(md).toMatch(/\| 이마트 \| 2 \| 50\.0% \|/);
    expect(md).toContain('✗ 읽음 "피죤" / 정답 "다우니"');
    expect(md).toContain('✓ 9,980원');
    expect(md).toContain('읽기 실패: timeout');
    expect(md).toContain('- 004: 정답 JSON 없음');
    expect(md).toContain('비용 합계: 미확인'); // one row had no cost → never summed as if known
    expect(md).toContain('지연 중앙값(서버 함수 기준, 네트워크 업로드 제외): 1000ms');
  });

  it('passes a target at exactly the threshold and hides the store table when no store is known', () => {
    const rows = Array.from({ length: 20 }, (_, i) =>
      row(String(i + 1).padStart(3, '0'), i === 0 ? { ...allTrue, storePrice: false } : allTrue),
    );
    const md = renderReport({ model: 'm', generatedAt: 't', imageCount: 20, rows, skipped: [] });
    expect(md).toContain('| 매장가 (정확히 일치) | 19/20 | 95.0% | ≥ 95% | 통과 |');
    expect(md).toContain('비용 합계: 600원');
    expect(md).not.toContain('## 매장별 정확도');
  });

  it('escapes pipes and newlines in table cells', () => {
    const r = { ...row('001', { ...allTrue, brand: false }), pred: reading({ brand: 'a|b\nc' }) };
    expect(
      renderReport({ model: 'm', generatedAt: 't', imageCount: 1, rows: [r], skipped: [] }),
    ).toContain('✗ 읽음 "a\\|b c"');
  });
});

describe('CLI args', () => {
  it('parses flags', () => {
    expect(parseArgs([])).toEqual({ draft: false, force: false, help: false, dir: null });
    expect(parseArgs(['--draft', '--force', '--dir', 'x'])).toEqual({
      draft: true,
      force: true,
      help: false,
      dir: 'x',
    });
  });
  it('rejects unknown flags, --force without --draft and --dir without a value', () => {
    expect(parseArgs(['--write-truth'])).toHaveProperty('error');
    expect(parseArgs(['--force'])).toHaveProperty('error');
    expect(parseArgs(['--dir'])).toHaveProperty('error');
  });
});
