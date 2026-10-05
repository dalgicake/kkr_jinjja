import type { ReactNode } from 'react';
import { AlertIcon, CheckIcon } from '../../components/common/Icons';
import { splitAt } from '../../lib/i18n';

/** Same field look as the confirm card: 48px, white, 2px black border. */
export const INPUT_CLASS =
  'min-h-12 w-full rounded-md border-2 border-ink bg-receipt px-3 text-[17px] text-ink placeholder:text-muted';

/**
 * A status line inside /account. Words + icon always; fill by meaning (pink = needs your attention,
 * lime = done, white = neutral progress). Polite live region so screen readers hear the change.
 */
export function Note({
  kind,
  children,
  testId,
}: {
  kind: 'error' | 'ok' | 'info';
  children: ReactNode;
  testId?: string;
}) {
  const fill = kind === 'error' ? 'bg-pink' : kind === 'ok' ? 'bg-lime' : 'bg-receipt';
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      data-testid={testId}
      className={`flex items-start gap-2 rounded-md border-2 border-ink px-3 py-2 text-[15px] font-semibold text-ink ${fill}`}
    >
      {kind === 'error' && <AlertIcon className="mt-0.5 size-4 shrink-0" />}
      {kind === 'ok' && <CheckIcon className="mt-0.5 size-4 shrink-0" />}
      <div className="flex min-w-0 flex-col gap-2">{children}</div>
    </div>
  );
}

/**
 * Copy with an `{email}` slot. Only the email may break anywhere (long addresses at 390px);
 * the sentence keeps the global `word-break: keep-all`, so Korean and English words stay whole.
 */
export function WithEmail({ template, email }: { template: string; email: string }) {
  const [before, after] = splitAt(template, 'email');
  return (
    <>
      {before}
      <span className="wrap-anywhere">{email}</span>
      {after}
    </>
  );
}
