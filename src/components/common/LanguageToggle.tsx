import { useCopy } from '../../lib/language';
import type { Lang } from '../../lib/i18n';

/** EN | 한국어 segmented switch, 48px tall. Active side is filled black with white text (plus aria-pressed). */
export function LanguageToggle() {
  const { t, lang, setLang } = useCopy();
  const option = (value: Lang, label: string) => {
    const active = lang === value;
    return (
      <button
        type="button"
        lang={value}
        aria-pressed={active}
        onClick={() => setLang(value)}
        className={`min-h-12 min-w-12 px-3 text-[15px] font-extrabold focus-visible:outline-4 focus-visible:-outline-offset-4 focus-visible:outline-ink ${
          active ? 'bg-ink text-receipt' : 'bg-receipt text-ink'
        }`}
      >
        {label}
      </button>
    );
  };
  return (
    <div
      role="group"
      aria-label={t.ui.language}
      data-testid="language-toggle"
      className="flex shrink-0 divide-x-2 divide-ink overflow-hidden rounded-lg border-2 border-ink"
    >
      {option('en', t.ui.langEn)}
      {option('ko', t.ui.langKo)}
    </div>
  );
}
