import type { ButtonHTMLAttributes } from 'react';
import { Link } from 'react-router';
import type { ReactNode } from 'react';
import { TONE_BG, type Tone } from './tone';

/**
 * Price-tag sticker button: colour fill, black text, 2px black border, hard 3px offset, >= 48px.
 *   tone  fill colour (see tone.ts for meanings). Default 'lime' = primary action; 'white' = secondary.
 *   size  'md' 48px / 17px (default) | 'lg' 64px / 22px (main action at thumb height)
 *   full  stretch to the column width (default true)
 * No arrows after the text (PLAN 13).
 */
export interface ButtonLook {
  tone?: Tone;
  size?: 'md' | 'lg';
  full?: boolean;
}

/** Same look for <button>, <Link> and a <label> that opens the camera. */
export function buttonClass({ tone = 'lime', size = 'md', full = true }: ButtonLook = {}): string {
  const sizing =
    size === 'lg'
      ? 'min-h-16 px-5 text-[22px] font-extrabold'
      : 'min-h-12 px-4 text-[17px] font-bold';
  return [
    'sticker inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-ink text-center leading-tight',
    'focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ink focus-within:outline-4 focus-within:outline-offset-2 focus-within:outline-ink',
    'disabled:cursor-default disabled:opacity-60',
    full ? 'w-full' : 'self-start',
    sizing,
    TONE_BG[tone],
  ].join(' ');
}

export function Button({
  tone,
  size,
  full,
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & ButtonLook) {
  return (
    <button
      type={type}
      className={`${buttonClass({ tone, size, full })} ${className}`}
      {...props}
    />
  );
}

/** A router link that looks like Button (for navigation actions like "Try the demo"). */
export function ButtonLink({
  to,
  children,
  ...look
}: ButtonLook & { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={buttonClass(look)}>
      {children}
    </Link>
  );
}

/** Underlined text action with a 48x48 hit box (same look as TextLink). */
export function TextButton(
  props: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'type'>,
) {
  return (
    <button
      type="button"
      className="-mx-2 inline-flex min-h-12 min-w-12 items-center justify-center self-start px-2 text-[15px] font-semibold underline underline-offset-4"
      {...props}
    />
  );
}
