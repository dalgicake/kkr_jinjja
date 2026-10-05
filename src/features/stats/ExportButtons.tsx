import { useState } from 'react';
import { Button } from '../../components/common/Button';
import { fill } from '../../lib/i18n';
import { useCopy } from '../../lib/language';
import { EXPORT_TABLES, type ExportTable } from './fixtures';

/**
 * One CSV button per table (PLAN 10.2 "모든 표 CSV 내보내기"). Shell only: no file is made yet,
 * a status line says so. Later: GET /api/stats?export=<table> with the gate's passcode header.
 */
export function ExportButtons() {
  const { t } = useCopy();
  const [picked, setPicked] = useState<ExportTable | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        {EXPORT_TABLES.map((table) => (
          <Button
            key={table}
            tone="white"
            aria-pressed={picked === table}
            onClick={() => setPicked(table)}
            className="text-[15px]"
          >
            {fill(t.ops.stats.exportButton, { table: t.ops.stats.tables[table] })}
          </Button>
        ))}
      </div>
      <p role="status" className="text-[15px]">
        {picked ? (
          <span className="inline-block rounded-md border-2 border-ink bg-sky px-2 py-1 text-ink">
            {t.ops.stats.exportNote}
          </span>
        ) : (
          <span className="text-[13px] text-muted">{t.ops.stats.exportNote}</span>
        )}
      </p>
    </div>
  );
}
