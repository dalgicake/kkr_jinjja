import type { User } from '@supabase/supabase-js';
import { Badge } from '../../components/common/Badges';
import { SectionBlock } from '../../components/common/SectionBlock';
import { isAnonymous, linkedMethods } from '../../lib/authFlows';
import { useCopy } from '../../lib/language';
import { WithEmail } from './parts';

type MethodKey = 'email' | 'google' | 'kakao';
const isMethodKey = (m: string): m is MethodKey => m === 'email' || m === 'google' || m === 'kakao';

/** Anonymous, or "Signed in as …" with the linked methods as lilac chips (with words). */
export function StatusSection({ user }: { user: User | null }) {
  const { t } = useCopy();
  const anonymous = isAnonymous(user);
  const methods = linkedMethods(user);
  return (
    <SectionBlock tone="lilac" id="account-status" title={t.account.status.title}>
      <div className="flex flex-col gap-2" data-testid="account-status">
        <div className="self-start">
          <Badge tone={anonymous ? 'white' : 'lime'} icon={anonymous ? 'none' : 'check'}>
            {anonymous ? t.account.status.anonymous : t.account.status.signedIn}
          </Badge>
        </div>
        {anonymous ? (
          <p className="text-[15px]">{t.account.status.anonymousBody}</p>
        ) : (
          <p className="text-[15px] font-semibold">
            {user?.email ? (
              <WithEmail template={t.account.status.signedInAs} email={user.email} />
            ) : (
              t.account.status.signedInNoEmail
            )}
          </p>
        )}
        {user?.new_email && (
          <p className="text-[15px]" data-testid="account-pending-email">
            <WithEmail template={t.account.status.pendingEmail} email={user.new_email} />
          </p>
        )}
        {methods.length > 0 && (
          <div className="flex flex-col gap-1">
            <h3 className="text-[15px] font-bold">{t.account.status.linkedTitle}</h3>
            <ul className="flex flex-wrap gap-2">
              {methods.map((m) => (
                <li key={m}>
                  <Badge tone="lilac" icon="check">
                    {isMethodKey(m) ? t.account.methods[m] : m}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </SectionBlock>
  );
}
