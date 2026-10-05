import { useNavigate } from 'react-router';
import { VerifiedBadge } from '../../components/common/Badges';
import { Button } from '../../components/common/Button';
import { storeDisplayName } from '../../components/common/StoreChips';
import { formatWon } from '../../../shared/units.js';
import { copy, fill } from '../../lib/i18n';
import { scanStore, type ConfirmedScan } from '../capture/scanSession';
import { productLabel } from './labels';

/**
 * Phase 1 stops here: the comparison (Phase 2/3) is not built yet, so this says so plainly.
 * No online price, verdict or example result is shown (P1).
 */
export function ConfirmedPlaceholder({ confirmed }: { confirmed: ConfirmedScan }) {
  const navigate = useNavigate();
  const store = storeDisplayName(confirmed.storeName);
  return (
    <section className="flex flex-col gap-4" aria-live="polite">
      <h2 className="text-[22px] font-extrabold">{copy.next.title}</h2>
      <div className="flex flex-col gap-1 text-[17px]">
        {confirmed.verified && (
          <span>
            <VerifiedBadge>{copy.confirm.verified}</VerifiedBadge>
          </span>
        )}
        <p className="font-semibold">{productLabel(confirmed.target)}</p>
        <p className="tabular-nums">
          {fill(copy.next.priceLine, { price: formatWon(confirmed.storePrice) })}
        </p>
        <p>{fill(copy.next.storeLine, { store: store ?? copy.next.noStore })}</p>
      </div>
      <p className="text-[15px]">{copy.next.body}</p>
      <div className="flex flex-col gap-3">
        <Button variant="secondary" onClick={() => scanStore.unconfirm()}>
          {copy.next.edit}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            scanStore.reset();
            void navigate('/');
          }}
        >
          {copy.next.home}
        </Button>
      </div>
    </section>
  );
}
