import { addChallenge, emptyRewards, parseISO, settleChallenges, shiftDays, type Challenge, type Habit, type Rewards, type Todo } from '@logbook/shared';
import { QueryClient } from '@tanstack/react-query';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { keys } from '@/api/queries';
import type { Bootstrap, MonthBundle } from '@/api/types';
import { challengeFacts, readCaches } from '../dayFacts';
import { openOrbs, resetOrbsForTest, setOrbs } from '../store';
import { rowsFor } from './model';
import { boardOf, useBoard, type Board } from './useBoard';

vi.mock('idb-keyval', () => ({ get: async () => undefined, set: async () => undefined, del: async () => undefined, clear: async () => undefined }));

/**
 * The board from real caches: the challenge's facts as the one adapter reads them (`challengeFacts`), then the row. These
 * are the cases a count alone cannot tell apart: which to-dos were on the list when the challenge was added, and whether
 * the slot's day still takes taps by the real clock.
 */
const U = 'u_owner';
const T = '2026-11-18'; // a Wednesday
const KEY = `challenge:d:${T}`;
const clock = (date: string, hour: number, minute = 0) => {
  const d = parseISO(date);
  d.setHours(hour, minute, 0, 0);
  return d;
};
const ADDED = clock(T, 9);
const habit = (id: string): Habit => ({ id, name: id, position: 0, createdOn: '2026-01-01', archivedOn: null });
const boot = (): Bootstrap =>
  ({
    user: { id: U, email: 'owner@example.com', onboardedAt: '2026-01-01T12:00:00.000Z', status: null },
    habits: [habit('h1'), habit('h2'), habit('h3')],
    blocks: [],
    morningSettings: { wake: 390, run: { pace: 540 } },
    zones: null,
    strava: { connected: false },
    features: { claude: false, strava: false },
    consent: { training: false, health: null, recall: false, reads: false, at: null, version: null },
    trainWhen: null,
  }) as unknown as Bootstrap;
const month = (m: string, p: Partial<MonthBundle> = {}): MonthBundle => ({ month: m, sessions: [], checks: [], lifts: [], activities: [], morningDays: {}, journal: [], coach: [], ...p });
const todo = (id: string, p: Partial<Todo> = {}): Todo => ({ id, text: `do ${id}`, note: null, priority: 0, color: null, groupId: null, due: null, bucket: 'today', position: 0, createdOn: T, doneOn: null, deletedOn: null, createdAt: clock(T, 8).toISOString(), ...p });
/** Written after the challenge was added. */
const later = (id: string, p: Partial<Todo> = {}) => todo(id, { createdAt: clock(T, 11).toISOString(), ...p });
const store = (c: Challenge): Rewards => ({ ...emptyRewards(U, '2026-10-05', undefined, '2026-10-05'), clock: T, challenges: { [KEY]: c } });
const world = (todos: Todo[], p: Partial<MonthBundle> = {}) => {
  const qc = new QueryClient();
  qc.setQueryData(keys.bootstrap, boot());
  for (const m of ['2026-10', '2026-11']) qc.setQueryData(keys.month(m), month(m, m === '2026-11' ? p : {}));
  qc.setQueryData(keys.todos, todos);
  qc.setQueryData(['goals'], []);
  return qc;
};
const list: Challenge = { item: 'list', target: 3, base: 0, state: 'added', at: ADDED.toISOString() };
const row = (todos: Todo[], c: Challenge = list, now = clock(T, 12)) => boardOf(world(todos), store(c), T, true, now)?.views[KEY] ?? null;

