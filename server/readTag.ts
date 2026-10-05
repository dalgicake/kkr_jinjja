// POST /api/read-tag (PLAN 6, 7). Pure handler with injected dependencies; api/read-tag.ts wires
// the real Anthropic and Supabase clients, tests wire fakes.
import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import {
  MAX_TAG_IMAGE_BYTES,
  deriveTagValues,
  isUnreadableTag,
  parseRecordTag,
  type TagDerivedValues,
  type TagReading,
} from '../shared/tag.js';
import {
  apiCallLogger,
  costKrw,
  describeModelError,
  recordTagRequest,
  type MessagesClient,
} from './anthropic.js';
import { authenticate, checkRateLimit, reserveRateLimitSlot } from './auth.js';
import { READ_TAG_SYSTEM_PROMPT, READ_TAG_USER_TEXT, readTagRetryText } from './prompts/readTag.js';
import type { ApiCallRow, ScanReadTagRow, ServerStore } from './supabaseAdmin.js';

export const READ_TAG_ENDPOINT = 'read-tag';
/** 7.3: whole model phase (both attempts) must finish within this. */
export const READ_TAG_TIMEOUT_MS = 15_000;
/** 7.3: images over 4MB (decoded) are rejected. Same value the client checks before upload. */
export const MAX_IMAGE_BYTES = MAX_TAG_IMAGE_BYTES;
/** Below this much remaining budget a retry is not attempted. */
const MIN_RETRY_BUDGET_MS = 1_000;

export interface ReadTagDeps {
  anthropic: MessagesClient;
  store: ServerStore;
  model: string;
  usdKrw: number;
  /** Injected clock (ms). Defaults to Date.now. */
  now?: () => number;
  /** Where non-fatal side-effect failures go (photo upload, scans upsert, api_calls write). */
  onSideEffectError?: (what: string, e: unknown) => void;
}

export const readTagRequestSchema = z.object({
  scanId: z.uuid(),
  imageBase64: z.string().min(1),
  barcodeFromImage: z
    .string()
    .regex(/^\d{8,14}$/)
    .nullish(),
  mode: z.enum(['normal', 'test', 'demo']),
  participantCode: z.string().trim().min(1).max(32).nullish(),
  storeName: z.string().trim().min(1).max(40).nullish(),
});
export type ReadTagRequest = z.infer<typeof readTagRequestSchema>;

export interface ReadTagResponse {
  ocr: TagReading;
  /** 7.3: total amount, store unit price and the printed unit-price cross-check, from `ocr`. */
  derived: TagDerivedValues;
  ms: number;
  /** Sum over both attempts. null only if MODEL_TAG has no entry in PRICES (cost unknown). */
  costKrw: number | null;
}

export type ReadTagErrorCode =
  | 'unauthorized'
  | 'rate_limited'
  | 'bad_request'
  | 'participant_code_required'
  | 'image_too_large'
  | 'unsupported_image'
  | 'forbidden'
  | 'unreadable'
  | 'timeout'
  | 'model_error'
  | 'server_error';

const json = (body: unknown, status: number, headers: Record<string, string> = {}): Response =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store', ...headers } });
const fail = (error: ReadTagErrorCode, status: number, headers?: Record<string, string>) =>
  json({ error }, status, headers);

// ---------------------------------------------------------------------------
// image
// ---------------------------------------------------------------------------

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

interface DecodedImage {
  base64: string;
  bytes: Uint8Array;
  mediaType: ImageMediaType;
}

const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

function sniffMediaType(b: Uint8Array): ImageMediaType | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  )
    return 'image/webp';
  return null;
}

/** Accepts plain base64 or a data URL. Size check happens before decoding the whole string. */
export function decodeImage(
  input: string,
):
  | { ok: true; image: DecodedImage }
  | { ok: false; error: 'image_too_large' | 'unsupported_image' } {
  const base64 = input.replace(/^data:[^;,]*;base64,/, '').replace(/\s+/g, '');
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  const decodedSize = Math.floor((base64.length * 3) / 4) - padding;
  if (decodedSize > MAX_IMAGE_BYTES) return { ok: false, error: 'image_too_large' };
  if (!base64 || base64.length % 4 !== 0 || !BASE64_RE.test(base64))
    return { ok: false, error: 'unsupported_image' };
  const bytes = new Uint8Array(Buffer.from(base64, 'base64'));
  const mediaType = sniffMediaType(bytes);
  if (!mediaType) return { ok: false, error: 'unsupported_image' };
  return { ok: true, image: { base64, bytes, mediaType } };
}

// ---------------------------------------------------------------------------
// model call with one validation retry
// ---------------------------------------------------------------------------

