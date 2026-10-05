import { formatWon } from '../../../shared/units.js';
import type { Copy } from '../../copy/ko';
import { fill, type Lang } from '../../lib/i18n';

/** Shared number formatting for the ops screens (/stats, /admin, /test). Pure, no React. */

/** 6200 → "6.2s" / "6.2초". Under a minute keeps one decimal; longer is whole seconds. */
export function secondsLabel(t: Copy, ms: number): string {
  const s = ms / 1000;
  const n = s < 60 ? (Math.round(s * 10) / 10).toFixed(1) : String(Math.round(s));
  return fill(t.ops.sec, { n });
}

export function pctLabel(t: Copy, pct: number): string {
  return fill(t.ops.pct, { n: Math.round(pct) });
}

/** 1234 → "1,234건" (ko) / "1,234" (en). */
export function countLabel(t: Copy, n: number): string {
  return fill(t.ops.count, { n: formatWon(n) });
}

export function peopleLabel(t: Copy, n: number): string {
  return fill(n === 1 ? t.ops.peopleOne : t.ops.people, { n: formatWon(n) });
}

/** "2026-10-05" → "Oct 5" / "10월 5일". Date-only strings are read as calendar dates (no TZ shift). */
export function shortDate(iso: string, lang: Lang): string {
  const [y = 1970, m = 1, d = 1] = iso.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat(lang === 'ko' ? 'ko-KR' : 'en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** Share of `value` in `max` as a CSS width, at least 2% so a non-zero bar stays visible. */
export function barWidth(value: number, max: number): string {
  if (max <= 0 || value <= 0) return '0%';
  return `${Math.max(2, Math.round((value / max) * 100))}%`;
}

/** Elapsed timer read-out: 74000 → "1:14", 8100 → "0:08". */
export function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
