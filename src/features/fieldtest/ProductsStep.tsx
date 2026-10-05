import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Badge } from '../../components/common/Badges';
import { Button } from '../../components/common/Button';
import { SectionBlock } from '../../components/common/SectionBlock';
import { fill } from '../../lib/i18n';
import { useCopy } from '../../lib/language';
import { fieldClass } from './StartStep';
import { MAX_PRODUCTS, firstStep, isTrialDone, type Trial } from './session';

/** Shows which side goes first for the n-th product: sky = own search (online apps), lime = our app. */
export function OrderBadge({ index }: { index: number }) {
  const { t } = useCopy();
  return firstStep(index) === 'manual' ? (
    <Badge tone="sky">{t.ops.test.manualFirst}</Badge>
  ) : (
    <Badge tone="lime">{t.ops.test.appFirst}</Badge>
  );
}

/** Facilitator adds up to 10 products on the spot, then runs each one in alternating order. */
export function ProductsStep({
  trials,
  onAdd,
  onOpen,
  onSurvey,
}: {
  trials: readonly Trial[];
  onAdd: (name: string) => void;
  onOpen: (index: number) => void;
  onSurvey: () => void;
}) {
  const { t } = useCopy();
  const s = t.ops.test;
  const [name, setName] = useState('');
  const inputId = useId();
  const full = trials.length >= MAX_PRODUCTS;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || full) return;
    onAdd(name);
    setName('');
  };

  return (
    <>
      <SectionBlock
        tone="lilac"
        id="test-products"
        title={s.productsTitle}
        sub={fill(s.productsSub, { max: MAX_PRODUCTS })}
      >
        <form onSubmit={submit} className="flex flex-col gap-2">
          <label htmlFor={inputId} className="text-[15px] font-bold">
            {s.productName}
          </label>
          <div className="flex gap-2">
            <input
              id={inputId}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={s.productPlaceholder}
              disabled={full}
              autoComplete="off"
              className={fieldClass}
            />
            <Button
              type="submit"
              tone="lilac"
              full={false}
              className="shrink-0"
              disabled={full || !name.trim()}
            >
              {s.add}
            </Button>
          </div>
          {full && (
            <p className="text-[13px] font-semibold">{fill(s.full, { max: MAX_PRODUCTS })}</p>
          )}
        </form>
        <p className="text-[13px] text-muted">{s.orderNote}</p>
        {trials.length === 0 ? (
          <p className="text-[15px]">{s.empty}</p>
        ) : (
          <ol className="flex flex-col">
            {trials.map((trial, i) => {
              const done = isTrialDone(trial);
              return (
                <li
                  key={trial.id}
                  className="flex items-center gap-3 border-b-2 border-dotted border-ink py-3"
                >
                  <span className="w-14 shrink-0 text-[15px] font-extrabold tabular-nums">
                    {fill(s.position, { n: i + 1 })}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                    <span className="text-[15px] font-bold break-words">{trial.name}</span>
                    <OrderBadge index={i} />
                  </div>
                  {done ? (
                    <Badge tone="lime" icon="check">
                      {s.finished}
                    </Badge>
                  ) : (
                    <Button
                      tone="white"
                      full={false}
                      className="shrink-0"
                      onClick={() => onOpen(i)}
                    >
                      {s.open}
                    </Button>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </SectionBlock>
      {trials.length > 0 && (
        <Button tone="lilac" size="lg" onClick={onSurvey}>
          {s.toSurvey}
        </Button>
      )}
    </>
  );
}
