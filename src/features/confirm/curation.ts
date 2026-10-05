// S2 curation: verified barcode match (products table) and "혹시 이 상품?" chips
// (search_products RPC, max 3), plus writing corrections. Every call is optional:
// without Supabase, or on any error, the result is simply absent — never a placeholder product.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { UNITS, type TagReading } from '../../../shared/tag.js';
import type { CorrectionRow, CuratedProduct } from './confirmForm';

export const MAX_SUGGESTIONS = 3;

const amountSchema = z
  .union([z.number(), z.string()])
  .nullable()
  .transform((v, ctx) => {
    if (v === null) return null;
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n) || n <= 0) {
      ctx.addIssue({ code: 'custom', message: 'per_item_amount must be > 0' });
      return z.NEVER;
    }
    return n;
  });

const productRowSchema = z
  .object({
    id: z.string().min(1),
    barcode: z.string().nullable(),
    brand: z.string().min(1),
    name: z.string().min(1),
    variant: z.string().nullable(),
    per_item_amount: amountSchema,
    per_item_unit: z.enum(UNITS),
    item_count: z.number().int().positive(),
  })
  .refine((r) => r.per_item_amount !== null || r.per_item_unit === 'ea', {
    message: "per_item_amount may be null only for unit 'ea'",
  });

/** Rows from `products` / `search_products` → CuratedProduct. Invalid rows are dropped. */
export function parseProductRows(data: unknown): CuratedProduct[] {
  const rows = Array.isArray(data) ? data : data == null ? [] : [data];
  const out: CuratedProduct[] = [];
  for (const row of rows) {
    const r = productRowSchema.safeParse(row);
    if (!r.success) continue;
    out.push({
      id: r.data.id,
      barcode: r.data.barcode,
      brand: r.data.brand,
      name: r.data.name,
      variant: r.data.variant,
      perItemAmount: r.data.per_item_amount,
      perItemUnit: r.data.per_item_unit,
      itemCount: r.data.item_count,
    });
  }
  return out;
}

/** Query for search_products: brand + name + variant as read. null when too little was read. */
export function searchQueryFromReading(
  reading: Pick<TagReading, 'brand' | 'product_name' | 'variant' | 'product_name_raw'> | null,
): string | null {
  if (!reading) return null;
  const parts = [reading.brand, reading.product_name, reading.variant].filter(
    (p): p is string => typeof p === 'string' && p.trim() !== '',
  );
  const q = (parts.length ? parts.join(' ') : (reading.product_name_raw ?? '')).trim();
  return q.length >= 2 ? q : null;
}

const PRODUCT_COLUMNS =
  'id, barcode, brand, name, variant, per_item_amount, per_item_unit, item_count';

export async function findProductByBarcode(
  client: SupabaseClient | null,
  barcode: string,
): Promise<CuratedProduct | null> {
  if (!client || !/^\d{8,14}$/.test(barcode)) return null;
  try {
    const { data, error } = await client
      .from('products')
      .select(PRODUCT_COLUMNS)
      .eq('barcode', barcode)
      .limit(1);
    if (error) return null;
    return parseProductRows(data)[0] ?? null;
  } catch {
    return null;
  }
}

export async function searchProducts(
  client: SupabaseClient | null,
  q: string,
): Promise<CuratedProduct[]> {
  if (!client) return [];
  try {
    const { data, error } = await client.rpc('search_products', { q });
    if (error) return [];
    return parseProductRows(data).slice(0, MAX_SUGGESTIONS);
  } catch {
    return [];
  }
}

/** Insert (original → edited) rows. user_id defaults to auth.uid() under RLS. */
export async function recordCorrections(
  client: SupabaseClient | null,
  scanId: string,
  rows: readonly CorrectionRow[],
): Promise<boolean> {
  if (!client || rows.length === 0) return rows.length === 0;
  try {
    const { error } = await client
      .from('corrections')
      .insert(rows.map((r) => ({ scan_id: scanId, ...r })));
    return !error;
  } catch {
    return false;
  }
}
