import { Badge } from '../../components/common/Badges';
import { Button } from '../../components/common/Button';
import { Chip } from '../../components/common/Chip';
import { SectionBlock } from '../../components/common/SectionBlock';
import { fill } from '../../lib/i18n';
import { useCopy } from '../../lib/language';
import { TRUST_PICKS } from '../stats/fixtures';
import { ManualStep } from './ManualStep';
import { OrderBadge } from './ProductsStep';
import { isTrialDone, stepDone, stepOrder, type Step, type Trial } from './session';

/**
 * One product: two steps in the PLAN 11 order for its position, then "which do you trust more?".
 * The second step opens only after the first is done, so the order can't be skipped by accident.
 */
export function TrialStep({
  trial,
  index,
  onChange,
  onBack,
}: {
  trial: Trial;
  index: number;
  onChange: (next: Trial) => void;
  onBack: () => void;
}) {
  const { t } = useCopy();
  const s = t.ops.test;
  const order = stepOrder(index);

  const stepBody = (step: Step) =>
    step === 'manual' ? (
      <ManualStep result={trial.manual} onChange={(manual) => onChange({ ...trial, manual })} />
    ) : (
      <div className="flex flex-col gap-3">
        <p className="rounded-md border-2 border-ink bg-sky px-3 py-2 text-[15px] text-ink">
          {s.appPending}
        </p>
        {trial.appDone ? (
          <div className="flex">
            <Badge tone="lime" icon="check">
              {s.appDone}
            </Badge>
          </div>
        ) : (
          <Button tone="lime" onClick={() => onChange({ ...trial, appDone: true })}>
            {s.appDone}
          </Button>
        )}
      </div>
    );

  const bothDone = stepDone(trial, 'manual') && stepDone(trial, 'app');

  return (
    <>
      <div className="flex flex-col items-start gap-2">
        <p className="text-[15px] font-extrabold tabular-nums">
          {fill(s.position, { n: index + 1 })}
        </p>
        <h2 className="text-[30px] leading-tight font-extrabold break-words">{trial.name}</h2>
        <OrderBadge index={index} />
      </div>

      {order.map((step, i) =>
        i === 1 && !stepDone(trial, order[0]) ? null : (
          <SectionBlock
            key={step}
            tone={step === 'manual' ? 'sky' : 'lime'}
            id={`test-step-${step}`}
            title={
              <span className="flex flex-col">
                <span className="text-[13px] font-bold tabular-nums">
                  {fill(s.step, { n: i + 1 })}
                </span>
                <span>{step === 'manual' ? s.manualTitle : s.appTitle}</span>
              </span>
            }
            sub={step === 'manual' ? s.manualSub : s.appSub}
          >
            {stepBody(step)}
          </SectionBlock>
        ),
      )}

      {bothDone && (
        <SectionBlock tone="lilac" id="test-trust" title={s.trustTitle}>
          <div className="flex flex-wrap gap-2">
            {TRUST_PICKS.map((p) => (
              <Chip
                key={p}
                tone="lilac"
                selected={trial.trust === p}
                onClick={() => onChange({ ...trial, trust: p })}
              >
                {t.ops.trust[p]}
              </Chip>
            ))}
          </div>
        </SectionBlock>
      )}

      <div className="flex flex-col gap-3">
        {isTrialDone(trial) && (
          <Button tone="lime" size="lg" onClick={onBack}>
            {s.next}
          </Button>
        )}
        <Button tone="white" onClick={onBack}>
          {s.backToList}
        </Button>
      </div>
    </>
  );
}
