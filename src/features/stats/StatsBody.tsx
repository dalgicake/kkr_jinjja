import { useState } from 'react';
import { ExampleLabel } from '../../components/common/ExampleLabel';
import { SectionBlock } from '../../components/common/SectionBlock';
import type { Tone } from '../../components/common/tone';
import { useCopy } from '../../lib/language';
import { ExportButtons } from './ExportButtons';
import {
  DEFAULT_MODES,
  EDIT_FIELDS,
  EXAMPLE_STATS,
  MANUAL_APPS,
  TRUST_PICKS,
  VERDICT_ORDER,
  type Mode,
  type Period,
  type StatsSnapshot,
  type VerdictKind,
} from './fixtures';
import { countLabel, pctLabel, peopleLabel, secondsLabel, shortDate } from './format';
import { BarList, DayBars, StatTile, TileGrid } from './StatParts';
import { StatsFilters } from './StatsFilters';

const VERDICT_TONE: Readonly<Record<VerdictKind, Tone>> = {
  STORE_CHEAPER: 'butter',
  SAME_PRICE: 'butter',
  ONLINE_CHEAPER: 'sky',
  BUNDLE_ONLY: 'white',
  NO_MATCH: 'pink',
  NEED_STORE_PRICE: 'white',
};

/**
 * S8 behind the gate. Returns a fragment so the sticky ExampleLabel's container is the whole page.
 * Renders EXAMPLE_STATS (fixtures) under the pink P1 label until /api/stats exists. */
