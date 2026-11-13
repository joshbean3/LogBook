import { emptyRewards, RULES, shiftDays, type Rewards } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { diagnosticRows, diagnostics } from './diagnostics';

/** The device counts at the foot of "How Orbs work": their arithmetic, from a store built by hand. */
const U = 'u_owner';
const MON = RULES.startsOn;
const day = (n: number) => shiftDays(MON, n);
const rec = (a: number, n = a) => ({ n, a, c: 1 as const });

describe('the counts', () => {
  // week 1: five counted days (two with exactly one thing); week 2: three counted; week 3: paused throughout;
  // week 4 (this week): two counted so far
  const s: Rewards = {
    ...emptyRewards(U, MON),
    clock: day(23),
    days: {
      [day(0)]: rec(1),
      [day(1)]: rec(4),
      [day(2)]: rec(1),
      [day(3)]: rec(6),
      [day(4)]: rec(2),
      [day(7)]: rec(3),
      [day(8)]: rec(1),
      [day(10)]: rec(2),
      ...Object.fromEntries(Array.from({ length: 7 }, (_, i) => [day(14 + i), { n: 0, a: 0, h: 1 as const, c: 1 as const }])),
      [day(21)]: rec(5),
      [day(22)]: rec(1),
    },
    challenges: {
      [`challenge:d:${day(2)}`]: { item: 'habits', target: 3, base: 0, state: 'done', at: '' },
      [`challenge:d:${day(9)}`]: { item: 'goal', target: 1, base: 0, state: 'added', at: '' },
      [`challenge:w:${day(7)}`]: { item: 'days', target: 4, base: 0, state: 'skipped', at: '' },
      [`challenge:d:${day(22)}`]: { item: 'full', target: 1, base: 0, state: 'offered', at: '' },
      [`challenge:w:${day(21)}`]: { item: 'days', target: 4, base: 0, state: 'void', at: '' },
    },
    off: [{ from: day(5), to: day(5) }],
  };
  const d = diagnostics(s, day(23));
  it('days counted a week: the finished weeks, leaving out a paused one and the week in progress', () => {
    expect(d.weeks).toBe(2);
    expect(d.countedInWeeks).toBe(8);
    expect(d.perWeek).toBe(4);
  });
  it('the share of counted days with exactly one thing done, over every counted day', () => {
    expect(d.counted).toBe(10);
    expect(d.one).toBe(4);
    expect(d.oneShare).toBe(40);
  });
  it('challenges: every one was offered; added ones include the finished; done and skipped by their state', () => {
    expect(d.challenges).toEqual({ offered: 5, added: 2, done: 1, skipped: 1 });
  });
  it('the switches as they stand, and how often Orbs were switched off', () => {
    expect(d.set).toEqual({ on: true, show: true, weekTarget: 5, cadence: 1, size: 'steady' });
    expect(d.timesOff).toBe(1);
  });
  it('rounds the mean to one decimal and the share to a whole percent', () => {
    const odd: Rewards = { ...emptyRewards(U, MON), clock: day(22), days: { [day(0)]: rec(1), [day(1)]: rec(2), [day(2)]: rec(2), [day(7)]: rec(2), [day(8)]: rec(2), [day(14)]: rec(2), [day(15)]: rec(2) } };
    const o = diagnostics(odd, day(22));
    expect(o.weeks).toBe(3);
    expect(o.perWeek).toBe(2.3);
    expect(o.oneShare).toBe(14);
  });
  it('are words for the page, and never a zero', () => {
    expect(diagnosticRows(d)).toEqual([
      { label: 'Days counted a week', value: '4 over 2 weeks' },
      { label: 'Counted days with one thing done', value: '40 percent (4 of 10)' },
      { label: `Challenges, last ${RULES.detailDays} days`, value: '5 offered, 2 added, 1 done' },
      { label: 'Switches', value: 'Orbs on. Shown on. A 5 day week. Challenges one a week, steady.' },
      { label: 'Orbs switched off', value: '1 time' },
    ]);
    const none = diagnosticRows(diagnostics({ ...emptyRewards(U, MON), set: { on: true, show: false, weekTarget: 3, cadence: 0, size: 'bold', at: '' } }, day(2)));
    expect(none.map((r) => r.value)).toEqual(['None yet', 'None yet', 'None yet', 'Orbs on. Shown off. A 3 day week. Challenges off.', 'Never']);
    expect(none.map((r) => r.value).join(' ')).not.toMatch(/\b0\b/);
  });
  it('never a zero, whatever the store holds: a count with nothing in it is left out', () => {
    const base = emptyRewards(U, MON);
    const ch = (state: 'offered' | 'added' | 'done' | 'skipped' | 'void') => ({ item: 'goal', target: 1, base: 0, state, at: '' });
    const rowsOf = (s: typeof base, today = day(20)) => diagnosticRows(diagnostics(s, today));
    // one challenge offered and skipped: it was offered, and nothing more is said
    expect(rowsOf({ ...base, challenges: { [`challenge:d:${day(1)}`]: ch('skipped') } })[2]!.value).toBe('1 offered');
    expect(rowsOf({ ...base, challenges: { [`challenge:d:${day(1)}`]: ch('added'), [`challenge:d:${day(8)}`]: ch('skipped') } })[2]!.value).toBe('2 offered, 1 added');
    expect(rowsOf({ ...base, challenges: { [`challenge:d:${day(1)}`]: ch('done') } })[2]!.value).toBe('1 offered, 1 added, 1 done');
    // two finished weeks with no day counted, and days that all held more than one thing
    const quiet = rowsOf({ ...base, days: { [day(15)]: { n: 4, a: 4 }, [day(16)]: { n: 2, a: 2 } } });
    for (const s of [quiet, rowsOf(base), rowsOf({ ...base, days: { [day(1)]: { n: 0, a: 0, h: 1 } } })]) expect(s.map((r) => r.value).join(' | ')).not.toMatch(/(^|[^\d.,])0([^\d.,]|$)/);
    expect(quiet[0]!.value).toBe('None yet');
    expect(quiet[1]!.value).toBe('None yet');
  });
});
