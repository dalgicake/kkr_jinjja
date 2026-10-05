import { useState } from 'react';
import { VerifiedBadge } from '../../components/common/Badges';
import { ExampleLabel } from '../../components/common/ExampleLabel';
import { SectionBlock } from '../../components/common/SectionBlock';
import { TextLink } from '../../components/common/TextLink';
import { useCopy } from '../../lib/language';
import { exampleHistory, useExampleHistory } from '../history/exampleStore';
import { recentRecords } from '../history/historyLogic';
import { RecordRow } from '../history/RecordRow';

/**
 * S0 "Recent records": the latest 3 rows, [Bought it] on planned (online) rows.
 * Rows come from example fixtures until purchases are saved, so the P1 label sits right above them.
 */
export function RecentRecords() {
  const { t } = useCopy();
  const records = recentRecords(useExampleHistory(), 3);
  const [justBought, setJustBought] = useState(false);
  return (
    <SectionBlock tone="lilac" id="home-recent" title={t.home.recentTitle}>
      {records.length === 0 ? (
        <p className="text-[15px]">{t.home.recentEmpty}</p>
      ) : (
        <>
          <ExampleLabel sticky={false}>{t.home.recentExample}</ExampleLabel>
          {justBought && (
            <p role="status">
              <VerifiedBadge>{t.history.justBought}</VerifiedBadge>
            </p>
          )}
          <ul aria-labelledby="home-recent-title" data-testid="home-recent">
            {records.map((r) => (
              <RecordRow
                key={r.id}
                record={r}
                showDue={false}
                onBought={(id, price) => {
                  exampleHistory.markBought(id, price);
                  setJustBought(true);
                }}
              />
            ))}
          </ul>
        </>
      )}
      <TextLink to="/history">{t.home.historyLink}</TextLink>
    </SectionBlock>
  );
}
