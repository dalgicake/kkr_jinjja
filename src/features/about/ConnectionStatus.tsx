import { useAuth } from '../../lib/auth';
import { fill } from '../../lib/i18n';
import { useCopy } from '../../lib/language';

export function ConnectionStatus() {
  const auth = useAuth();
  const { t } = useCopy();
  return (
    <div className="flex flex-col gap-1 text-[13px] text-muted" data-testid="connection-status">
      <h2 className="text-[15px] font-bold">{t.about.connection}</h2>
      {auth.status === 'loading' && <p>{t.auth.loading}</p>}
      {auth.status === 'not_connected' && <p>{t.auth.notConnected}</p>}
      {auth.status === 'error' && (
        <>
          <p>{t.auth.error}</p>
          <p className="text-[13px] text-muted break-all">
            {auth.code === 'no_user'
              ? t.auth.noUser
              : fill(t.auth.errorDetail, { message: auth.detail })}
          </p>
        </>
      )}
      {auth.status === 'signed_in' && (
        <>
          <p>{t.auth.signedIn}</p>
          <p className="text-[13px] text-muted break-all tabular-nums" data-testid="anon-user-id">
            {fill(t.auth.userId, { id: auth.userId })}
          </p>
        </>
      )}
    </div>
  );
}
