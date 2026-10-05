/**
 * Colour fills (PLAN 13, 2026-10-05). Every tone is a FILL with black text on it — never a text colour.
 * Fixed meanings across screens; always pair a colour with words or an icon (colour is never the only signal).
 *   lime      cheaper side, primary action
 *   pink      needs checking, example-data label
 *   sky       online, source, info
 *   butter    store / mart
 *   tangerine promo (1+1 etc.)
 *   lilac     records, planned purchases
 *   white     neutral (receipt paper, secondary buttons)
 *   paper     page background
 */
export type Tone = 'lime' | 'pink' | 'sky' | 'butter' | 'tangerine' | 'lilac' | 'white' | 'paper';

export const TONE_BG: Readonly<Record<Tone, string>> = {
  lime: 'bg-lime text-ink',
  pink: 'bg-pink text-ink',
  sky: 'bg-sky text-ink',
  butter: 'bg-butter text-ink',
  tangerine: 'bg-tangerine text-ink',
  lilac: 'bg-lilac text-ink',
  white: 'bg-receipt text-ink',
  paper: 'bg-paper text-ink',
};
