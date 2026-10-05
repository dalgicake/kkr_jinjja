import type { ReactNode } from 'react';
import { TONE_BG, type Tone } from '../../components/common/tone';
import { barWidth } from './format';

/**
 * One metric: colour fill (tone.ts meaning) + label words + big tabular number with its unit.
 *   wide  spans both grid columns and uses the 56px number (the headline metric)
 */
export function StatTile({
  tone,
  label,
  value,
  sub,
  wide = false,
}: {
  tone: Tone;
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-lg border-2 border-ink p-3 ${TONE_BG[tone]} ${
        wide ? 'col-span-2' : ''
      }`}
    >
      <p className="text-[15px] leading-snug font-bold">{label}</p>
      <p
        className={`leading-none font-extrabold tabular-nums ${wide ? 'text-[56px]' : 'text-[30px]'}`}
      >
        {value}
      </p>
      {sub && <p className="text-[13px] leading-snug font-semibold">{sub}</p>}
    </div>
  );
}

export function TileGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

export interface BarItem {
  key: string;
  label: ReactNode;
  value: number;
  display: ReactNode;
  tone: Tone;
}

/**
 * Horizontal bars, one row per item: words + number on one line, a filled bar under it.
 * Identity is always the text label; the fill only repeats it. `max` defaults to the largest value.
 */
export function BarList({
  items,
  max,
  label,
}: {
  items: readonly BarItem[];
  max?: number;
  label?: string;
}) {
  const top = max ?? Math.max(0, ...items.map((i) => i.value));
  return (
    <ul aria-label={label} className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.key} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-[15px]">
            <span className="font-semibold">{item.label}</span>
            <span className="shrink-0 font-extrabold tabular-nums">{item.display}</span>
          </div>
          <div className="h-4 w-full rounded-sm border-2 border-ink bg-receipt">
            <div
              className={`h-full border-r-2 border-ink ${TONE_BG[item.tone]}`}
              style={{ width: barWidth(item.value, top) }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Vertical day bars (one series → no legend; every bar carries its own number and date). */
export function DayBars({
  days,
  label,
}: {
  days: readonly { key: string; dateLabel: string; value: number }[];
  label: string;
}) {
  const top = Math.max(0, ...days.map((d) => d.value));
  return (
    <ol aria-label={label} className="grid grid-flow-col auto-cols-fr items-end gap-1.5">
      {days.map((d) => (
        <li key={d.key} className="flex flex-col items-center gap-1">
          <span className="text-[13px] font-extrabold tabular-nums">{d.value}</span>
          <div className="flex h-28 w-full items-end">
            <div
              className="w-full rounded-t-sm border-2 border-ink bg-lilac"
              style={{ height: barWidth(d.value, top) }}
            />
          </div>
          <span className="text-center text-[13px] leading-tight text-muted">{d.dateLabel}</span>
        </li>
      ))}
    </ol>
  );
}
