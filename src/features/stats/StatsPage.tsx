import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useCopy } from '../../lib/language';
import { PasscodeGate } from './PasscodeGate';
import { StatsBody } from './StatsBody';

/** S8 `/stats`. Lilac header (records). Passcode gate (UI only) → example metrics (PLAN 10.2). */
export function StatsPage() {
  const { t } = useCopy();
  return (
    <section className="flex flex-col gap-8 pb-8">
      <ScreenHeader tone="lilac" title={t.ops.stats.title} back={{ to: '/', label: t.ops.home }} />
      <PasscodeGate>{() => <StatsBody />}</PasscodeGate>
    </section>
  );
}
