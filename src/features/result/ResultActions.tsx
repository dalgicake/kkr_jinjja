import { useEffect, useRef } from 'react';
import { Button, TextButton } from '../../components/common/Button';
import { useCopy } from '../../lib/language';

/**
 * S3 item 9: bottom action bar [Buy at store] [Buy online] [Skip]. Sticky, so it stays at the thumb
 * while scrolling and rests above the footer at the end. Butter = store, sky = online; when the store
 * wins or ties the online button drops to white (P3: don't push online).
 */
export function ActionBar({
  emphasiseOnline,
  onAction,
}: {
  emphasiseOnline: boolean;
  onAction: () => void;
}) {
  const { t } = useCopy();
  const ta = t.result.actions;
  const small = 'px-2! text-[15px]! break-keep';
  return (
    <nav
      aria-label={ta.label}
      data-testid="action-bar"
      className="result-actions sticky bottom-0 z-30 -mx-4 mt-2 grid grid-cols-3 gap-2 border-t-2 border-ink bg-paper px-4 pt-3"
    >
      <Button tone="butter" className={small} onClick={onAction}>
        {ta.store}
      </Button>
      <Button tone={emphasiseOnline ? 'sky' : 'white'} className={small} onClick={onAction}>
        {ta.online}
      </Button>
      <Button tone="white" className={small} onClick={onAction}>
        {ta.skip}
      </Button>
    </nav>
  );
}

const KINDS = ['product', 'size', 'price', 'other'] as const;

/** S3 item 10: "Something's off" sheet with 4 kinds. Esc or the backdrop closes it. */
export function ReportSheet({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: () => void;
}) {
  const { t } = useCopy();
  const tr = t.result.report;
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <button
        type="button"
        aria-label={tr.close}
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-ink/40"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        className="relative flex w-full max-w-[480px] flex-col gap-3 rounded-t-xl border-2 border-b-0 border-ink bg-receipt px-4 pt-4 pb-[max(16px,env(safe-area-inset-bottom))]"
      >
        <h2 id="report-title" className="text-[22px] font-extrabold">
          {tr.title}
        </h2>
        {KINDS.map((kind) => (
          <Button key={kind} tone="white" className="justify-start! text-left" onClick={onPick}>
            {tr[kind]}
          </Button>
        ))}
        <TextButton onClick={onClose}>{tr.close}</TextButton>
      </div>
    </div>
  );
}
