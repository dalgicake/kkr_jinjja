import { ko, type Copy } from '../copy/ko';

/** v0.1 Phase 0: ko only. Language switching arrives in Phase 5. */
export const copy: Copy = ko;

/** Replace `{name}` placeholders. Unknown placeholders are left as-is. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}
