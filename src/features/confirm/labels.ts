import type { TargetSpec } from '../../../shared/types.js';
import { formatWon } from '../../../shared/units.js';
import { copy, fill } from '../../lib/i18n';
import type { ReadFailure } from '../capture/readTagClient';

type SizeSpec = Pick<TargetSpec, 'perItemAmount' | 'perItemUnit' | 'itemCount'>;

export function sizeLabel(s: SizeSpec): string {
  if (s.perItemAmount === null) return fill(copy.confirm.sizeCountOnly, { count: s.itemCount });
  return fill(copy.confirm.size, {
    amount: s.perItemAmount,
    unit: copy.confirm.units[s.perItemUnit],
    count: s.itemCount,
  });
}

/** "다우니 섬유유연제 실내건조 2600ml 1개" — data joined with spaces, no copy needed. */
export function productLabel(
  p: Pick<TargetSpec, 'brand' | 'productName' | 'variant'> & SizeSpec,
): string {
  const words = [p.brand, p.productName];
  if (p.variant && !p.productName.includes(p.variant)) words.push(p.variant);
  return `${words.join(' ')} ${sizeLabel(p)}`;
}

export function priceLabel(won: number): string {
  return fill(copy.confirm.price, { price: formatWon(won) });
}

export function failureMessage(reason: ReadFailure): string {
  switch (reason) {
    case 'unreadable':
      return copy.error.unreadable;
    case 'network':
      return copy.error.network;
    case 'not_connected':
      return copy.error.notConnected;
    case 'auth':
      return copy.error.auth;
    case 'rate_limited':
      return copy.error.rateLimited;
    case 'too_large':
      return copy.error.tooLarge;
    case 'image':
      return copy.error.image;
    case 'server':
      return copy.error.server;
  }
}

/** Retaking can't help when there is no server connection or sign-in. */
export const canRetake = (reason: ReadFailure): boolean =>
  reason !== 'not_connected' && reason !== 'auth';
