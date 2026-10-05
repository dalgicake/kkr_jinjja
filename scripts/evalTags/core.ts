// PLAN 7.4 eval: run /api/read-tag's handler with an in-memory store (no Supabase, no limit).
import { randomUUID } from 'node:crypto';
import type { MessagesClient } from '../../server/anthropic.js';
import { handleReadTag } from '../../server/readTag.js';
import type { ApiCallRow, ServerStore } from '../../server/supabaseAdmin.js';
import { tagReadingSchema, type TagReading } from '../../shared/tag.js';
import { isRecord } from './fixtures.js';

// ---------------------------------------------------------------------------
// Core: /api/read-tag's handler with an in-memory store
// ---------------------------------------------------------------------------

export type CoreOutcome =
  | { ok: true; reading: TagReading; costKrw: number | null; ms: number | null }
  | {
      ok: false;
      error: string;
      costKrw: number | null;
      ms: number | null;
      /** A validated reading the app still refused (422 unreadable). Only used for --draft. */
      modelReading: TagReading | null;
    };

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** 200 body of /api/read-tag `{ ocr, ms, costKrw }` → outcome. Anything else is an error, never filled in. */
export function interpretReadTagBody(body: unknown): CoreOutcome {
  const rec = isRecord(body) ? body : {};
  const costKrw = num(rec.costKrw);
  const ms = num(rec.ms);
  const parsed = tagReadingSchema.safeParse(rec.ocr);
  if (parsed.success) return { ok: true, reading: parsed.data, costKrw, ms };
  const issues = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
  return {
    ok: false,
    error: `unexpected read-tag body: ${issues.join('; ')}`,
    costKrw,
    ms,
    modelReading: null,
  };
}

export interface ReadTagCoreInput {
  imageBase64: string;
  model: string;
}
export type ReadTagCore = (input: ReadTagCoreInput) => Promise<CoreOutcome>;

const EVAL_TOKEN = 'eval-tags';
const EVAL_USER_ID = '00000000-0000-4000-8000-000000000000';

/**
 * Runs `handleReadTag` exactly as api/read-tag.ts does, but with an in-memory ServerStore:
 * auth always passes, no rate limit, nothing written to Supabase. The api_calls row the handler
 * would log is kept to report cost, latency and the failure reason.
 */
export function createReadTagCore(deps: {
  anthropic: MessagesClient;
  usdKrw: number;
  handle?: typeof handleReadTag;
}): ReadTagCore {
  const handle = deps.handle ?? handleReadTag;
  return async ({ imageBase64, model }) => {
    let apiCall: ApiCallRow | null = null;
    let scanOcr: TagReading | null = null;
    const store: ServerStore = {
      getUserIdFromToken: async (token) => (token === EVAL_TOKEN ? EVAL_USER_ID : null),
      countApiCalls: async () => 0,
      // the handler reserves its row before the model call and fills it in afterwards
      insertApiCall: async (row) => {
        apiCall = row;
        return 1;
      },
      updateApiCall: async (_id, row) => {
        apiCall = row;
      },
      deleteApiCall: async () => {
        apiCall = null;
      },
      getScanOwner: async () => null,
      upsertScan: async (row) => {
        // scans.ocr also carries the server's derived values; a draft needs only the reading
        scanOcr = row.ocr ? tagReadingSchema.parse(row.ocr) : null;
      },
      uploadTestPhoto: async () => {
        throw new Error('eval-tags never stores photos');
      },
    };
    const request = new Request('http://eval.local/api/read-tag', {
      method: 'POST',
      headers: { authorization: `Bearer ${EVAL_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ scanId: randomUUID(), imageBase64, mode: 'normal' }),
    });
    const res = await handle(request, {
      anthropic: deps.anthropic,
      store,
      model,
      usdKrw: deps.usdKrw,
      onSideEffectError: () => {},
    });
    const body: unknown = await res.json().catch(() => null);
    if (res.status === 200) return interpretReadTagBody(body);
    const logged = apiCall as ApiCallRow | null;
    const code = isRecord(body) && typeof body.error === 'string' ? body.error : 'error';
    return {
      ok: false,
      error: `${res.status} ${code}${logged?.error ? ` — ${logged.error}` : ''}`,
      // No api_calls row → rejected before the model was called (bad image), so nothing was spent.
      costKrw: logged ? logged.cost_krw : 0,
      ms: logged ? logged.ms : null,
      modelReading: scanOcr,
    };
  };
}

/**
 * True when every read failed with the model API itself (502: bad key, network, unknown model).
 * That says nothing about reading accuracy, so no report is written.
 */
export function allModelApiErrors(errors: readonly (string | null)[]): boolean {
  return errors.length > 0 && errors.every((e) => e !== null && e.startsWith('502 '));
}