describe('“Clear this morning’s list”, from the to-dos themselves', () => {
  it('a to-do written after it was added, and checked off, is not one of the list’s', () => {
    // the morning's three, one done; then two more written at eleven and both checked off
    const todos = [todo('a', { doneOn: T }), todo('b'), todo('c'), later('x', { doneOn: T }), later('y', { doneOn: T })];
    expect(row(todos)).toMatchObject({ shown: 'added', sub: '1 of 3 done' });
    // by the counts alone this was three done of three, and it paid
    const qc = world(todos);
    const s = store(list);
    const f = challengeFacts(readCaches(qc, true, ['2026-10', '2026-11'])!, s, { key: KEY, kind: 'day', date: T, seed: 0 }, T);
    expect(f.list).toEqual({ open: 2, done: 1 });
    expect(f.day.todosDone).toBe(3);
    expect(settleChallenges(s, { [KEY]: f }, clock(T, 12)).gained).toEqual([]);
  });
  it('the morning’s three done pays, whatever was written since', () => {
    const todos = [todo('a', { doneOn: T }), todo('b', { doneOn: T }), todo('c', { doneOn: T }), later('x'), later('y')];
    expect(row(todos)).toMatchObject({ shown: 'done', sub: 'Done · 5 Orbs' });
  });
  it('one moved to tomorrow or deleted is no longer asked for', () => {
    const tomorrow = shiftDays(T, 1);
    expect(row([todo('a', { doneOn: T }), todo('b'), todo('c', { bucket: 'later', due: tomorrow })])).toMatchObject({ shown: 'added', sub: '1 of 2 done' });
    expect(row([todo('a', { doneOn: T }), todo('b', { doneOn: T }), todo('c', { bucket: 'later', due: tomorrow })])).toMatchObject({ shown: 'done', sub: 'Done · 5 Orbs' });
    expect(row([todo('a', { doneOn: T }), todo('b', { doneOn: T }), todo('c', { deletedOn: T })])).toMatchObject({ shown: 'done' });
    // every one of them gone with none done: it ends, with no row and nothing paid
    const gone = [todo('a', { deletedOn: T }), todo('b', { bucket: 'someday' }), todo('c', { bucket: 'later', due: tomorrow })];
    expect(row(gone)).toBeNull();
    const qc = world(gone);
    const s = store(list);
    const settled = settleChallenges(s, { [KEY]: challengeFacts(readCaches(qc, true, ['2026-10', '2026-11'])!, s, { key: KEY, kind: 'day', date: T, seed: 0 }, T) }, clock(T, 12));
    expect(settled.store.challenges[KEY]!.state).toBe('void');
    expect(settled.store.once).toEqual({});
  });
  it('what was done before it was added is its base, and a row with no time of its own is taken as an old one', () => {
    const c: Challenge = { ...list, target: 2, base: 1 };
    const todos = [todo('a', { doneOn: T }), todo('b', { createdAt: '' }), todo('c')];
    expect(row(todos, c)).toMatchObject({ shown: 'added', sub: 'Added to today' });
    expect(row([todo('a', { doneOn: T }), todo('b', { createdAt: '', doneOn: T }), todo('c')], c)).toMatchObject({ sub: '1 of 2 done' });
    expect(row([todo('a', { doneOn: T }), todo('b', { createdAt: '', doneOn: T }), todo('c', { doneOn: T })], c)).toMatchObject({ shown: 'done' });
  });
  it('a phone whose clock runs behind the server’s: adding it keeps the whole list (it was losing it, and ending at once)', () => {
    // the three were saved by the server at 09:10 by its clock; this phone thinks it is 09:00 when Add is tapped
    const made = clock(T, 9, 10).toISOString();
    const todos = [todo('a', { createdAt: made }), todo('b', { createdAt: made }), todo('c', { createdAt: made })];
    const slot = { key: KEY, kind: 'day' as const, date: T, seed: 0 };
    const s0 = store({ ...list, state: 'offered' });
    const f0 = challengeFacts(readCaches(world(todos), true, ['2026-10', '2026-11'])!, s0, slot, T);
    expect(f0.todosNewest).toBe(made);
    const s1 = addChallenge(s0, slot, f0, ADDED);
    expect(s1.challenges[KEY]).toMatchObject({ state: 'added', target: 3, base: 0, at: made });
    const view = (rows: Todo[]) => boardOf(world(rows), s1, T, true, clock(T, 12))?.views[KEY] ?? null;
    expect(view(todos)).toMatchObject({ shown: 'added', sub: 'Added to today' });
    expect(view([{ ...todos[0]!, doneOn: T }, todos[1]!, todos[2]!])).toMatchObject({ sub: '1 of 3 done' });
    // one written a quarter of an hour later is still not one of the list's
    expect(view([{ ...todos[0]!, doneOn: T }, todos[1]!, todos[2]!, todo('x', { createdAt: clock(T, 9, 25).toISOString(), doneOn: T })])).toMatchObject({ sub: '1 of 3 done' });
  });
  it('a to-do checked off just before it was added is its base, whatever the two clocks say', () => {
    // done at 09:12 by the server's clock (made at 09:11), with two older ones open; this phone thinks it is 09:00
    const todos = [todo('a'), todo('b'), todo('z', { createdAt: clock(T, 9, 11).toISOString(), doneOn: T })];
    const slot = { key: KEY, kind: 'day' as const, date: T, seed: 0 };
    const s0 = store({ ...list, target: 2, state: 'offered' });
    const s1 = addChallenge(s0, slot, challengeFacts(readCaches(world(todos), true, ['2026-10', '2026-11'])!, s0, slot, T), ADDED);
    expect(s1.challenges[KEY]).toMatchObject({ state: 'added', target: 2, base: 1, at: clock(T, 9, 11).toISOString() });
    const view = (rows: Todo[]) => boardOf(world(rows), s1, T, true, clock(T, 12))?.views[KEY] ?? null;
    expect(view(todos)).toMatchObject({ sub: 'Added to today' });
    expect(view([{ ...todos[0]!, doneOn: T }, todos[1]!, todos[2]!])).toMatchObject({ sub: '1 of 2 done' });
    expect(view([{ ...todos[0]!, doneOn: T }, { ...todos[1]!, doneOn: T }, todos[2]!])).toMatchObject({ shown: 'done' });
  });
  it('when the times tell nothing (every to-do was given its time after the challenge was added), the counts stand', () => {
    // written offline before it was added, saved by the server an hour later with the server's time
    const todos = [later('a', { doneOn: T }), later('b'), later('c')];
    const f = challengeFacts(readCaches(world(todos), true, ['2026-10', '2026-11'])!, store(list), { key: KEY, kind: 'day', date: T, seed: 0 }, T);
    expect(f.list).toBeUndefined();
    expect(row(todos)).toMatchObject({ shown: 'added', sub: '1 of 3 done' });
    // and it never ends by itself while something of the day is there
    expect(row([later('b'), later('c')])).toMatchObject({ shown: 'added' });
  });
  it('an offer is read by the counts, as before: the list is only frozen when it is added', () => {
    const qc = world([todo('a'), todo('b'), later('x')]);
    const s = store({ ...list, state: 'offered' });
    const f = challengeFacts(readCaches(qc, true, ['2026-10', '2026-11'])!, s, { key: KEY, kind: 'day', date: T, seed: 0 }, T);
    expect(f.list).toBeUndefined();
    expect(f.todosOpen).toBe(3);
  });
});

