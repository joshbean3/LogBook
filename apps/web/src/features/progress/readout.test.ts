import type { ISODate } from '@logbook/shared';
import { describe, expect, it } from 'vitest';
import { bucketLifts, bucketRuns, rangeSpan, type DayLift, type DayRun } from './ranges';
import { liftAt, liftRest, liftWords, readoutWords, runAt, runRest, runWords, weekTakeaway } from './readout';

// Wednesday Nov 11 2026: this week began Monday Nov 9
const T = '2026-11-11';
const runs =
  (plan: Record<string, number>, ran: Record<string, number>) =>
  (d: ISODate): DayRun => ({ planned: plan[d] ?? 0, plannedRuns: plan[d] ? 1 : 0, done: ran[d] ?? 0, runs: ran[d] ? 1 : 0 });
const lifts =
  (plan: Record<string, number>, did: Record<string, [number, number, number]>) =>
  (d: ISODate): DayLift => ({ planned: plan[d] ?? 0, done: did[d]?.[0] ?? 0, sets: did[d]?.[1] ?? 0, volume: did[d]?.[2] ?? 0 });
const run = (range: Parameters<typeof rangeSpan>[0], plan: Record<string, number>, ran: Record<string, number>, first: string | null = null) => {
  const span = rangeSpan(range, T, first);
  return { span, buckets: bucketRuns(span.buckets, runs(plan, ran), T) };
};
const lift = (range: Parameters<typeof rangeSpan>[0], plan: Record<string, number>, did: Record<string, [number, number, number]>) => {
  const span = rangeSpan(range, T, null);
  return { span, buckets: bucketLifts(span.buckets, lifts(plan, did), T) };
};
const PLAN = { '2026-11-09': 4, '2026-11-11': 5, '2026-11-13': 5, '2026-11-14': 9 };
const RAN = { '2026-10-27': 6, '2026-10-31': 12, '2026-11-03': 8, '2026-11-07': 15.8, '2026-11-09': 4.1, '2026-11-11': 5.2 };
const noDash = (s: string) => expect(s).not.toMatch(/[–—]/);

describe('the running headline at rest', () => {
  it('reads the range in a long view: its miles, where it began, and the usual week', () => {
    const { span, buckets } = run('3M', PLAN, RAN);
    const week = buckets.at(-1)!;
    const r = runRest(span, buckets, week, buckets.at(-2)!, T, false);
    expect(r).toEqual({ big: '51.1', context: 'mi in 3 months', take: '20.9 mi a week on average' });
    expect(readoutWords(r)).toBe('51.1 mi in 3 months. 20.9 mi a week on average.');
  });

  it('never grades history against a plan', () => {
    // a plan for every past week, half of it run: the words say what was run, nothing about the plan
    const span = rangeSpan('3M', T);
    const plan = Object.fromEntries(span.buckets.map((b) => [b.key, 20]));
    const ran = Object.fromEntries(span.buckets.slice(0, -1).map((b) => [b.key, 10]));
    const buckets = bucketRuns(span.buckets, runs(plan, ran), T);
    const r = runRest(span, buckets, buckets.at(-1)!, buckets.at(-2)!, T, false);
    expect(r.take).toBe('10 mi a week on average');
    expect(`${r.context} ${r.take}`).not.toMatch(/plan|behind|%/i);
  });

  it('says the usual month by month', () => {
    const { span, buckets } = run('12M', {}, { '2026-09-10': 60, '2026-10-12': 90, '2026-11-02': 20 });
    expect(runRest(span, buckets, buckets.at(-1)!, null, T, false)).toEqual({ big: '170', context: 'mi in 12 months', take: '75 mi a month on average' });
  });

  it('counts runs when no bucket is finished yet, and says so when there are none', () => {
    const young = run('1M', {}, { '2026-11-09': 3 });
    expect(runRest(young.span, young.buckets, young.buckets.at(-1)!, null, T, false).take).toBe('1 run');
    const none = run('1M', {}, {});
    expect(runRest(none.span, none.buckets, none.buckets.at(-1)!, null, T, false)).toEqual({ big: '0', context: 'mi since Oct 12', take: 'No runs in this range' });
  });

  it('reads this week against its plan in 1W', () => {
    const { span, buckets } = run('1W', PLAN, RAN);
    const week = run('3M', PLAN, RAN).buckets.at(-1)!;
    // "to go" is what the plan still asks for (Friday's 5 and Saturday's 9), the miles the dashed bars draw
    expect(runRest(span, buckets, week, null, T, true)).toEqual({ big: '9.3', context: 'of 23 mi · 2 of 4 runs', take: 'On plan, 14 mi to go' });
    const firstWeek = runRest(span, buckets, week, null, T, true, true);
    expect(firstWeek.take).toBe('Your weeks draw here as you go.');
    // a line that is already a sentence is not given a second period
    expect(readoutWords(firstWeek)).toBe('9.3 of 23 mi · 2 of 4 runs. Your weeks draw here as you go.');
  });

  it('reads this week beside last week when it has no plan', () => {
    const { buckets } = run('3M', {}, RAN);
    const week = buckets.at(-1)!;
    expect(runRest(rangeSpan('1W', T), [], week, buckets.at(-2)!, T, true)).toEqual({ big: '9.3', context: 'mi · 2 runs', take: '23.8 mi last week' });
    expect(weekTakeaway(week, null)).toBe('No runs planned this week');
    expect(weekTakeaway(week, { ...buckets.at(-2)!, done: 0 })).toBe('No runs planned this week');
  });

  it('says behind, on plan and done for a week with a plan', () => {
    const wk = (ran: Record<string, number>, plan: Record<string, number> = PLAN) => run('3M', plan, ran).buckets.at(-1)!;
    expect(weekTakeaway(wk({}), null)).toBe('4 mi behind plan this week');
    // Monday done, today's 5 not yet run: it is still to go, with Friday and Saturday
    expect(weekTakeaway(wk({ '2026-11-09': 4 }), null)).toBe('On plan, 19 mi to go');
    // a watch reads a little over the plan: still on plan
    expect(weekTakeaway(wk({ '2026-11-09': 4.4, '2026-11-11': 5.5 }), null)).toBe('On plan, 14 mi to go');
    // a long run early in the week does not shorten what the plan still asks for: the miles over are said
    expect(weekTakeaway(wk({ '2026-11-09': 12, '2026-11-11': 11 }), null)).toBe('14 mi ahead of plan, 14 mi to go');
    // runs before a plan that starts later in the week: all of the plan is still to go, and the headline's "9.3 of 12.5 mi"
    // is not left to be read as 3.2 to go
    expect(weekTakeaway(wk({ '2026-11-09': 4.1, '2026-11-11': 5.2 }, { '2026-11-13': 5, '2026-11-14': 7.5 }), null)).toBe('9.3 mi ahead of plan, 12.5 mi to go');
    // a run on a day with none planned, a mile or more: ahead of plan
    expect(weekTakeaway(wk({ '2026-11-09': 4, '2026-11-10': 3, '2026-11-11': 5 }), null)).toBe('3 mi ahead of plan, 14 mi to go');
    // every planned day behind us and run
    expect(weekTakeaway(wk({ '2026-11-09': 4, '2026-11-10': 6 }, { '2026-11-09': 4, '2026-11-10': 6 }), null)).toBe('This week’s plan is done');
  });
});

