// /demo walkthrough state lives in the URL (?s=D2&step=2) so the browser back button, reloads and
// shared links all land on the same step. Pure helpers, no React.
import { isDemoScenarioId, type DemoScenarioId } from './fixtures';

/** 1 = price tag, 2 = confirm card, 3 = result link */
export type DemoStep = 1 | 2 | 3;

export interface DemoState {
  scenario: DemoScenarioId | null;
  step: DemoStep;
}

export function parseDemoState(params: URLSearchParams): DemoState {
  const id = params.get('s');
  const scenario = isDemoScenarioId(id) ? id : null;
  if (!scenario) return { scenario: null, step: 1 };
  const n = Number(params.get('step'));
  const step: DemoStep = n === 2 || n === 3 ? n : 1;
  return { scenario, step };
}

/** Search params for a scenario at a step (step defaults to 1). */
export function demoParams(scenario: DemoScenarioId, step: DemoStep = 1): Record<string, string> {
  return { s: scenario, step: String(step) };
}
