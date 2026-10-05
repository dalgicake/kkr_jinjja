import { describe, expect, it } from 'vitest';
import { en } from '../../copy/en';
import { ko } from '../../copy/ko';
import { exampleHistory } from './exampleStore';
import { EXAMPLE_PURCHASES } from './fixtures';
import { dayLabel, dueLine, placeLine } from './format';
import {
  confirmedRecords,
  markBought,
  monthDay,
  parseWonInput,
  plannedRecords,
  recentRecords,
} from './historyLogic';

const byId = (id: string) => EXAMPLE_PURCHASES.find((r) => r.id === id)!;

describe('history logic', () => {
  it('planned rows are online plans only, newest first', () => {
    const ids = plannedRecords(EXAMPLE_PURCHASES).map((r) => r.id);
    expect(ids).toEqual(['example-1', 'example-2']);
    expect(plannedRecords(EXAMPLE_PURCHASES).every((r) => r.channel === 'online')).toBe(true);
  });
  it('confirmed rows: nearest next due date first, no due date last', () => {
    expect(confirmedRecords(EXAMPLE_PURCHASES).map((r) => r.id)).toEqual([
      'example-4', // 10-12
      'example-3', // 10-15
      'example-5', // 11-20
      'example-6', // none
    ]);
  });
  it('recent: latest 3 by last activity', () => {
    expect(recentRecords(EXAMPLE_PURCHASES).map((r) => r.id)).toEqual([
      'example-1',
      'example-2',
      'example-3',
    ]);
  });
  it('P5: Bought it confirms a plan with the given price (or none); confirmed rows stay as they are', () => {
    const plan = byId('example-1');
    expect(markBought(plan, 12900, '2026-10-05')).toMatchObject({
      status: 'confirmed',
      pricePaid: 12900,
      purchasedOn: '2026-10-05',
    });
    expect(markBought(plan, null, '2026-10-05').pricePaid).toBeNull();
    const done = byId('example-3');
    expect(markBought(done, 1, '2026-10-05')).toBe(done);
  });
  it('actual price input: blank is "not entered", commas allowed, anything else rejected', () => {
    expect(parseWonInput('  ')).toEqual({ ok: true, value: null });
    expect(parseWonInput('12,900')).toEqual({ ok: true, value: 12900 });
    expect(parseWonInput('0')).toEqual({ ok: false });
    expect(parseWonInput('12.5')).toEqual({ ok: false });
    expect(parseWonInput('-3')).toEqual({ ok: false });
    expect(parseWonInput('abc')).toEqual({ ok: false });
  });
  it('monthDay reads the calendar day without timezone shifts', () => {
    expect(monthDay('2026-01-09')).toEqual({ month: 1, day: 9 });
  });
  it('shared example store moves a planned row to confirmed and resets', () => {
    exampleHistory.markBought('example-2', null, '2026-10-05');
    expect(exampleHistory.get().find((r) => r.id === 'example-2')?.status).toBe('confirmed');
    exampleHistory.reset();
    expect(exampleHistory.get()).toBe(EXAMPLE_PURCHASES);
  });
});

describe('history wording', () => {
  it('dates and places in both languages', () => {
    expect(dayLabel(ko, '2026-10-04')).toBe('10월 4일');
    expect(dayLabel(en, '2026-10-04')).toBe('10/4');
    expect(placeLine(en, byId('example-4'))).toBe('Bought at E-Mart, 9/28');
    expect(placeLine(en, byId('example-5'))).toBe('Bought online, 9/20');
    expect(placeLine(ko, byId('example-6'))).toBe('9월 15일 동네마트에서 샀어요');
    expect(placeLine(en, byId('example-1'))).toBe('You tapped Buying online on 10/4');
    expect(dueLine(en, byId('example-3'))).toBe('Next around 10/15');
    expect(dueLine(ko, byId('example-6'))).toBe(ko.history.noNextDue);
  });
});
