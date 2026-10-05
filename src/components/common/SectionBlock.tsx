import type { ReactNode } from 'react';
import { TONE_BG, type Tone } from './tone';

/**
 * A titled section: a coloured title tab (fill + 2px black border) sitting on a top rule, content below
 * on the page background. Not a boxed card — keeps screens from becoming a stack of identical cards.
 *   tone   title-tab fill (tone.ts meanings), default 'butter'
 *   title  h2 text
 *   sub    optional one-line explanation under the title (muted)
 *   id     section id; the h2 gets `${id}-title` and labels the section
 */
export function SectionBlock({
  tone = 'butter',
  title,
  sub,
  id,
  children,
}: {
  tone?: Tone;
  title: ReactNode;
  sub?: ReactNode;
  id?: string;
  children?: ReactNode;
}) {
  const titleId = id ? `${id}-title` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className="flex flex-col gap-3 border-t-2 border-ink"
    >
      <div className="flex flex-col items-start gap-1">
        <h2
          id={titleId}
          className={`-mt-px rounded-b-md border-2 border-t-0 border-ink px-3 py-1 text-[17px] font-extrabold ${TONE_BG[tone]}`}
        >
          {title}
        </h2>
        {sub && <p className="text-[13px] text-muted">{sub}</p>}
      </div>
      {children}
    </section>
  );
}
