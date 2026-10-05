import { APP_VERSION } from '../../constants/version';
import { fill } from '../../lib/i18n';
import { useCopy } from '../../lib/language';

export function VersionBadge() {
  const { t } = useCopy();
  return (
    <p className="text-[13px] text-muted tabular-nums" data-testid="app-version">
      {fill(t.version, { version: APP_VERSION })}
    </p>
  );
}