describe('a running bucket while it is read', () => {
  it('says a finished week: its miles, its days and its runs', () => {
    const { span, buckets } = run('3M', PLAN, RAN);
    expect(runAt(span.unit, buckets.at(-2)!, T)).toEqual({ big: '23.8', context: 'mi', take: 'Nov 2 to 8 · 2 runs' });
    expect(runAt(span.unit, buckets.at(-4)!, T)).toEqual({ big: '0', context: 'mi', take: 'Oct 19 to 25 · 0 runs' });
    expect(runWords(span.unit, buckets.at(-2)!, T)).toBe('Last week: 23.8 miles, 2 runs');
  });

  it('says this week so far, and what the plan still asks for', () => {
    const { span, buckets } = run('3M', PLAN, RAN);
    expect(runAt(span.unit, buckets.at(-1)!, T)).toEqual({ big: '9.3', context: 'mi so far', take: 'This week · 2 runs · 14 mi to go' });
    expect(runWords(span.unit, buckets.at(-1)!, T)).toBe('This week: 9.3 miles, 2 runs, 14 miles still planned');
    const bare = run('3M', {}, RAN);
    expect(runAt(bare.span.unit, bare.buckets.at(-1)!, T).take).toBe('This week · 2 runs');
  });

  it('says a day: today, a day behind and a day ahead', () => {
    const { span, buckets } = run('1W', PLAN, RAN);
    expect(runAt(span.unit, buckets[0]!, T)).toEqual({ big: '4.1', context: 'mi', take: 'Mon, Nov 9 · 1 run' });
    expect(runAt(span.unit, buckets[2]!, T)).toEqual({ big: '5.2', context: 'mi', take: 'Today · 1 run' });
    expect(runAt(span.unit, buckets[5]!, T)).toEqual({ big: '9', context: 'mi planned', take: 'Sat, Nov 14' });
    expect(runAt(span.unit, buckets[6]!, T)).toEqual({ big: '0', context: 'mi', take: 'Sun, Nov 15 · Nothing planned' });
    expect(runWords(span.unit, buckets[5]!, T)).toBe('Sat, Nov 14: 9 miles planned');
    expect(runWords(span.unit, buckets[6]!, T)).toBe('Sun, Nov 15: nothing planned');
  });

  it('says a month, with its year when it is not this one', () => {
    const { span, buckets } = run('12M', PLAN, { '2025-12-06': 41.5, ...RAN });
    expect(runAt(span.unit, buckets[0]!, T)).toEqual({ big: '41.5', context: 'mi', take: 'December 2025 · 1 run' });
    expect(runAt(span.unit, buckets.at(-1)!, T)).toEqual({ big: '33.1', context: 'mi so far', take: 'This month · 4 runs · 14 mi to go' });
  });

  it('says a bucket that has not loaded', () => {
    const span = rangeSpan('3M', T);
    const b = bucketRuns(span.buckets, runs({}, {}), T, (m) => m >= '2026-09');
    expect(runWords(span.unit, b[0]!, T)).toBe('Week of Aug 17: not loaded yet');
  });
});

