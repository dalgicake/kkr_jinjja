import type { ReactNode } from 'react';
import { CheckBadge } from '../../components/common/Badges';
import { AlertIcon } from '../../components/common/Icons';
import { useCopy } from '../../lib/language';
import type { FieldError } from './confirmForm';

export interface FieldStatus {
  /** low confidence or unit-price mismatch → pink-fill "Please check" badge next to the label */
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

/**
 * Inputs: 48px tall, black text on white, always a 2px black border. "Please check" is never an
 * outline colour — it is the pink-FILL badge next to the label (pink is a fill only, PLAN 13);
 * an error adds an icon + words under the field.
 */
export function inputClass(s: FieldStatus): string {
  const weight = s.check || s.error ? ' font-semibold' : '';
  return `min-h-12 w-full rounded-md border-2 border-ink bg-receipt px-3 text-[17px] text-ink placeholder:text-muted${weight}`;
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
  const { t } = useCopy();
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <label htmlFor={id} className="text-[15px] font-bold">
          {label}
        </label>
        {optional && <span className="text-[13px] text-muted">{t.confirm.optional}</span>}
        {status.check && <CheckBadge id={`${id}-check`}>{t.confirm.check}</CheckBadge>}
      </div>
      {children}
      {status.error && (
        <p id={`${id}-error`} className="flex items-center gap-1 text-[13px] font-semibold">
          <AlertIcon className="size-3.5 shrink-0" />
          {status.error === 'required' ? t.confirm.required : t.confirm.invalidNumber}
        </p>
      )}
      {hint && <p className="text-[13px] text-muted">{hint}</p>}
    </div>
  );
}
