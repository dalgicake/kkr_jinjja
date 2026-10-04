import { copy } from '../../lib/i18n';

/** P7: v0.1 has no affiliate links or ads. */
export function CommissionNotice() {
  return <p className="text-[13px] text-muted">{copy.commission}</p>;
}
