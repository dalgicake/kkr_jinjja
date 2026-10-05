// Test doubles for server handlers: an in-memory ServerStore and a scripted Anthropic client.
import type Anthropic from '@anthropic-ai/sdk';
import type { MessagesClient } from '../../server/anthropic.js';
import type { ReadTagDeps } from '../../server/readTag.js';
import type { ApiCallRow, ScanReadTagRow, ServerStore } from '../../server/supabaseAdmin.js';

export const USER_A = '11111111-1111-4111-8111-111111111111';
export const USER_B = '22222222-2222-4222-8222-222222222222';
export const SCAN_ID = '33333333-3333-4333-8333-333333333333';
export const TOKEN_A = 'token-a';

export interface StoredApiCall extends ApiCallRow {
  id?: number;
  created_at: string;
}

/** Lets other pending promises run, so concurrent handler calls interleave like real I/O. */
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export class FakeStore implements ServerStore {
  tokens = new Map<string, string>([[TOKEN_A, USER_A]]);
  apiCalls: StoredApiCall[] = [];
  scans = new Map<string, ScanReadTagRow>();
  photos = new Map<string, { bytes: Uint8Array; contentType: string }>();
  failUpload = false;
  clock: () => number = () => Date.now();

  async getUserIdFromToken(token: string) {
    await tick();
    if (this.authDown) throw new Error('getUserIdFromToken: fetch failed');
    return this.tokens.get(token) ?? null;
  }
  /** Set to make getUserIdFromToken fail like a Supabase outage. */
  authDown = false;
  private nextId = 1;
  // Every store call yields first (await tick) so concurrency tests see real interleaving.
  async countApiCalls(
    userId: string,
    endpoints: readonly string[],
    sinceIso: string,
    maxId?: number,
  ) {
    await tick();
    return this.apiCalls.filter(
      (r) =>
        r.user_id === userId &&
        endpoints.includes(r.endpoint) &&
        r.created_at >= sinceIso &&
        (maxId === undefined || (r.id ?? 0) <= maxId),
    ).length;
  }
  async insertApiCall(row: ApiCallRow) {
    await tick();
    const id = this.nextId++;
    this.apiCalls.push({ ...row, id, created_at: new Date(this.clock()).toISOString() });
    return id;
  }
  async updateApiCall(id: number, row: ApiCallRow) {
    await tick();
    const i = this.apiCalls.findIndex((r) => r.id === id);
    if (i < 0) throw new Error(`no api_calls row ${id}`);
    const prev = this.apiCalls[i]!;
    this.apiCalls[i] = { ...row, id, created_at: prev.created_at };
  }
  async deleteApiCall(id: number) {
    await tick();
    this.apiCalls = this.apiCalls.filter((r) => r.id !== id);
  }
  async getScanOwner(scanId: string) {
    await tick();
    return this.scans.get(scanId)?.user_id ?? null;
  }
  async upsertScan(row: ScanReadTagRow) {
    this.scans.set(row.id, { ...this.scans.get(row.id), ...row });
  }
  async uploadTestPhoto(objectName: string, bytes: Uint8Array, contentType: string) {
    if (this.failUpload) throw new Error('upload failed');
    this.photos.set(objectName, { bytes, contentType });
    return `test-photos/${objectName}`;
  }
}

type Scripted =
  | Anthropic.Message
  | Error
  | ((body: Anthropic.MessageCreateParamsNonStreaming) => Anthropic.Message);

export class FakeAnthropic implements MessagesClient {
  calls: { body: Anthropic.MessageCreateParamsNonStreaming; options?: Anthropic.RequestOptions }[] =
    [];
  constructor(private script: Scripted[]) {}
  messages = {
    create: async (
      body: Anthropic.MessageCreateParamsNonStreaming,
      options?: Anthropic.RequestOptions,
    ): Promise<Anthropic.Message> => {
      this.calls.push({ body, options });
      const next = this.script.shift();
      if (!next) throw new Error('FakeAnthropic: no scripted response left');
      if (next instanceof Error) throw next;
      return typeof next === 'function' ? next(body) : next;
    },
  };
}

export function message(
  content: unknown[],
  usage: { input_tokens: number; output_tokens: number } = {
    input_tokens: 1000,
    output_tokens: 200,
  },
  stop_reason: Anthropic.StopReason = 'tool_use',
): Anthropic.Message {
  return {
    id: 'msg_fake',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-5-5',
    content,
    stop_reason,
    stop_sequence: null,
    usage: { ...usage, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
  } as unknown as Anthropic.Message;
}

export function toolCall(input: unknown, usage?: { input_tokens: number; output_tokens: number }) {
  return message([{ type: 'tool_use', id: 'toolu_fake', name: 'record_tag', input }], usage);
}

/** A tag as the model would report it (L instead of ml on purpose — the server re-normalizes). */
export function validToolInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    image_kind: 'shelf_tag',
    product_name_raw: '다우니 실내건조 2.6L',
    brand: '다우니',
    product_name: '섬유유연제 실내건조',
    variant: '실내건조',
    per_item_amount: 2.6,
    per_item_unit: 'L',
    item_count: 1,
    store_price: 9980,
    regular_price: null,
    promo: { type: 'none', text: null },
    tag_unit_price: { price: 384, per_amount: 100, per_unit: 'ml' },
    barcode_digits: null,
    multiple_tags_visible: false,
    confidence: { product: 0.95, size: 0.9, price: 0.98 },
    notes: null,
    ...overrides,
  };
}

/** Smallest bytes that sniff as JPEG, base64-encoded. */
export const JPEG_BASE64 = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
]).toString('base64');

export function readTagRequest(
  body: Record<string, unknown>,
  token: string | null = TOKEN_A,
): Request {
  return new Request('http://localhost/api/read-tag', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

export function baseBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { scanId: SCAN_ID, imageBase64: JPEG_BASE64, mode: 'normal', ...overrides };
}

/** Handler deps with a fresh FakeStore and a scripted model; side-effect failures are collected. */
export function setupReadTag(
  script: ConstructorParameters<typeof FakeAnthropic>[0],
  extra: Partial<ReadTagDeps> = {},
) {
  const store = new FakeStore();
  const anthropic = new FakeAnthropic(script);
  const sideEffects: string[] = [];
  const deps: ReadTagDeps = {
    anthropic,
    store,
    model: 'claude-sonnet-5-5',
    usdKrw: 1400,
    onSideEffectError: (what) => sideEffects.push(what),
    ...extra,
  };
  return { store, anthropic, deps, sideEffects };
}
