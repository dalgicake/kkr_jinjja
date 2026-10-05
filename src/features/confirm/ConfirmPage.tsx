import { CheckBadge } from '../../components/common/Badges';
import { Button } from '../../components/common/Button';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { useCopy } from '../../lib/language';
import { CaptureButton } from '../capture/CaptureButton';
import { startManualEntry } from '../capture/manualEntry';
import type { ReadFailure } from '../capture/readTagClient';
import { useScanState } from '../capture/useScan';
import { ConfirmCard } from './ConfirmCard';
import { ConfirmedPlaceholder } from './ConfirmedPlaceholder';
import { canRetake, failureMessage } from './labels';

function ManualButton({ primary = false }: { primary?: boolean }) {
  const { t } = useCopy();
  return (
    <Button tone={primary ? 'lime' : 'white'} onClick={startManualEntry}>
      {t.home.manualEntry}
    </Button>
  );
}

function Failed({ reason }: { reason: ReadFailure }) {
  const { t } = useCopy();
  const retake = canRetake(reason);
  return (
    <div className="flex flex-col gap-4" role="alert">
      <div className="flex flex-col items-start gap-2">
        <CheckBadge>{t.confirm.check}</CheckBadge>
        <p className="text-[17px] font-semibold">{failureMessage(t, reason)}</p>
      </div>
      <div className="flex flex-col gap-3">
        {retake && <CaptureButton variant="retake" />}
        <ManualButton primary={!retake} />
      </div>
    </div>
  );
}

/** S2 route: progress of the current scan, its failure, or the confirm card. Butter = store tag. */
export function ConfirmPage() {
  const { t } = useCopy();
  const { session, confirmed } = useScanState();
  const isConfirmed = !!session && confirmed?.scanId === session.scanId;
  const title = isConfirmed
    ? t.next.title
    : session?.source === 'manual'
      ? t.confirm.manualTitle
      : t.confirm.title;

  return (
    <section className="flex flex-col gap-6 pb-4">
      <ScreenHeader tone="butter" title={title} back={{ to: '/', label: t.confirm.back }} />

      {!session && (
        <div className="flex flex-col gap-4">
          <p className="text-[17px]">{t.confirm.noSession}</p>
          <p className="text-[15px]">{t.capture.hint}</p>
          <CaptureButton />
          <ManualButton />
        </div>
      )}

      {session?.status === 'reading' && (
        <p
          className="self-start rounded-lg border-2 border-ink bg-receipt px-4 py-3 text-[17px] font-semibold"
          role="status"
          aria-live="polite"
        >
          {t.capture.reading}
        </p>
      )}

      {session?.status === 'failed' && <Failed reason={session.failure ?? 'server'} />}

      {isConfirmed && confirmed && <ConfirmedPlaceholder confirmed={confirmed} />}
      {session?.status === 'ready' && (
        // kept mounted while confirmed so [다시 고치기] returns to the same values
        <div hidden={isConfirmed}>
          <ConfirmCard key={session.scanId} session={session} />
        </div>
      )}
    </section>
  );
}
