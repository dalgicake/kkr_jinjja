// POST /api/read-tag — PLAN 6·7. Wires real clients; logic lives in server/readTag.ts.
// Node ESM on Vercel: relative imports need explicit .js extensions.
import { createAnthropicClient } from '../server/anthropic.js';
import { readTagEnv } from '../server/env.js';
import { handleReadTag } from '../server/readTag.js';
import { createAdminClient, createSupabaseStore } from '../server/supabaseAdmin.js';

export async function POST(request: Request): Promise<Response> {
  const env = readTagEnv(process.env);
  if (!env.ok) {
    // Names only (never values), and only in the server log: the response does not tell an
    // anonymous caller which secrets this deployment has.
    console.error(`read-tag: missing or invalid env: ${env.missing.join(', ')}`);
    return Response.json(
      { error: 'not_configured' },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }
  const { anthropicApiKey, modelTag, supabaseUrl, supabaseServiceRoleKey, usdKrw } = env.env;
  return handleReadTag(request, {
    anthropic: createAnthropicClient(anthropicApiKey),
    store: createSupabaseStore(createAdminClient(supabaseUrl, supabaseServiceRoleKey)),
    model: modelTag,
    usdKrw,
  });
}
