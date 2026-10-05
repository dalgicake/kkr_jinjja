// Anthropic client, the single price table (PLAN 3) and api_calls logging. Server only.
import Anthropic from '@anthropic-ai/sdk';
import { RECORD_TAG_TOOL, RECORD_TAG_TOOL_CHOICE } from '../shared/tag.js';
import type { ApiCallRow, ServerStore } from './supabaseAdmin.js';

// USD per 1M tokens — 요금이 바뀌면 여기만 고친다
export const PRICES: Record<string, { in: number; out: number }> = {
  'claude-sonnet-5-5': { in: 2, out: 10 },
  'claude-haiku-4-5-20251001': { in: 1, out: 5 },
  'claude-opus-5-5': { in: 4, out: 20 },
};

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
}

/**
 * cost_krw = (input_tokens*in + output_tokens*out) / 1e6 * USD_KRW, rounded to 2 decimals
 * (api_calls.cost_krw is numeric(10,2)). Unknown model → null: never a guessed price (P1).
 */
export function costKrw(model: string, usage: TokenUsage, usdKrw: number): number | null {
  const price = PRICES[model];
  if (!price) return null;
  const usd = (usage.input_tokens * price.in + usage.output_tokens * price.out) / 1e6;
  return Math.round(usd * usdKrw * 100) / 100;
}

/** The slice of the SDK client the server uses — tests pass a fake with the same shape. */
export interface MessagesClient {
  messages: {
    create(
      body: Anthropic.MessageCreateParamsNonStreaming,
      options?: Anthropic.RequestOptions,
    ): PromiseLike<Anthropic.Message>;
  };
}

/** SDK retries are off: the read-tag handler owns its 15 s budget and single validation retry. */
export function createAnthropicClient(apiKey: string): MessagesClient {
  return new Anthropic({ apiKey, maxRetries: 0 });
}

/**
 * Models that reject forced tool_choice ('tool'/'any') with a 400. For them the request uses
 * tool_choice 'auto' with record_tag as the only tool, and the system prompt's
 * "Always respond by calling the record_tag tool."; a reply without the tool call fails
 * validation like any other bad output (retry once, then 422).
 */
const NO_FORCED_TOOL_CHOICE = new Set([
  'claude-sonnet-5-5',
  'claude-opus-5-5',
  'claude-fable-5-1',
  'claude-mythos-5-1',
]);

/** Models that accept output_config.effort. Reading a tag is a short extraction → 'low'. */
const EFFORT_MODELS = new Set(['claude-sonnet-5-5', 'claude-opus-5-5']);

export const READ_TAG_MAX_TOKENS = 16000;

/** Request fields for one record_tag call on `model` (everything except messages). */
export function recordTagRequest(
  model: string,
  system: string,
): Omit<Anthropic.MessageCreateParamsNonStreaming, 'messages'> {
  const tool: Anthropic.Tool = { ...RECORD_TAG_TOOL };
  const toolChoice: Anthropic.ToolChoice = NO_FORCED_TOOL_CHOICE.has(model)
    ? { type: 'auto', disable_parallel_tool_use: true }
    : { ...RECORD_TAG_TOOL_CHOICE, disable_parallel_tool_use: true };
  return {
    model,
    max_tokens: READ_TAG_MAX_TOKENS,
    system,
    tools: [tool],
    tool_choice: toolChoice,
    ...(EFFORT_MODELS.has(model) ? { output_config: { effort: 'low' as const } } : {}),
  };
}

/** reservedId: fill the row reserved by reserveRateLimitSlot; null: insert a new row. */
export type ApiCallLogger = (reservedId: number | null, row: ApiCallRow) => Promise<void>;

/** Writes one api_calls row. A logging failure is reported but never breaks the user request. */
export function apiCallLogger(
  store: ServerStore,
  onError: (e: unknown) => void = (e) => console.error('api_calls write failed', e),
): ApiCallLogger {
  return async (reservedId, row) => {
    const clean = { ...row, error: row.error?.slice(0, 1000) ?? null };
    try {
      if (reservedId === null) await store.insertApiCall(clean);
      else await store.updateApiCall(reservedId, clean);
    } catch (e) {
      onError(e);
    }
  };
}

/** Short, key-free description of an SDK error for api_calls.error. */
export function describeModelError(e: unknown): { kind: 'timeout' | 'api_error'; text: string } {
  if (e instanceof Anthropic.APIConnectionTimeoutError) return { kind: 'timeout', text: 'timeout' };
  if (e instanceof Anthropic.APIUserAbortError) return { kind: 'timeout', text: 'aborted' };
  if (e instanceof Anthropic.APIError) {
    const status = e.status ?? 'connection';
    return { kind: 'api_error', text: `anthropic ${status}: ${e.message}`.slice(0, 300) };
  }
  return {
    kind: 'api_error',
    text: `error: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300),
  };
}
