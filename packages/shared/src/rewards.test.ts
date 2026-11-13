import { describe, expect, it } from 'vitest';
import { mondayOf, parseISO, shiftDays, type ISODate } from './dates.js';
import { act, sess, snapOf } from './fixtures.js';
import type { Aim } from './goals.js';
import {
  addKeepsakes,
  applySet,
  chapterOf,
  compact,
  countLine,
  countOf,
  dayFactsOf,
  dayLines,
  earnDay,
  earnOnce,
  emptyRewards,
  goalEarns,
  isFullDay,
  isOpen,
  keepsakesDue,
  levelOf,
  markSeen,
  mergeRewards,
  mondayLine,
  newKeys,
  parseRewards,
  pendingMoments,
  rebuild,
  reconcile,
  ruleLine,
  RULES,
  tidy,
  totalOf,
  weekBonus,
  zRewards,
  type DayFacts,
  type DayRec,
  type Rewards,
  type World,
} from './rewards.js';
import type { Habit, HabitCheck, Session, Todo } from './types.js';

const U = 'u_owner';
/** The Monday the rules start on. */
const D0 = RULES.startsOn;
const day = (n: number): ISODate => shiftDays(D0, n);
const at = (date: ISODate, hour = 12, minute = 0): Date => {
  const d = parseISO(date);
  d.setHours(hour, minute, 0, 0);
  return d;
};
const facts = (date: ISODate, p: Partial<DayFacts> = {}): DayFacts => ({ date, todosDone: 0, todosEarlier: 0, habitsLive: 0, habitsDone: 0, lines: 0, train: {}, trainRequired: false, goalDay: 'none', held: false, ...p });
const fresh = (startedOn: ISODate = D0): Rewards => emptyRewards(U, startedOn);
/** One reconcile of one day at noon. */
const run = (s: Rewards, f: DayFacts, hour = 12) => reconcile(s, [f], at(f.date, hour));
/** A store that lived `n` days from D0, each day by `fn` (null: nothing done that day), reconciled at noon. */
const live = (n: number, fn: (i: number, date: ISODate) => Partial<DayFacts> | null, start: Rewards = fresh()): Rewards => {
  let s = start;
  for (let i = 0; i < n; i++) {
    const p = fn(i, day(i));
    s = reconcile(s, p ? [facts(day(i), p)] : [], at(day(i))).store;
  }
  return s;
};
const goal = (level: Aim['level'], period: string, p: Partial<Aim> = {}): Aim => ({ id: `g-${level}-${period}`, level, period, text: `the ${level} goal`, original: null, why: null, status: 'done', reflection: null, steps: [], createdAt: '2026-01-02T10:00:00.000Z', updatedAt: '2026-01-02T10:00:00.000Z', closedAt: null, ...p });

describe('the rules are one published constant', () => {
  it('carries a version, the start date and the daily ceiling', () => {
    expect(RULES.version).toBe(1);
    expect(RULES.startsOn).toBe('2026-11-16');
    expect(mondayOf(RULES.startsOn)).toBe(RULES.startsOn);
    expect(RULES.todo.cap * RULES.todo.each + RULES.habit.cap * RULES.habit.each + RULES.train.kinds * RULES.train.done + RULES.goalDay + RULES.full.bonus).toBe(27);
    expect(RULES.dailyCeiling).toBe(27);
  });
});

describe('earnDay: what a day is worth', () => {
  const tap = { fitness: true, src: 'tap' as const };
  it('pays a to-do 1, a habit 1, a session 3 or 2 at its floor, the goal 3', () => {
    const r = earnDay(facts(D0, { todosDone: 2, habitsDone: 3, habitsLive: 5, train: { run: 'done', lift: 'floor' }, goalDay: 'done' }), undefined, tap);
    expect(r.k).toEqual({ todo: 2, habit: 3, 'train:run': 3, 'train:lift': 2, 'goal:day': 3 });
    expect(r.n).toBe(13);
    expect(r.a).toBe(2 + 3 + 2 + 1);
  });
  it('test 7, caps: 50 to-dos pay 5; 30 habits pay 8', () => {
    expect(earnDay(facts(D0, { todosDone: 50 }), undefined, tap).n).toBe(5);
    expect(earnDay(facts(D0, { habitsDone: 30, habitsLive: 30 }), undefined, tap).k).toEqual({ habit: 8 });
  });
  it('test 7, caps: four sessions and a lift set pay two kinds, the two that pay most', () => {
    // two runs, a lift and a cross session all done (the lift by a logged set): three kinds, two paid
    const r = earnDay(facts(D0, { train: { run: 'done', lift: 'done', cross: 'done' } }), undefined, tap);
    expect(r.n).toBe(6);
    expect(Object.keys(r.k ?? {}).filter((k) => k.startsWith('train:'))).toHaveLength(2);
    // a floor never takes the place of a full session
    expect(earnDay(facts(D0, { train: { run: 'floor', lift: 'done', cross: 'done' } }), undefined, tap).k).toEqual({ 'train:lift': 3, 'train:cross': 3 });
  });
  it('the journal line earns no Orb and still makes the day count', () => {
    const r = earnDay(facts(D0, { lines: 1 }), undefined, tap);
    expect(r).toEqual({ n: 0, a: 1 });
  });
  it('an empty day is an empty record, and a paused one is marked', () => {
    expect(earnDay(facts(D0), undefined, tap)).toEqual({ n: 0, a: 0 });
    expect(earnDay(facts(D0, { held: true }), undefined, tap)).toEqual({ n: 0, a: 0, h: 1 });
  });
  it('a closed day is returned as it is, whatever the facts say', () => {
    const closed: DayRec = { n: 2, a: 2, k: { todo: 2 }, c: 1 };
    expect(earnDay(facts(D0, { todosDone: 5, goalDay: 'done' }), closed, tap)).toBe(closed);
  });
});

