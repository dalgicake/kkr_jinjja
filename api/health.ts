// Node ESM on Vercel: relative imports need explicit .js extensions.
import { APP_VERSION } from '../src/constants/version.js';
import { unitPrice } from '../shared/units.js';

/** GET /api/health → { ok: true, version }. Imports shared/ to surface bundling problems early. */
export function GET(): Response {
  const sharedOk = unitPrice(1000, 1000, 'ml') === 100;
  return Response.json(
    { ok: sharedOk, version: APP_VERSION },
    { status: sharedOk ? 200 : 500, headers: { 'cache-control': 'no-store' } },
  );
}
