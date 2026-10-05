import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { RECORD_TAG_TOOL } from '../../shared/tag.js';
import { READ_TAG_SYSTEM_PROMPT } from '../../server/prompts/readTag.js';
import {
  MAX_IMAGE_BYTES,
  READ_TAG_TIMEOUT_MS,
  decodeImage,
  handleReadTag,
} from '../../server/readTag.js';
import {
  SCAN_ID,
  TOKEN_A,
  USER_A,
  baseBody,
  message,
  readTagRequest,
  setupReadTag as setup,
  toolCall,
  validToolInput,
} from './fakes.js';

describe('POST /api/read-tag — happy path', () => {
  it('returns the normalized reading, cost and ms, and records scan + api_calls', async () => {
    const { store, anthropic, deps } = setup([
      toolCall(validToolInput(), { input_tokens: 1000, output_tokens: 500 }),
    ]);
    const res = await handleReadTag(readTagRequest(baseBody({ storeName: '이마트' })), deps);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ocr: Record<string, unknown>;
      ms: number;
      costKrw: number;
    };
    // 2.6 L → 2600 ml (7.3 re-normalization), promo n/m filled with null
    expect(body.ocr.per_item_amount).toBe(2600);
    expect(body.ocr.per_item_unit).toBe('ml');
    expect(body.ocr.promo).toEqual({ type: 'none', text: null, n: null, m: null });
    expect(body.costKrw).toBe(9.8); // (1000*2 + 500*10)/1e6 * 1400
    expect(typeof body.ms).toBe('number');
    // 7.3 derived values: 2600 ml, 9980 / 2600 * 100 = 383.8 → 384 won/100ml, printed 384 → ok
    const derived = {
      totalAmount: 2600,
      storeUnitPrice: 384,
      unitPriceCheck: { ok: true, diffPct: 0.04 },
    };
    expect((body as unknown as { derived: unknown }).derived).toEqual(derived);

    // request sent to the model
    expect(anthropic.calls).toHaveLength(1);
    const sent = anthropic.calls[0]!.body;
    expect(sent.model).toBe('claude-sonnet-5-5');
    expect(sent.system).toBe(READ_TAG_SYSTEM_PROMPT);
    expect(sent.tools).toEqual([RECORD_TAG_TOOL]);
    const content = sent.messages[0]!.content as Anthropic.ContentBlockParam[];
    expect(content[0]).toMatchObject({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg' },
    });
    expect(anthropic.calls[0]!.options?.timeout).toBeLessThanOrEqual(READ_TAG_TIMEOUT_MS);

    // scans upsert
    const scan = store.scans.get(SCAN_ID);
    expect(scan).toMatchObject({
      user_id: USER_A,
      mode: 'normal',
      store_name: '이마트',
      store_price: 9980,
    });
    expect(scan?.ocr?.per_item_amount).toBe(2600);
    expect(scan?.ocr?.derived).toEqual(derived);
    expect(scan?.image_path).toBeUndefined();

    // api_calls
    expect(store.apiCalls).toHaveLength(1);
    expect(store.apiCalls[0]).toMatchObject({
      user_id: USER_A,
      scan_id: SCAN_ID,
      endpoint: 'read-tag',
      model: 'claude-sonnet-5-5',
      input_tokens: 1000,
      output_tokens: 500,
      cost_krw: 9.8,
      ok: true,
      error: null,
    });
  });

  it('derived cross-check flags a printed unit price that disagrees by more than 5%', async () => {
    // tag says 1 item, but the printed unit price fits 2 × 2.6 L (9980 / 5200 * 100 = 191.9)
    const { store, deps } = setup([
      toolCall(validToolInput({ tag_unit_price: { price: 192, per_amount: 100, per_unit: 'ml' } })),
    ]);
    const res = await handleReadTag(readTagRequest(baseBody()), deps);
    const body = (await res.json()) as {
      derived: { unitPriceCheck: { ok: boolean; diffPct: number } };
    };
    expect(body.derived.unitPriceCheck.ok).toBe(false);
    expect(body.derived.unitPriceCheck.diffPct).toBeGreaterThan(5);
    expect(store.scans.get(SCAN_ID)?.ocr?.derived.unitPriceCheck?.ok).toBe(false);
  });

  it('derived values stay null when they cannot be computed (no guessing)', async () => {
    const { deps } = setup([
      toolCall(
        validToolInput({ per_item_amount: null, per_item_unit: null, tag_unit_price: null }),
      ),
    ]);
    const res = await handleReadTag(readTagRequest(baseBody()), deps);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { derived: unknown }).derived).toEqual({
      totalAmount: null,
      storeUnitPrice: null,
      unitPriceCheck: null,
    });
  });

  it('prefers the barcode decoded on the device over the digits the model read', async () => {
    const { store, deps } = setup([toolCall(validToolInput({ barcode_digits: '8801111111111' }))]);
    await handleReadTag(readTagRequest(baseBody({ barcodeFromImage: '8806666666666' })), deps);
    expect(store.scans.get(SCAN_ID)?.barcode).toBe('8806666666666');
  });

  it('uses forced tool_choice for models that accept it and auto for Sonnet 5.5', async () => {
    const sonnet = setup([toolCall(validToolInput())]);
    await handleReadTag(readTagRequest(baseBody()), sonnet.deps);
    expect(sonnet.anthropic.calls[0]!.body.tool_choice).toEqual({
      type: 'auto',
      disable_parallel_tool_use: true,
    });

    const haiku = setup([toolCall(validToolInput())], { model: 'claude-haiku-4-5-20251001' });
    await handleReadTag(readTagRequest(baseBody()), haiku.deps);
    expect(haiku.anthropic.calls[0]!.body.tool_choice).toEqual({
      type: 'tool',
      name: 'record_tag',
      disable_parallel_tool_use: true,
    });
    expect(haiku.anthropic.calls[0]!.body.output_config).toBeUndefined();
  });
});

