import { useState } from 'react';
import { buttonClass, TextButton } from '../../components/common/Button';
import { Chip } from '../../components/common/Chip';
import { useCopy } from '../../lib/language';

/**
 * Per online item (S3 item 6): [Open seller page] and a small "Same item? Yes / No".
 *   emphasise  false → the seller link is a plain text link (P3: store wins, don't push online)
 *   onAction   not wired yet: the page shows "Not connected yet"
 */
export function ItemActions({ emphasise, onAction }: { emphasise: boolean; onAction: () => void }) {
  const { t } = useCopy();
  const [answer, setAnswer] = useState<'yes' | 'no' | null>(null);
  const pick = (value: 'yes' | 'no') => {
    setAnswer((prev) => (prev === value ? null : value));
    onAction();
  };
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {emphasise ? (
        <button
          type="button"
          onClick={onAction}
          className={`${buttonClass({ tone: 'sky', full: false })} text-[15px]!`}
        >
          {t.result.link.view}
        </button>
      ) : (
        <TextButton onClick={onAction}>{t.result.link.view}</TextButton>
      )}
      <div role="group" aria-label={t.result.link.sameAsk} className="flex items-center gap-2">
        <span className="text-[13px] font-semibold">{t.result.link.sameAsk}</span>
        <Chip tone="lime" selected={answer === 'yes'} onClick={() => pick('yes')}>
          {t.result.link.yes}
        </Chip>
        <Chip tone="lime" selected={answer === 'no'} onClick={() => pick('no')}>
          {t.result.link.no}
        </Chip>
      </div>
    </div>
  );
}
