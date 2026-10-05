// Server-only env reading. Never import from src/ or shared/ (ESLint bans it).

export const DEFAULT_MODEL_TAG = 'claude-sonnet-5-5';
export const DEFAULT_USD_KRW = 1400;

export interface ReadTagEnv {
  anthropicApiKey: string;
  modelTag: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  usdKrw: number;
}

export type EnvResult<T> = { ok: true; env: T } | { ok: false; missing: string[] };

type RawEnv = Record<string, string | undefined>;

const value = (raw: RawEnv, name: string): string | null => {
  const v = raw[name]?.trim();
  return v ? v : null;
};

/** Env for /api/read-tag. Missing required keys → { ok: false, missing } (names only, never values). */
export function readTagEnv(raw: RawEnv): EnvResult<ReadTagEnv> {
  const anthropicApiKey = value(raw, 'ANTHROPIC_API_KEY');
  const supabaseUrl = value(raw, 'SUPABASE_URL');
  const supabaseServiceRoleKey = value(raw, 'SUPABASE_SERVICE_ROLE_KEY');
  const missing: string[] = [];
  if (!anthropicApiKey) missing.push('ANTHROPIC_API_KEY');
  if (!supabaseUrl) missing.push('SUPABASE_URL');
  if (!supabaseServiceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  const rate = Number(value(raw, 'USD_KRW') ?? DEFAULT_USD_KRW);
  if (!Number.isFinite(rate) || rate <= 0) missing.push('USD_KRW');

  if (missing.length || !anthropicApiKey || !supabaseUrl || !supabaseServiceRoleKey)
    return { ok: false, missing };
  return {
    ok: true,
    env: {
      anthropicApiKey,
      modelTag: value(raw, 'MODEL_TAG') ?? DEFAULT_MODEL_TAG,
      supabaseUrl,
      supabaseServiceRoleKey,
      usdKrw: rate,
    },
  };
}