describe('test 8: the full day table', () => {
  const full = (p: Partial<DayFacts>) => isFullDay(facts(D0, p));
  const base: Partial<DayFacts> = { goalDay: 'done', habitsLive: 3, habitsDone: 3, habitsLiveDone: 3, trainRequired: true, trainLeft: 0, train: { run: 'done' } };
  it('the goal, the session and every habit: +5, once', () => {
    expect(full(base)).toBe(true);
    const r = earnDay(facts(D0, base), undefined, { fitness: true, src: 'tap' });
    expect(r.k?.full).toBe(5);
    expect(r.n).toBe(3 + 3 + 3 + 5);
  });
  it('no goal set, or the goal still open: never', () => {
    expect(full({ ...base, goalDay: 'none' })).toBe(false);
    expect(full({ ...base, goalDay: 'open' })).toBe(false);
  });
  it('no habits and no session: the goal alone is not three things', () => {
    expect(full({ goalDay: 'done' })).toBe(false);
    // two earlier to-dos done with it make three
    expect(full({ goalDay: 'done', todosDone: 2, todosEarlier: 2 })).toBe(true);
  });
  it('three to-dos made today do not make it three things', () => {
    expect(full({ goalDay: 'done', todosDone: 3, todosEarlier: 0 })).toBe(false);
  });
  it('one habit of slack with three or more habits; none with two or fewer', () => {
    expect(full({ ...base, habitsDone: 2, habitsLiveDone: 2 })).toBe(true);
    expect(full({ ...base, habitsDone: 1, habitsLiveDone: 1 })).toBe(false);
    expect(full({ goalDay: 'done', habitsLive: 2, habitsDone: 1, habitsLiveDone: 1 })).toBe(false);
    expect(full({ goalDay: 'done', habitsLive: 2, habitsDone: 2, habitsLiveDone: 2 })).toBe(true);
  });
  it('a habit archived at 23:00 is still asked for (the adapter keeps it live that day)', () => {
    const habits: Habit[] = [
      { id: 'h1', name: 'Read', position: 0, createdOn: '2026-01-01', archivedOn: null },
      { id: 'h2', name: 'Walk', position: 1, createdOn: '2026-01-01', archivedOn: D0 },
    ];
    const world: World = { snap: snapOf([], [], D0), todos: [], habits, checksOn: () => [{ habitId: 'h1', date: D0, done: true, note: null }], goals: [goal('day', D0, { createdAt: at(D0, 8).toISOString() })], linesOn: () => 0, status: null, fitness: true };
    const f = dayFactsOf(world, D0, D0);
    expect(f).toMatchObject({ habitsLive: 2, habitsDone: 1, habitsLiveDone: 1, goalDay: 'done' });
    expect(isFullDay(f)).toBe(false);
    // archived the day before, it is no longer asked for: the goal and one habit are two things, so two earlier to-dos decide
    const before = dayFactsOf({ ...world, habits: [habits[0]!, { ...habits[1]!, archivedOn: shiftDays(D0, -1) }] }, D0, D0);
    expect(before.habitsLive).toBe(1);
    expect(isFullDay(before)).toBe(false);
  });
  it('a habit made today earns its Orb and is not part of the required set', () => {
    const habits: Habit[] = [{ id: 'h1', name: 'New', position: 0, createdOn: D0, archivedOn: null }];
    const world: World = { snap: snapOf([], [], D0), todos: [], habits, checksOn: () => [{ habitId: 'h1', date: D0, done: true, note: null }], goals: [], linesOn: () => 0, status: null, fitness: true };
    expect(dayFactsOf(world, D0, D0)).toMatchObject({ habitsLive: 0, habitsDone: 1, habitsLiveDone: 0 });
  });
  it('a planned session not done blocks it; a skipped one asks for nothing', () => {
    expect(full({ ...base, trainLeft: 1, train: {} })).toBe(false);
    expect(full({ ...base, trainRequired: false, trainLeft: 0, train: {} })).toBe(true);
    const skipped: Session[] = [sess({ date: D0, kind: 'run', miles: 5, mark: 'skip' })];
    const world: World = { snap: snapOf(skipped, [], D0), todos: [], habits: [], checksOn: () => [], goals: [], linesOn: () => 0, status: null, fitness: true };
    expect(dayFactsOf(world, D0, D0)).toMatchObject({ trainRequired: false, train: {} });
  });
  it('the floor of the planned session is enough', () => {
    expect(full({ ...base, train: { run: 'floor' } })).toBe(true);
  });
  it('a paused day asks for no training', () => {
    const planned: Session[] = [sess({ date: D0, kind: 'run', miles: 5 })];
    const world: World = { snap: snapOf(planned, [], D0), todos: [], habits: [], checksOn: () => [], goals: [], linesOn: () => 0, status: { kind: 'sick', from: D0, until: null }, fitness: true };
    expect(dayFactsOf(world, D0, D0)).toMatchObject({ held: true, trainRequired: false });
    expect(full({ ...base, held: true, trainRequired: false, trainLeft: 0, train: {} })).toBe(true);
  });
  it('Fitness switched off mid-day keeps the training Orbs already in the record and adds none', () => {
    const on = run(fresh(), facts(D0, { train: { run: 'done' }, trainRequired: true, trainLeft: 0 }));
    expect(on.store.days[D0]?.k).toEqual({ 'train:run': 3 });
    // Fitness off: the adapter sees no training at all
    const off = reconcile(on.store, [facts(D0, { habitsDone: 1 })], at(D0, 13), { fitness: false });
    expect(off.store.days[D0]?.k).toEqual({ 'train:run': 3, habit: 1 });
    // a day that had no training earns none while Fitness is off, whatever the facts carry
    const none = reconcile(fresh(), [facts(D0, { train: { lift: 'done' } })], at(D0), { fitness: false });
    expect(none.store.days[D0]).toBeUndefined();
    // and with Fitness off the day can be full without a session
    expect(full({ goalDay: 'done', habitsLive: 3, habitsDone: 3, habitsLiveDone: 3, trainRequired: false })).toBe(true);
  });
});

describe('isOpen: when a day takes taps, and when it takes late evidence', () => {
  it('a day takes taps until 03:00 the next morning', () => {
    expect(isOpen(D0, at(D0, 23, 59), 'tap')).toBe(true);
    expect(isOpen(D0, at(day(1), 2, 59), 'tap')).toBe(true);
    expect(isOpen(D0, at(day(1), 3, 0), 'tap')).toBe(false);
    expect(isOpen(day(1), at(D0, 12), 'tap')).toBe(false);
  });
  it('and evidence that syncs late until the end of the next day', () => {
    expect(isOpen(D0, at(day(1), 23, 59), 'evidence')).toBe(true);
    expect(isOpen(D0, at(day(2), 0, 0), 'evidence')).toBe(false);
  });
});

describe('reconcile', () => {
  it('test 1: twice on the same facts gives the same store and nothing gained', () => {
    const f = facts(D0, { todosDone: 2, habitsDone: 1, goalDay: 'done' });
    const one = run(fresh(), f);
    expect(one.gained).toEqual([
      { key: 'todo', n: 2, date: D0 },
      { key: 'habit', n: 1, date: D0 },
      { key: 'goal:day', n: 3, date: D0 },
    ]);
    const two = run(one.store, f);
    expect(two.store).toBe(one.store);
    expect(two.gained).toEqual([]);
  });
  it('test 3: done, undone, done in an open day is the same number; undone after close changes nothing', () => {
    const done = run(fresh(), facts(D0, { habitsDone: 2 }));
    const undone = run(done.store, facts(D0, { habitsDone: 1 }));
    expect(undone.store.days[D0]?.n).toBe(1);
    expect(undone.gained).toEqual([]);
    const again = run(undone.store, facts(D0, { habitsDone: 2 }));
    expect(again.store).toEqual(done.store);
    // everything undone: the record goes, as if the day was never touched
    expect(run(done.store, facts(D0)).store).toEqual(reconcile(fresh(), [], at(D0)).store);
    // two days on, the day is closed: unticking is not seen
    const later = reconcile(again.store, [facts(D0)], at(day(2)));
    expect(later.store.days[D0]).toEqual({ n: 2, a: 2, k: { habit: 2 }, c: 1 });
  });
  it('test 4: back-fill two days back (a habit, a to-do, a line, a marked session, a lift set) changes nothing', () => {
    const s = live(3, (i) => (i === 0 ? { todosDone: 1 } : i === 2 ? { habitsDone: 1 } : null));
    const before = countOf(s, day(2));
    // D0 had one to-do; day 1 had nothing. On day 2 the person fills both in.
    const filled = reconcile(s, [facts(D0, { todosDone: 3, habitsDone: 4, lines: 1, train: { run: 'done', lift: 'done' }, goalDay: 'done' }), facts(day(1), { habitsDone: 2, lines: 1, train: { lift: 'done' } }), facts(day(2), { habitsDone: 1 })], at(day(2), 18));
    expect(filled.store).toBe(s);
    expect(filled.gained).toEqual([]);
    expect(countOf(filled.store, day(2))).toEqual(before);
  });
  it('test 4: yesterday after 03:00 takes no taps, even with nothing recorded for it', () => {
    const r = reconcile(fresh(), [facts(D0, { habitsDone: 3, todosDone: 2, lines: 1, train: { run: 'done' } })], at(day(1), 9));
    expect(r.store.days[D0]).toBeUndefined();
    // before 03:00 it still does (Today holds on yesterday past midnight)
    expect(reconcile(fresh(), [facts(D0, { habitsDone: 3 })], at(day(1), 1)).store.days[D0]?.n).toBe(3);
  });
  it('test 4: a run that syncs for yesterday counts today and not the day after', () => {
    const y = run(fresh(), facts(D0, { habitsDone: 1 }));
    const synced = facts(D0, { habitsDone: 1, train: { run: 'done' }, auto: { run: 'done' } });
    const today = reconcile(y.store, [synced], at(day(1), 10));
    expect(today.store.days[D0]).toEqual({ n: 4, a: 2, k: { habit: 1, 'train:run': 3 } });
    expect(today.gained).toEqual([{ key: 'train:run', n: 3, date: D0 }]);
    // the same run arriving a day later: the day is closed
    const late = reconcile(y.store, [synced], at(day(2), 10));
    expect(late.store.days[D0]).toEqual({ n: 1, a: 1, k: { habit: 1 }, c: 1 });
    // and a day with nothing on it at all counts by a run that syncs the next day
    expect(reconcile(fresh(), [facts(D0, { train: { run: 'floor' }, auto: { run: 'floor' } })], at(day(1), 10)).store.days[D0]).toEqual({ n: 2, a: 1, k: { 'train:run': 2 } });
  });
  it('in the evidence window a session marked by hand, a habit or a to-do earns nothing', () => {
    const y = run(fresh(), facts(D0, { habitsDone: 1 }));
    const r = reconcile(y.store, [facts(D0, { habitsDone: 5, todosDone: 3, lines: 2, train: { lift: 'done' } })], at(day(1), 10));
    expect(r.store.days).toBe(y.store.days);
    expect(r.gained).toEqual([]);
  });
  it('a late review of yesterday’s goal earns its Orbs once and makes no day count', () => {
    const r = reconcile(fresh(), [facts(D0, { goalDay: 'done' })], at(day(1), 9));
    expect(r.store.days[D0]).toEqual({ n: 3, a: 0, k: { 'goal:day': 3 } });
    expect(countOf(r.store, day(1)).days).toBe(0);
    expect(reconcile(r.store, [facts(D0, { goalDay: 'done' })], at(day(1), 10)).store).toBe(r.store);
  });
  it('closes days two days back and never reopens them', () => {
    const s = live(3, () => ({ todosDone: 1 }));
    expect(s.days[D0]?.c).toBe(1);
    expect(s.days[day(1)]?.c).toBeUndefined();
    expect(s.days[day(2)]?.c).toBeUndefined();
  });
  it('pays nothing before the start date, and nothing for a day in the future', () => {
    const before = shiftDays(D0, -1);
    expect(reconcile(emptyRewards(U, before), [facts(before, { habitsDone: 3 })], at(before)).store.days).toEqual({});
    expect(reconcile(fresh(), [facts(day(3), { habitsDone: 3 })], at(D0)).store.days).toEqual({});
    // an account that began later earns nothing before its own first day
    const s = fresh(day(5));
    expect(reconcile(s, [facts(day(4), { habitsDone: 1 }), facts(day(5), { habitsDone: 1 })], at(day(5), 1)).store.days).toEqual({ [day(5)]: { n: 1, a: 1, k: { habit: 1 } } });
  });
  it('earns nothing while Orbs are switched off, and takes nothing away', () => {
    const on = run(fresh(), facts(D0, { habitsDone: 2 }));
    const off = applySet(on.store, { on: false }, at(D0, 13));
    const r = reconcile(off, [facts(D0, { habitsDone: 5, todosDone: 2 }), facts(day(1), { habitsDone: 5 })], at(day(1)));
    expect(r.store.days).toEqual({ [D0]: { n: 2, a: 2, k: { habit: 2 } } });
    expect(r.gained).toEqual([]);
    // back on: the day it is switched on earns again
    const back = applySet(r.store, { on: true }, at(day(3)));
    expect(reconcile(back, [facts(day(3), { habitsDone: 1 })], at(day(3), 14)).store.days[day(3)]?.n).toBe(1);
  });
});

