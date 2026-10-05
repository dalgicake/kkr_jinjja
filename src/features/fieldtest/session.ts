import type { ManualApp, TrustPick } from '../stats/fixtures';

/**
 * Field test session (PLAN 11) — pure state helpers, no React, no saving yet.
 * Later each finished trial becomes a `manual_trials` row and the survey becomes events(name='survey').
 */

export const MAX_PRODUCTS = 10;

export type Outcome = 'found_same' | 'unsure' | 'gave_up';
export const OUTCOMES: readonly Outcome[] = ['found_same', 'unsure', 'gave_up'];
export type Step = 'manual' | 'app';
export type Phase = 'start' | 'list' | 'trial' | 'survey' | 'done';

export interface ManualResult {
  startedAt: number | null;
  ms: number | null;
  outcome: Outcome | null;
  price: string; // digits only, optional
  app: ManualApp | null;
}

export interface Trial {
  id: string;
  name: string;
  manual: ManualResult;
  appDone: boolean;
  trust: TrustPick | null;
}

export interface Survey {
  confusing: string;
  reuse: number | null; // 1..5
  wantToCheck: string;
}

export const EMPTY_SURVEY: Survey = { confusing: '', reuse: null, wantToCheck: '' };

/** PLAN 11: odd-numbered products (1st, 3rd …) start with own search, even ones with the app. */
export function firstStep(index: number): Step {
  return index % 2 === 0 ? 'manual' : 'app';
}

export function stepOrder(index: number): readonly [Step, Step] {
  return firstStep(index) === 'manual' ? ['manual', 'app'] : ['app', 'manual'];
}

export function canStart(code: string, consentPhoto: boolean): boolean {
  return code.trim().length > 0 && consentPhoto;
}

export function newTrial(name: string, id: string): Trial {
  return {
    id,
    name,
    manual: { startedAt: null, ms: null, outcome: null, price: '', app: null },
    appDone: false,
    trust: null,
  };
}

/** Adds a trimmed, non-empty name while there is room; otherwise returns the same list. */
export function addTrial(list: readonly Trial[], name: string, id: string): readonly Trial[] {
  const clean = name.trim();
  if (!clean || list.length >= MAX_PRODUCTS) return list;
  return [...list, newTrial(clean, id)];
}

export function stepDone(trial: Trial, step: Step): boolean {
  return step === 'manual' ? trial.manual.outcome !== null : trial.appDone;
}

export function isTrialDone(trial: Trial): boolean {
  return stepDone(trial, 'manual') && stepDone(trial, 'app') && trial.trust !== null;
}

/** Keep digits only (found price is integer won). */
export function digitsOnly(v: string): string {
  return v.replace(/\D/g, '').slice(0, 9);
}
