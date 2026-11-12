import { addMonths } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { monthCaption } from '@/ui/captions';
import { firstWeekOf, fromParams, monthOfWeek, weekForMonth } from './planRoute';

const T = '2026-11-12'; // a Thursday; its week starts Mon Nov 9

describe('fromParams: the week or the month a Fitness URL asks for', () => {
  it('reads a week, a month, and nothing at all', () => {
    expect(fromParams({}, T)).toEqual({ view: 'week', mon: '2026-11-09', first: '2026-11-01' });
    expect(fromParams({ mon: '2026-11-23' }, T)).toEqual({ view: 'week', mon: '2026-11-23', first: '2026-11-01' });
    expect(fromParams({ month: '2026-12-01' }, T)).toEqual({ view: 'month', first: '2026-12-01', mon: '2026-11-30' });
    // this month opens beside this week
    expect(fromParams({ month: '2026-11-01' }, T)).toEqual({ view: 'month', first: '2026-11-01', mon: '2026-11-09' });
  });
  it('a date the calendar cannot hold opens this week, and never a page that throws', () => {
    // year 9999: the month after it is year 10000, which no date string holds (the month caption threw on it)
    const bads: Array<Record<string, string>> = [{ month: '9999-12-01' }, { mon: '9999-12-27' }, { mon: '0001-01-01' }, { month: '0000-01-01' }, { mon: '1899-12-25' }];
    for (const bad of bads) {
      const st = fromParams(bad, T);
      expect(st, JSON.stringify(bad)).toEqual({ view: 'week', mon: '2026-11-09', first: '2026-11-01' });
    }
    // what PlanView draws for the page it lands on and its two neighbours
    const { first } = fromParams({ month: '9999-12-01' }, T);
    expect(() => [-1, 0, 1].map((n) => monthCaption(addMonths(first, n)))).not.toThrow();
  });
  it('keeps every date a person can reach', () => {
    expect(fromParams({ mon: '2031-03-03' }, T).mon).toBe('2031-03-03');
    expect(fromParams({ mon: '1999-01-04' }, T).mon).toBe('1999-01-04');
    expect(fromParams({ month: '2028-02-01' }, T).first).toBe('2028-02-01');
  });
});

describe('weekForMonth: the week the month goes back to', () => {
  it('is the week that was left, while the month in view holds any of its days', () => {
    // Week of Nov 23, then the month (November), then back: Nov 23 again, not this week
    expect(weekForMonth('2026-11-01', '2026-11-23', T)).toBe('2026-11-23');
    // a later month: its own week, not the month's first
    expect(weekForMonth('2026-12-01', '2026-12-14', T)).toBe('2026-12-14');
    // a week across two months belongs to both
    expect(weekForMonth('2026-12-01', '2026-11-30', T)).toBe('2026-11-30');
    expect(weekForMonth('2026-11-01', '2026-11-30', T)).toBe('2026-11-30');
    // across a year
    expect(weekForMonth('2027-01-01', '2026-12-28', T)).toBe('2026-12-28');
  });
  it('is this week in this month, and a month’s first week in any other, once the month was paged away from that week', () => {
    expect(weekForMonth('2026-11-01', '2026-12-14', T)).toBe('2026-11-09');
    expect(weekForMonth('2027-02-01', '2026-11-23', T)).toBe(firstWeekOf('2027-02-01'));
    expect(firstWeekOf('2027-02-01')).toBe('2027-02-01');
    expect(firstWeekOf('2026-12-01')).toBe('2026-11-30');
  });
  it('agrees with the month a week opens (its Thursday’s): going in and straight back is always the same week', () => {
    for (let mon = '2026-01-05', i = 0; i < 120; i++) {
      expect(weekForMonth(monthOfWeek(mon), mon, T), mon).toBe(mon);
      const d = new Date(+mon.slice(0, 4), +mon.slice(5, 7) - 1, +mon.slice(8) + 7);
      mon = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  });
});