type ModelOutcome =
  | { kind: 'ok'; reading: TagReading }
  | { kind: 'invalid'; error: string }
  | { kind: 'timeout'; error: string }
  | { kind: 'api_error'; error: string };

interface ModelRun {
  outcome: ModelOutcome;
  attempts: number;
  inputTokens: number;
  outputTokens: number;
  ms: number;
}

/** First record_tag tool_use input, or a validation-style error describing what came back. */
function extractToolInput(
  message: Anthropic.Message,
): { ok: true; input: unknown } | { ok: false; error: string } {
  const block = message.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'record_tag',
  );
  if (block) {
    if (message.stop_reason === 'max_tokens')
      return { ok: false, error: '(root): output was cut off (max_tokens)' };
    return { ok: true, input: block.input };
  }
  if (message.stop_reason === 'refusal')
    return { ok: false, error: '(root): model declined (refusal)' };
  return { ok: false, error: '(root): record_tag tool was not called' };
}

async function runModel(
  deps: ReadTagDeps,
  image: DecodedImage,
  deadline: number,
  now: () => number,
): Promise<ModelRun> {
  const start = now();
  const imageBlock: Anthropic.ImageBlockParam = {
    type: 'image',
    source: { type: 'base64', media_type: image.mediaType, data: image.base64 },
  };
  const base = recordTagRequest(deps.model, READ_TAG_SYSTEM_PROMPT);
  let inputTokens = 0;
  let outputTokens = 0;
  let lastError = '';

  for (let attempt = 1; attempt <= 2; attempt++) {
    const remaining = deadline - now();
    if (attempt === 2 && remaining < MIN_RETRY_BUDGET_MS) {
      return {
        outcome: { kind: 'invalid', error: `${lastError} | retry skipped: no time left` },
        attempts: 1,
        inputTokens,
        outputTokens,
        ms: now() - start,
      };
    }
    const text = attempt === 1 ? READ_TAG_USER_TEXT : readTagRetryText(lastError);
    let message: Anthropic.Message;
    try {
      message = await deps.anthropic.messages.create(
        { ...base, messages: [{ role: 'user', content: [imageBlock, { type: 'text', text }] }] },
        { timeout: Math.max(remaining, 1), maxRetries: 0 },
      );
    } catch (e) {
      const d = describeModelError(e);
      const prefix = attempt === 2 ? `attempt 1: ${lastError} | attempt 2: ` : '';
      return {
        outcome: { kind: d.kind, error: prefix + d.text },
        attempts: attempt,
        inputTokens,
        outputTokens,
        ms: now() - start,
      };
    }
    inputTokens += message.usage.input_tokens;
    outputTokens += message.usage.output_tokens;

    const extracted = extractToolInput(message);
    const parsed = extracted.ok ? parseRecordTag(extracted.input) : extracted;
    if (parsed.ok) {
      return {
        outcome: { kind: 'ok', reading: parsed.reading },
        attempts: attempt,
        inputTokens,
        outputTokens,
        ms: now() - start,
      };
    }
    lastError =
      attempt === 1 ? parsed.error : `attempt 1: ${lastError} | attempt 2: ${parsed.error}`;
  }
  return {
    outcome: { kind: 'invalid', error: `validation failed twice: ${lastError}` },
    attempts: 2,
    inputTokens,
    outputTokens,
    ms: now() - start,
  };
}

// ---------------------------------------------------------------------------
// handler
// ---------------------------------------------------------------------------

