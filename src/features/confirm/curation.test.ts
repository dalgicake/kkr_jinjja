import { describe, expect, it } from 'vitest';
import {
  MAX_SUGGESTIONS,
  findProductByBarcode,
  parseProductRows,
  recordCorrections,
  searchProducts,
  searchQueryFromReading,
} from './curation';

const row = {
  id: 'p1',
  barcode: '8801234567893',
  brand: '다우니',
  name: '섬유유연제 실내건조',
  variant: null,
  per_item_amount: '2600', // Postgres numeric may arrive as a string
  per_item_unit: 'ml',
  item_count: 1,
  category: '세탁',
};

describe('parseProductRows', () => {
  it('maps DB rows and coerces numeric strings', () => {
    expect(parseProductRows([row])).toEqual([
      {
        id: 'p1',
        barcode: '8801234567893',
        brand: '다우니',
        name: '섬유유연제 실내건조',
        variant: null,
        perItemAmount: 2600,
        perItemUnit: 'ml',
        itemCount: 1,
      },
    ]);
  });
  it('drops invalid rows instead of guessing', () => {
    expect(
      parseProductRows([
        { ...row, per_item_unit: 'L' },
        { ...row, per_item_amount: null },
        { ...row, per_item_amount: 'abc' },
        { ...row, item_count: 0 },
        null,
      ]),
    ).toEqual([]);
    expect(parseProductRows([{ ...row, per_item_amount: null, per_item_unit: 'ea' }])).toHaveLength(
      1,
    );
    expect(parseProductRows(null)).toEqual([]);
    expect(parseProductRows(row)).toHaveLength(1);
  });
});

describe('searchQueryFromReading', () => {
  it('joins brand, name and variant', () => {
    expect(
      searchQueryFromReading({
        brand: '다우니',
        product_name: '섬유유연제',
        variant: null,
        product_name_raw: 'x',
      }),
    ).toBe('다우니 섬유유연제');
  });
  it('falls back to the raw line, and gives up on too little text', () => {
    expect(
      searchQueryFromReading({
        brand: null,
        product_name: null,
        variant: null,
        product_name_raw: '신라면 5입',
      }),
    ).toBe('신라면 5입');
    expect(
      searchQueryFromReading({
        brand: ' ',
        product_name: null,
        variant: null,
        product_name_raw: null,
      }),
    ).toBeNull();
    expect(searchQueryFromReading(null)).toBeNull();
  });
});

describe('without Supabase everything is absent', () => {
  it('returns nothing and does not throw', async () => {
    expect(await findProductByBarcode(null, '8801234567893')).toBeNull();
    expect(await searchProducts(null, '다우니')).toEqual([]);
    expect(
      await recordCorrections(null, 's1', [{ field: 'brand', from_value: 'a', to_value: 'b' }]),
    ).toBe(false);
    expect(await recordCorrections(null, 's1', [])).toBe(true);
  });
});

describe('with a fake client', () => {
  it('search keeps at most 3 chips and swallows errors', async () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ ...row, id: `p${i}` }));
    const ok = { rpc: async () => ({ data: many, error: null }) } as never;
    expect(await searchProducts(ok, '다우니')).toHaveLength(MAX_SUGGESTIONS);
    const failing = { rpc: async () => ({ data: null, error: { message: 'x' } }) } as never;
    expect(await searchProducts(failing, '다우니')).toEqual([]);
    const throwing = {
      rpc: async () => {
        throw new Error('offline');
      },
    } as never;
    expect(await searchProducts(throwing, '다우니')).toEqual([]);
  });
  it('barcode lookup ignores non-numeric codes and maps the row', async () => {
    const calls: unknown[] = [];
    const chain = {
      select: () => chain,
      eq: (col: string, val: string) => (calls.push([col, val]), chain),
      limit: async () => ({ data: [row], error: null }),
    };
    const client = { from: () => chain } as never;
    expect(await findProductByBarcode(client, 'abc')).toBeNull();
    expect((await findProductByBarcode(client, '8801234567893'))?.id).toBe('p1');
    expect(calls).toEqual([['barcode', '8801234567893']]);
  });
  it('corrections are inserted with the scan id', async () => {
    let inserted: unknown;
    const client = {
      from: (table: string) => ({
        insert: async (rows: unknown) => {
          inserted = { table, rows };
          return { error: null };
        },
      }),
    } as never;
    const ok = await recordCorrections(client, 'scan-1', [
      { field: 'store_price', from_value: '9980', to_value: '8980' },
    ]);
    expect(ok).toBe(true);
    expect(inserted).toEqual({
      table: 'corrections',
      rows: [{ scan_id: 'scan-1', field: 'store_price', from_value: '9980', to_value: '8980' }],
    });
  });
});
