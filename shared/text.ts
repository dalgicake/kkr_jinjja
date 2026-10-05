// Text comparison shared by the S2 card (barcode vs reading) and the 7.4 eval (brand scoring).

/** NFKC, lower case, no whitespace / punctuation / symbols. "P&G 다우니" → "pg다우니". null if empty. */
export function normalizeText(s: string | null): string | null {
  if (s === null) return null;
  const n = s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '');
  return n === '' ? null : n;
}
