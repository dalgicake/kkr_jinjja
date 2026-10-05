import type { ReactNode } from 'react';
import { CheckBadge } from '../../components/common/Badges';
import { AlertIcon } from '../../components/common/Icons';
import { copy } from '../../lib/i18n';
import type { FieldError } from './confirmForm';

export interface FieldStatus {
  /** low confidence or unit-price mismatch → pink border + "확인해 주세요" */
  check: boolean;
  error?: FieldError;
}

export function fieldIds(id: string, s: FieldStatus) {
  const describedBy = [s.check && `${id}-check`, s.error && `${id}-error`]
    .filter(Boolean)
    .join(' ');
  return {
    id,
    'aria-invalid': s.error ? true : undefined,
    'aria-describedby': describedBy || undefined,
  } as const;
}

/** Inputs: 48px tall, black text on white; status shown by border AND words. */
export function inputClass(s: FieldStatus): string {
  const border = s.error
    ? 'border-2 border-ink'
    : s.check
      ? 'border-2 border-pink'
      : 'border border-muted';
  return `min-h-12 w-full rounded-md bg-receipt px-3 text-[17px] text-ink placeholder:text-muted ${border}`;
}

export function ConfirmField({
  id,
  label,
  optional = false,
  status,
  hint,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  status: FieldStatus;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <label htmlFor={id} className="text-[15px] font-semibold">
          {label}
        </label>
        {optional && <span className="text-[13px] text-muted">{copy.confirm.optional}</span>}
        {status.check && <CheckBadge id={`${id}-check`}>{copy.confirm.check}</CheckBadge>}
      </div>
      {children}
      {status.error && (
        <p id={`${id}-error`} className="flex items-center gap-1 text-[13px] font-semibold">
          <AlertIcon className="size-3.5 shrink-0" />
          {status.error === 'required' ? copy.confirm.required : copy.confirm.invalidNumber}
        </p>
      )}
      {hint && <p className="text-[13px] text-muted">{hint}</p>}
    </div>
  );
}
