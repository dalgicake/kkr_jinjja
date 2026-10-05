import { useState } from 'react';
import { CheckBadge } from '../../components/common/Badges';
import { Button } from '../../components/common/Button';
import { SectionBlock } from '../../components/common/SectionBlock';
import { fill } from '../../lib/i18n';
import { useCopy } from '../../lib/language';
import { shortDate } from '../stats/format';
import type { AdminReport, ReportAction } from './fixtures';

function ReportRow({ r }: { r: AdminReport }) {
  const { t, lang } = useCopy();
  const a = t.ops.admin;
  const [action, setAction] = useState<ReportAction | null>(null);
  const actionLabel = (x: ReportAction) => (x === 'recheck' ? a.recheck : a.markWrong);
  return (
    <li className="flex flex-col gap-2 border-b-2 border-dotted border-ink pb-4">
      <div className="flex items-center justify-between gap-3">
        <CheckBadge>{a.reportKinds[r.kind]}</CheckBadge>
        <span className="text-[13px] text-muted tabular-nums">{shortDate(r.createdOn, lang)}</span>
      </div>
      <p className="text-[15px] font-bold">{fill(a.reportProduct, { label: r.productLabel })}</p>
      {r.note && <p className="text-[15px]">{fill(a.reportNote, { note: a.exampleNotes[r.note] })}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Button tone="sky" aria-pressed={action === 'recheck'} onClick={() => setAction('recheck')}>
          {a.recheck}
        </Button>
        <Button
          tone="pink"
          aria-pressed={action === 'markWrong'}
          onClick={() => setAction('markWrong')}
        >
          {a.markWrong}
        </Button>
      </div>
      {action && (
        <p role="status" className="text-[13px] font-semibold">
          {fill(a.handled, { action: actionLabel(action) })}
        </p>
      )}
    </li>
  );
}

/** Reports (`reports` table): recheck the link or mark it wrong. Shell: choices are not saved. */
export function ReportList({ reports }: { reports: readonly AdminReport[] }) {
  const { t } = useCopy();
  return (
    <SectionBlock
      tone="pink"
      id="admin-reports"
      title={fill(reports.length === 1 ? t.ops.admin.reportsTitleOne : t.ops.admin.reportsTitle, {
        n: reports.length,
      })}
    >
      <ul className="flex flex-col gap-4">
        {reports.map((r) => (
          <ReportRow key={r.id} r={r} />
        ))}
      </ul>
    </SectionBlock>
  );
}
