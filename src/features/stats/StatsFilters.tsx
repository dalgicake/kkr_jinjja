import { Chip } from '../../components/common/Chip';
import { useCopy } from '../../lib/language';
import { MODES, PERIODS, type Mode, type Period } from './fixtures';

/** Pure: toggle one mode, keep MODES order, never leave the set empty (the last one stays on). */
export function toggleMode(current: readonly Mode[], mode: Mode): Mode[] {
  const on = current.includes(mode);
  const next = MODES.filter((m) => (m === mode ? !on : current.includes(m)));
  return next.length ? next : [...current];
}

/** Period (pick one, lime) and mode (pick any, sky) filter chips, one block above the metrics. */
export function StatsFilters({
  period,
  modes,
  onPeriod,
  onModes,
}: {
  period: Period;
  modes: readonly Mode[];
  onPeriod: (p: Period) => void;
  onModes: (m: Mode[]) => void;
}) {
  const { t } = useCopy();
  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[15px] font-extrabold">{t.ops.stats.period}</legend>
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <Chip key={p} tone="lime" selected={period === p} onClick={() => onPeriod(p)}>
              {t.ops.stats.periods[p]}
            </Chip>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[15px] font-extrabold">{t.ops.stats.mode}</legend>
        <div className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <Chip
              key={m}
              tone="lime"
              selected={modes.includes(m)}
              onClick={() => onModes(toggleMode(modes, m))}
            >
              {t.ops.stats.modes[m]}
            </Chip>
          ))}
        </div>
        <p className="text-[13px] text-muted">{t.ops.stats.modeNote}</p>
      </fieldset>
      <p className="text-[13px] text-muted">{t.ops.stats.filterNote}</p>
    </div>
  );
}
