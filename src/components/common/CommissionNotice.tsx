import { useCopy } from '../../lib/language';

/** P7: v0.1 has no affiliate links or ads. */
export function CommissionNotice() {
  const { t } = useCopy();
  return <p className="text-[13px] text-muted">{t.commission}</p>;
}
