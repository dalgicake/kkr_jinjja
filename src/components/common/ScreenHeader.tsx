import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useCopy } from '../../lib/language';
import { LanguageToggle } from './LanguageToggle';
import { TONE_BG, type Tone } from './tone';

/**
 * Top of every screen: a full-bleed colour block with an optional back link, the ko/en toggle,
 * a Pretendard 800 title and an optional sub line. Use exactly once per screen, first in the page.
 *   tone      block fill (tone.ts meanings): home lime, confirm butter, about sky, history lilac,
 *             result white/lime, demo tangerine … pick the one that matches the screen's subject
 *   title     h1 text
 *   sub       optional line under the title
 *   back      { to, label? } shows a 48px back link (label defaults to t.ui.back); omit on home
 *   size      'lg' 56px title (home) | 'md' 30px (default)
 *   children  extra content inside the block, below the sub line
 */
export function ScreenHeader({
  tone = 'lime',
  title,
  sub,
  back,
  size = 'md',
  children,
}: {
  tone?: Tone;
  title: ReactNode;
  sub?: ReactNode;
  back?: { to: string; label?: string };
  size?: 'md' | 'lg';
  children?: ReactNode;
}) {
  const { t } = useCopy();
  return (
    <header
      className={`-mx-4 flex flex-col gap-3 border-b-2 border-ink px-4 pt-3 pb-5 ${TONE_BG[tone]}`}
    >
      <div className="flex items-center justify-between gap-3">
        {back ? (
          <Link
            to={back.to}
            className="-mx-2 inline-flex min-h-12 min-w-12 items-center px-2 text-[15px] font-bold underline underline-offset-4"
          >
            {back.label ?? t.ui.back}
          </Link>
        ) : (
          <span />
        )}
        <LanguageToggle />
      </div>
      <h1
        className={`leading-tight font-extrabold ${size === 'lg' ? 'text-[56px] leading-none' : 'text-[30px]'}`}
      >
        {title}
      </h1>
      {sub && <p className="text-[17px] font-semibold">{sub}</p>}
      {children}
    </header>
  );
}
