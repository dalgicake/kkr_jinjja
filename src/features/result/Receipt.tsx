import type { ReactNode } from 'react';
import { Badge, CheckBadge } from '../../components/common/Badges';
import { useCopy } from '../../lib/language';
import { fill } from '../../lib/i18n';
import { Evidence } from './Evidence';
import { ItemActions } from './ItemActions';
import {
  bundleCandidates,
  candidateUnitPrice,
  emphasiseOnline,
  mallLabel,
  scopeSentence,
  storeLabel,
  unitPriceText,
  winner,
} from './resultView';
import type { PreviewVerdict, ResultCandidate, ResultFixture } from './types';
import './result.css';

const Dotted = () => <hr className="border-0 border-t-2 border-dotted border-ink" />;

/** One receipt line: label chip + name on the left, price on the right; lime band when cheaper. */
function Row({
  chip,
  name,
  price,
  lines,
  mark,
  cheaper = false,
  testId,
}: {
  chip: ReactNode;
  name: ReactNode;
  price: ReactNode;
  lines: ReactNode[];
  mark?: ReactNode;
  cheaper?: boolean;
  testId: string;
}) {
  return (
    <div className="relative py-2" data-testid={cheaper ? `${testId}-cheaper` : testId}>
      {cheaper && <span aria-hidden="true" className="receipt-band" />}
      <div className="relative z-[1] grid grid-cols-[1fr_auto] items-start gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {chip}
          <span className="text-[15px] font-bold break-words">{name}</span>
        </div>
        <div className="price text-right text-[22px] leading-tight font-extrabold">{price}</div>
        <div className="col-span-2 flex flex-col text-[13px] font-semibold">
          {lines.map((line, i) => (
            <span key={i}>{line}</span>
          ))}
        </div>
        {mark && <div className="col-span-2">{mark}</div>}
      </div>
    </div>
  );
}

function Amount({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-baseline justify-between gap-3 text-[17px] font-bold">
        <span>{label}</span>
        <span className="price text-right">{value}</span>
      </div>
      {note && <p className="text-[13px] text-muted">{note}</p>}
    </div>
  );
}

/**
 * S3 "comparison receipt": the one white paper card (PLAN 13). Store row (butter chip), online row
 * (sky chip, "Shipping unknown"), difference, break-even shipping, evidence and the lookup sentence.
 */
export function Receipt({
  fixture: f,
  verdict: v,
  onAction,
}: {
  fixture: ResultFixture;
  verdict: PreviewVerdict;
  onAction: () => void;
}) {
  const { t, won } = useCopy();
  const tr = t.result.receipt;
  const side = winner(v);
  const onlineItem: ResultCandidate | undefined =
    v.bestExact ?? (v.type === 'BUNDLE_ONLY' ? bundleCandidates(f, v)[0] : undefined);
  const onlineUnit = onlineItem ? candidateUnitPrice(onlineItem) : null;
  const same = v.type === 'SAME_PRICE';

  const markFor = (who: 'store' | 'online') =>
    side === who ? (
      <Badge tone="lime" icon="check">
        {tr.cheaper}
      </Badge>
    ) : same ? (
      <Badge tone="white" icon="check">
        {tr.samePrice}
      </Badge>
    ) : null;

  const storePrice =
    v.store.price === null ? <CheckBadge>{tr.priceUnknown}</CheckBadge> : won(v.store.price);
  const storeLines: ReactNode[] = [];
  if (v.store.count > 1) storeLines.push(fill(tr.pack, { count: v.store.count }));
  if (v.store.unitPrice !== null)
    storeLines.push(unitPriceText(t, won, v.store.unitPrice, v.store.unit));

  return (
    <div className="receipt-wrap receipt-print">
      <section
        aria-labelledby="receipt-title"
        data-testid="receipt"
        className="receipt-paper flex flex-col gap-3 bg-receipt px-4"
      >
        <h2 id="receipt-title" className="text-[17px] font-extrabold">
          {tr.title}
        </h2>
        <Dotted />
        <Row
          testId="row-store"
          cheaper={side === 'store'}
          chip={<Badge tone="butter">{tr.store}</Badge>}
          name={storeLabel(t, f.storeKey)}
          price={storePrice}
          lines={storeLines}
          mark={markFor('store')}
        />
        {onlineItem && v.type !== 'NEED_STORE_PRICE' ? (
          <div className="flex flex-col gap-1">
            <Row
              testId="row-online"
              cheaper={side === 'online'}
              chip={<Badge tone="sky">{tr.online}</Badge>}
              name={mallLabel(t, onlineItem)}
              price={won(onlineItem.price)}
              lines={[
                ...(onlineItem.spec.itemCount && onlineItem.spec.itemCount > 1
                  ? [fill(tr.pack, { count: onlineItem.spec.itemCount })]
                  : []),
                ...(onlineUnit !== null ? [unitPriceText(t, won, onlineUnit, v.store.unit)] : []),
                tr.shippingUnknown,
              ]}
              mark={markFor('online')}
            />
            <ItemActions emphasise={emphasiseOnline(v)} onAction={onAction} />
          </div>
        ) : (
          <Row
            testId="row-online"
            chip={<Badge tone="sky">{tr.online}</Badge>}
            name={v.type === 'NEED_STORE_PRICE' ? tr.afterPrice : tr.noOnline}
            price=""
            lines={[]}
          />
        )}
        {(v.type === 'STORE_CHEAPER' || v.type === 'SAME_PRICE' || v.type === 'ONLINE_CHEAPER') && (
          <>
            <Dotted />
            <Amount label={tr.diff} value={won(v.diff ?? 0)} />
            {v.type === 'ONLINE_CHEAPER' && (
              <Amount
                label={tr.breakEven}
                value={won(v.breakEvenShipping ?? v.diff ?? 0)}
                note={tr.breakEvenNote}
              />
            )}
          </>
        )}
        {v.type === 'BUNDLE_ONLY' && v.store.unitPrice !== null && onlineUnit !== null && (
          <>
            <Dotted />
            <Amount
              label={tr.unitGap}
              value={unitPriceText(t, won, Math.abs(v.store.unitPrice - onlineUnit), v.store.unit)}
            />
          </>
        )}
        <Dotted />
        {onlineItem && v.type !== 'NEED_STORE_PRICE' && (
          <Evidence candidate={onlineItem} target={f.target} storeCount={v.store.count} />
        )}
        <p className="text-[13px] font-semibold" data-testid="scope">
          {scopeSentence(t, f)}
        </p>
      </section>
    </div>
  );
}
