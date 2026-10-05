import { useState } from 'react';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { SectionBlock } from '../../components/common/SectionBlock';
import { VerifiedBadge } from '../../components/common/Badges';
import { ButtonLink } from '../../components/common/Button';
import { useCopy } from '../../lib/language';
import { ExampleBadge } from './ExampleBadge';
import { exampleHistory, useExampleHistory } from './exampleStore';
import { confirmedRecords, plannedRecords } from './historyLogic';
import { RecordRow } from './RecordRow';
import type { PurchaseRecord } from './types';

/**
 * S4 view (pure: records in, [Bought it] out). Planned (online) on top, then confirmed purchases
 * sorted by next due date. `example` shows the P1 label — required while rows come from fixtures.
 */
export function HistoryView({
  records,
  example,
  onBought,
}: {
  records: readonly PurchaseRecord[];
  example: boolean;
  onBought: (id: string, pricePaid: number | null) => void;
}) {
  const { t } = useCopy();
  const [justBought, setJustBought] = useState(false);
  const planned = plannedRecords(records);
  const confirmed = confirmedRecords(records);
  const bought = (id: string, price: number | null) => {
    onBought(id, price);
    setJustBought(true);
  };

  return (
    <section className="flex flex-col gap-8">
      <ScreenHeader
        tone="lilac"
        title={t.history.title}
        back={{ to: '/', label: t.history.back }}
      />
      {records.length > 0 && example && (
        <>
          <ExampleBadge sticky />
          <p className="-mt-4 text-[13px] text-muted">{t.history.exampleNote}</p>
        </>
      )}

      {records.length === 0 ? (
        <div className="flex flex-col gap-3" data-testid="history-empty">
          <h2 className="text-[22px] font-extrabold">{t.history.emptyTitle}</h2>
          <p className="text-[15px]">{t.history.emptyBody}</p>
          <ButtonLink to="/" tone="lime">
            {t.home.cta}
          </ButtonLink>
        </div>
      ) : (
        <>
          <SectionBlock
            tone="lilac"
            id="history-planned"
            title={t.history.plannedTitle}
            sub={t.history.plannedSub}
          >
            {justBought && (
              <p role="status">
                <VerifiedBadge>{t.history.justBought}</VerifiedBadge>
              </p>
            )}
            {planned.length === 0 ? (
              <p className="text-[15px]">{t.history.plannedEmpty}</p>
            ) : (
              <ul aria-labelledby="history-planned-title">
                {planned.map((r) => (
                  <RecordRow key={r.id} record={r} onBought={bought} />
                ))}
              </ul>
            )}
          </SectionBlock>

          <SectionBlock
            tone="lilac"
            id="history-confirmed"
            title={t.history.confirmedTitle}
            sub={t.history.confirmedSub}
          >
            {confirmed.length === 0 ? (
              <p className="text-[15px]">{t.history.confirmedEmpty}</p>
            ) : (
              <ul aria-labelledby="history-confirmed-title" data-testid="history-confirmed">
                {confirmed.map((r) => (
                  <RecordRow key={r.id} record={r} onBought={bought} />
                ))}
              </ul>
            )}
          </SectionBlock>
        </>
      )}
    </section>
  );
}

/** /history — example rows until purchases are saved (Phase 4). Nothing here is a real purchase. */
export function HistoryPage() {
  const records = useExampleHistory();
  return (
    <HistoryView
      records={records}
      example
      onBought={(id, price) => exampleHistory.markBought(id, price)}
    />
  );
}
