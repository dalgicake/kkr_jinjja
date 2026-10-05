import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RECORD_TAG_TOOL } from '../shared/tag.js';

// PLAN.md is the single source of scope; keep the exported tool definition identical to 7.1.
const plan = readFileSync(new URL('../PLAN.md', import.meta.url), 'utf8');

describe('RECORD_TAG_TOOL vs PLAN 7.1', () => {
  it('matches the JSON block in PLAN 7.1 exactly', () => {
    const start = plan.indexOf('### 7.1');
    const block = /```json\n([\s\S]*?)\n```/.exec(plan.slice(start));
    expect(start).toBeGreaterThan(-1);
    expect(block?.[1]).toBeDefined();
    expect(RECORD_TAG_TOOL).toEqual(JSON.parse(block?.[1] ?? 'null'));
  });
});
