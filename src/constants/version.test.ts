import { describe, expect, it } from 'vitest';
import { APP_VERSION } from './version';
import { updateLogs } from './updateLogs';

describe('version', () => {
  it('has three decimals', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d{3}$/);
  });
  it('matches the newest update log', () => {
    expect(updateLogs[0]?.version).toBe(APP_VERSION);
  });
  it('update logs are newest first', () => {
    const versions = updateLogs.map((l) => Number(l.version));
    expect([...versions].sort((a, b) => b - a)).toEqual(versions);
  });
});
