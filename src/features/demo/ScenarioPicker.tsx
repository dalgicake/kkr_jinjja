import { Chip } from '../../components/common/Chip';
import { CheckIcon } from '../../components/common/Icons';
import { SectionBlock } from '../../components/common/SectionBlock';
import { useCopy } from '../../lib/language';
import { DEMO_SCENARIO_IDS, type DemoScenarioId } from './fixtures';

/**
 * Nothing picked yet: three big sticker buttons (tangerine number tab + title + one-line sub).
 * A scenario is open: a compact row of sky chips so the walkthrough stays above the fold.
 */
export function ScenarioPicker({
  current,
  onPick,
}: {
  current: DemoScenarioId | null;
  onPick: (id: DemoScenarioId) => void;
}) {
  const { t } = useCopy();

  if (current) {
    return (
      <nav aria-labelledby="demo-switch-title" className="flex flex-col gap-2">
        <h2 id="demo-switch-title" className="text-[13px] font-semibold text-muted">
          {t.demo.switchTitle}
        </h2>
        <div className="flex flex-wrap gap-2">
          {DEMO_SCENARIO_IDS.map((id) => (
            <Chip key={id} tone="lime" selected={id === current} onClick={() => onPick(id)}>
              {t.demo.scenarios[id].short}
            </Chip>
          ))}
        </div>
      </nav>
    );
  }

  return (
    <SectionBlock tone="tangerine" id="demo-pick" title={t.demo.pickTitle} sub={t.demo.pickSub}>
      <ul className="flex flex-col gap-4">
        {DEMO_SCENARIO_IDS.map((id, i) => (
          <li key={id}>
            <button
              type="button"
              onClick={() => onPick(id)}
              data-testid={`demo-pick-${id}`}
              className="sticker grid min-h-12 w-full grid-cols-[3rem_1fr] items-stretch overflow-hidden rounded-lg border-2 border-ink bg-receipt text-left focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <span
                aria-hidden="true"
                className="flex items-center justify-center border-r-2 border-ink bg-tangerine text-[22px] font-extrabold tabular-nums"
              >
                {i + 1}
              </span>
              <span className="flex flex-col gap-1 px-4 py-3">
                <span className="text-[17px] font-extrabold">{t.demo.scenarios[id].title}</span>
                <span className="text-[15px]">{t.demo.scenarios[id].sub}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </SectionBlock>
  );
}

/** Step progress: current step is lime + bold + aria-current; finished steps carry a check icon and "Done". */
export function StepIndicator({
  step,
  labels,
}: {
  step: 1 | 2 | 3;
  labels: readonly [string, string, string];
}) {
  const { t } = useCopy();
  return (
    <ol aria-label={t.demo.stepsLabel} className="grid grid-cols-3 gap-2">
      {labels.map((label, i) => {
        const n = i + 1;
        const state = n < step ? 'done' : n === step ? 'current' : 'next';
        return (
          <li
            key={label}
            aria-current={state === 'current' ? 'step' : undefined}
            className={`flex min-h-12 items-center gap-2 rounded-md border-2 px-2 text-[13px] leading-tight ${
              state === 'current'
                ? 'border-ink bg-lime font-extrabold'
                : state === 'done'
                  ? 'border-ink bg-receipt font-semibold'
                  : 'border-muted font-semibold text-muted'
            }`}
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-current text-[13px] font-extrabold tabular-nums">
              {state === 'done' ? <CheckIcon className="size-3.5" /> : n}
            </span>
            <span>
              {label}
              {state === 'done' && <span className="sr-only"> {t.demo.stepDone}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
