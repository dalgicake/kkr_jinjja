import { describe, expect, it } from 'vitest';
import { en } from '../../copy/en';
import { ko } from '../../copy/ko';
import { DELETE_ACCOUNT_BODY, confirmWordMatches, requestAccountDeletion } from './deleteAccount';
import { loadNickname, saveNickname, validateNickname, type ProfilesStore } from './nickname';

describe('validateNickname', () => {
  it('trims and accepts 1..20 characters', () => {
    expect(validateNickname('  기령  ')).toEqual({ ok: true, value: '기령' });
    expect(validateNickname('a'.repeat(20))).toEqual({ ok: true, value: 'a'.repeat(20) });
    expect(validateNickname('가'.repeat(20))).toEqual({ ok: true, value: '가'.repeat(20) });
  });
  it('rejects empty, too long and control characters', () => {
    expect(validateNickname('   ')).toEqual({ ok: false, reason: 'empty' });
    expect(validateNickname('a'.repeat(21))).toEqual({ ok: false, reason: 'tooLong' });
    expect(validateNickname(' ' + 'a'.repeat(20) + ' ')).toEqual({
      ok: true,
      value: 'a'.repeat(20),
    });
    expect(validateNickname('a\nb')).toEqual({ ok: false, reason: 'invalid' });
    expect(validateNickname('a‮b')).toEqual({ ok: false, reason: 'invalid' });
  });
  it('counts an emoji as one character, like Postgres char_length', () => {
    expect(validateNickname('😀'.repeat(20))).toMatchObject({ ok: true });
    expect(validateNickname('😀'.repeat(21))).toEqual({ ok: false, reason: 'tooLong' });
  });
});

class FakeProfiles implements ProfilesStore {
  rows = new Map<string, { nickname: string; updated_at: string }>();
  fail = false;
  upserts = 0;
  async selectNickname(userId: string) {
    if (this.fail) return { data: null, error: { message: 'relation does not exist' } };
    return { data: this.rows.get(userId) ?? null, error: null };
  }
  async upsert(row: { id: string; nickname: string; updated_at: string }) {
    this.upserts++;
    if (this.fail) return { error: { message: 'denied' } };
    this.rows.set(row.id, { nickname: row.nickname, updated_at: row.updated_at });
    return { error: null };
  }
}

describe('profiles', () => {
  it('saves the trimmed value and loads it back', async () => {
    const db = new FakeProfiles();
    const now = new Date('2026-10-05T01:02:03Z');
    expect(await saveNickname(db, 'u1', '  Kiryeong ', now)).toEqual({
      ok: true,
      nickname: 'Kiryeong',
    });
    expect(db.rows.get('u1')).toEqual({ nickname: 'Kiryeong', updated_at: now.toISOString() });
    expect(await loadNickname(db, 'u1')).toEqual({ ok: true, nickname: 'Kiryeong' });
    expect(await loadNickname(db, 'u2')).toEqual({ ok: true, nickname: null });
  });
  it('never sends an invalid nickname', async () => {
    const db = new FakeProfiles();
    expect(await saveNickname(db, 'u1', '')).toEqual({ ok: false, reason: 'empty' });
    expect(await saveNickname(db, 'u1', 'x'.repeat(21))).toEqual({ ok: false, reason: 'tooLong' });
    expect(db.upserts).toBe(0);
  });
  it('database errors become failed / load error', async () => {
    const db = new FakeProfiles();
    db.fail = true;
    expect(await saveNickname(db, 'u1', 'ok')).toEqual({ ok: false, reason: 'failed' });
    expect(await loadNickname(db, 'u1')).toEqual({ ok: false });
  });
});

describe('delete account (client)', () => {
  it('POSTs /api/account with the bearer token and the confirmation body', async () => {
    const seen: { url: string; init?: RequestInit }[] = [];
    const f = (async (url: string, init?: RequestInit) => {
      seen.push({ url, init });
      return Response.json({ ok: true });
    }) as typeof fetch;
    expect(await requestAccountDeletion('tok', f)).toEqual({ ok: true });
    expect(seen[0]?.url).toBe('/api/account');
    expect(seen[0]?.init?.method).toBe('POST');
    expect((seen[0]?.init?.headers as Record<string, string>).authorization).toBe('Bearer tok');
    expect(JSON.parse(String(seen[0]?.init?.body))).toEqual(DELETE_ACCOUNT_BODY);
  });
  it('401 → unauthorized, other failures → failed', async () => {
    const status = (s: number) => (async () => new Response('{}', { status: s })) as typeof fetch;
    expect(await requestAccountDeletion('t', status(401))).toEqual({
      ok: false,
      reason: 'unauthorized',
    });
    expect(await requestAccountDeletion('t', status(500))).toEqual({ ok: false, reason: 'failed' });
    const offline = (async () => {
      throw new TypeError('offline');
    }) as typeof fetch;
    expect(await requestAccountDeletion('t', offline)).toEqual({ ok: false, reason: 'failed' });
  });
  it('the typed word must match the copy word', () => {
    expect(confirmWordMatches(' Delete ', en.account.remove.word)).toBe(true);
    expect(confirmWordMatches('삭제', ko.account.remove.word)).toBe(true);
    expect(confirmWordMatches('delet', en.account.remove.word)).toBe(false);
    expect(confirmWordMatches('', ko.account.remove.word)).toBe(false);
  });
});
