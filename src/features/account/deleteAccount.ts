/** Client side of POST /api/account (delete my account and records). */

/** The body the server requires, so a stray POST can't delete anything. */
export const DELETE_ACCOUNT_BODY = { confirm: 'delete-account' } as const;

export type DeleteResult = { ok: true } | { ok: false; reason: 'unauthorized' | 'failed' };

export async function requestAccountDeletion(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DeleteResult> {
  try {
    const res = await fetchImpl('/api/account', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify(DELETE_ACCOUNT_BODY),
    });
    if (res.ok) return { ok: true };
    return { ok: false, reason: res.status === 401 ? 'unauthorized' : 'failed' };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

/** The typed confirmation must match the copy word (case and outer spaces ignored). */
export function confirmWordMatches(typed: string, word: string): boolean {
  return typed.trim().toLocaleLowerCase() === word.trim().toLocaleLowerCase();
}
