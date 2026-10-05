import { copy, fill } from '../../lib/i18n';
import { medianMs, readLatencySamples } from '../capture/latencyLog';

/** /about?debug — shutter → confirm card on this device (Phase 1 acceptance: median ≤ 6 s on LTE). */
export function LatencyDebug({ samples = readLatencySamples() }: { samples?: readonly number[] }) {
  const median = medianMs(samples);
  const last = samples.at(-1);
  return (
    <div className="flex flex-col gap-1 text-[15px]" data-testid="latency-debug">
      <h2 className="text-[17px] font-semibold">{copy.about.latency.title}</h2>
      {median === null || last === undefined ? (
        <p>{copy.about.latency.none}</p>
      ) : (
        <>
          <p className="tabular-nums">
            {fill(copy.about.latency.median, { n: samples.length, ms: median })}
          </p>
          <p className="text-[13px] text-muted tabular-nums">
            {fill(copy.about.latency.last, { ms: last })}
          </p>
        </>
      )}
    </div>
  );
}
