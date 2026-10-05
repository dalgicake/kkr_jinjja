import type { ReactNode } from 'react';
import { useCopy } from '../../lib/language';
import { AlertIcon } from './Icons';

/**
 * P1 example-data label. Required on every screen that renders fixture numbers. Full-bleed
 * (-mx-4): place it directly in the page column, right under ScreenHeader.
 * Pink fill, black text, alert icon. Default text: t.ui.exampleLabel
 * ("Example screen — not a real lookup" / "예시 화면 — 실제 조회 결과가 아니에요").
 *   sticky    stick to the top of the viewport while scrolling (default true — keep it visible)
 *   children  optional replacement text (e.g. t.history.exampleBadge)
 */
export function ExampleLabel({
  sticky = true,
  children,
}: {
  sticky?: boolean;
  children?: ReactNode;
}) {
  const { t } = useCopy();
  return (
    <p
      role="note"
      data-testid="example-label"
      className={`${sticky ? 'sticky top-0 z-20 ' : ''}-mx-4 flex items-start gap-2 border-b-2 border-ink bg-pink px-4 py-2 text-[15px] font-bold text-ink`}
    >
      <AlertIcon className="mt-0.5 size-4 shrink-0" />
      <span>{children ?? t.ui.exampleLabel}</span>
    </p>
  );
}