describe('the real clock', () => {
  const habits: Challenge = { item: 'habits', target: 3, base: 0, state: 'added', at: ADDED.toISOString() };
  const checks = ['h1', 'h2', 'h3'].map((habitId) => ({ habitId, date: T, done: true, note: null }));
  const at = (now: Date, c: Challenge = habits, p: Partial<MonthBundle> = { checks }) => boardOf(world([], p), store(c), T, true, now)?.views[KEY] ?? null;
  it('past midnight, while Today still holds the day, the row is as it was until 03:00', () => {
    expect(at(clock(shiftDays(T, 1), 0, 30))).toMatchObject({ shown: 'done' });
    expect(at(clock(shiftDays(T, 1), 2, 59), habits, {})).toMatchObject({ shown: 'added' });
  });
  it('from 03:00 the day takes no taps and the engine settles nothing: no row, so nothing says Done that is not paid', () => {
    expect(at(clock(shiftDays(T, 1), 3, 2))).toBeNull();
    expect(at(clock(shiftDays(T, 1), 3, 2), habits, {})).toBeNull();
    expect(at(clock(shiftDays(T, 1), 3, 2), { ...habits, state: 'offered' }, {})).toBeNull();
    // one the engine settled in time keeps its row while Today holds the day
    const paid = boardOf(world([], { checks }), { ...store({ ...habits, state: 'done' }), once: { [KEY]: { on: T, n: 5 } } }, T, true, clock(shiftDays(T, 1), 3, 2));
    expect(paid?.views[KEY]).toMatchObject({ shown: 'done', sub: 'Done · 5 Orbs' });
  });
});

describe('the menu an answer is checked against', () => {
  it('holds only what could be added now', () => {
    // every habit already done: "Every habit today" asks nothing, so it is not something to pick
    const checks = ['h1', 'h2', 'h3'].map((habitId) => ({ habitId, date: T, done: true, note: null }));
    const offered: Challenge = { item: 'list', target: 2, base: 0, state: 'offered', at: ADDED.toISOString() };
    const board = boardOf(world([todo('a'), todo('b')], { checks }), store(offered), T, true, clock(T, 12))!;
    expect(board.menuOf(KEY).map((o) => o.item)).toEqual(['list']);
  });
});

