import type { ReactNode } from 'react';
import type { Unit } from '../../../shared/types';
import { CheckBadge } from '../../components/common/Badges';
import { SectionBlock } from '../../components/common/SectionBlock';
import { useCopy } from '../../lib/language';
import { fill } from '../../lib/i18n';
import { ItemActions } from './ItemActions';
import { candidateUnitPrice, mallLabel, unitPriceText } from './resultView';
import type { PreviewVerdict, ResultCandidate } from './types';

/** One online item in a lower section: title (original Korean), seller, numbers, actions. */
function Item({
  c,
  children,
  top,
  onAction,
}: {
  c: ResultCandidate;
  children?: ReactNode;
  top?: ReactNode;
  onAction: () => void;
}) {
  const { t } = useCopy();
  return (
    <li className="flex flex-col gap-2 border-b-2 border-dotted border-ink pb-3 last:border-b-0">
      {top}
      <div className="flex flex-col">
        <span className="text-[15px] font-bold" lang="ko">
          {c.title}
        </span>
        <span className="text-[13px] text-muted">{mallLabel(t, c)}</span>
      </div>
      {children}
      {/* Lower-section items are never pushed: text link only (P2, P3). */}
      <ItemActions emphasise={false} onAction={onAction} />
    </li>
  );
}

/** S3 item 5a: bundles and other sizes, compared by unit price only, with the full amount. */
export function BundleSection({
  items,
  verdict: v,
  onAction,
}: {
  items: ResultCandidate[];
  verdict: PreviewVerdict;
  onAction: () => void;
}) {
  const { t, won } = useCopy();
  const tb = t.result.bundles;
  const unit: Unit = v.store.unit;
  const insight = v.bundleInsight;
  return (
    <SectionBlock tone="sky" id="bundles" title={tb.title} sub={tb.sub}>
      {items.length === 0 ? (
        <p className="text-[15px]">{tb.empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((c) => {
            const per = candidateUnitPrice(c);
            const isInsight = insight?.candidate.externalId === c.externalId;
            return (
              <Item key={c.externalId} c={c} onAction={onAction}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="price text-[17px] font-bold">
                    {per !== null ? unitPriceText(t, won, per, unit) : null}
                  </span>
                  <span className="price text-right text-[15px]">
                    {fill(tb.total, { price: won(c.price) })}
                  </span>
                </div>
                {isInsight && insight && (
                  <p className="rounded-md border-2 border-ink bg-receipt px-3 py-2 text-[15px] font-semibold">
                    {fill(tb.insight, {
                      count: insight.count,
                      unit: t.result.unit[unit],
                      pct: insight.pct,
                      total: won(insight.total),
                    })}
                  </p>
                )}
              </Item>
            );
          })}
        </ul>
      )}
    </SectionBlock>
  );
}

/** S3 item 5b: "Needs checking" — pink badge + reason words; never used in the verdict (P2). */
export function UncertainSection({
  items,
  onAction,
}: {
  items: ResultCandidate[];
  onAction: () => void;
}) {
  const { t, won } = useCopy();
  const tu = t.result.uncertain;
  return (
    <SectionBlock tone="pink" id="uncertain" title={tu.title} sub={tu.sub}>
      {items.length === 0 ? (
        <p className="text-[15px]">{tu.empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((c) => (
            <Item
              key={c.externalId}
              c={c}
              onAction={onAction}
              top={
                <div className="flex flex-wrap items-center gap-2">
                  <CheckBadge>{tu.badge}</CheckBadge>
                  {c.reasonCode && (
                    <span className="text-[15px] font-semibold">{tu.reasons[c.reasonCode]}</span>
                  )}
                </div>
              }
            >
              <span className="price text-[15px]">{won(c.price)}</span>
            </Item>
          ))}
        </ul>
      )}
    </SectionBlock>
  );
}
