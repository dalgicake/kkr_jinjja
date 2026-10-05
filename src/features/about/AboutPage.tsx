import { useLocation } from 'react-router';
import { ButtonLink } from '../../components/common/Button';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { SectionBlock } from '../../components/common/SectionBlock';
import { TONE_BG, type Tone } from '../../components/common/tone';
import { fill } from '../../lib/i18n';
import { useCopy } from '../../lib/language';
import { isDebugSearch } from '../capture/latencyLog';
import { ConnectionStatus } from './ConnectionStatus';
import { LatencyDebug } from './LatencyDebug';

const PRINCIPLES = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'] as const;

/**
 * Number-chip fill per principle, following the fixed colour meanings (tone.ts): pink = needs
 * checking (P1 unknown values, P2 unsure matches), butter = store (P3), sky = online lookups and
 * their scope (P4, P6), lilac = records (P5), tangerine = deals/ads (P7). The chip also carries the
 * "P1"… text, so colour is never the only signal.
 */
const PRINCIPLE_TONE: Readonly<Record<(typeof PRINCIPLES)[number], Tone>> = {
  p1: 'pink',
  p2: 'pink',
  p3: 'butter',
  p4: 'sky',
  p5: 'lilac',
  p6: 'sky',
  p7: 'tangerine',
};
const PRIVACY = ['anonymous', 'photo', 'testMode', 'purchases'] as const;

/** S9. Sky header (info). P1~P7 in plain words, privacy, data source, contact. */
export function AboutPage() {
  const { search } = useLocation();
  const { t } = useCopy();
  return (
    <section className="flex flex-col gap-8">
      <ScreenHeader
        tone="sky"
        title={t.about.title}
        sub={t.about.intro}
        back={{ to: '/', label: t.about.back }}
      />

      <SectionBlock tone="lime" id="about-principles" title={t.about.principlesTitle}>
        <ol className="flex flex-col gap-4">
          {PRINCIPLES.map((key, i) => (
            <li key={key} className="grid grid-cols-[3rem_1fr] items-start gap-3">
              <span
                className={`flex h-10 w-12 items-center justify-center rounded-md border-2 border-ink text-[17px] font-extrabold tabular-nums ${TONE_BG[PRINCIPLE_TONE[key]]}`}
              >
                {fill(t.about.principleCode, { n: i + 1 })}
              </span>
              <div className="flex flex-col gap-1">
                <h3 className="text-[17px] font-extrabold">{t.about.principles[key].title}</h3>
                <p className="text-[15px]">{t.about.principles[key].body}</p>
              </div>
            </li>
          ))}
        </ol>
      </SectionBlock>

      <SectionBlock tone="lilac" id="about-privacy" title={t.about.privacyTitle}>
        <ul className="flex list-disc flex-col gap-2 pl-5 text-[15px]">
          {PRIVACY.map((key) => (
            <li key={key}>{t.about.privacy[key]}</li>
          ))}
        </ul>
      </SectionBlock>

      <SectionBlock tone="sky" id="about-source" title={t.about.sourceTitle}>
        <p className="text-[15px]">{t.about.source}</p>
      </SectionBlock>

      <SectionBlock tone="white" id="about-contact" title={t.about.contactTitle}>
        <p className="text-[15px]">{t.about.contactEmail}</p>
      </SectionBlock>

      <ButtonLink to="/demo" tone="sky">
        {t.about.demoLink}
      </ButtonLink>

      <ConnectionStatus />
      {isDebugSearch(search) && <LatencyDebug />}
    </section>
  );
}
