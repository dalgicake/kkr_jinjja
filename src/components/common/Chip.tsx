import type { ReactNode } from 'react';
import { CheckIcon } from './Icons';
import { TONE_BG, type Tone } from './tone';

/**
 * Tappable toggle chip, 48px tall, 2px black border, pill shape.
 *   tone      fill when selected (default 'lime'); unselected chips are white
 *   selected  shows the fill AND a check icon (never colour alone); sets aria-pressed
 *   onClick   toggle handler
 */
export function Chip({
  tone = 'lime',
  selected,
  onClick,
  children,
}: {
  tone?: Tone;
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`inline-flex min-h-12 items-center gap-1 rounded-full border-2 border-ink px-4 text-[15px] font-bold focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ink ${
        selected ? TONE_BG[tone] : TONE_BG.white
      }`}
    >
      {selected && <CheckIcon />}
      {children}
    </button>
  );
}
