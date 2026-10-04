import type { ReactNode } from 'react';
import { Link } from 'react-router';

/**
 * In-app text link with a hit box of at least 48x48px (CLAUDE.md: touch area >= 48px).
 * The negative margin cancels the padding so the text stays aligned with surrounding content.
 */
export function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="-mx-2 inline-flex min-h-12 min-w-12 items-center justify-center self-start px-2 text-[15px] font-semibold underline underline-offset-4"
    >
      {children}
    </Link>
  );
}