describe('POST /api/read-tag — validation retry', () => {
  it('retries once with the validation error, then succeeds', async () => {
    const bad = validToolInput({ store_price: '9,980원' });
    const { store, anthropic, deps } = setup([
      toolCall(bad, { input_tokens: 1000, output_tokens: 100 }),
      toolCall(validToolInput(), { input_tokens: 1100, output_tokens: 200 }),
    ]);
    const res = await handleReadTag(readTagRequest(baseBody()), deps);
    expect(res.status).toBe(200);
    expect(anthropic.calls).toHaveLength(2);
    const retryContent = anthropic.calls[1]!.body.messages[0]!
      .content as Anthropic.ContentBlockParam[];
    const retryText = retryContent.find(
      (b): b is Anthropic.TextBlockParam => b.type === 'text',
    )?.text;
    expect(retryText).toContain('store_price');
    // tokens of both attempts are logged and billed
    expect(store.apiCalls).toHaveLength(1);
    expect(store.apiCalls[0]).toMatchObject({ input_tokens: 2100, output_tokens: 300, ok: true });
    const body = (await res.json()) as { costKrw: number };
    expect(body.costKrw).toBe(Math.round(((2100 * 2 + 300 * 10) / 1e6) * 1400 * 100) / 100);
  });

  it('treats a reply without the tool call as invalid and retries', async () => {
    const { anthropic, deps } = setup([
      message([{ type: 'text', text: '가격표가 보이지 않아요' }], undefined, 'end_turn'),
      toolCall(validToolInput()),
    ]);
    const res = await handleReadTag(readTagRequest(baseBody()), deps);
    expect(res.status).toBe(200);
    expect(anthropic.calls).toHaveLength(2);
  });

  it('invalid twice → 422 unreadable, never a guessed reading; api_calls still logged', async () => {
    const bad = validToolInput({ confidence: { product: 2, size: 0.5, price: 0.5 } });
    const { store, anthropic, deps } = setup([toolCall(bad), toolCall(bad)]);
    const res = await handleReadTag(readTagRequest(baseBody()), deps);
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'unreadable' });
    expect(anthropic.calls).toHaveLength(2);
    expect(store.apiCalls).toHaveLength(1);
    expect(store.apiCalls[0]).toMatchObject({ ok: false, input_tokens: 2000, output_tokens: 400 });
    expect(store.apiCalls[0]!.error).toMatch(/^validation failed twice: .*confidence\.product/);
    expect(store.scans.get(SCAN_ID)).toMatchObject({ ocr: null, store_price: null });
  });

  it('a valid but unreadable photo (receipt) → 422 without retry', async () => {
    const { store, anthropic, deps } = setup([toolCall(validToolInput({ image_kind: 'receipt' }))]);
    const res = await handleReadTag(readTagRequest(baseBody()), deps);
    expect(res.status).toBe(422);
    expect(anthropic.calls).toHaveLength(1);
    expect(store.apiCalls[0]).toMatchObject({ ok: false, error: 'unreadable: image_kind=receipt' });
  });

  it('skips the retry when the 15 s budget is used up', async () => {
    let t = 0;
    const { store, anthropic, deps } = setup(
      [
        () => {
          t += READ_TAG_TIMEOUT_MS; // first call eats the whole budget
          return toolCall(validToolInput({ store_price: -1 }));
        },
      ],
      { now: () => t },
    );
    const res = await handleReadTag(readTagRequest(baseBody()), deps);
    expect(res.status).toBe(422);
    expect(anthropic.calls).toHaveLength(1);
    expect(store.apiCalls[0]!.error).toContain('retry skipped');
  });
});