describe('the comeback', () => {
  it('pays +3 on the first counted day after three or more missed days, once in 14 days', () => {
    // day 0 counted, days 1 to 3 missed, day 4 is the return
    const s = live(4, (i) => (i === 0 ? { habitsDone: 1 } : null));
    const r = run(s, facts(day(4), { habitsDone: 1 }));
    expect(r.store.days[day(4)]).toEqual({ n: 4, a: 1, k: { habit: 1, back: 3 } });
    expect(r.gained).toContainEqual({ key: 'back', n: 3, date: day(4) });
    // it never makes a day count by itself, and it leaves with the last action while the day is open
    expect(run(r.store, facts(day(4))).store.days[day(4)]).toBeUndefined();
    // a second gap inside 14 days pays nothing
    let t = r.store;
    for (let i = 5; i <= 8; i++) t = reconcile(t, [], at(day(i))).store;
    expect(run(t, facts(day(9), { habitsDone: 1 })).store.days[day(9)]).toEqual({ n: 1, a: 1, k: { habit: 1 } });
    // a third, past the 14 days, pays again
    let v = run(t, facts(day(9), { habitsDone: 1 })).store;
    for (let i = 10; i <= 18; i++) v = reconcile(v, [], at(day(i))).store;
    expect(run(v, facts(day(19), { habitsDone: 1 })).store.days[day(19)]?.k?.back).toBe(3);
  });
  it('two missed days are days off, not a comeback; paused days are not missed; a first day is not a return', () => {
    const two = live(3, (i) => (i === 0 ? { habitsDone: 1 } : null));
    expect(run(two, facts(day(3), { habitsDone: 1 })).store.days[day(3)]?.k?.back).toBeUndefined();
    const paused = live(5, (i) => (i === 0 ? { habitsDone: 1 } : i < 4 ? { held: true } : null));
    expect(run(paused, facts(day(5), { habitsDone: 1 })).store.days[day(5)]?.k?.back).toBeUndefined();
    const first = live(4, () => null);
    expect(run(first, facts(day(4), { habitsDone: 1 })).store.days[day(4)]?.k?.back).toBeUndefined();
  });
});

describe('goals multiply by reach, once per period', () => {
  const now = at('2026-11-20');
  it('3 times the reach: 3, 9, 30, 90, keyed by the period and never by the id', () => {
    expect(goalEarns(goal('day', '2026-11-20', { createdAt: at('2026-11-20', 7).toISOString() }), '2026-11-20')).toEqual({ key: 'goal:day:2026-11-20', n: 3 });
    expect(goalEarns(goal('week', '2026-11-16', { createdAt: at('2026-11-16', 7).toISOString() }), '2026-11-20')).toEqual({ key: 'goal:week:2026-11-16', n: 9 });
    expect(goalEarns(goal('month', '2026-11', { createdAt: at('2026-11-02').toISOString() }), '2026-11-20')).toEqual({ key: 'goal:month:2026-11', n: 30 });
    expect(goalEarns(goal('year', '2026'), '2026-11-20')).toEqual({ key: 'goal:year:2026', n: 90 });
  });
  it('test 7: a goal out of its period and grace pays nothing', () => {
    const wk = goal('week', '2026-11-09', { createdAt: at('2026-11-09').toISOString() });
    expect(goalEarns(wk, '2026-11-17')).not.toBeNull(); // Sunday the 15th plus 2 days
    expect(goalEarns(wk, '2026-11-18')).toBeNull();
    expect(goalEarns(goal('day', '2026-11-18', { createdAt: at('2026-11-18').toISOString() }), '2026-11-19')).not.toBeNull();
    expect(goalEarns(goal('day', '2026-11-18', { createdAt: at('2026-11-18').toISOString() }), '2026-11-20')).toBeNull();
    expect(goalEarns(goal('month', '2026-10', { createdAt: at('2026-10-01').toISOString() }), '2026-11-03')).not.toBeNull();
    expect(goalEarns(goal('month', '2026-10', { createdAt: at('2026-10-01').toISOString() }), '2026-11-04')).toBeNull();
    expect(goalEarns(goal('year', '2025', { createdAt: at('2025-01-10').toISOString() }), '2026-01-07')).not.toBeNull();
    expect(goalEarns(goal('year', '2025', { createdAt: at('2025-01-10').toISOString() }), '2026-01-08')).toBeNull();
    // not yet in its period
    expect(goalEarns(goal('week', '2026-11-23', { createdAt: at('2026-11-10').toISOString() }), '2026-11-20')).toBeNull();
  });
  it('test 7: a goal set too late pays nothing (week 2 days, month 7, year 30), by the day it was marked', () => {
    expect(goalEarns(goal('week', '2026-11-16', { createdAt: at('2026-11-19').toISOString() }), '2026-11-20')).toBeNull();
    expect(goalEarns(goal('week', '2026-11-16', { createdAt: at('2026-11-18').toISOString() }), '2026-11-20')).not.toBeNull();
    expect(goalEarns(goal('month', '2026-11', { createdAt: at('2026-11-14').toISOString() }), '2026-11-20')).toBeNull();
    expect(goalEarns(goal('year', '2026', { createdAt: at('2026-11-01').toISOString() }), '2026-11-20')).toBeNull();
    // set and marked the same day, then left: waiting does not turn it into Orbs
    const quick = goal('week', '2026-11-16', { createdAt: at('2026-11-16', 9).toISOString(), closedAt: at('2026-11-16', 10).toISOString() });
    expect(goalEarns(quick, '2026-11-20')).toBeNull();
    // a day goal made after its day is over
    expect(goalEarns(goal('day', '2026-11-19', { createdAt: at('2026-11-20', 8).toISOString() }), '2026-11-20')).toBeNull();
  });
  it('only a goal that is done earns', () => {
    for (const status of ['open', 'partly', 'missed'] as const) expect(goalEarns(goal('year', '2026', { status }), '2026-11-20')).toBeNull();
  });
  it('test 2: a year goal set and done offline, then renamed by the server, pays once', () => {
    const offline = goal('year', '2026', { id: 'tmp-goal-year-2026' });
    const one = reconcile(fresh(), [], now, { goals: [offline] });
    expect(one.gained).toEqual([{ key: 'goal:year:2026', n: 90, date: '2026-11-20' }]);
    const renamed = reconcile(one.store, [], now, { goals: [{ ...offline, id: 'g_9f2c' }] });
    expect(renamed.store).toBe(one.store);
    expect(totalOf(renamed.store)).toBe(90);
  });
  it('test 7: a goal cleared, set again and marked again pays once (the week in the ledger, the day in its record)', () => {
    const wk = goal('week', D0, { createdAt: at(shiftDays(D0, -3)).toISOString() });
    const a = reconcile(fresh(), [facts(day(2), { goalDay: 'done' })], at(day(2)), { goals: [wk] });
    expect(totalOf(a.store)).toBe(9 + 3);
    // cleared: the week's Orbs stay (nothing is taken away), the day's leave while the day is open
    const cleared = reconcile(a.store, [facts(day(2), { goalDay: 'none' })], at(day(2), 13), { goals: [] });
    expect(totalOf(cleared.store)).toBe(9);
    const again = reconcile(cleared.store, [facts(day(2), { goalDay: 'done' })], at(day(2), 14), { goals: [{ ...wk, id: 'g-new', createdAt: at(shiftDays(D0, -3)).toISOString() }] });
    expect(totalOf(again.store)).toBe(12);
    expect(again.gained).toEqual([{ key: 'goal:day', n: 3, date: day(2) }]);
  });
  it('earnOnce is idempotent and never pays a key twice', () => {
    const one = earnOnce(fresh(), 'goal:week:2026-11-16', 9, '2026-11-20');
    expect(earnOnce(one, 'goal:week:2026-11-16', 9, '2026-11-21')).toBe(one);
    expect(earnOnce(one, 'goal:week:2026-11-16', 30, '2026-11-21')).toBe(one);
    expect(one.once['goal:week:2026-11-16']).toEqual({ on: '2026-11-20', n: 9 });
    expect(earnOnce(one, 'x', 0, '2026-11-21')).toBe(one);
  });
});

