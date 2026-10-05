// POST /api/account — delete my account and records (PLAN S10). Logic in server/account.ts.
// Node ESM on Vercel: relative imports need explicit .js extensions.
import { accountEnv, handleAccount, methodNotAllowed } from '../server/account.js';
import { createAccountStore } from '../server/accountStore.js';
import { createAdminClient } from '../server/supabaseAdmin.js';

async function handle(request: Request): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed();
  const env = accountEnv(process.env);
  if (!env.ok) {
    console.error(`account: missing env: ${env.missing.join(', ')}`);
    return Response.json(
      { error: 'not_configured' },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }
  const { supabaseUrl, supabaseServiceRoleKey } = env.env;
  return handleAccount(request, {
    store: createAccountStore(createAdminClient(supabaseUrl, supabaseServiceRoleKey)),
  });
}

export const POST = handle;
export const GET = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
