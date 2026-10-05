import type { ReactNode } from 'react';
import { AlertIcon, CheckIcon } from './Icons';
import { TONE_BG, type Tone } from './tone';

/**
 * Small static label: colour fill + black text + 2px black border, optional icon.
 *   tone  fill (tone.ts meanings), default 'white'
 *   icon  'check' | 'alert' | 'none' (default 'none')
 *   id    for aria-describedby
 * Not interactive — use Chip for tappable choices.
 */
export function Badge({
  tone = 'white',
  icon = 'none',
  id,
  children,
}: {
  tone?: Tone;
  icon?: 'check' | 'alert' | 'none';
  id?: string;
  children: ReactNode;
}) {
  return (
    <span
      id={id}
      className={`inline-flex items-center gap-1 rounded-md border-2 border-ink px-2 py-0.5 text-[13px] leading-snug font-bold ${TONE_BG[tone]}`}
    >
      {icon === 'check' && <CheckIcon className="size-3.5 shrink-0" />}
      {icon === 'alert' && <AlertIcon className="size-3.5 shrink-0" />}
      {children}
    </span>
  );
}

/** "Please check": pink fill + alert icon + words (pink is a fill only, never text colour). */
export function CheckBadge({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <Badge tone="pink" icon="alert" id={id}>
      {children}
    </Badge>
  );
}

/** "Verified product": lime fill + check icon + words. */
export function VerifiedBadge({ children }: { children: ReactNode }) {
  return (
    <Badge tone="lime" icon="check">
      {children}
    </Badge>
  );
}