describe('test 9: the count', () => {
  /** A week by its seven days: 1 counted, 0 nothing, h paused. */
  const weeks = (rows: string[], start = fresh()) => live(rows.length * 7, (i) => {
    const c = rows[Math.floor(i / 7)]![i % 7];
    return c === '1' ? { habitsDone: 1 } : c === 'h' ? { held: true } : null;
  }, start);
  const after = (rows: string[]) => day(rows.length * 7);
  it('a day counts with one base action, and the count is the fact line', () => {
    const s = live(3, (i) => (i === 1 ? null : { lines: 1 }));
    const c = countOf(s, day(2));
    expect(c).toMatchObject({ days: 2, thisWeek: 2, marks: [true, false, true, false, false, false, false], today: 2, weeks: 0, target: 5, daysOff: 2 });
    expect(countLine(c)).toBe('2 days this week · 2 in all');
  });
  it('two days off carry a week; a third miss does not', () => {
    expect(countOf(weeks(['1101101']), after(['1101101'])).weeks).toBe(1);
    expect(countOf(weeks(['1100101']), after(['1100101'])).weeks).toBe(0);
  });
  it('a bonus-only day does not count', () => {
    // a late goal review: Orbs, no base action
    const s = reconcile(fresh(), [facts(D0, { goalDay: 'done' })], at(day(1), 9)).store;
    expect(s.days[D0]?.n).toBe(3);
    expect(countOf(s, day(1))).toMatchObject({ days: 0, thisWeek: 0 });
  });
  it('one missed week is forgiven when the next week counts; it adds nothing itself', () => {
    const rows = ['1111100', '1111100', '1000000', '1111100'];
    expect(countOf(weeks(rows), after(rows)).weeks).toBe(3);
  });
  it('two missed weeks in a row end it, with no notice', () => {
    const rows = ['1111100', '1111100', '1000000', '0000000', '1111100'];
    const c = countOf(weeks(rows), after(rows));
    expect(c.weeks).toBe(1);
    expect(countLine(c)).not.toMatch(/row|end|lost|streak/i);
  });
  it('the week in progress never breaks it, and one missed week waits to be forgiven', () => {
    const rows = ['1111100', '1111100'];
    expect(countOf(weeks(rows), after(rows)).weeks).toBe(2);
    const missed = ['1111100', '1111100', '0000000'];
    expect(countOf(weeks(missed), after(missed)).weeks).toBe(2);
  });
  it('“N weeks in a row” is said only from two', () => {
    const one = ['1111100'];
    expect(countLine(countOf(weeks(one), after(one)))).not.toContain('in a row');
    const three = ['1111100', '1111100', '1111100'];
    expect(countLine(countOf(weeks(three), after(three)))).toBe('15 in all · 3 weeks in a row');
    // never a zero, and nothing at all before the first day
    expect(countLine(countOf(fresh(), D0))).toBe('');
    expect(countLine(countOf(live(1, () => ({ lines: 1 })), D0))).toBe('1 day this week · 1 in all');
  });
  it('neutral days: a paused day is neither counted nor missed, and lowers what the week needs', () => {
    // two paused days, three counted: 5 - 2 = 3 needed
    expect(countOf(weeks(['hh11100']), after(['hh11100'])).weeks).toBe(1);
    expect(countOf(weeks(['hh11000']), after(['hh11000'])).weeks).toBe(0);
  });
  it('a paused day with something done on it counts', () => {
    const s = live(7, (i) => (i < 5 ? { held: true, habitsDone: 1 } : null));
    expect(countOf(s, day(7))).toMatchObject({ days: 5, weeks: 1 });
  });
  it('neutral weeks: three or more paused days make the week neutral, and it is skipped over', () => {
    const rows = ['1111100', 'hhh1000', '1111100'];
    expect(countOf(weeks(rows), after(rows)).weeks).toBe(2);
    // a neutral week between two missed ones does not hide them
    const ended = ['1111100', '0000000', 'hhhhhhh', '0000000', '1111100'];
    expect(countOf(weeks(ended), after(ended)).weeks).toBe(1);
  });
  it('the week target at 3 and 4', () => {
    const three = applySet(fresh(), { weekTarget: 3 }, at(D0, 8));
    expect(countOf(weeks(['1010100'], three), after(['1010100']))).toMatchObject({ weeks: 1, target: 3, daysOff: 4 });
    expect(countOf(weeks(['1010000'], three), after(['1010000'])).weeks).toBe(0);
    const four = applySet(fresh(), { weekTarget: 4 }, at(D0, 8));
    expect(countOf(weeks(['1011100'], four), after(['1011100'])).weeks).toBe(1);
    expect(countOf(weeks(['1010100'], four), after(['1010100'])).weeks).toBe(0);
  });
  it('a finished week keeps the target it was lived under when the target changes later', () => {
    const rows = ['1110000', '1110000'];
    const s = weeks(rows, applySet(fresh(), { weekTarget: 3 }, at(D0, 8)));
    const sealed = reconcile(s, [], at(day(15))).store;
    expect(countOf(sealed, day(15)).weeks).toBe(2);
    const raised = applySet(sealed, { weekTarget: 5 }, at(day(15), 13));
    expect(countOf(raised, day(15)).weeks).toBe(2);
    // and lowering it does not turn old missed weeks into counted ones
    const hard = weeks(rows);
    const hardSealed = reconcile(hard, [], at(day(15))).store;
    expect(countOf(applySet(hardSealed, { weekTarget: 3 }, at(day(15), 13)), day(15)).weeks).toBe(0);
  });
  it('the lines framed as every day with days off, never as N of 7', () => {
    expect(ruleLine(5)).toBe('One thing a day. Two days off a week.');
    expect(ruleLine(4)).toBe('One thing a day. Three days off a week.');
    expect(ruleLine(3)).toBe('One thing a day. Four days off a week.');
    expect(mondayLine(5)).toBe('New week. Two days off in hand.');
    expect(mondayLine(3)).toBe('New week. Four days off in hand.');
  });
  it('the weeks of March and November (the clocks change) are seven days each', () => {
    for (const monday of ['2027-03-08', '2027-03-22', '2027-10-25', '2027-11-01']) {
      const s = emptyRewards(U, monday);
      let t = s;
      for (let i = 0; i < 7; i++) t = reconcile(t, i < 5 ? [facts(shiftDays(monday, i), { habitsDone: 1 })] : [], at(shiftDays(monday, i), i === 6 ? 23 : 1)).store;
      const c = countOf(t, shiftDays(monday, 7));
      expect(c).toMatchObject({ days: 5, weeks: 1 });
      expect(countOf(t, shiftDays(monday, 6)).marks).toEqual([true, true, true, true, true, false, false]);
    }
  });
  it('400 days of history equal their compacted form', () => {
    const s = live(400, (i) => (i % 7 < 5 ? { habitsDone: 2, todosDone: 1, goalDay: i % 3 === 0 ? 'done' : 'none' } : null));
    const c = compact(s, day(400));
    expect(countOf(c, day(400))).toEqual(countOf(s, day(400)));
    expect(totalOf(c)).toBe(totalOf(s));
    expect(c.days[day(10)]?.k).toBeUndefined();
    expect(c.days[day(395)]?.k).toBeDefined();
    expect(JSON.stringify(c).length).toBeLessThan(JSON.stringify(s).length);
    expect(compact(c, day(400))).toBe(c);
  });
});

