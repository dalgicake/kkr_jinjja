import { useAuth } from '../../lib/auth';
import { copy, fill } from '../../lib/i18n';

export function ConnectionStatus() {
  const auth = useAuth();
  return (
    <div className="flex flex-col gap-1 text-[15px]" data-testid="connection-status">
      <h2 className="text-[17px] font-semibold">{copy.about.connection}</h2>
      {auth.status === 'loading' && <p>{copy.auth.loading}</p>}
      {auth.status === 'not_connected' && <p>{copy.auth.notConnected}</p>}
      {auth.status === 'error' && (
        <>
          <p>{copy.auth.error}</p>
          <p className="text-[13px] text-muted break-all">
            {auth.code === 'no_user'
              ? copy.auth.noUser
              : fill(copy.auth.errorDetail, { message: auth.detail })}
          </p>
        </>
      )}
      {auth.status === 'signed_in' && (
        <>
          <p>{copy.auth.signedIn}</p>
          <p className="text-[13px] text-muted break-all tabular-nums" data-testid="anon-user-id">
            {fill(copy.auth.userId, { id: auth.userId })}
          </p>
        </>
      )}
    </div>
  );
}
