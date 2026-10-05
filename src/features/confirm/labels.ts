import type { TargetSpec } from '../../../shared/types.js';
import type { Copy } from '../../copy/ko';
import { fill } from '../../lib/i18n';
import type { ReadFailure } from '../capture/readTagClient';

// Pure label helpers: callers pass `t` from useCopy() so they follow the current language.

type SizeSpec = Pick<TargetSpec, 'perItemAmount' | 'perItemUnit' | 'itemCount'>;

export function sizeLabel(t: Copy, s: SizeSpec): string {
  if (s.perItemAmount === null) return fill(t.confirm.sizeCountOnly, { count: s.itemCount });
  return fill(t.confirm.size, {
    amount: s.perItemAmount,
    unit: t.confirm.units[s.perItemUnit],
    count: s.itemCount,
  });
}

/** "다우니 섬유유연제 실내건조 2600ml 1개" — product words stay as data (Korean), size follows t. */
export function productLabel(
  t: Copy,
  p: Pick<TargetSpec, 'brand' | 'productName' | 'variant'> & SizeSpec,
): string {
  const words = [p.brand, p.productName];
  if (p.variant && !p.productName.includes(p.variant)) words.push(p.variant);
  return `${words.join(' ')} ${sizeLabel(t, p)}`;
}

export function failureMessage(t: Copy, reason: ReadFailure): string {
  switch (reason) {
    case 'unreadable':
      return t.error.unreadable;
    case 'network':
      return t.error.network;
    case 'not_connected':
      return t.error.notConnected;
    case 'auth':
      return t.error.auth;
    case 'rate_limited':
      return t.error.rateLimited;
    case 'too_large':
      return t.error.tooLarge;
    case 'image':
      return t.error.image;
    case 'server':
      return t.error.server;
  }
}

/** Retaking can't help when there is no server connection or sign-in. */
export const canRetake = (reason: ReadFailure): boolean =>
  reason !== 'not_connected' && reason !== 'auth';
