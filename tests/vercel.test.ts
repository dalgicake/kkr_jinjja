import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as {
  regions: string[];
  functions: Record<string, { maxDuration: number }>;
  rewrites: { source: string; destination: string }[];
};

describe('vercel.json', () => {
  it('runs functions in icn1 with maxDuration 30', () => {
    expect(config.regions).toEqual(['icn1']);
    expect(config.functions['api/**/*.ts']?.maxDuration).toBe(30);
  });
  it('SPA fallback does not capture /api/*', () => {
    const rewrite = config.rewrites[0];
    expect(rewrite?.destination).toBe('/index.html');
    const re = new RegExp(`^${rewrite?.source ?? ''}$`);
    expect(re.test('/api/health')).toBe(false);
    expect(re.test('/api/admin/links')).toBe(false);
    expect(re.test('/')).toBe(true);
    expect(re.test('/history')).toBe(true);
    expect(re.test('/about')).toBe(true);
  });
});