describe('test 9: the clock', () => {
  it('keeps the highest device day seen', () => {
    const s = live(3, () => ({ habitsDone: 1 }));
    expect(s.clock).toBe(day(2));
    expect(reconcile(s, [], at(D0)).store.clock).toBe(day(2));
  });
  it('set back: closed days never reopen, and a day behind the clock earns nothing', () => {
    const s = live(6, () => ({ habitsDone: 1 }));
    // the phone's date goes back four days
    const back = reconcile(s, [facts(day(1), { habitsDone: 6, todosDone: 4 }), facts(day(0), { habitsDone: 6 })], at(day(1)));
    expect(back.store).toBe(s);
    // a day nothing was recorded for is no more open than the others
    const gap = live(6, (i) => (i === 2 ? null : { habitsDone: 1 }));
    expect(reconcile(gap, [facts(day(2), { habitsDone: 6 })], at(day(2))).store).toBe(gap);
  });
  it('one day back (a flight west) still earns today', () => {
    const s = live(6, () => ({ habitsDone: 1 }));
    const r = reconcile(s, [facts(day(4), { habitsDone: 3 })], at(day(4), 20));
    expect(r.store.days[day(4)]?.n).toBe(3);
  });
  it('set forward: a day beyond the server’s date plus one does not count and does not move the clock', () => {
    const s = live(2, () => ({ habitsDone: 1 }));
    const ahead = reconcile(s, [facts(day(30), { habitsDone: 5 })], at(day(30)), { serverDay: day(1) });
    expect(ahead.store.days[day(30)]).toBeUndefined();
    expect(ahead.store.clock).toBe(day(2));
    // the server's date plus one is allowed (a phone ahead of UTC)
    const edge = reconcile(s, [facts(day(2), { habitsDone: 5 })], at(day(2)), { serverDay: day(1) });
    expect(edge.store.days[day(2)]?.n).toBe(5);
    // back on the real date, the day earns as usual
    expect(reconcile(ahead.store, [facts(day(2), { habitsDone: 1 })], at(day(2)), { serverDay: day(2) }).store.days[day(2)]?.n).toBe(1);
  });
});

describe('the weekly bonus', () => {
  const week = (s: Rewards, w: number, days: number) => {
    let t = s;
    for (let i = 0; i < 7; i++) t = reconcile(t, i < days ? [facts(day(w * 7 + i), { habitsDone: 1 })] : [], at(day(w * 7 + i))).store;
    return t;
  };
  it('5 times the weeks in a row up to x4, paid once the week after is two days old', () => {
    let s = fresh();
    const paid: number[] = [];
    for (let w = 0; w < 6; w++) {
      s = week(s, w, 5);
      // Monday: the Sunday can still take late evidence, nothing is paid
      expect(s.once[`week:${day(w * 7)}`]).toBeUndefined();
      const r = reconcile(s, [], at(day(w * 7 + 8)));
      paid.push(r.gained.find((g) => g.key === `week:${day(w * 7)}`)?.n ?? 0);
      expect(reconcile(r.store, [], at(day(w * 7 + 8), 13)).gained).toEqual([]);
    }
    expect(paid).toEqual([5, 10, 15, 20, 20, 20]);
  });
  it('a missed week steps it down one rung and never to nothing; a paused week leaves it where it was', () => {
    let s = fresh();
    for (let w = 0; w < 4; w++) s = week(s, w, 5);
    s = week(s, 4, 1); // missed
    s = week(s, 5, 5);
    s = reconcile(s, [], at(day(6 * 7 + 1))).store;
    expect([0, 1, 2, 3, 4, 5].map((w) => s.once[`week:${day(w * 7)}`]?.n ?? 0)).toEqual([5, 10, 15, 20, 0, 15]);
    expect(weekBonus(s, day(5 * 7))).toBe(15);
    expect(weekBonus(s, day(4 * 7))).toBe(0);
    // three missed weeks: the next counted week still pays 5
    let t = fresh();
    for (let w = 0; w < 2; w++) t = week(t, w, 5);
    for (let w = 2; w < 6; w++) t = week(t, w, 0);
    t = week(t, 6, 5);
    expect(weekBonus(t, day(6 * 7))).toBe(5);
    // a paused week
    let p = fresh();
    for (let w = 0; w < 3; w++) p = week(p, w, 5);
    for (let i = 0; i < 7; i++) p = reconcile(p, [facts(day(21 + i), { held: true })], at(day(21 + i))).store;
    p = week(p, 4, 5);
    expect(weekBonus(p, day(4 * 7))).toBe(20);
    expect(weekBonus(p, day(3 * 7))).toBe(0);
  });
  it('a bonus never makes a day count', () => {
    const s = reconcile(week(fresh(), 0, 5), [], at(day(8))).store;
    expect(totalOf(s)).toBe(5 + 5);
    expect(countOf(s, day(8)).days).toBe(5);
  });
});

describe('levels', () => {
  it('widen with no top: 25, 75, 200, 500, 1,200, 2,500, 5,000, then every 5,000', () => {
    expect(levelOf(0)).toEqual({ level: 1, floor: 0, next: 25, into: 0, span: 25, left: 25 });
    expect(levelOf(24).level).toBe(1);
    expect(levelOf(25).level).toBe(2);
    expect(levelOf(75).level).toBe(3);
    expect(levelOf(200).level).toBe(4);
    expect(levelOf(500).level).toBe(5);
    expect(levelOf(984)).toEqual({ level: 5, floor: 500, next: 1200, into: 484, span: 700, left: 216 });
    expect(levelOf(1200).level).toBe(6);
    expect(levelOf(2500).level).toBe(7);
    expect(levelOf(5000)).toMatchObject({ level: 8, next: 10000 });
    expect(levelOf(10000)).toMatchObject({ level: 9, floor: 10000, next: 15000 });
    expect(levelOf(123456)).toMatchObject({ level: 31, floor: 120000, next: 125000 });
    expect(levelOf(-5).level).toBe(1);
  });
});

// ---------- merge ----------
/** A small deterministic generator (mulberry32), so a failing case can be replayed from its seed. */
const rng = (seed: number) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const KINDS = ['todo', 'habit', 'train:run', 'train:lift', 'train:cross', 'goal:day', 'full', 'back'] as const;
const genStore = (seed: number): Rewards => {
  const r = rng(seed);
  const int = (n: number) => Math.floor(r() * n);
  const s = emptyRewards(U, day(-int(3)));
  s.clock = day(100 + int(5));
  for (let i = 0; i < 100; i++) {
    if (r() < 0.35) continue;
    const rec: DayRec = { n: 0, a: int(6) };
    if (r() < 0.75) {
      const k: NonNullable<DayRec['k']> = {};
      for (const kind of KINDS) if (r() < 0.4) k[kind] = 1 + int(5);
      if (Object.keys(k).length) rec.k = k;
    }
    rec.n = Object.values(rec.k ?? {}).reduce((t, v) => t + v, 0) + (r() < 0.2 ? int(4) : 0);
    if (r() < 0.8 || i < 90) rec.c = 1;
    if (rec.c && r() < 0.15) rec.r = 1;
    if (r() < 0.1) rec.h = 1;
    s.days[day(i)] = rec;
  }
  for (let i = 0; i < 12; i++) if (r() < 0.5) s.once[`week:${day(i * 7)}`] = { on: day(i * 7 + 8 + int(2)), n: 5 * (1 + int(4)) };
  if (r() < 0.5) s.once['goal:year:2026'] = { on: day(int(40)), n: 90 };
  for (let i = 0; i < 6; i++) if (r() < 0.5) s.challenges[`challenge:d:${day(60 + i * 7)}`] = { item: ['habits', 'goal', 'full'][int(3)]!, target: 1 + int(3), base: int(2), state: (['offered', 'added', 'done', 'skipped', 'void'] as const)[int(5)]!, at: at(day(60 + i * 7), 6 + int(12)).toISOString() };
  for (const key of ['first', 'days:10', 'weeks:2', 'chapter:' + D0]) if (r() < 0.5) s.keepsakes[key] = { on: day(int(60)), ...(r() < 0.3 ? { d: int(20), t: 'a line' } : {}) };
  if (r() < 0.4) s.off.push({ from: day(20 + int(3)), to: r() < 0.5 ? null : day(24 + int(3)) });
  for (let i = 0; i < 12; i++) if (r() < 0.5) s.wt[day(i * 7)] = (3 + int(3)) as 3 | 4 | 5;
  for (const key of ['first', 'days:10', 'goal:year:2026']) if (r() < 0.4) s.seen[key] = day(50 + int(30));
  s.set = { on: r() < 0.8, show: r() < 0.8, weekTarget: (3 + int(3)) as 3 | 4 | 5, cadence: int(3) as 0 | 1 | 2, size: (['gentle', 'steady', 'bold'] as const)[int(3)]!, at: at(day(int(90)), int(24)).toISOString() };
  return s;
};
const rank = (r: DayRec | undefined) => (!r ? -1 : r.c ? (r.r ? 1 : 2) : 0);

