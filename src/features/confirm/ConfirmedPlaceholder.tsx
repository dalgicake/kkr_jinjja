import { useNavigate } from 'react-router';
import { VerifiedBadge } from '../../components/common/Badges';
import { Button } from '../../components/common/Button';
import { storeDisplayName } from '../../components/common/StoreChips';
import { formatWon } from '../../../shared/units.js';
import { fill } from '../../lib/i18n';
import { useCopy } from '../../lib/language';
import { scanStore, type ConfirmedScan } from '../capture/scanSession';
import { productLabel } from './labels';

/**
 * Phase 1 stops here: the comparison (Phase 2/3) is not built yet, so this says so plainly.
 * No online price, verdict or example result is shown (P1).
 */
export function ConfirmedPlaceholder({ confirmed }: { confirmed: ConfirmedScan }) {
  const navigate = useNavigate();
  const { t } = useCopy();
  const store = storeDisplayName(t, confirmed.storeName);
  return (
    <section className="flex flex-col gap-4" aria-live="polite">
      <div className="flex flex-col items-start gap-1 rounded-lg border-2 border-ink bg-butter px-4 py-3 text-[17px]">
        {confirmed.verified && (
          <span>
            <VerifiedBadge>{t.confirm.verified}</VerifiedBadge>
          </span>
        )}
        <p className="font-semibold">{productLabel(t, confirmed.target)}</p>
        <p className="tabular-nums">
          {fill(t.next.priceLine, { price: formatWon(confirmed.storePrice) })}
        </p>
        <p>{fill(t.next.storeLine, { store: store ?? t.next.noStore })}</p>
      </div>
      <p className="text-[15px]">{t.next.body}</p>
      <div className="flex flex-col gap-3">
        <Button tone="white" onClick={() => scanStore.unconfirm()}>
          {t.next.edit}
        </Button>
        <Button
          tone="white"
          onClick={() => {
            scanStore.reset();
            void navigate('/');
          }}
        >
          {t.next.home}
        </Button>
      </div>
    </section>
  );
}
