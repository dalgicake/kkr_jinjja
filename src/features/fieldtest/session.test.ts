import { describe, expect, it } from 'vitest';
import {
  MAX_PRODUCTS,
  addTrial,
  canStart,
  digitsOnly,
  firstStep,
  isTrialDone,
  newTrial,
  stepOrder,
  type Trial,
} from './session';

describe('field test session (PLAN 11)', () => {
  it('odd-numbered products start with own search, even ones with the app', () => {
    expect(firstStep(0)).toBe('manual'); // 1st
    expect(firstStep(1)).toBe('app'); // 2nd
    expect(firstStep(2)).toBe('manual'); // 3rd
    expect(stepOrder(1)).toEqual(['app', 'manual']);
  });

  it('needs a code and photo consent to start; the guardian box is optional', () => {
    expect(canStart('H01', true)).toBe(true);
    expect(canStart('  ', true)).toBe(false);
    expect(canStart('H01', false)).toBe(false);
  });

  it('adds trimmed names up to 10 and ignores blanks', () => {
    let list: readonly Trial[] = [];
    list = addTrial(list, '   ', 'x');
    expect(list).toHaveLength(0);
    for (let i = 0; i < MAX_PRODUCTS + 3; i++) list = addTrial(list, ` item ${i} `, `id-${i}`);
    expect(list).toHaveLength(MAX_PRODUCTS);
    expect(list[0]?.name).toBe('item 0');
  });

  it('a trial is done only after both steps and a trust pick', () => {
    const t = newTrial('다우니', 'a');
    expect(isTrialDone(t)).toBe(false);
    const manual = { ...t.manual, outcome: 'found_same' as const, ms: 50000 };
    expect(isTrialDone({ ...t, manual, appDone: true })).toBe(false);
    expect(isTrialDone({ ...t, manual, appDone: true, trust: 'app' })).toBe(true);
  });

  it('found price keeps digits only', () => {
    expect(digitsOnly('8,900원')).toBe('8900');
  });
});
