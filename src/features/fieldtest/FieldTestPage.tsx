import { useState } from 'react';
import { Badge } from '../../components/common/Badges';
import { Button } from '../../components/common/Button';
import { ExampleLabel } from '../../components/common/ExampleLabel';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { fill } from '../../lib/i18n';
import { useCopy } from '../../lib/language';
import { FacilitatorGuide } from './FacilitatorGuide';
import { ProductsStep } from './ProductsStep';
import { EMPTY_SURVEY, addTrial, type Phase, type Survey, type Trial } from './session';
import { StartStep } from './StartStep';
import { SurveyStep } from './SurveyStep';
import { TrialStep } from './TrialStep';

/**
 * S6 `/test` (PLAN 11) — UI shell. Everything lives in memory: nothing is saved and no photo is
 * stored yet, which the pink practice label says on every step.
 */
export function FieldTestPage() {
  const { t } = useCopy();
  const s = t.ops.test;
  const [phase, setPhase] = useState<Phase>('start');
  const [code, setCode] = useState('');
  const [trials, setTrials] = useState<readonly Trial[]>([]);
  const [current, setCurrent] = useState(0);
  const [survey, setSurvey] = useState<Survey>(EMPTY_SURVEY);
  const [nextId, setNextId] = useState(1);

  const restart = () => {
    setPhase('start');
    setCode('');
    setTrials([]);
    setCurrent(0);
    setSurvey(EMPTY_SURVEY);
  };
  const trial = trials[current];

  return (
    <section className="flex flex-col gap-8 pb-8">
      <ScreenHeader tone="sky" title={s.title} back={{ to: '/', label: t.ops.home }}>
        {code && (
          <div className="flex">
            <Badge tone="white">{fill(s.participant, { code })}</Badge>
          </div>
        )}
      </ScreenHeader>
      <ExampleLabel>{t.ops.practice}</ExampleLabel>
      <p className="-mt-4 text-[15px]">{t.ops.practiceSub}</p>

      <FacilitatorGuide compact={phase !== 'start' && phase !== 'list'} />

      {phase === 'start' && (
        <StartStep
          onStart={(c) => {
            setCode(c);
            setPhase('list');
          }}
        />
      )}

      {phase === 'list' && (
        <ProductsStep
          trials={trials}
          onAdd={(name) => {
            setTrials(addTrial(trials, name, `trial-${nextId}`));
            setNextId(nextId + 1);
          }}
          onOpen={(i) => {
            setCurrent(i);
            setPhase('trial');
          }}
          onSurvey={() => setPhase('survey')}
        />
      )}

      {phase === 'trial' && trial && (
        <TrialStep
          key={trial.id}
          trial={trial}
          index={current}
          onChange={(next) => setTrials(trials.map((x, i) => (i === current ? next : x)))}
          onBack={() => setPhase('list')}
        />
      )}

      {phase === 'survey' && (
        <SurveyStep survey={survey} onChange={setSurvey} onSubmit={() => setPhase('done')} />
      )}

      {phase === 'done' && (
        <div className="flex flex-col gap-4">
          <p className="rounded-lg border-2 border-ink bg-lime px-4 py-4 text-[22px] font-extrabold text-ink">
            {s.thanks}
          </p>
          <Button tone="white" onClick={restart}>
            {s.restart}
          </Button>
        </div>
      )}
    </section>
  );
}