describe('test 5: the merge laws, by property', () => {
  const N = 150;
  it('is commutative', () => {
    for (let i = 0; i < N; i++) expect(mergeRewards(genStore(i), genStore(i + 1000)), `seed ${i}`).toEqual(mergeRewards(genStore(i + 1000), genStore(i)));
  });
  it('is associative', () => {
    for (let i = 0; i < N; i++) {
      const [a, b, c] = [genStore(i), genStore(i + 1000), genStore(i + 2000)];
      expect(mergeRewards(mergeRewards(a, b), c), `seed ${i}`).toEqual(mergeRewards(a, mergeRewards(b, c)));
    }
  });
  it('is idempotent, and merging a copy of itself changes nothing', () => {
    for (let i = 0; i < N; i++) {
      const a = genStore(i);
      const m = mergeRewards(a, genStore(i + 1000));
      expect(mergeRewards(m, m), `seed ${i}`).toEqual(m);
      expect(mergeRewards(m, genStore(i + 1000)), `seed ${i}`).toEqual(m);
      expect(mergeRewards(m, a), `seed ${i}`).toEqual(m);
    }
  });
  it('never lowers a day’s number: the merged day is at least each side of the same standing, and a closed day never loses to an open one', () => {
    for (let i = 0; i < N; i++) {
      const [a, b] = [genStore(i), genStore(i + 1000)];
      const m = mergeRewards(a, b);
      for (const d of new Set([...Object.keys(a.days), ...Object.keys(b.days)])) {
        const top = Math.max(rank(a.days[d]), rank(b.days[d]));
        for (const side of [a, b]) if (rank(side.days[d]) === top) expect(m.days[d]!.n, `seed ${i} ${d}`).toBeGreaterThanOrEqual(side.days[d]!.n);
        expect(rank(m.days[d])).toBe(top);
      }
      for (const [k, v] of Object.entries({ ...a.once, ...b.once })) expect(m.once[k]!.n).toBeGreaterThanOrEqual(v.n);
    }
  });
  it('merging a compacted store gives the same total as merging the raw one', () => {
    for (let i = 0; i < N; i++) {
      const [a, b] = [genStore(i), genStore(i + 1000)];
      expect(totalOf(mergeRewards(compact(a, a.clock), b)), `seed ${i}`).toBe(totalOf(mergeRewards(a, b)));
      expect(totalOf(mergeRewards(compact(a, a.clock), compact(b, b.clock))), `seed ${i}`).toBe(totalOf(mergeRewards(a, b)));
      // and after the tidy both the phone and the server run on a merged store
      expect(totalOf(tidy(mergeRewards(compact(a, a.clock), b))), `seed ${i}`).toBe(totalOf(tidy(mergeRewards(a, b))));
      expect(countOf(mergeRewards(compact(a, a.clock), b), day(104))).toEqual(countOf(mergeRewards(a, b), day(104)));
    }
  });
  it('every merged store is one the schema takes', () => {
    for (let i = 0; i < 40; i++) expect(zRewards.safeParse(mergeRewards(genStore(i), genStore(i + 1000))).success, `seed ${i}`).toBe(true);
  });
  it('never merges another account’s store', () => {
    const mine = genStore(1);
    const theirs = { ...genStore(2), userId: 'u_other' };
    expect(mergeRewards(mine, theirs)).toBe(mine);
  });
  it('closed against closed is a maximum per kind; closed beats open; a real day beats a rebuilt one', () => {
    const one = (rec: DayRec): Rewards => ({ ...fresh(), clock: day(3), days: { [D0]: rec } });
    // the merge itself is a plain maximum (which is what keeps it lawful); `tidy` then makes the number the sum of the kinds
    const both = mergeRewards(one({ n: 3, a: 3, k: { todo: 3 }, c: 1 }), one({ n: 2, a: 2, k: { habit: 2 }, c: 1 }));
    expect(both.days[D0]).toEqual({ n: 3, a: 3, k: { todo: 3, habit: 2 }, c: 1 });
    expect(tidy(both).days[D0]).toEqual({ n: 5, a: 3, k: { todo: 3, habit: 2 }, c: 1 });
    expect(tidy(tidy(both))).toEqual(tidy(both));
    expect(mergeRewards(one({ n: 9, a: 9, k: { habit: 8, todo: 1 } }), one({ n: 2, a: 2, k: { habit: 2 }, c: 1 })).days[D0]).toEqual({ n: 2, a: 2, k: { habit: 2 }, c: 1 });
    expect(mergeRewards(one({ n: 9, a: 9, k: { habit: 8, todo: 1 }, c: 1, r: 1 }), one({ n: 2, a: 2, k: { habit: 2 }, c: 1 })).days[D0]).toEqual({ n: 2, a: 2, k: { habit: 2 }, c: 1 });
  });
});

describe('test 6: two phones', () => {
  const whole = facts(D0, { todosDone: 4, habitsDone: 6 });
  it('disjoint halves of one open day converge to the capped number once the facts have synced', () => {
    // each phone has seen only its own taps: A four to-dos and six habits, B three to-dos and four habits
    const a = run(fresh(), facts(D0, { todosDone: 4, habitsDone: 6 })).store;
    const b = run(fresh(), facts(D0, { todosDone: 3, habitsDone: 4 })).store;
    // the facts sync (7 to-dos, 10 habits); each recomputes its open day; the stores then merge either way round
    const synced = facts(D0, { todosDone: 7, habitsDone: 10 });
    const a2 = run(mergeRewards(a, b), synced).store;
    const b2 = run(mergeRewards(b, a), synced).store;
    expect(a2.days[D0]).toEqual({ n: 13, a: 17, k: { todo: 5, habit: 8 } });
    expect(b2).toEqual(a2);
    // and never the union of what each paid alone (7 + 10)
    expect(totalOf(a2)).toBe(13);
  });
  it('an undo on one phone is not brought back by the other', () => {
    const a = run(fresh(), whole).store;
    const b = run(fresh(), whole).store;
    // A unticks a habit; the fact syncs; B still holds the old open record
    const undone = facts(D0, { todosDone: 4, habitsDone: 5 });
    const a2 = run(a, undone).store;
    const a3 = run(mergeRewards(a2, b), undone).store;
    expect(a3.days[D0]?.n).toBe(9);
    // once A has closed the day, its closed record beats B's stale open one
    const closedA = reconcile(a3, [], at(day(2))).store;
    expect(mergeRewards(b, closedA).days[D0]).toEqual({ n: 9, a: 9, k: { todo: 4, habit: 5 }, c: 1 });
    expect(mergeRewards(closedA, b).days[D0]).toEqual({ n: 9, a: 9, k: { todo: 4, habit: 5 }, c: 1 });
  });
});

