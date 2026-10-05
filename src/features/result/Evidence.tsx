import { useId, useState } from 'react';
import type { TargetSpec } from '../../../shared/types';
import { VerifiedBadge } from '../../components/common/Badges';
import { useCopy } from '../../lib/language';
import type { ResultCandidate } from './types';

type Mark = 'yes' | 'unclear' | 'no';

/** Evidence rows for "Why we think it's the same item". Size and count are checked against the tag. */
export function evidenceMarks(
  c: ResultCandidate,
  target: Pick<TargetSpec, 'perItemAmount'>,
  storeCount: number,
): Record<'brand' | 'line' | 'variant' | 'amount' | 'count', Mark> {
  const e = c.evidence;
  const amount: Mark = !e.amount
    ? 'unclear'
    : c.spec.perItemAmount === target.perItemAmount
      ? 'yes'
      : 'no';
  const count: Mark = !e.count ? 'unclear' : c.spec.itemCount === storeCount ? 'yes' : 'no';
  return {
    brand: e.brand ? 'yes' : 'unclear',
    line: e.line ? 'yes' : 'unclear',
    variant: e.variant,
    amount,
    count,
  };
}

const SYMBOL: Record<Mark, string> = { yes: '✓', unclear: '?', no: '✗' };
const FILL: Record<Mark, string> = { yes: 'bg-lime', unclear: 'bg-pink', no: 'bg-receipt' };

/** S3 item 3: expandable evidence list (✓ / ?), with the verified-link badge when we confirmed it. */
export function Evidence({
  candidate,
  target,
  storeCount,
}: {
  candidate: ResultCandidate;
  target: Pick<TargetSpec, 'perItemAmount'>;
  storeCount: number;
}) {
  const { t } = useCopy();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const marks = evidenceMarks(candidate, target, storeCount);
  const te = t.result.evidence;
  const word: Record<Mark, string> = { yes: te.yes, unclear: te.unclear, no: te.no };
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="-mx-2 flex min-h-12 items-center justify-between gap-3 px-2 text-left text-[15px] font-bold underline underline-offset-4"
      >
        <span>{te.title}</span>
        <span
          aria-hidden="true"
          className={`inline-block text-[17px] no-underline transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
        >
          ▾
        </span>
      </button>
      <div id={panelId} hidden={!open} className="flex flex-col gap-2">
        {candidate.verifiedLink && (
          <span>
            <VerifiedBadge>{t.result.receipt.verified}</VerifiedBadge>
          </span>
        )}
        <ul className="flex flex-col gap-1.5">
          {(['brand', 'line', 'variant', 'amount', 'count'] as const).map((key) => (
            <li key={key} className="flex items-center gap-2 text-[15px]">
              <span
                aria-hidden="true"
                className={`inline-flex size-6 shrink-0 items-center justify-center rounded border-2 border-ink text-[13px] font-extrabold ${FILL[marks[key]]}`}
              >
                {SYMBOL[marks[key]]}
              </span>
              <span className="font-semibold">{te[key]}</span>
              <span>{word[marks[key]]}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
