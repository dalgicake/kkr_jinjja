import { Link } from 'react-router';
import { CheckIcon } from '../../components/common/Icons';
import { SectionBlock } from '../../components/common/SectionBlock';
import { useCopy } from '../../lib/language';
import { fill } from '../../lib/i18n';
import { RESULT_FIXTURES } from './fixtures';

/** S3 item 8: n+m deal banner (tangerine) with a "compare for N items" toggle. */
export function PromoBanner({
  promoText,
  count,
  on,
  onToggle,
}: {
  promoText: string;
  count: number;
  on: boolean;
  onToggle: () => void;
}) {
  const { t } = useCopy();
  const tp = t.result.promo;
  return (
    <div
      data-testid="promo-banner"
      className="flex flex-col gap-3 rounded-lg border-2 border-ink bg-tangerine px-4 py-3 text-ink"
    >
      <p className="text-[17px] font-bold">
        {on ? fill(tp.on, { count }) : fill(tp.banner, { promo: promoText, count })}
      </p>
      <button
        type="button"
        aria-pressed={on}
        onClick={onToggle}
        className={`sticker inline-flex min-h-12 items-center gap-2 self-start rounded-full border-2 border-ink px-4 text-[15px] font-bold ${
          on ? 'bg-lime' : 'bg-receipt'
        }`}
      >
        <span
          aria-hidden="true"
          className={`inline-flex size-5 items-center justify-center rounded border-2 border-ink ${on ? 'bg-ink text-receipt' : 'bg-receipt'}`}
        >
          {on && <CheckIcon className="size-3.5" />}
        </span>
        {fill(tp.toggle, { count })}
      </button>
    </div>
  );
}

/** S3 item 7: last purchase line (lilac = records). */
export function LastPurchase({ text }: { text: string }) {
  return (
    <p
      data-testid="last-purchase"
      className="rounded-lg border-2 border-ink bg-lilac px-4 py-3 text-[15px] font-semibold text-ink"
    >
      {text}
    </p>
  );
}

/** Preview only: jump between the example verdicts so every state can be reviewed. */
export function PreviewList({ currentId }: { currentId: string }) {
  const { t } = useCopy();
  return (
    <SectionBlock
      tone="white"
      id="preview"
      title={t.result.preview.title}
      sub={t.result.preview.sub}
    >
      <ul className="flex flex-wrap gap-2">
        {RESULT_FIXTURES.map((f) => {
          const current = f.id === currentId;
          return (
            <li key={f.id}>
              <Link
                to={`/preview/result/${f.id}`}
                aria-current={current ? 'page' : undefined}
                className={`inline-flex min-h-12 items-center gap-1 rounded-full border-2 border-ink px-4 text-[15px] font-bold ${
                  current ? 'bg-lime' : 'bg-receipt'
                }`}
              >
                {current && <CheckIcon />}
                {t.result.preview.names[f.nameKey]}
              </Link>
            </li>
          );
        })}
      </ul>
    </SectionBlock>
  );
}
