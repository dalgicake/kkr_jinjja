import { Button } from '../../components/common/Button';
import { TextLink } from '../../components/common/TextLink';
import { copy } from '../../lib/i18n';
import { CaptureButton } from '../capture/CaptureButton';
import { startManualEntry } from '../capture/manualEntry';
import type { ReadFailure } from '../capture/readTagClient';
import { useScanState } from '../capture/useScan';
import { ConfirmCard } from './ConfirmCard';
import { ConfirmedPlaceholder } from './ConfirmedPlaceholder';
import { canRetake, failureMessage } from './labels';

function ManualButton({ primary = false }: { primary?: boolean }) {
  return (
    <Button variant={primary ? 'primary' : 'secondary'} onClick={startManualEntry}>
      {copy.home.manualEntry}
    </Button>
  );
}

function Failed({ reason }: { reason: ReadFailure }) {
  const retake = canRetake(reason);
  return (
    <div className="flex flex-col gap-4" role="alert">
      <p className="text-[17px] font-semibold">{failureMessage(reason)}</p>
      <div className="flex flex-col gap-3">
        {retake && <CaptureButton variant="retake" />}
        <ManualButton primary={!retake} />
      </div>
    </div>
  );
}

/** S2 route: progress of the current scan, its failure, or the confirm card. */
export function ConfirmPage() {
  const { session, confirmed } = useScanState();
  const isConfirmed = !!session && confirmed?.scanId === session.scanId;
  const title = session?.source === 'manual' ? copy.confirm.manualTitle : copy.confirm.title;

  return (
    <section className="flex flex-col gap-6 pt-6 pb-4">
      <TextLink to="/">{copy.confirm.back}</TextLink>
      {!isConfirmed && <h1 className="text-[22px] font-extrabold">{title}</h1>}

      {!session && (
        <div className="flex flex-col gap-4">
          <p className="text-[17px]">{copy.confirm.noSession}</p>
          <p className="text-[15px]">{copy.capture.hint}</p>
          <CaptureButton />
          <ManualButton />
        </div>
      )}

      {session?.status === 'reading' && (
        <p className="text-[17px]" role="status" aria-live="polite">
          {copy.capture.reading}
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
