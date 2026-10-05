import { fill } from '../../lib/i18n';
import { useCopy } from '../../lib/language';
import type { DemoScenario } from './fixtures';

// Drawn in code (no external images) so /demo also works offline. Shape follows the home CTA:
// a punch hole on the left and one corner cut diagonally (PLAN 13). The product name stays as
// printed (Korean original, PLAN 12); prices go through the shared won formatter.
const W = 360;
const H = 220;
const CUT = 28;

/** "₩13,980" → ['₩', '13,980', ''] / "13,980원" → ['', '13,980', '원'] so the digits can be drawn big. */
function splitCurrency(text: string): [string, string, string] {
  const m = /^(\D*)([\d,]+)(\D*)$/.exec(text);
  return m ? [m[1] ?? '', m[2] ?? text, m[3] ?? ''] : ['', text, ''];
}

export function DemoPriceTag({ scenario }: { scenario: DemoScenario }) {
  const { t, won } = useCopy();
  const { tag, storePrice, storeKey } = scenario;
  const price = won(storePrice);
  const [before, digits, after] = splitCurrency(price);
  const unitLine = fill(t.demo.tagUnitPrice, {
    base: t.demo.unitBases[tag.unitBase],
    price: won(tag.unitPrice),
  });
  const outline = `M0 0 H${W - CUT} L${W} ${CUT} V${H} H0 Z`;

  return (
    <svg
      viewBox={`-2 -2 ${W + 4} ${H + 4}`}
      role="img"
      aria-label={fill(t.demo.tagAlt, { name: tag.nameLine, price })}
      className="block h-auto w-full"
      style={{ fontVariantNumeric: 'tabular-nums' }}
      data-testid="demo-price-tag"
    >
      <path d={outline} className="fill-receipt" />
      {/* store band: butter = store */}
      <path d={`M0 0 H${W - CUT} L${W} ${CUT} V52 H0 Z`} className="fill-butter" />
      <line x1="0" x2={W} y1="52" y2="52" className="stroke-ink" strokeWidth="2" />
      <path d={outline} className="fill-none stroke-ink" strokeWidth="3" />
      <text x="52" y="34" className="fill-ink" fontSize="17" fontWeight="800">
        {t.store.names[storeKey]}
      </text>
      {/* punch hole */}
      <circle cx="26" cy="27" r="9" className="fill-paper stroke-ink" strokeWidth="2" />

      <text x="24" y="86" className="fill-ink" fontSize="16" fontWeight="600">
        {tag.nameLine}
      </text>
      <text x="24" y="110" className="fill-ink" fontSize="15">
        {tag.sizeLine}
      </text>

      <text x={W - 24} y="170" textAnchor="end" className="fill-ink" fontWeight="800">
        {before && (
          <tspan fontSize="30" dx="-4">
            {before}
          </tspan>
        )}
        <tspan fontSize="56">{digits}</tspan>
        {after && (
          <tspan fontSize="26" dx="4">
            {after}
          </tspan>
        )}
      </text>

      <line x1="24" x2={W - 24} y1="188" y2="188" className="stroke-ink" strokeDasharray="4 4" />
      <text x="24" y="208" className="fill-ink" fontSize="13">
        {unitLine}
      </text>
    </svg>
  );
}