describe('strength', () => {
  const PLAN_L = { '2026-11-03': 1, '2026-11-10': 1, '2026-11-12': 1 };
  const DID: Record<string, [number, number, number]> = { '2026-10-20': [1, 9, 8800], '2026-10-22': [1, 9, 9100], '2026-10-27': [1, 0, 0], '2026-11-10': [1, 9, 9270] };

  it('reads this week against its plan in 1W, with what it was made of', () => {
    const week = lift('3M', PLAN_L, DID).buckets.at(-1)!;
    expect(liftRest(rangeSpan('1W', T), [], week, T, true)).toEqual({ big: '1', context: 'of 2 sessions this week', take: '9 sets, 9,270 lb moved' });
    const bare = lift('3M', {}, { '2026-11-10': [1, 0, 0] }).buckets.at(-1)!;
    expect(liftRest(rangeSpan('1W', T), [], bare, T, true)).toEqual({ big: '1', context: 'session this week', take: 'No sets yet' });
    const body = lift('3M', {}, { '2026-11-10': [1, 4, 0] }).buckets.at(-1)!;
    expect(liftRest(rangeSpan('1W', T), [], body, T, true).take).toBe('4 sets');
  });

  it('reads the range in a long view: its sessions and the usual week', () => {
    const { span, buckets } = lift('3M', PLAN_L, DID);
    // 3 sessions over the 3 finished weeks since the first lift (Oct 19, Oct 26 and Nov 2)
    expect(liftRest(span, buckets, buckets.at(-1)!, T, false)).toEqual({ big: '4', context: 'sessions in 3 months', take: '1 a week on average' });
    const one = lift('1M', {}, { '2026-11-10': [1, 9, 9270] });
    expect(liftRest(one.span, one.buckets, one.buckets.at(-1)!, T, false)).toEqual({ big: '1', context: 'session since Oct 12', take: '9 sets · 9,270 lb' });
    const none = lift('1M', {}, {});
    expect(liftRest(none.span, none.buckets, none.buckets.at(-1)!, T, false).take).toBe('No lifts in this range');
  });

  it('says a bucket while it is read: sessions, days, sets and pounds', () => {
    const { span, buckets } = lift('3M', PLAN_L, DID);
    expect(liftAt(span.unit, buckets.at(-4)!, T)).toEqual({ big: '2', context: 'sessions', take: 'Oct 19 to 25 · 18 sets · 17.9K lb' });
    expect(liftAt(span.unit, buckets.at(-3)!, T)).toEqual({ big: '1', context: 'session', take: 'Oct 26 to Nov 1 · No sets logged' });
    expect(liftAt(span.unit, buckets.at(-2)!, T)).toEqual({ big: '0', context: 'sessions', take: 'Nov 2 to 8 · No lifts' });
    expect(liftAt(span.unit, buckets.at(-1)!, T)).toEqual({ big: '1', context: 'session so far', take: 'This week · 9 sets · 9,270 lb · 1 to go' });
    expect(liftWords(span.unit, buckets.at(-1)!, T)).toBe('This week: 1 lift session, 9 sets, 1 still planned');
    const days = lift('1W', PLAN_L, DID);
    expect(liftAt(days.span.unit, days.buckets[3]!, T)).toEqual({ big: '1', context: 'session planned', take: 'Thu, Nov 12' });
    expect(liftWords(days.span.unit, days.buckets[3]!, T)).toBe('Thu, Nov 12: 1 lift session planned');
    expect(liftAt(days.span.unit, days.buckets[5]!, T)).toEqual({ big: '0', context: 'sessions', take: 'Sat, Nov 14 · Nothing planned' });
  });
});

describe('the copy', () => {
  it('has no dashes and calls nothing by a banned name', () => {
    const { span, buckets } = run('3M', PLAN, RAN);
    const all = [
      ...buckets.map((b) => runAt(span.unit, b, T)),
      runRest(span, buckets, buckets.at(-1)!, buckets.at(-2)!, T, false),
      runRest(span, buckets, buckets.at(-1)!, buckets.at(-2)!, T, true),
    ];
    for (const r of all) {
      noDash(readoutWords(r));
      expect(readoutWords(r)).not.toMatch(/coach|\bAI\b|workout/i);
    }
  });
});