describe('POST /api/read-tag — photos', () => {
  it('test mode stores the photo privately at test-photos/<scanId>.jpg', async () => {
    const { store, deps } = setup([toolCall(validToolInput())]);
    const res = await handleReadTag(
      readTagRequest(baseBody({ mode: 'test', participantCode: 'H01' })),
      deps,
    );
    expect(res.status).toBe(200);
    expect([...store.photos.keys()]).toEqual([`${SCAN_ID}.jpg`]);
    expect(store.photos.get(`${SCAN_ID}.jpg`)?.contentType).toBe('image/jpeg');
    expect(store.scans.get(SCAN_ID)).toMatchObject({
      mode: 'test',
      participant_code: 'H01',
      image_path: `test-photos/${SCAN_ID}.jpg`,
    });
  });

  it('test mode keeps the photo even when the tag is unreadable (eval material)', async () => {
    const bad = validToolInput({ store_price: 'x' });
    const { store, deps } = setup([toolCall(bad), toolCall(bad)]);
    const res = await handleReadTag(
      readTagRequest(baseBody({ mode: 'test', participantCode: 'H01' })),
      deps,
    );
    expect(res.status).toBe(422);
    expect(store.photos.size).toBe(1);
  });

  it.each(['normal', 'demo'])('%s mode never stores the photo', async (mode) => {
    const { store, deps } = setup([toolCall(validToolInput())]);
    const res = await handleReadTag(readTagRequest(baseBody({ mode })), deps);
    expect(res.status).toBe(200);
    expect(store.photos.size).toBe(0);
    expect(store.scans.get(SCAN_ID)?.image_path).toBeUndefined();
  });

  it('test mode without a participant code is rejected before any model call', async () => {
    const { store, anthropic, deps } = setup([]);
    const res = await handleReadTag(readTagRequest(baseBody({ mode: 'test' })), deps);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'participant_code_required' });
    expect(anthropic.calls).toHaveLength(0);
    expect(store.photos.size).toBe(0);
  });

  it('a failed photo upload does not fail the read', async () => {
    const { store, deps, sideEffects } = setup([toolCall(validToolInput())]);
    store.failUpload = true;
    const res = await handleReadTag(
      readTagRequest(baseBody({ mode: 'test', participantCode: 'H01' })),
      deps,
    );
    expect(res.status).toBe(200);
    expect(sideEffects).toContain('test photo upload');
    expect(store.scans.get(SCAN_ID)?.image_path).toBeUndefined();
  });
});

describe('POST /api/read-tag — failures are logged', () => {
  it('model timeout → 504, api_calls ok=false', async () => {
    const { store, deps } = setup([new Anthropic.APIConnectionTimeoutError()]);
    const res = await handleReadTag(readTagRequest(baseBody()), deps);
    expect(res.status).toBe(504);
    expect(await res.json()).toEqual({ error: 'timeout' });
    expect(store.apiCalls).toHaveLength(1);
    expect(store.apiCalls[0]).toMatchObject({
      ok: false,
      error: 'timeout',
      input_tokens: 0,
      cost_krw: 0,
    });
  });

  it('API error on the retry → 502, both attempts in the error text and tokens kept', async () => {
    const apiError = new Anthropic.InternalServerError(
      500,
      { type: 'error' },
      'overloaded',
      new Headers(),
    );
    const { store, deps } = setup([toolCall(validToolInput({ store_price: 1.5 })), apiError]);
    const res = await handleReadTag(readTagRequest(baseBody()), deps);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'model_error' });
    expect(store.apiCalls[0]).toMatchObject({ ok: false, input_tokens: 1000 });
    expect(store.apiCalls[0]!.error).toMatch(
      /attempt 1: .*store_price.* \| attempt 2: anthropic 500/,
    );
  });

  it('a failing api_calls update is reported but does not break the response', async () => {
    const { store, deps, sideEffects } = setup([toolCall(validToolInput())]);
    store.updateApiCall = async () => {
      throw new Error('db down');
    };
    const res = await handleReadTag(readTagRequest(baseBody()), deps);
    expect(res.status).toBe(200);
    expect(sideEffects).toContain('api_calls write');
    // the reserved row still counts toward the limit
    expect(store.apiCalls).toHaveLength(1);
  });
});

describe('POST /api/read-tag — request checks', () => {
  it('400 on a malformed body', async () => {
    const { deps } = setup([]);
    expect((await handleReadTag(readTagRequest({ scanId: 'nope' }), deps)).status).toBe(400);
    const notJson = new Request('http://localhost/api/read-tag', {
      method: 'POST',
      headers: { authorization: `Bearer ${TOKEN_A}` },
      body: '{',
    });
    expect((await handleReadTag(notJson, deps)).status).toBe(400);
  });

  it('413 for images over 4MB, 400 for non-images', async () => {
    const { anthropic, deps } = setup([]);
    const big = 'A'.repeat(Math.ceil(((MAX_IMAGE_BYTES + 3) * 4) / 3 / 4) * 4);
    const res = await handleReadTag(readTagRequest(baseBody({ imageBase64: big })), deps);
    expect(res.status).toBe(413);
    const txt = Buffer.from('hello world!').toString('base64');
    expect((await handleReadTag(readTagRequest(baseBody({ imageBase64: txt })), deps)).status).toBe(
      400,
    );
    expect(anthropic.calls).toHaveLength(0);
  });

  it('decodeImage accepts data URLs and sniffs PNG', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64');
    const r = decodeImage(`data:image/png;base64,${png}`);
    expect(r.ok && r.image.mediaType).toBe('image/png');
  });
});
