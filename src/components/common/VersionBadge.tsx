import { APP_VERSION } from '../../constants/version';
import { copy, fill } from '../../lib/i18n';

export function VersionBadge() {
  return (
    <p className="text-[13px] text-muted tabular-nums" data-testid="app-version">
      {fill(copy.version, { version: APP_VERSION })}
    </p>
  );
}