describe('test 10: the account', () => {
  const good = () => run(fresh(), facts(D0, { habitsDone: 2 })).store;
  it('parseRewards reads a stored store back, as an object or as text', () => {
    expect(parseRewards(JSON.stringify(good()), U)).toEqual(good());
    expect(parseRewards(good(), U)).toEqual(good());
  });
  it('refuses garbage', () => {
    for (const raw of [null, undefined, '', 'not json', '[]', '{}', 42, [], { v: 2 }, { ...good(), v: 2 }, { ...good(), days: { nope: { n: 1, a: 1 } } }, { ...good(), days: { [D0]: { n: -1, a: 1 } } }, { ...good(), days: { [D0]: { n: 1.5, a: 1 } } }, { ...good(), once: { x: { on: 'never', n: 1 } } }, { ...good(), set: { weekTarget: 9 } }, { ...good(), startedOn: '2026-13-40' }])
      expect(parseRewards(raw, U), JSON.stringify(raw)).toBeNull();
  });
  it('refuses another account’s store, and a store with no account', () => {
    expect(parseRewards(good(), 'u_other')).toBeNull();
    expect(parseRewards({ ...good(), userId: '' }, '')).toBeNull();
  });
  it('makes a day’s number at least the sum of its kinds, so a merge can trust it', () => {
    const s = { ...good(), days: { [D0]: { n: 1, a: 2, k: { habit: 2 }, c: 1 } } };
    expect(parseRewards(s, U)?.days[D0]?.n).toBe(2);
  });
  it('the schema caps the size', () => {
    const many: Rewards = { ...good(), days: Object.fromEntries(Array.from({ length: 4200 }, (_, i) => [shiftDays('2026-01-01', i), { n: 1, a: 1, c: 1 as const }])) };
    expect(zRewards.safeParse(many).success).toBe(false);
    expect(zRewards.safeParse({ ...good(), keepsakes: { first: { on: D0, t: 'x'.repeat(400) } } }).success).toBe(false);
    // a field this build does not know is dropped, not refused (a newer build may have written it)
    expect(parseRewards({ ...good(), extra: 1 }, U)).toEqual(good());
  });
  it('a wipe then rebuild gives at least the base total, pays base only, and marks its days', () => {
    const lived: DayFacts[] = Array.from({ length: 30 }, (_, i) => facts(day(i), i % 4 === 3 ? {} : { todosDone: 1 + (i % 3), todosEarlier: 2, habitsLive: 3, habitsDone: 3, habitsLiveDone: 3, goalDay: 'done', lines: 1 }));
    let s = fresh();
    for (const f of lived) s = reconcile(s, [f], at(f.date)).store;
    const base = Object.values(s.days).reduce((t, r) => t + r.n - (r.k?.full ?? 0) - (r.k?.back ?? 0), 0);
    expect(totalOf(s)).toBeGreaterThan(base);
    const re = rebuild(lived, D0, day(30), U);
    expect(totalOf(re)).toBeGreaterThanOrEqual(base);
    expect(totalOf(re)).toBe(base);
    expect(countOf(re, day(30)).days).toBe(countOf(s, day(30)).days);
    expect(Object.values(re.days).every((r) => r.c === 1 && r.r === 1 && !r.k?.full && !r.k?.back)).toBe(true);
    expect(Object.values(re.once)).toEqual([]);
    expect(re).toMatchObject({ userId: U, startedOn: D0, clock: day(30) });
    // rebuilt weeks pay no weekly bonus afterwards
    expect(reconcile(re, [], at(day(31))).gained).toEqual([]);
  });
  it('rebuild starts no earlier than the rules do, and leaves today to the reconciler', () => {
    const re = rebuild([facts(shiftDays(D0, -3), { habitsDone: 2 }), facts(D0, { habitsDone: 1 }), facts(day(2), { habitsDone: 4 })], shiftDays(D0, -10), day(2), U);
    expect(re.startedOn).toBe(D0);
    expect(Object.keys(re.days)).toEqual([D0]);
    expect(reconcile(re, [facts(day(2), { habitsDone: 4 })], at(day(2))).store.days[day(2)]).toEqual({ n: 4, a: 4, k: { habit: 4 } });
  });
});

describe('test 2: facts do not depend on ids', () => {
  const world = (ids: { habit: string; todo: string; session: string; goal: string }): World => {
    const habits: Habit[] = [{ id: ids.habit, name: 'Read', position: 0, createdOn: '2026-01-01', archivedOn: null }, { id: 'h2', name: 'Walk', position: 1, createdOn: '2026-01-01', archivedOn: null }];
    const checks: HabitCheck[] = [{ habitId: ids.habit, date: D0, done: true, note: null }, { habitId: 'h2', date: D0, done: false, note: null }];
    const todos: Todo[] = [{ id: ids.todo, text: 'Call', note: null, priority: 0, color: null, groupId: null, due: null, bucket: 'today', position: 0, createdOn: shiftDays(D0, -2), doneOn: D0, deletedOn: null, createdAt: '' }];
    const sessions = [sess({ id: ids.session, date: D0, kind: 'run', miles: 4, mark: 'done' })];
    return { snap: snapOf(sessions, [], D0), todos, habits, checksOn: (d) => checks.filter((c) => c.date === d), goals: [goal('day', D0, { id: ids.goal, createdAt: at(D0, 7).toISOString() })], linesOn: () => 1, status: null, fitness: true };
  };
  it('provisional ids, then the server’s ids: the same facts and the same numbers', () => {
    const tmp = dayFactsOf(world({ habit: 'tmp-1731', todo: 'tmp-a1', session: 'tmp-s1', goal: 'tmp-goal-day-x' }), D0, D0);
    const real = dayFactsOf(world({ habit: 'h_9', todo: 't_9', session: 'p9', goal: 'g_9' }), D0, D0);
    expect(real).toEqual(tmp);
    expect(tmp).toMatchObject({ todosDone: 1, todosEarlier: 1, habitsLive: 2, habitsDone: 1, habitsLiveDone: 1, lines: 1, train: { run: 'done' }, trainRequired: true, trainLeft: 0, goalDay: 'done', held: false });
    const one = run(fresh(), tmp);
    expect(run(one.store, real).store).toBe(one.store);
    expect(JSON.stringify(one.store)).not.toMatch(/tmp-|h_9|t_9|g_9/);
  });
  it('reads training as the app grades it: a mark, an activity, a floor, an unplanned run, a logged set', () => {
    const w = (sessions: Session[], acts = [] as ReturnType<typeof act>[], sets: Record<string, number> = {}, fitness = true): World => ({ snap: fitness ? snapOf(sessions, acts, D0, sets) : snapOf([], [], D0), todos: [], habits: [], checksOn: () => [], goals: [], linesOn: () => 0, status: null, fitness });
    const run5 = sess({ date: D0, kind: 'run', miles: 5 });
    expect(dayFactsOf(w([run5], [act(D0, 5)]), D0, D0)).toMatchObject({ train: { run: 'done' }, auto: { run: 'done' }, trainRequired: true, trainLeft: 0 });
    expect(dayFactsOf(w([run5], [act(D0, 2)]), D0, D0)).toMatchObject({ train: { run: 'floor' }, auto: { run: 'floor' } });
    expect(dayFactsOf(w([{ ...run5, mark: 'floor' }]), D0, D0)).toMatchObject({ train: { run: 'floor' }, auto: {} });
    expect(dayFactsOf(w([run5]), D0, D0)).toMatchObject({ train: {}, trainRequired: true, trainLeft: 1 });
    expect(dayFactsOf(w([], [act(D0, 3)]), D0, D0)).toMatchObject({ train: { run: 'done' }, auto: { run: 'done' }, trainRequired: false });
    expect(dayFactsOf(w([sess({ date: D0, kind: 'lift' })], [], { [D0]: 1 }), D0, D0)).toMatchObject({ train: { lift: 'done' }, auto: {} });
    expect(dayFactsOf(w([], [], { [D0]: 3 }), D0, D0)).toMatchObject({ train: { lift: 'done' }, auto: {} });
    expect(dayFactsOf(w([sess({ date: D0, kind: 'rest' })]), D0, D0)).toMatchObject({ train: {}, trainRequired: false });
    // Fitness off: the adapter hands over a world with no training in it
    expect(dayFactsOf(w([run5], [act(D0, 5)], {}, false), D0, D0)).toMatchObject({ train: {}, auto: {}, trainRequired: false });
  });
  it('a to-do deleted that day, a habit archived before it, and a goal out of its guards are not facts', () => {
    const base = world({ habit: 'h1', todo: 't1', session: 's1', goal: 'g1' });
    expect(dayFactsOf({ ...base, todos: base.todos.map((t) => ({ ...t, deletedOn: D0 })) }, D0, D0).todosDone).toBe(0);
    expect(dayFactsOf({ ...base, habits: base.habits.map((h) => ({ ...h, archivedOn: shiftDays(D0, -1) })) }, D0, D0)).toMatchObject({ habitsLive: 0, habitsDone: 0 });
    expect(dayFactsOf({ ...base, goals: [goal('day', D0, { createdAt: at(day(1), 9).toISOString() })] }, D0, day(1)).goalDay).toBe('open');
    expect(dayFactsOf({ ...base, goals: [] }, D0, D0).goalDay).toBe('none');
    expect(dayFactsOf({ ...base, status: { kind: 'travel', from: D0, until: day(3) } }, day(2), day(2)).held).toBe(true);
    expect(dayFactsOf({ ...base, status: { kind: 'taper', from: D0, until: day(3) } }, day(2), day(2)).held).toBe(false);
  });
});

