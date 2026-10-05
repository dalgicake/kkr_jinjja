import { useCallback, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { Badge } from '../../components/common/Badges';
import { Button, TextButton } from '../../components/common/Button';
import { ExampleLabel } from '../../components/common/ExampleLabel';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useCopy } from '../../lib/language';
import { productLabel } from '../confirm/labels';
import { isDemoScenarioId } from '../demo/fixtures';
import { FIRST_FIXTURE_ID, findFixture } from './fixtures';
import { Receipt } from './Receipt';
import { ActionBar, ReportSheet } from './ResultActions';
import { LastPurchase, PreviewList, PromoBanner } from './ResultExtras';
import { BundleSection, UncertainSection } from './ResultSections';
import {
  activeVerdict,
  bundleCandidates,
  emphasiseOnline,
  headerTone,
  lastPurchaseLine,
  promoCount,
  uncertainCandidates,
  verdictSub,
  verdictTitle,
} from './resultView';
import { Toast, useToast } from './Toast';
import type { ResultFixture } from './types';

/**
 * S3 result "comparison receipt" — UI shell on example data (P1 label always on).
 * Routes: /result (first example) and /preview/result/:type, where :type is a fixture id
 * ("online-close-call") or a PLAN 9 VerdictType ("ONLINE_CHEAPER", used by /demo).
 */
export function ResultPage() {
  const { type } = useParams();
  const fixture = findFixture(type ?? FIRST_FIXTURE_ID) ?? findFixture(FIRST_FIXTURE_ID);
  if (!fixture) return null;
  // key: a new example is a new result — state resets and the receipt prints once more.
  return <ResultScreen key={fixture.id} fixture={fixture} />;
}

function ResultScreen({ fixture: f }: { fixture: ResultFixture }) {
  const { t, won } = useCopy();
  const [params] = useSearchParams();
  const demo = params.get('demo');
  // back to the demo's step 3 for the scenario that opened this result
  const demoBack = demo && isDemoScenarioId(demo) ? `/demo?s=${demo}&step=3` : '/demo';
  const [promoOn, setPromoOn] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const { message, show } = useToast();
  const notConnected = useCallback(() => show(t.result.toast), [show, t]);
  const closeReport = useCallback(() => setReportOpen(false), []);

  const v = activeVerdict(f, promoOn);
  const deal = promoCount(f);
  const last = lastPurchaseLine(t, won, f);

  return (
    <div className="flex flex-col" data-verdict={v.type}>
      <ScreenHeader
        tone={headerTone(v)}
        title={verdictTitle(t, won, v)}
        sub={verdictSub(t, won, v)}
        back={demo !== null ? { to: demoBack } : { to: '/', label: t.ui.home }}
      >
        <p className="text-[15px] font-semibold" lang="ko">
          {productLabel(t, f.target)}
        </p>
        {v.type === 'ONLINE_CHEAPER' && v.closeCall && (
          <span data-testid="close-call">
            <Badge tone="pink" icon="alert">
              {t.result.verdict.closeCall}
            </Badge>
          </span>
        )}
      </ScreenHeader>
      <ExampleLabel />

      <div className="flex flex-col gap-6 pt-5">
        {v.type === 'NEED_STORE_PRICE' && (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              notConnected();
            }}
          >
            <label htmlFor="result-store-price" className="text-[15px] font-bold">
              {t.result.needPrice.label}
            </label>
            <input
              id="result-store-price"
              inputMode="numeric"
              pattern="[0-9,]*"
              autoComplete="off"
              className="price min-h-12 rounded-lg border-2 border-ink bg-receipt px-3 text-[22px] font-bold"
            />
            <Button type="submit">{t.result.needPrice.cta}</Button>
          </form>
        )}

        {deal !== null && f.promo.text && (
          <PromoBanner
            promoText={f.promo.text}
            count={deal}
            on={promoOn}
            onToggle={() => setPromoOn((on) => !on)}
          />
        )}

        <Receipt fixture={f} verdict={v} onAction={notConnected} />

        {last && <LastPurchase text={last} />}

        <BundleSection items={bundleCandidates(f, v)} verdict={v} onAction={notConnected} />
        <UncertainSection items={uncertainCandidates(f)} onAction={notConnected} />

        <TextButton onClick={() => setReportOpen(true)}>{t.result.report.open}</TextButton>

        <PreviewList currentId={f.id} />

        <ActionBar emphasiseOnline={emphasiseOnline(v)} onAction={notConnected} />
      </div>

      <ReportSheet
        open={reportOpen}
        onClose={closeReport}
        onPick={() => {
          setReportOpen(false);
          notConnected();
        }}
      />
      <Toast message={message} />
    </div>
  );
}