export function StatsBody({ stats = EXAMPLE_STATS }: { stats?: StatsSnapshot }) {
  const { t, lang, won } = useCopy();
  const s = t.ops.stats;
  const [period, setPeriod] = useState<Period>('d7');
  const [modes, setModes] = useState<Mode[]>([...DEFAULT_MODES]);
  const storeSaid = stats.verdicts.STORE_CHEAPER + stats.verdicts.SAME_PRICE;

  return (
    <>
      <ExampleLabel />
      <p className="-mt-4 text-[15px]">{t.ops.exampleSub}</p>

      <StatsFilters period={period} modes={modes} onPeriod={setPeriod} onModes={setModes} />

      <SectionBlock tone="lilac" id="stats-usage" title={s.usage}>
        <TileGrid>
          <StatTile tone="lilac" label={s.scans} value={countLabel(t, stats.scans)} />
          <StatTile tone="white" label={s.users} value={peopleLabel(t, stats.users)} />
          <StatTile
            tone="lilac"
            wide
            label={s.reuse}
            value={pctLabel(t, stats.reusePct)}
            sub={s.reuseSub}
          />
        </TileGrid>
        <h3 className="text-[15px] font-extrabold">{s.daily}</h3>
        <DayBars
          label={s.dailyChart}
          days={stats.daily.map((d) => ({
            key: d.date,
            dateLabel: shortDate(d.date, lang),
            value: d.scans,
          }))}
        />
      </SectionBlock>

      <SectionBlock tone="butter" id="stats-verdicts" title={s.verdicts}>
        <TileGrid>
          <StatTile
            tone="butter"
            wide
            label={s.storeSaid}
            value={countLabel(t, storeSaid)}
            sub={s.storeSaidSub}
          />
        </TileGrid>
        <BarList
          label={s.verdicts}
          items={VERDICT_ORDER.map((v) => ({
            key: v,
            label: s.verdictTypes[v],
            value: stats.verdicts[v],
            display: countLabel(t, stats.verdicts[v]),
            tone: VERDICT_TONE[v],
          }))}
        />
      </SectionBlock>

      <SectionBlock tone="lime" id="stats-match" title={s.match}>
        <TileGrid>
          <StatTile tone="lime" label={s.anySame} value={pctLabel(t, stats.match.anySamePct)} />
          <StatTile
            tone="white"
            label={s.exactCount}
            value={pctLabel(t, stats.match.exactCountPct)}
          />
        </TileGrid>
      </SectionBlock>

      <SectionBlock tone="sky" id="stats-speed" title={s.speed}>
        <TileGrid>
          <StatTile
            tone="sky"
            label={s.median}
            value={secondsLabel(t, stats.shutterToVerdictMs.median)}
          />
          <StatTile
            tone="white"
            label={s.p90}
            value={secondsLabel(t, stats.shutterToVerdictMs.p90)}
          />
        </TileGrid>
      </SectionBlock>

      <SectionBlock tone="pink" id="stats-edits" title={s.edits} sub={s.editsSub}>
        <BarList
          label={s.edits}
          max={100}
          items={EDIT_FIELDS.map((f) => ({
            key: f,
            label: s.fields[f],
            value: stats.editRatePct[f],
            display: pctLabel(t, stats.editRatePct[f]),
            tone: 'pink',
          }))}
        />
      </SectionBlock>

      <SectionBlock tone="pink" id="stats-reports" title={s.reports}>
        <TileGrid>
          <StatTile tone="pink" label={s.reportRate} value={pctLabel(t, stats.reports.ratePct)} />
          <StatTile tone="white" label={s.notSame} value={pctLabel(t, stats.reports.notSamePct)} />
        </TileGrid>
      </SectionBlock>

      <SectionBlock tone="sky" id="stats-savings" title={s.savings}>
        <TileGrid>
          <StatTile
            tone="sky"
            wide
            label={s.savingsTotal}
            value={won(stats.potentialSavingsWon)}
            sub={s.savingsSub}
          />
        </TileGrid>
      </SectionBlock>

      <SectionBlock tone="lilac" id="stats-purchases" title={s.purchases}>
        <TileGrid>
          <StatTile
            tone="butter"
            label={s.storeConfirmed}
            value={countLabel(t, stats.purchases.storeConfirmed)}
          />
          <StatTile
            tone="sky"
            label={s.onlinePlanned}
            value={countLabel(t, stats.purchases.onlinePlanned)}
          />
          <StatTile
            tone="lilac"
            wide
            label={s.converted}
            value={countLabel(t, stats.purchases.plannedToConfirmed)}
          />
        </TileGrid>
      </SectionBlock>

      <SectionBlock tone="white" id="stats-cost" title={s.cost}>
        <TileGrid>
          <StatTile tone="white" label={s.costPerScan} value={won(stats.cost.perScanWon)} />
          <StatTile tone="white" label={s.costTotal} value={won(stats.cost.totalWon)} />
        </TileGrid>
      </SectionBlock>

      <SectionBlock tone="white" id="stats-field" title={s.field}>
        <h3 className="text-[15px] font-extrabold">{s.fieldTime}</h3>
        <TileGrid>
          <StatTile
            tone="white"
            label={t.ops.trust.manual}
            value={secondsLabel(t, stats.field.manualMedianMs)}
          />
          <StatTile
            tone="lime"
            label={t.ops.trust.app}
            value={secondsLabel(t, stats.field.appMedianMs)}
          />
        </TileGrid>
        <h3 className="text-[15px] font-extrabold">{s.fieldSuccess}</h3>
        <BarList
          label={s.fieldSuccess}
          max={100}
          items={[
            {
              key: 'manual',
              label: s.manualSuccess,
              value: stats.field.manualFoundPct,
              display: pctLabel(t, stats.field.manualFoundPct),
              tone: 'white',
            },
            {
              key: 'app',
              label: s.appFound,
              value: stats.field.appFoundPct,
              display: pctLabel(t, stats.field.appFoundPct),
              tone: 'lime',
            },
          ]}
        />
        <h3 className="text-[15px] font-extrabold">{s.appsUsed}</h3>
        <BarList
          label={s.appsUsed}
          items={MANUAL_APPS.map((a) => ({
            key: a,
            label: t.ops.apps[a],
            value: stats.field.apps[a],
            display: countLabel(t, stats.field.apps[a]),
            tone: 'sky',
          }))}
        />
        <p className="text-[13px] text-muted">{s.appsNote}</p>
        <h3 className="text-[15px] font-extrabold">{s.trustPicks}</h3>
        <BarList
          label={s.trustPicks}
          items={TRUST_PICKS.map((p) => ({
            key: p,
            label: t.ops.trust[p],
            value: stats.field.trust[p],
            display: countLabel(t, stats.field.trust[p]),
            tone: 'lilac',
          }))}
        />
      </SectionBlock>

      <SectionBlock tone="white" id="stats-export" title={s.exportTitle}>
        <ExportButtons />
      </SectionBlock>
    </>
  );
}
