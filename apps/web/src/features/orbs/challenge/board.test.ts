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
