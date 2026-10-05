import { describe, expect, it } from 'vitest';
import {
  UNIT_BASE,
  formatPrice,
  formatWon,
  normalizeAmount,
  totalAmount,
  unitPrice,
} from './units.js';

describe('UNIT_BASE', () => {
  it('uses ml·g = 100, m = 10, sheet = 100, ea = 1', () => {
    expect(UNIT_BASE).toEqual({ ml: 100, g: 100, m: 10, sheet: 100, ea: 1 });
  });
});

describe('normalizeAmount', () => {
  it('converts L to ml and kg to g', () => {
    expect(normalizeAmount(2.6, 'L')).toEqual({ amount: 2600, unit: 'ml' });
    expect(normalizeAmount(1.5, 'l')).toEqual({ amount: 1500, unit: 'ml' });
    expect(normalizeAmount(0.3, 'kg')).toEqual({ amount: 300, unit: 'g' });
  });
  it('keeps base units and accepts Korean counters', () => {
    expect(normalizeAmount(500, 'mL')).toEqual({ amount: 500, unit: 'ml' });
    expect(normalizeAmount(27, 'm')).toEqual({ amount: 27, unit: 'm' });
    expect(normalizeAmount(80, '매')).toEqual({ amount: 80, unit: 'sheet' });
    expect(normalizeAmount(3, '개')).toEqual({ amount: 3, unit: 'ea' });
  });
  it('returns null for unknown units or non-positive amounts (no guessing)', () => {
    expect(normalizeAmount(1, 'oz')).toBeNull();
    expect(normalizeAmount(0, 'ml')).toBeNull();
    expect(normalizeAmount(Number.NaN, 'g')).toBeNull();
  });
});

describe('totalAmount', () => {
  it('multiplies per-item amount by count', () => {
    expect(totalAmount({ perItemAmount: 27, perItemUnit: 'm', itemCount: 30 })).toBe(810);
  });
  it('counts items when unit is ea and amount is null', () => {
    expect(totalAmount({ perItemAmount: null, perItemUnit: 'ea', itemCount: 4 })).toBe(4);
  });
  it('returns null when a non-ea amount is missing', () => {
    expect(totalAmount({ perItemAmount: null, perItemUnit: 'ml', itemCount: 1 })).toBeNull();
  });
});

describe('unitPrice', () => {
  it('returns integer won per base unit', () => {
    expect(unitPrice(9980, 2600, 'ml')).toBe(384);
    expect(unitPrice(8900, 2600, 'ml')).toBe(342);
    expect(unitPrice(12900, 810, 'm')).toBe(159);
    expect(unitPrice(3000, 3, 'ea')).toBe(1000);
  });
  it('returns null for invalid input', () => {
    expect(unitPrice(9980, 0, 'ml')).toBeNull();
    expect(unitPrice(99.5, 100, 'g')).toBeNull();
    expect(unitPrice(-1, 100, 'g')).toBeNull();
  });
});

describe('formatWon', () => {
  it('groups thousands', () => {
    expect(formatWon(9980)).toBe('9,980');
    expect(formatWon(1234567)).toBe('1,234,567');
    expect(formatWon(0)).toBe('0');
    expect(formatWon(-1080)).toBe('-1,080');
  });
});

describe('formatPrice', () => {
  it('formats won per language', () => {
    expect(formatPrice(9980, 'en')).toBe('₩9,980');
    expect(formatPrice(9980, 'ko')).toBe('9,980원');
    expect(formatPrice(0, 'en')).toBe('₩0');
    expect(formatPrice(1234567, 'ko')).toBe('1,234,567원');
  });
  it('puts the minus sign first', () => {
    expect(formatPrice(-1080, 'en')).toBe('-₩1,080');
    expect(formatPrice(-1080, 'ko')).toBe('-1,080원');
  });
});
