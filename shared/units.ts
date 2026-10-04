import type { TargetSpec, Unit } from './types.js';

/** 단위가격 기준량: ml·g = 100, m = 10, sheet = 100, ea = 1 (PLAN 1장·CLAUDE.md). */
export const UNIT_BASE: Readonly<Record<Unit, number>> = Object.freeze({
  ml: 100,
  g: 100,
  m: 10,
  sheet: 100,
  ea: 1,
});

const UNIT_ALIASES: Readonly<Record<string, { unit: Unit; factor: number }>> = {
  ml: { unit: 'ml', factor: 1 },
  l: { unit: 'ml', factor: 1000 },
  g: { unit: 'g', factor: 1 },
  kg: { unit: 'g', factor: 1000 },
  m: { unit: 'm', factor: 1 },
  sheet: { unit: 'sheet', factor: 1 },
  매: { unit: 'sheet', factor: 1 },
  ea: { unit: 'ea', factor: 1 },
  개: { unit: 'ea', factor: 1 },
};

const round6 = (n: number): number => Math.round(n * 1e6) / 1e6;

/** L→ml(×1000), kg→g(×1000). 모르는 단위나 0 이하 값은 추정하지 않고 null. */
export function normalizeAmount(
  amount: number,
  rawUnit: string,
): { amount: number; unit: Unit } | null {
  const alias = UNIT_ALIASES[rawUnit.trim().toLowerCase()];
  if (!alias || !Number.isFinite(amount) || amount <= 0) return null;
  return { amount: round6(amount * alias.factor), unit: alias.unit };
}

/** 매장가로 사는 총량. 단위가 ea가 아닌데 개당 용량이 없으면 null. */
export function totalAmount(
  spec: Pick<TargetSpec, 'perItemAmount' | 'perItemUnit' | 'itemCount'>,
): number | null {
  if (!Number.isInteger(spec.itemCount) || spec.itemCount <= 0) return null;
  if (spec.perItemAmount === null) return spec.perItemUnit === 'ea' ? spec.itemCount : null;
  if (!Number.isFinite(spec.perItemAmount) || spec.perItemAmount <= 0) return null;
  return round6(spec.perItemAmount * spec.itemCount);
}

/** 기준량(UNIT_BASE)당 가격, 정수 원(반올림). 금액은 정수 원만 받는다. */
export function unitPrice(priceWon: number, amount: number, unit: Unit): number | null {
  if (!Number.isInteger(priceWon) || priceWon < 0) return null;
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round((priceWon / amount) * UNIT_BASE[unit]);
}

/** 정수 원을 천 단위 쉼표로. 로캘에 의존하지 않는다. */
export function formatWon(won: number): string {
  const sign = won < 0 ? '-' : '';
  return sign + String(Math.abs(Math.round(won))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