export async function handleReadTag(request: Request, deps: ReadTagDeps): Promise<Response> {
  const now = deps.now ?? Date.now;
  const started = now();
  const sideEffectError =
    deps.onSideEffectError ??
    ((what: string, e: unknown) => console.error(`read-tag ${what} failed`, e));

  // 1. token → user (401)
  let userId: string | null;
  try {
    userId = await authenticate(request, deps.store);
  } catch (e) {
    sideEffectError('auth', e);
    return fail('server_error', 500);
  }
  if (!userId) return fail('unauthorized', 401);

  // 2. per-user hourly limit (429), counted from api_calls. A cheap read that turns away users
  //    already over the limit; the slot itself is reserved atomically in step 5.
  try {
    const limit = await checkRateLimit(deps.store, userId, [READ_TAG_ENDPOINT], new Date(now()));
    if (!limit.allowed) return fail('rate_limited', 429, { 'retry-after': '3600' });
  } catch (e) {
    sideEffectError('rate limit', e);
    return fail('server_error', 500);
  }

  // 3. body (400 / 413)
  let body: ReadTagRequest;
  try {
    const parsed = readTagRequestSchema.safeParse(await request.json());
    if (!parsed.success) return fail('bad_request', 400);
    body = parsed.data;
  } catch {
    return fail('bad_request', 400);
  }
  // Photos are stored only in test mode, and only for a named participant (consent flow).
  if (body.mode === 'test' && !body.participantCode) return fail('participant_code_required', 400);
  const decoded = decodeImage(body.imageBase64);
  if (!decoded.ok) return fail(decoded.error, decoded.error === 'image_too_large' ? 413 : 400);
  const image = decoded.image;

  // 4. scan id must not belong to someone else (service role bypasses RLS)
  try {
    const owner = await deps.store.getScanOwner(body.scanId);
    if (owner !== null && owner !== userId) return fail('forbidden', 403);
  } catch (e) {
    sideEffectError('scan lookup', e);
    return fail('server_error', 500);
  }

  // 5. reserve this request's api_calls row BEFORE the model call, so parallel requests cannot
  //    all pass on the same stale count (the row is filled in at step 8).
  const pending: ApiCallRow = {
    user_id: userId,
    scan_id: body.scanId,
    endpoint: READ_TAG_ENDPOINT,
    model: deps.model,
    input_tokens: null,
    output_tokens: null,
    cost_krw: null,
    ms: 0,
    ok: false,
    error: 'pending',
  };
  let apiCallId: number;
  try {
    const slot = await reserveRateLimitSlot(
      deps.store,
      pending,
      [READ_TAG_ENDPOINT],
      new Date(now()),
      (e) => sideEffectError('api_calls release', e),
    );
    if (!slot.allowed) return fail('rate_limited', 429, { 'retry-after': '3600' });
    apiCallId = slot.id;
  } catch (e) {
    // no log row → no model call (an unlogged call would also escape the limit)
    sideEffectError('rate limit', e);
    return fail('server_error', 500);
  }

  // 6. model call (+1 retry on invalid output)
  const run = await runModel(deps, image, started + READ_TAG_TIMEOUT_MS, now);
  const cost =
    run.inputTokens || run.outputTokens
      ? costKrw(
          deps.model,
          { input_tokens: run.inputTokens, output_tokens: run.outputTokens },
          deps.usdKrw,
        )
      : 0;

  const reading = run.outcome.kind === 'ok' ? run.outcome.reading : null;
  const unreadable = reading !== null && isUnreadableTag(reading);
  const ok = reading !== null && !unreadable;
  // PLAN 7.3 derived values after unit re-normalization (null = could not compute, never guessed)
  const derived = reading ? deriveTagValues(reading) : null;

  // 7. test-mode photo (never stored in normal/demo mode)
  let imagePath: string | undefined;
  if (body.mode === 'test') {
    try {
      imagePath = await deps.store.uploadTestPhoto(
        `${body.scanId}.jpg`,
        image.bytes,
        image.mediaType,
      );
    } catch (e) {
      sideEffectError('test photo upload', e);
    }
  }

  // 8. scans upsert (ocr only when the output validated; derived values kept with it)
  const scan: ScanReadTagRow = {
    id: body.scanId,
    user_id: userId,
    mode: body.mode,
    participant_code: body.participantCode ?? null,
    store_name: body.storeName ?? null,
    barcode: body.barcodeFromImage ?? reading?.barcode_digits ?? null,
    ocr: reading && derived ? { ...reading, derived } : null,
    store_price: ok ? reading.store_price : null,
    ...(imagePath ? { image_path: imagePath } : {}),
  };
  try {
    await deps.store.upsertScan(scan);
  } catch (e) {
    sideEffectError('scans upsert', e);
  }

  // 9. api_calls — always, success or failure: fills the row reserved in step 5
  let error: string | null = null;
  if (run.outcome.kind !== 'ok') error = run.outcome.error;
  else if (unreadable)
    error = `${run.attempts === 2 ? 'after retry: ' : ''}unreadable: image_kind=${run.outcome.reading.image_kind}`;
  await apiCallLogger(deps.store, (e) => sideEffectError('api_calls write', e))(apiCallId, {
    user_id: userId,
    scan_id: body.scanId,
    endpoint: READ_TAG_ENDPOINT,
    model: deps.model,
    input_tokens: run.inputTokens,
    output_tokens: run.outputTokens,
    cost_krw: cost,
    ms: Math.round(run.ms),
    ok,
    error,
  });

  if (run.outcome.kind === 'timeout') return fail('timeout', 504);
  if (run.outcome.kind === 'api_error') return fail('model_error', 502);
  if (!ok || !derived) return fail('unreadable', 422);
  const response: ReadTagResponse = {
    ocr: reading,
    derived,
    ms: Math.round(now() - started),
    costKrw: cost,
  };
  return json(response, 200);
}
