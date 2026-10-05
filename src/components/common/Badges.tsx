import type { ReactNode } from 'react';
import { AlertIcon, CheckIcon } from './Icons';

/** Pink fill + black text + icon (PLAN 13: pink is a fill only, never text colour). */
export function CheckBadge({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <span
      id={id}
      className="inline-flex items-center gap-1 rounded-sm bg-pink px-2 py-0.5 text-[13px] font-semibold text-ink"
    >
      <AlertIcon className="size-3.5" />
      {children}
    </span>
  );
}

/** "확인된 상품": black outline + check icon + text. */
export function VerifiedBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border-2 border-ink bg-receipt px-2 py-0.5 text-[13px] font-semibold text-ink">
      <CheckIcon className="size-3.5" />
      {children}
    </span>
  );
}
