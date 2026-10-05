import { Link } from 'react-router';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { SectionBlock } from '../../components/common/SectionBlock';
import { TONE_BG } from '../../components/common/tone';
import { fill } from '../../lib/i18n';
import { useCopy } from '../../lib/language';
import { tourGroups, type TourStop } from './tour';

function StopLink({ stop }: { stop: TourStop }) {
  const { t } = useCopy();
  return (
    <Link
      to={stop.to}
      className={`sticker flex min-h-12 items-start gap-3 rounded-lg border-2 border-ink px-3 py-2 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ink ${TONE_BG[stop.tone]}`}
    >
      <span className="mt-0.5 shrink-0 rounded border-2 border-ink bg-receipt px-1.5 text-[13px] font-extrabold tabular-nums">
        {fill(t.screens.code, { n: stop.screen })}
      </span>
      <span className="flex flex-col">
        <span className="text-[17px] leading-snug font-extrabold">{stop.name}</span>
        <span className="text-[15px] leading-snug font-semibold">{stop.desc}</span>
      </span>
    </Link>
  );
}

/** /screens: a tour of every screen and every result verdict, for reviewing the UI shells. */
export function ScreensPage() {
  const { t } = useCopy();
  return (
    <section className="flex flex-col gap-8 pb-4">
      <ScreenHeader
        tone="sky"
        title={t.screens.title}
        sub={t.screens.sub}
        back={{ to: '/', label: t.ui.home }}
      />
      {tourGroups(t).map((g) => (
        <SectionBlock key={g.id} id={`tour-${g.id}`} tone={g.tone} title={g.title} sub={g.sub}>
          <ul className="flex flex-col gap-3">
            {g.stops.map((s) => (
              <li key={s.to}>
                <StopLink stop={s} />
              </li>
            ))}
          </ul>
        </SectionBlock>
      ))}
    </section>
  );
}
