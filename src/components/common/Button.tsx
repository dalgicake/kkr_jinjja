import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary';

/** 48px+ touch target. Also used to style a <label> that opens the camera. */
export function buttonClass(variant: ButtonVariant = 'primary'): string {
  const base =
    'inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg px-4 text-[17px] font-semibold focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ink focus-within:outline-4 focus-within:outline-offset-2 focus-within:outline-ink disabled:cursor-default disabled:opacity-60';
  return variant === 'primary'
    ? `${base} bg-ink text-receipt`
    : `${base} border-2 border-ink bg-transparent text-ink`;
}

export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button type={type} className={`${buttonClass(variant)} ${className}`} {...props} />;
}

/** Same look as TextLink, for in-page actions (48x48 hit box). */
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
