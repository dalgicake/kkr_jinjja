import { useId } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../../components/common/Button';
import { Chip } from '../../components/common/Chip';
import { SectionBlock } from '../../components/common/SectionBlock';
import { useCopy } from '../../lib/language';
import { fieldClass } from './StartStep';
import type { Survey } from './session';

const SCALE = [1, 2, 3, 4, 5] as const;

/** PLAN 11 final 3 questions (free text / 1–5 / free text). Later: events(name='survey'). */
export function SurveyStep({
  survey,
  onChange,
  onSubmit,
}: {
  survey: Survey;
  onChange: (next: Survey) => void;
  onSubmit: () => void;
}) {
  const { t } = useCopy();
  const s = t.ops.test;
  const q1 = useId();
  const q3 = useId();
  const scaleNote = useId();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };
  return (
    <SectionBlock tone="lilac" id="test-survey" title={s.surveyTitle}>
      <form onSubmit={submit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label htmlFor={q1} className="text-[17px] font-bold">
            {s.q1}
          </label>
          <textarea
            id={q1}
            rows={3}
            value={survey.confusing}
            onChange={(e) => onChange({ ...survey, confusing: e.target.value })}
            className={`${fieldClass} py-2`}
          />
        </div>
        <fieldset className="flex flex-col gap-2" aria-describedby={scaleNote}>
          <legend className="mb-2 text-[17px] font-bold">{s.q2}</legend>
          <div className="flex flex-wrap gap-2">
            {SCALE.map((n) => (
              <Chip
                key={n}
                tone="lime"
                selected={survey.reuse === n}
                onClick={() => onChange({ ...survey, reuse: n })}
              >
                <span className="min-w-4 text-center tabular-nums">{n}</span>
              </Chip>
            ))}
          </div>
          <p id={scaleNote} className="text-[13px] text-muted">
            {s.q2Scale}
          </p>
        </fieldset>
        <div className="flex flex-col gap-2">
          <label htmlFor={q3} className="text-[17px] font-bold">
            {s.q3}
          </label>
          <input
            id={q3}
            value={survey.wantToCheck}
            onChange={(e) => onChange({ ...survey, wantToCheck: e.target.value })}
            className={fieldClass}
          />
        </div>
        <Button type="submit" tone="lilac" size="lg">
          {s.submit}
        </Button>
      </form>
    </SectionBlock>
  );
}
