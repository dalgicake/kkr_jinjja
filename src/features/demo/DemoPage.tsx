import { useSearchParams } from 'react-router';
import { Badge } from '../../components/common/Badges';
import { Button, ButtonLink, TextButton } from '../../components/common/Button';
import { ExampleLabel } from '../../components/common/ExampleLabel';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { SectionBlock } from '../../components/common/SectionBlock';
import type { Tone } from '../../components/common/tone';
import { fill } from '../../lib/i18n';
import { useCopy } from '../../lib/language';
import { DemoConfirm } from './DemoConfirm';
import { DemoPriceTag } from './DemoPriceTag';
import { demoParams, parseDemoState, type DemoStep } from './demoFlow';
import {
  DEMO_SCENARIOS,
  resultPreviewPath,
  type DemoScenario,
  type DemoVerdictKey,
} from './fixtures';
import { ScenarioPicker, StepIndicator } from './ScenarioPicker';

/** Verdict badge fill follows the fixed colour meanings: butter = store, sky = online. */
const VERDICT_TONE: Readonly<Record<DemoVerdictKey, Tone>> = {
  STORE_CHEAPER: 'butter',
  ONLINE_CHEAPER: 'sky',
  BUNDLE_ONLY: 'sky',
};

/**
 * S5 /demo (PLAN 12) — UI shell. Pick one of three scenarios, then walk through
 * price tag (SVG) → read-only confirm card → link to the result preview for that verdict type.
 * All numbers come from fixtures.ts, so the pink example label (P1) stays visible on the whole page.
 * TODO(Phase 5): live read-tag/compare with recorded fallback (fixtures/demo/D*.json).
 */
export function DemoPage() {
  const { t } = useCopy();
  const [params, setParams] = useSearchParams();
  const { scenario: id, step } = parseDemoState(params);
  const scenario = id ? DEMO_SCENARIOS[id] : null;

  const go = (next: DemoStep) => {
    if (id) setParams(demoParams(id, next));
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  };

  return (
    <section className="flex flex-col gap-6 pb-8">
      <ScreenHeader
        tone="white"
        title={t.demo.title}
        sub={t.demo.intro}
        back={{ to: '/', label: t.ui.home }}
      >
        <div>
          <Badge tone="white" icon="alert">
            {t.demo.banner}
          </Badge>
        </div>
      </ScreenHeader>
      <ExampleLabel />

      <ScenarioPicker current={id} onPick={(next) => setParams(demoParams(next))} />

      {scenario && (
        <article aria-labelledby="demo-scenario-title" className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <p className="text-[13px] font-semibold text-muted tabular-nums">
              {fill(t.demo.stepOf, { n: step })}
            </p>
            <h2 id="demo-scenario-title" className="text-[22px] leading-tight font-extrabold">
              {t.demo.scenarios[scenario.id].title}
            </h2>
            <p className="text-[15px]">{t.demo.scenarios[scenario.id].sub}</p>
          </div>
          <StepIndicator
            step={step}
            labels={[t.demo.steps.tag, t.demo.steps.confirm, t.demo.steps.result]}
          />
          {step === 1 && <TagStep scenario={scenario} onNext={() => go(2)} />}
          {step === 2 && (
            <ConfirmStep scenario={scenario} onNext={() => go(3)} onPrev={() => go(1)} />
          )}
          {step === 3 && <ResultStep scenario={scenario} onPrev={() => go(2)} />}
        </article>
      )}
    </section>
  );
}

function TagStep({ scenario, onNext }: { scenario: DemoScenario; onNext: () => void }) {
  const { t } = useCopy();
  return (
    <SectionBlock tone="butter" id="demo-tag" title={t.demo.tagTitle}>
      <div className="-rotate-1 px-1 py-2">
        <DemoPriceTag scenario={scenario} />
      </div>
      <Button tone="lime" size="lg" onClick={onNext}>
        {t.demo.tagNext}
      </Button>
    </SectionBlock>
  );
}

function ConfirmStep({
  scenario,
  onNext,
  onPrev,
}: {
  scenario: DemoScenario;
  onNext: () => void;
  onPrev: () => void;
}) {
  const { t } = useCopy();
  return (
    <SectionBlock
      tone="butter"
      id="demo-confirm"
      title={t.demo.confirmTitle}
      sub={t.demo.confirmIntro}
    >
      <DemoConfirm scenario={scenario} />
      <Button tone="lime" size="lg" onClick={onNext}>
        {t.confirm.cta}
      </Button>
      <TextButton onClick={onPrev}>{t.demo.prev}</TextButton>
    </SectionBlock>
  );
}

function ResultStep({ scenario, onPrev }: { scenario: DemoScenario; onPrev: () => void }) {
  const { t } = useCopy();
  return (
    <SectionBlock tone="lime" id="demo-result" title={t.demo.resultTitle}>
      <p className="text-[15px]">{t.demo.resultIntro}</p>
      <div data-testid="demo-verdict">
        <Badge tone={VERDICT_TONE[scenario.verdictKey]}>
          <span className="text-[17px]">{t.demo.verdicts[scenario.verdictKey]}</span>
        </Badge>
      </div>
      <ButtonLink to={resultPreviewPath(scenario)} tone="lime" size="lg">
        {t.demo.resultOpen}
      </ButtonLink>
      <TextButton onClick={onPrev}>{t.demo.prev}</TextButton>
      <ButtonLink to="/demo" tone="white">
        {t.demo.other}
      </ButtonLink>
    </SectionBlock>
  );
}