describe('keepsakes and chapters', () => {
  const keys = (s: Rewards, now: Date, extra?: Parameters<typeof keepsakesDue>[2]) => keepsakesDue(s, now, extra).map((k) => k.key);
  it('the first Orb is First light, dated the day it was earned, once', () => {
    expect(keys(fresh(), at(D0))).toEqual([]);
    const s = live(3, (i) => (i === 1 ? { habitsDone: 1 } : null));
    const due = keepsakesDue(s, at(day(2)));
    expect(due).toEqual([{ key: 'first', keepsake: { on: day(1) } }]);
    const kept = addKeepsakes(s, due);
    expect(keys(kept, at(day(2)))).toEqual([]);
    expect(addKeepsakes(kept, due)).toBe(kept);
  });
  it('days in all at 10, 50, 100, dated the day the count got there', () => {
    const s = live(60, (i) => (i % 7 < 6 ? { lines: 1 } : null));
    const due = keepsakesDue(s, at(day(59)));
    expect(due.find((k) => k.key === 'days:10')?.keepsake.on).toBe(day(10));
    expect(due.map((k) => k.key)).toContain('days:50');
    expect(due.map((k) => k.key)).not.toContain('days:100');
    // a line earns no Orb, so First light waits for the first weekly bonus
    expect(due.find((k) => k.key === 'first')?.keepsake.on).toBe(day(8));
  });
  it('weeks in a row at 2 and 4, the first full day, the first challenge, a month and a year goal with its words', () => {
    let s = live(29, (i) => (i % 7 < 5 ? { habitsLive: 3, habitsDone: 3, habitsLiveDone: 3, goalDay: 'done' } : null));
    s = earnOnce(s, `challenge:d:${day(3)}`, 5, day(3));
    s = earnOnce(s, 'goal:month:2026-11', 30, day(13));
    s = earnOnce(s, 'goal:year:2026', 90, day(20));
    s = earnOnce(s, `goal:week:${D0}`, 9, day(5));
    const due = keepsakesDue(s, at(day(28), 12), { goals: [goal('month', '2026-11', { text: 'Run 80 miles' }), goal('year', '2026', { text: 'A spring marathon' })] });
    const by = Object.fromEntries(due.map((k) => [k.key, k.keepsake]));
    expect(Object.keys(by).sort()).toEqual(['challenge', `chapter:${D0}`, 'days:10', 'first', 'full', 'goal:month:2026-11', 'goal:year:2026', 'weeks:2', 'weeks:4'].sort());
    expect(by.full).toEqual({ on: D0 });
    expect(by.challenge).toEqual({ on: day(3) });
    expect(by['goal:month:2026-11']).toEqual({ on: day(13), t: 'Run 80 miles' });
    expect(by['goal:year:2026']).toEqual({ on: day(20), t: 'A spring marathon' });
  });
  it('a chapter closes every four weeks on a Monday, carrying its own facts and one line written in it', () => {
    let s = live(28, (i) => (i % 7 < 5 ? { habitsDone: 1, train: i % 7 === 0 ? { run: 'done' } : {}, goalDay: i % 7 === 1 ? 'done' : 'none' } : null));
    s = earnOnce(s, `goal:week:${day(7)}`, 9, day(12));
    const lines = [{ date: shiftDays(D0, -2), text: 'before the chapter' }, { date: day(9), text: 'Slept early and it showed.' }, { date: day(40), text: 'after it' }];
    // Sunday night: not yet
    expect(keys(s, at(day(27), 23), { lines })).not.toContain(`chapter:${D0}`);
    // Monday before 03:00: Sunday still takes taps
    expect(keys(reconcile(s, [], at(day(28), 1)).store, at(day(28), 1), { lines })).not.toContain(`chapter:${D0}`);
    const due = keepsakesDue(reconcile(s, [], at(day(28), 9)).store, at(day(28), 9), { lines });
    expect(due.find((k) => k.key === `chapter:${D0}`)?.keepsake).toEqual({ on: day(28), d: 20, s: 4, g: 5, t: 'Slept early and it showed.' });
    expect(mondayOf(day(28))).toBe(day(28));
    // the second chapter, eight weeks in
    const two = live(56, (i) => (i % 7 < 5 ? { habitsDone: 1 } : null));
    expect(keys(two, at(day(56), 9))).toEqual(expect.arrayContaining([`chapter:${D0}`, `chapter:${day(28)}`]));
  });
  it('a chapter with nothing in it leaves no keepsake (never a zero)', () => {
    const s = live(29, () => null);
    expect(keys(s, at(day(28), 9))).toEqual([]);
  });
  it('chapterOf: the chapter’s bar starts again; the total and the level do not', () => {
    const s = live(30, () => ({ habitsDone: 2 }));
    expect(chapterOf(s, day(27))).toEqual({ n: 1, start: D0, end: day(27), closes: day(28), day: 28, orbs: 56, days: 28 });
    expect(chapterOf(s, day(29))).toEqual({ n: 2, start: day(28), end: day(55), closes: day(56), day: 2, orbs: 4, days: 2 });
    expect(totalOf(s)).toBeGreaterThanOrEqual(60);
  });
});

describe('what has been seen, and the big moments', () => {
  const big = () => {
    let s = live(29, (i) => (i % 7 < 5 ? { habitsDone: 1 } : null));
    s = earnOnce(s, `goal:week:${day(14)}`, 9, day(18));
    s = earnOnce(s, 'goal:month:2026-11', 30, day(13));
    return addKeepsakes(s, keepsakesDue(s, at(day(28), 9)));
  };
  it('everything earned is new until it is marked seen', () => {
    const s = big();
    expect(newKeys(s).sort()).toEqual([`chapter:${D0}`, 'days:10', 'first', 'goal:month:2026-11', `goal:week:${day(14)}`, 'weeks:2', 'weeks:4'].sort());
    const seen = markSeen(s, 'first', day(28));
    expect(newKeys(seen)).not.toContain('first');
    expect(markSeen(seen, 'first', day(29))).toBe(seen);
  });
  it('big moments wait in the order they were earned, at most two in any seven days', () => {
    const s = big();
    // a month goal, a week goal, four weeks in a row and a chapter are big; First light and ten days are not
    expect(pendingMoments(s, day(28)).map((m) => m.key)).toEqual(['goal:month:2026-11', `goal:week:${day(14)}`]);
    const one = markSeen(s, 'goal:month:2026-11', day(28));
    expect(pendingMoments(one, day(28)).map((m) => m.key)).toEqual([`goal:week:${day(14)}`]);
    const two = markSeen(one, `goal:week:${day(14)}`, day(28));
    expect(pendingMoments(two, day(28))).toEqual([]);
    expect(pendingMoments(two, day(34))).toEqual([]);
    // a week on, the next two
    expect(pendingMoments(two, day(35)).map((m) => m.key).sort()).toEqual([`chapter:${D0}`, 'weeks:4'].sort());
    // the ones that waited are still new rows meanwhile
    expect(newKeys(two)).toEqual(expect.arrayContaining(['weeks:4', `chapter:${D0}`]));
  });
  it('dayLines: what a day paid, in the order of the rules table', () => {
    const s = run(fresh(), facts(D0, { todosDone: 2, habitsLive: 3, habitsDone: 3, habitsLiveDone: 3, goalDay: 'done', train: { run: 'floor' } })).store;
    expect(dayLines(s, D0)).toEqual([
      { key: 'todo', n: 2 },
      { key: 'habit', n: 3 },
      { key: 'train:run', n: 2 },
      { key: 'goal:day', n: 3 },
      { key: 'full', n: 5 },
    ]);
    expect(dayLines(s, day(1))).toEqual([]);
  });
});

describe('the switches travel in the store', () => {
  it('the newest change wins a merge, whichever side holds it', () => {
    const a = applySet(fresh(), { weekTarget: 4 }, at(D0, 9));
    const b = applySet(fresh(), { weekTarget: 3, size: 'bold' }, at(D0, 10));
    expect(mergeRewards(a, b).set).toMatchObject({ weekTarget: 3, size: 'bold' });
    expect(mergeRewards(b, a).set).toMatchObject({ weekTarget: 3, size: 'bold' });
  });
  it('switching Orbs off opens a range of neutral days and switching on closes it', () => {
    const off = applySet(fresh(), { on: false }, at(day(2)));
    expect(off.off).toEqual([{ from: day(2), to: null }]);
    const on = applySet(off, { on: true }, at(day(5)));
    expect(on.off).toEqual([{ from: day(2), to: day(4) }]);
    // off and on again the same day leaves nothing behind
    expect(applySet(applySet(fresh(), { on: false }, at(day(2), 9)), { on: true }, at(day(2), 10)).off).toEqual([]);
    // the days off are neutral: the week needs less, and nothing is missed
    const s = live(7, (i) => (i < 3 ? { habitsDone: 1 } : null));
    const range: Rewards = { ...s, off: [{ from: day(3), to: day(4) }] };
    expect(countOf(range, day(7)).weeks).toBe(1);
    expect(countOf(s, day(7)).weeks).toBe(0);
  });
  it('a change that changes nothing is no change', () => {
    const s = fresh();
    expect(applySet(s, { weekTarget: 5 }, at(D0))).toBe(s);
  });
});