describe('last week’s challenge, read on the Monday after', () => {
  const MON = '2026-11-16';
  const NEXT = shiftDays(MON, 7);
  const WEEK = `challenge:w:${MON}`;
  const slot = { key: WEEK, kind: 'week' as const, date: MON, seed: 0 };
  const days: Challenge = { item: 'days', target: 5, floor: 4, base: 0, state: 'added', at: clock(MON, 9).toISOString() };
  // four days of that week counted and closed: its floor
  const s: Rewards = { ...emptyRewards(U, '2026-10-05', undefined, '2026-10-05'), clock: NEXT, days: Object.fromEntries([0, 1, 2, 3].map((i) => [shiftDays(MON, i), { n: 1, a: 1, c: 1 as const }])), challenges: { [WEEK]: days } };
  const factsWith = (status: Bootstrap['user']['status']) => {
    const qc = world([]);
    qc.setQueryData(keys.bootstrap, { ...boot(), user: { ...boot().user, status } });
    return challengeFacts(readCaches(qc, true, ['2026-10', '2026-11'])!, s, slot, NEXT);
  };
  it('pays its floor', () => {
    const f = factsWith(null);
    expect(f.week).toMatchObject({ monday: MON, counted: 4, paused: 0 });
    expect(settleChallenges(s, { [WEEK]: f }, clock(NEXT, 8)).store.once[WEEK]).toEqual({ on: NEXT, n: 10 });
  });
  it('a status that starts this Monday does not reach back into it: it was ended with nothing paid', () => {
    const f = factsWith({ kind: 'sick', from: NEXT, until: null });
    expect(f.day.held).toBe(true);
    expect(f.week.paused).toBe(0);
    const settled = settleChallenges(s, { [WEEK]: f }, clock(NEXT, 8)).store;
    expect(settled.challenges[WEEK]!.state).toBe('done');
    expect(settled.once[WEEK]).toEqual({ on: NEXT, n: 10 });
  });
  it('a paused day inside the week still ends it, as before', () => {
    const paused: Rewards = { ...s, days: { ...s.days, [shiftDays(MON, 4)]: { n: 0, a: 0, h: 1, c: 1 } } };
    const qc = world([]);
    const f = challengeFacts(readCaches(qc, true, ['2026-10', '2026-11'])!, paused, slot, NEXT);
    expect(f.week.paused).toBe(1);
    expect(settleChallenges(paused, { [WEEK]: f }, clock(NEXT, 8)).store.challenges[WEEK]!.state).toBe('void');
  });
});

describe('Today’s one row, in a week whose Monday held a day challenge', () => {
  const MON = '2026-11-16';
  const TUE = shiftDays(MON, 1);
  const week: Challenge = { item: 'days', target: 3, floor: 2, base: 0, state: 'offered', at: clock(MON, 9).toISOString() };
  const today = (s: Rewards, day: string) => {
    const b = boardOf(world([]), s, day, true, clock(day, 12))!;
    return rowsFor('today', b.slots, b.views, b.today, b.offerDay).map((r) => r.key);
  };
  const base = { ...emptyRewards(U, '2026-10-05', undefined, '2026-10-05'), clock: TUE };
  it('the week’s offer has Tuesday: on Monday the day’s challenge had the row', () => {
    const s: Rewards = { ...base, challenges: { [`challenge:w:${MON}`]: week, [`challenge:d:${MON}`]: { item: 'habits', target: 3, base: 0, state: 'offered', at: clock(MON, 9).toISOString() } } };
    expect(today(s, MON)).toEqual([`challenge:d:${MON}`]);
    expect(today(s, TUE)).toEqual([`challenge:w:${MON}`]);
    expect(today(s, shiftDays(MON, 2))).toEqual([]);
    // skipped on Monday: still Tuesday's
    expect(today({ ...s, challenges: { ...s.challenges, [`challenge:d:${MON}`]: { ...s.challenges[`challenge:d:${MON}`]!, state: 'skipped' } } }, TUE)).toEqual([`challenge:w:${MON}`]);
  });
  it('in any other week it is Monday’s alone, as before', () => {
    const s: Rewards = { ...base, challenges: { [`challenge:w:${MON}`]: week } };
    expect(today(s, MON)).toEqual([`challenge:w:${MON}`]);
    expect(today(s, TUE)).toEqual([]);
  });
});

describe('the sheet reads the day its row stands on', () => {
  afterEach(() => {
    vi.useRealTimers();
    resetOrbsForTest();
  });
  const habits: Challenge = { item: 'habits', target: 3, base: 0, state: 'added', at: ADDED.toISOString() };
  const boardFor = (day?: string): Board | null => {
    let seen: Board | null = null;
    const Probe = () => {
      seen = useBoard(day);
      return null;
    };
    renderToStaticMarkup(createElement(QueryClientProvider, { client: world([]) }, createElement(Probe)));
    return seen;
  };
  it('past midnight Today still holds the day and shows its row: the sheet opened from it is for that day, not the clock’s (it opened and closed at once)', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(clock(shiftDays(T, 1), 0, 20));
    resetOrbsForTest();
    openOrbs(U);
    setOrbs(store(habits));
    // by the clock's own day there is no such slot today
    expect(boardFor()?.live[KEY]).toBeUndefined();
    // by the day the row stands on, there is, and it is shown
    const held = boardFor(T);
    expect(held?.today).toBe(T);
    expect(held?.live[KEY]?.view).toMatchObject({ shown: 'added', title: 'Every habit today' });
  });
});
