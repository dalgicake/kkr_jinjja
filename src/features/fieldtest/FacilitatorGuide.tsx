import { SectionBlock } from '../../components/common/SectionBlock';
import { useCopy } from '../../lib/language';

const LINES = ['guide1', 'guide2', 'guide3'] as const;

/**
 * Facilitator notes shown at the top of /test (PLAN 11). Full on the first screens; folded into a
 * 48px disclosure while a trial runs so the timer stays near the top.
 */
export function FacilitatorGuide({ compact = false }: { compact?: boolean }) {
  const { t } = useCopy();
  const list = (
    <ol className="flex list-decimal flex-col gap-2 pl-6 text-[15px]">
      {LINES.map((k) => (
        <li key={k}>{t.ops.test[k]}</li>
      ))}
    </ol>
  );
  if (compact) {
    return (
      <details className="rounded-lg border-2 border-ink bg-sky text-ink">
        <summary className="flex min-h-12 cursor-pointer items-center px-3 text-[15px] font-extrabold">
          {t.ops.test.guideTitle}
        </summary>
        <div className="px-3 pb-3">{list}</div>
      </details>
    );
  }
  return (
    <SectionBlock tone="sky" id="test-guide" title={t.ops.test.guideTitle}>
      {list}
    </SectionBlock>
  );
}
