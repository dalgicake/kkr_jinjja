import { useEffect, useId, useState } from 'react';
import { Badge } from '../../components/common/Badges';
import { Button } from '../../components/common/Button';
import { Chip } from '../../components/common/Chip';
import type { Tone } from '../../components/common/tone';
import { fill } from '../../lib/i18n';
import { useCopy } from '../../lib/language';
import { MANUAL_APPS } from '../stats/fixtures';
import { clock } from '../stats/format';
import { fieldClass } from './StartStep';
import { OUTCOMES, digitsOnly, type ManualResult, type Outcome } from './session';

const OUTCOME_TONE: Readonly<Record<Outcome, Tone>> = {
  found_same: 'lime',
  unsure: 'pink',
  gave_up: 'white',
};

/** Ticks while the timer runs; reads the clock only in the effect (render stays pure). */
function useNow(running: boolean): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!running) return;
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, 250);
    const first = window.setTimeout(tick, 0);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(first);
    };
  }, [running]);
  return now;
}

/** Own search: [Start] → timer → [Found same][Not sure][Gave up] → optional price + app used. */
export function ManualStep({
  result,
  onChange,
}: {
  result: ManualResult;
  onChange: (next: ManualResult) => void;
}) {
  const { t } = useCopy();
  const s = t.ops.test;
  const priceId = useId();
  const running = result.startedAt !== null && result.outcome === null;
  const now = useNow(running);
  const outcomeLabel = (o: Outcome) =>
    o === 'found_same' ? s.found : o === 'unsure' ? s.unsure : s.gaveUp;

  const elapsed =
    result.ms ??
    (result.startedAt !== null && now !== null ? Math.max(0, now - result.startedAt) : 0);

  if (result.startedAt === null) {
    return (
      <Button tone="lime" size="lg" onClick={() => onChange({ ...result, startedAt: Date.now() })}>
        {s.timerStart}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3 rounded-lg border-2 border-ink bg-receipt px-4 py-3">
        <span className="text-[15px] font-bold">{s.elapsed}</span>
        <span className="text-[56px] leading-none font-extrabold tabular-nums" aria-live="off">
          {clock(elapsed)}
        </span>
      </div>

      {result.outcome === null ? (
        <div className="flex flex-col gap-3">
          {OUTCOMES.map((o) => (
            <Button
              key={o}
              tone={OUTCOME_TONE[o]}
              onClick={() =>
                onChange({
                  ...result,
                  outcome: o,
                  ms: Math.max(0, Date.now() - (result.startedAt ?? Date.now())),
                })
              }
            >
              {outcomeLabel(o)}
            </Button>
          ))}
        </div>
      ) : (
        <>
          <div className="flex">
            <Badge tone={OUTCOME_TONE[result.outcome]} icon="check">
              {fill(s.outcome, { outcome: outcomeLabel(result.outcome) })}
            </Badge>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={priceId} className="text-[15px] font-bold">
              {s.foundPrice}
            </label>
            <input
              id={priceId}
              inputMode="numeric"
              autoComplete="off"
              value={result.price}
              onChange={(e) => onChange({ ...result, price: digitsOnly(e.target.value) })}
              className={`${fieldClass} tabular-nums`}
            />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[15px] font-bold">{s.appUsed}</legend>
            <div className="flex flex-wrap gap-2">
              {MANUAL_APPS.map((a) => (
                <Chip
                  key={a}
                  tone="sky"
                  selected={result.app === a}
                  onClick={() => onChange({ ...result, app: result.app === a ? null : a })}
                >
                  {t.ops.apps[a]}
                </Chip>
              ))}
            </div>
          </fieldset>
        </>
      )}
    </div>
  );
}
