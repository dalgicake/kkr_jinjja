import { useState } from 'react';
import { buttonClass } from '../../components/common/Button';
import { SectionBlock } from '../../components/common/SectionBlock';
import { fill } from '../../lib/i18n';
import { useCopy } from '../../lib/language';
import { CSV_COLUMNS } from './fixtures';

/**
 * CSV upload area (S7). Shell only: picking a file shows its name and a note that nothing was sent.
 * Later: POST /api/admin/products with the gate's passcode header (upsert rules in uploadSub).
 */
export function CsvUpload() {
  const { t } = useCopy();
  const a = t.ops.admin;
  const [fileName, setFileName] = useState<string | null>(null);
  return (
    <SectionBlock tone="butter" id="admin-upload" title={a.uploadTitle} sub={a.uploadSub}>
      <div className="flex flex-col gap-3 rounded-lg border-2 border-dashed border-ink bg-receipt p-4">
        <label className={buttonClass({ tone: 'butter' })}>
          {a.uploadPick}
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
        </label>
        <div className="flex flex-col gap-1">
          <p className="text-[13px] font-bold">{a.uploadColumns}</p>
          <p className="font-mono text-[13px] break-words text-muted">{CSV_COLUMNS.join(', ')}</p>
        </div>
      </div>
      {fileName && (
        <div role="status" className="flex flex-col gap-1 text-[15px]">
          <p className="font-bold break-all">{fill(a.uploadPicked, { name: fileName })}</p>
          <p className="self-start rounded-md border-2 border-ink bg-sky px-2 py-1 text-ink">
            {a.uploadPending}
          </p>
        </div>
      )}
    </SectionBlock>
  );
}
