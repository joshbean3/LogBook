import { emptyRewards, parseISO, reconcile, RULES, shiftDays, totalOf, type Aim, type DayFacts, type Habit, type HabitCheck, type Learning, type Rewards, type Session, type Todo } from '@logbook/shared';
import { QueryClient, type InfiniteData } from '@tanstack/react-query';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bootstrap, MonthBundle } from '@/api/types';

/**
 * Orbs on the phone, end to end without a screen: the caches change as the app's own mutations change them, the
 * reconciler reads them through the one adapter, the store follows, the event is published, and the account's copy is
 * synced only where the server keeps one. The server is a stand-in for `api()`; the device is two memory storages and the
 * few parts of `window` and `document` the modules listen on.
 */
const api = vi.fn<(path: string, init?: { method?: string; json?: unknown }) => Promise<unknown>>();
vi.mock('@/api/client', async (orig) => ({ ...(await orig<typeof import('@/api/client')>()), api: (path: string, init?: { method?: string; json?: unknown }) => api(path, init) }));
const toasts: string[] = [];
vi.mock('@/ui/toastStore', async (orig) => ({ ...(await orig<typeof import('@/ui/toastStore')>()), showToast: (text: string) => void toasts.push(text) }));
vi.mock('idb-keyval', () => ({ get: async () => undefined, set: async () => undefined, del: async () => undefined, clear: async () => undefined }));

// ---------- the device ----------
class MemStorage {
  m = new Map<string, string>();
  writes = 0;
  broken = false;
  get length() {
    return this.m.size;
  }
  key = (i: number) => [...this.m.keys()][i] ?? null;
  getItem = (k: string) => {
    if (this.broken) throw new Error('storage refused');
    return this.m.get(k) ?? null;
  };
  setItem = (k: string, v: string) => {
    if (this.broken) throw new Error('storage refused');
    this.writes++;
    this.m.set(k, String(v));
  };
  removeItem = (k: string) => void this.m.delete(k);
}
type Listener = (e: unknown) => void;
const hub = () => {
  const on = new Map<string, Set<Listener>>();
  return {
    on,
    addEventListener: (t: string, f: Listener) => void (on.get(t) ?? on.set(t, new Set()).get(t)!).add(f),
    removeEventListener: (t: string, f: Listener) => void on.get(t)?.delete(f),
    fire: (t: string, e: unknown = {}) => [...(on.get(t) ?? [])].forEach((f) => f(e)),
  };
};
const g = globalThis as unknown as Record<string, unknown>;
let local: MemStorage;
let win: ReturnType<typeof hub> & { dispatchEvent: (e: Event) => boolean; localStorage: MemStorage; sessionStorage: MemStorage };
let doc: ReturnType<typeof hub> & { hidden: boolean };
const events: Array<{ gained: Array<{ key: string; n: number; date: string }>; total: number; today: number }> = [];

// ---------- the account ----------
const U = 'u_owner';
const TODAY = shiftDays(RULES.startsOn, 23); // a Wednesday, three weeks and two days in
const Y = shiftDays(TODAY, -1);
const MONTH = TODAY.slice(0, 7);
const noon = (date: string, hour = 12) => {
  const d = parseISO(date);
  d.setHours(hour, 0, 0, 0);
  return d;
};
const habit = (id: string, name: string, p: Partial<Habit> = {}): Habit => ({ id, name, position: 0, createdOn: '2026-01-01', archivedOn: null, ...p });
const boot = (p: Partial<Bootstrap['user']> = {}, habits: Habit[] = [habit('h1', 'Read'), habit('h2', 'Walk'), habit('h3', 'Stretch')]): Bootstrap =>
  ({
    user: { id: U, email: 'owner@example.com', onboardedAt: '2026-01-01T12:00:00.000Z', status: null, ...p },
    habits,
    blocks: [],
    morningSettings: { wake: 390, run: { pace: 540 } },
    zones: null,
    strava: { connected: false },
    features: { claude: false, strava: false },
    consent: { training: false, health: null, recall: false, reads: false, at: null, version: null },
    trainWhen: null,
  }) as unknown as Bootstrap;
const month = (m: string, p: Partial<MonthBundle> = {}): MonthBundle => ({ month: m, sessions: [], checks: [], lifts: [], activities: [], morningDays: {}, journal: [], coach: [], ...p });
const check = (habitId: string, date: string, done = true): HabitCheck => ({ habitId, date, done, note: null });
const todo = (id: string, p: Partial<Todo> = {}): Todo => ({ id, text: `do ${id}`, note: null, priority: 0, color: null, groupId: null, due: null, bucket: 'today', position: 0, createdOn: shiftDays(TODAY, -3), doneOn: null, deletedOn: null, createdAt: '2026-12-01T10:00:00.000Z', ...p });
const session = (id: string, date: string, p: Partial<Session> = {}): Session => ({ id, date, position: 0, kind: 'run', type: 'Easy', title: null, details: null, miles: 4, minutes: null, blockId: null, movedFrom: null, mark: null, ...p });
const goalOf = (level: Aim['level'], period: string, p: Partial<Aim> = {}): Aim => ({ id: `g-${level}`, level, period, text: 'Write the outline', original: null, why: null, status: 'open', reflection: null, steps: [], createdAt: noon(shiftDays(TODAY, -10)).toISOString(), updatedAt: '', closedAt: null, ...p });
const lines = (...rows: Learning[]): InfiniteData<{ learnings: Learning[]; next: string | null }, string | null> => ({ pages: [{ learnings: rows, next: null }], pageParams: [null] });

interface Launch {
  /** What storage holds for the Orbs key before the app starts. */
  stored?: Rewards | string | null;
  /** The cached bootstrap (null: nobody signed in). */
  boot?: Bootstrap | null;
  /** Leave the caches empty (a cold open before anything has loaded). */
  bare?: boolean;
}
const launch = async (o: Launch = {}) => {
  vi.resetModules();
  local = new MemStorage();
  const session = new MemStorage();
  win = Object.assign(hub(), {
    localStorage: local,
    sessionStorage: session,
    dispatchEvent: (e: Event) => {
      if (e.type === 'logbook:orbs-gained') events.push((e as CustomEvent).detail);
      win.fire(e.type, e);
      return true;
    },
  });
  doc = Object.assign(hub(), { hidden: false });
  Object.assign(g, { window: win, document: doc, localStorage: local, sessionStorage: session });
  local.setItem('logbook.user', U);
  if (o.stored) local.setItem('logbook.orbs', typeof o.stored === 'string' ? o.stored : JSON.stringify(o.stored));
  local.writes = 0;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } } });
  const b = o.boot === undefined ? boot() : o.boot;
  if (b) qc.setQueryData(['bootstrap'], b);
  if (!o.bare) {
    qc.setQueryData(['month', MONTH], month(MONTH));
    qc.setQueryData(['todos'], []);
    qc.setQueryData(['goals'], []);
  }
  const store = await import('./store');
  const engine = await import('./engine');
  const sync = await import('./sync');
  const intake = await import('./intake');
  const queries = await import('@/api/queries');
  const patchMonth = (fn: (b: MonthBundle) => Partial<MonthBundle>) => qc.setQueryData<MonthBundle>(['month', MONTH], (m) => ({ ...m!, ...fn(m!) }));
  return { qc, store, engine, sync, intake, queries, patchMonth, run: () => engine.reconcileNow(qc) };
};
/** A store that already exists on the device, a day old, so nothing needs rebuilding. */
const existing = (p: Partial<Rewards> = {}): Rewards => ({ ...emptyRewards(U, RULES.startsOn), clock: Y, ...p });
const settle = async (n = 6) => {
  for (let i = 0; i < n; i++) await Promise.resolve();
};

beforeEach(async () => {
  // the stand-in for the client is one module for the whole file: each test starts with no Sign out hooks from the last
  (await import('@/api/client')).beforeSignOut.clear();
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(noon(TODAY));
  api.mockReset();
  api.mockRejectedValue(Object.assign(new Error('Not found'), { status: 404 }));
  toasts.length = 0;
  events.length = 0;
});
afterEach(() => {
  vi.useRealTimers();
  for (const k of ['window', 'document', 'localStorage', 'sessionStorage']) delete g[k];
});

describe('the reconciler reads the caches and the store follows', () => {
  it('a habit checked in the cache is an Orb, and the gain is published with its exact shape', async () => {
    const k = await launch({ stored: existing() });
    k.run(); // the first pass of a session is quiet: what it finds was not earned just now
    expect(events).toEqual([]);
    k.patchMonth((m) => ({ checks: [...m.checks, check('h1', TODAY)] }));
    expect(k.run()).toEqual([{ key: 'habit', n: 1, date: TODAY }]);
    expect(k.store.getOrbs()?.days[TODAY]).toEqual({ n: 1, a: 1, k: { habit: 1 } });
    expect(events).toEqual([{ gained: [{ key: 'habit', n: 1, date: TODAY }], total: 1, today: 1 }]);
    // nothing changed: nothing runs, nothing is said, the store is the same object
    const before = k.store.getOrbs();
    expect(k.run()).toEqual([]);
    expect(k.store.getOrbs()).toBe(before);
    expect(events).toHaveLength(1);
  });
  it('everything a day can hold, through the one adapter', async () => {
    const k = await launch({ stored: existing() });
    k.run();
    k.qc.setQueryData(['todos'], [todo('t1', { doneOn: TODAY }), todo('t2', { doneOn: TODAY, createdOn: TODAY }), todo('t3')]);
    k.qc.setQueryData(['goals'], [goalOf('day', TODAY, { status: 'done', createdAt: noon(TODAY, 7).toISOString() })]);
    k.qc.setQueryData(['learnings', 'list', { month: MONTH, q: null }], lines({ id: 'l1', date: TODAY, text: 'Slow is smooth.', createdAt: '', editedAt: null }));
    k.patchMonth(() => ({ checks: [check('h1', TODAY), check('h2', TODAY), check('h3', TODAY)], sessions: [session('s1', TODAY, { mark: 'done' })] }));
    k.run();
    expect(k.store.getOrbs()?.days[TODAY]).toEqual({ n: 2 + 3 + 3 + 3 + 5, a: 2 + 3 + 1 + 1 + 1, k: { todo: 2, habit: 3, 'train:run': 3, 'goal:day': 3, full: 5 } });
    expect(events.at(-1)).toMatchObject({ total: 16, today: 16 });
    expect(events.at(-1)?.gained.map((x) => x.key)).toEqual(['todo', 'habit', 'train:run', 'goal:day', 'full']);
  });
  it('a row under its provisional id and then the server’s id is the same Orb, once', async () => {
    const k = await launch({ stored: existing(), boot: boot({}, [habit('tmp-1765000000000', 'New habit', { createdOn: Y })]) });
    k.run();
    k.patchMonth(() => ({ checks: [check('tmp-1765000000000', TODAY)] }));
    k.qc.setQueryData(['todos'], [todo('tmp-a1b2c3', { doneOn: TODAY })]);
    expect(k.run().map((x) => x.key)).toEqual(['todo', 'habit']);
    const before = k.store.getOrbs();
    // the server names them
    k.qc.setQueryData(['bootstrap'], boot({}, [habit('h_91', 'New habit', { createdOn: Y })]));
    k.patchMonth(() => ({ checks: [check('h_91', TODAY)] }));
    k.qc.setQueryData(['todos'], [todo('t_77', { doneOn: TODAY })]);
    expect(k.run()).toEqual([]);
    expect(k.store.getOrbs()).toBe(before);
    expect(events).toHaveLength(1);
    expect(JSON.stringify(k.store.getOrbs())).not.toMatch(/tmp-|h_91|t_77/);
  });
  it('a write the server refused takes its Orb with it, and an untick is silent', async () => {
    const k = await launch({ stored: existing() });
    k.run();
    k.patchMonth(() => ({ checks: [check('h1', TODAY), check('h2', TODAY)] }));
    k.run();
    expect(k.store.getOrbs()?.days[TODAY]?.n).toBe(2);
    // the outbox dropped the second check (a 404, a 422): the mutation's onError refetches the month without it
    k.patchMonth(() => ({ checks: [check('h1', TODAY)] }));
    expect(k.run()).toEqual([]);
    expect(k.store.getOrbs()?.days[TODAY]?.n).toBe(1);
    expect(events).toHaveLength(1);
    k.patchMonth(() => ({ checks: [check('h1', TODAY, false)] }));
    k.run();
    expect(k.store.getOrbs()?.days[TODAY]).toBeUndefined();
  });
  it('back-filling two days ago changes nothing; yesterday takes only a run that synced', async () => {
    const k = await launch({ stored: existing() });
    k.run();
    const two = shiftDays(TODAY, -2);
    k.patchMonth(() => ({ checks: [check('h1', two), check('h2', two), check('h1', Y)], lifts: [{ id: 'x', date: two, exercise: 'Squat', weight: 100, reps: 5, createdAt: '' }], sessions: [session('s0', two, { mark: 'done' }), session('s1', Y, { kind: 'lift', mark: 'done' })] }));
    k.qc.setQueryData(['todos'], [todo('t1', { doneOn: two }), todo('t2', { doneOn: Y })]);
    expect(k.run()).toEqual([]);
    expect(k.store.getOrbs()?.days).toEqual({});
    // a run arrives for yesterday by refetch: it counts today
    k.patchMonth((m) => ({ activities: [{ id: 'a1', date: Y, time: '07:00', name: 'Run', sportType: 'Run', kind: 'run', miles: 4, movingSec: 2000, elevFt: 0, avgHr: null, maxHr: null, cadence: null, laps: null, perfAt: null, polyline: null }], sessions: [...m.sessions, session('s2', Y)] }));
    expect(k.run()).toEqual([{ key: 'train:run', n: 3, date: Y }]);
    expect(k.store.getOrbs()?.days[Y]).toEqual({ n: 3, a: 1, k: { 'train:run': 3 } });
  });
  it('reads through the Fitness filter: with Fitness off a done session is no fact', async () => {
    const k = await launch({ stored: existing() });
    const prefs = await import('@/lib/prefs');
    prefs.setFitness(false);
    k.run();
    k.patchMonth(() => ({ sessions: [session('s1', TODAY, { mark: 'done' })], checks: [check('h1', TODAY)] }));
    k.run();
    expect(k.store.getOrbs()?.days[TODAY]).toEqual({ n: 1, a: 1, k: { habit: 1 } });
    prefs.setFitness(true);
    k.run();
    expect(k.store.getOrbs()?.days[TODAY]?.k).toEqual({ habit: 1, 'train:run': 3 });
    // off again mid-day: what was earned stays, and nothing is added
    prefs.setFitness(false);
    k.run();
    expect(k.store.getOrbs()?.days[TODAY]?.k).toEqual({ habit: 1, 'train:run': 3 });
  });
  it('a paused day is marked, and a status that ends is forgotten for the days after it', async () => {
    const k = await launch({ stored: existing(), boot: boot({ status: { kind: 'sick', from: Y, until: null } }) });
    k.run();
    expect(k.store.getOrbs()?.days[TODAY]).toEqual({ n: 0, a: 0, h: 1 });
  });
  it('days under a status that the phone never saw (the app stayed closed) are paused, not missed', async () => {
    // last opened four days ago; sick from three days ago until yesterday
    const D4 = shiftDays(TODAY, -4);
    const k = await launch({ stored: existing({ clock: D4, days: { [D4]: { n: 1, a: 1, k: { habit: 1 } } } }), boot: boot({ status: { kind: 'sick', from: shiftDays(TODAY, -3), until: Y } }) });
    k.run();
    const days = k.store.getOrbs()!.days;
    expect(days[shiftDays(TODAY, -3)]).toEqual({ n: 0, a: 0, c: 1, h: 1 });
    expect(days[shiftDays(TODAY, -2)]).toEqual({ n: 0, a: 0, c: 1, h: 1 });
    expect(days[Y]).toEqual({ n: 0, a: 0, h: 1 });
    expect(days[TODAY]).toBeUndefined();
    expect(days[D4]).toEqual({ n: 1, a: 1, k: { habit: 1 }, c: 1 });
  });
  it('a stored store with days that have not happened is cut once the server’s date is known', async () => {
    const future = shiftDays(TODAY, 200);
    const k = await launch({ stored: existing({ days: { [Y]: { n: 2, a: 2, k: { habit: 2 } }, [future]: { n: 27, a: 9, c: 1 } }, keepsakes: { 'days:100': { on: future } } }) });
    k.run();
    // nothing is known yet: the store stands as it was read
    expect(k.store.getOrbs()!.days[future]).toBeDefined();
    k.intake.takeBootstrap({ rewards: null, serverTime: new Date().toISOString() });
    k.run();
    const s = k.store.getOrbs()!;
    expect(s.days[future]).toBeUndefined();
    expect(s.keepsakes['days:100']).toBeUndefined();
    expect(s.days[Y]?.n).toBe(2);
    // and a clock in the future, which shuts every day out, comes back to the last day that can be
    const stuck = await launch({ stored: existing({ clock: future, days: { [Y]: { n: 2, a: 2, k: { habit: 2 }, c: 1 } } }) });
    stuck.intake.takeBootstrap({ rewards: null, serverTime: new Date().toISOString() });
    stuck.patchMonth(() => ({ checks: [check('h1', TODAY)] }));
    stuck.run();
    expect(stuck.store.getOrbs()!.clock <= shiftDays(TODAY, 1)).toBe(true);
    expect(stuck.store.getOrbs()!.days[TODAY]).toEqual({ n: 1, a: 1, k: { habit: 1 } });
  });
  it('a month that has not loaded is not an empty day: the stored day stands until its facts are there', async () => {
    const stored = existing({ clock: TODAY, days: { [TODAY]: { n: 4, a: 4, k: { habit: 4 } } } });
    const k = await launch({ stored, bare: true });
    expect(k.run()).toEqual([]);
    expect(k.store.getOrbs()?.days[TODAY]?.n).toBe(4);
    // the caches arrive (the saved copy is read, then the network answers): the day agrees, and nothing pops on open
    k.qc.setQueryData(['todos'], []);
    k.qc.setQueryData(['goals'], []);
    k.qc.setQueryData(['month', MONTH], month(MONTH, { checks: ['h1', 'h2', 'h3'].map((h) => check(h, TODAY)) }));
    expect(k.run()).toEqual([]);
    expect(k.store.getOrbs()?.days[TODAY]?.n).toBe(3);
    expect(events).toEqual([]);
  });
  it('pays a week goal once from the goals cache, and adds the keepsakes that are due', async () => {
    const monday = shiftDays(TODAY, -2);
    const k = await launch({ stored: existing() });
    k.run();
    k.qc.setQueryData(['goals'], [goalOf('week', monday, { status: 'done' })]);
    expect(k.run()).toEqual([{ key: `goal:week:${monday}`, n: 9, date: TODAY }]);
    expect(k.store.getOrbs()?.keepsakes.first).toEqual({ on: TODAY });
    expect(k.store.pendingMoments().map((m) => m.key)).toEqual([`goal:week:${monday}`]);
    expect(k.store.newKeys().sort()).toEqual(['first', `goal:week:${monday}`].sort());
    k.store.markSeen(`goal:week:${monday}`);
    expect(k.store.pendingMoments()).toEqual([]);
    expect(k.store.newKeys()).toEqual(['first']);
    // the goal renamed by the server, or cleared and set again: still once
    k.qc.setQueryData(['goals'], [goalOf('week', monday, { status: 'done', id: 'g_server' })]);
    expect(k.run()).toEqual([]);
    expect(totalOf(k.store.getOrbs()!)).toBe(9);
  });
  it('a chapter that closed before the journal’s list had loaded takes its line when the list answers', async () => {
    // three weeks and two days in: the first chapter closes on the fourth Monday, five days from TODAY
    const monday = shiftDays(RULES.startsOn, 28);
    vi.setSystemTime(noon(monday, 9));
    const days = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [shiftDays(RULES.startsOn, Math.floor(i / 5) * 7 + (i % 5)), { n: 1, a: 1, k: { habit: 1 }, c: 1 as const }]));
    const k = await launch({ stored: existing({ clock: shiftDays(monday, -1), days }) });
    k.qc.setQueryData(['month', monday.slice(0, 7)], month(monday.slice(0, 7)));
    k.run();
    const key = `chapter:${RULES.startsOn}`;
    expect(k.store.getOrbs()!.keepsakes[key]).toEqual({ on: monday, d: 20, s: 0, g: 0 });
    // the journal answers a moment later
    k.qc.setQueryData(['learnings', 'list', { month: null, q: null }], lines({ id: 'l1', date: shiftDays(RULES.startsOn, 9), text: 'Ask sooner.', createdAt: '', editedAt: null }));
    k.run();
    expect(k.store.getOrbs()!.keepsakes[key]).toEqual({ on: monday, d: 20, s: 0, g: 0, t: 'Ask sooner.' });
  });
  it('a weekly bonus that came due while the app was closed is said on the first pass, though the days are not', async () => {
    // last week: five counted days, closed. It is Wednesday: the bonus is due.
    const monday = shiftDays(TODAY, -9);
    const days = Object.fromEntries([0, 1, 2, 3, 4].map((i) => [shiftDays(monday, i), { n: 2, a: 2, k: { habit: 2 }, c: 1 as const }]));
    const k = await launch({ stored: existing({ startedOn: monday, clock: shiftDays(monday, 6), days }) });
    k.patchMonth(() => ({ checks: [check('h1', TODAY)] }));
    expect(k.run()).toEqual([{ key: `week:${monday}`, n: 5, date: TODAY }]);
    // today holds a habit and the comeback (four days away), neither announced on this quiet pass
    expect(events).toEqual([{ gained: [{ key: `week:${monday}`, n: 5, date: TODAY }], total: 19, today: 4 }]);
    expect(k.store.getOrbs()?.days[TODAY]).toEqual({ n: 4, a: 1, k: { habit: 1, back: 3 } });
    expect(k.run()).toEqual([]);
  });
  it('earns nothing while Orbs are switched off, and the switch travels in the store', async () => {
    const k = await launch({ stored: existing() });
    k.run();
    k.store.setSwitches({ on: false });
    k.patchMonth(() => ({ checks: [check('h1', TODAY)] }));
    expect(k.run()).toEqual([]);
    expect(k.store.getOrbs()?.days[TODAY]).toBeUndefined();
    expect(k.store.getOrbs()?.off).toEqual([{ from: TODAY, to: null }]);
    expect(k.store.getOrbs()?.set.on).toBe(false);
  });
});

describe('once per frame', () => {
  it('ten changes to the caches in one frame are one reconcile', async () => {
    const k = await launch({ stored: existing() });
    const stop = k.engine.startOrbs(k.qc);
    vi.advanceTimersByTime(20);
    for (let i = 0; i < 10; i++) k.patchMonth((m) => ({ checks: [...m.checks, check(`h${(i % 3) + 1}`, TODAY)] }));
    k.qc.setQueryData(['todos'], [todo('t1', { doneOn: TODAY })]);
    // nothing has run yet: a tap pays nothing for Orbs on its own frame
    expect(k.store.getOrbs()?.days[TODAY]).toBeUndefined();
    vi.advanceTimersByTime(20);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ gained: [{ key: 'todo', n: 1, date: TODAY }, { key: 'habit', n: 3, date: TODAY }], total: 4, today: 4 });
    // a cache the day's facts are not read from wakes nothing
    const before = k.store.getOrbs();
    k.qc.setQueryData(['daily'], { date: TODAY });
    k.qc.setQueryData(['reads'], []);
    vi.advanceTimersByTime(40);
    expect(k.store.getOrbs()).toBe(before);
    stop();
    k.patchMonth(() => ({ checks: [] }));
    vi.advanceTimersByTime(40);
    expect(k.store.getOrbs()).toBe(before);
  });
  it('costs nothing measurable: a reconcile of two open days is well under 1 ms', async () => {
    // a year of history, a full month of checks, 400 to-dos, two days open
    let s = emptyRewards(U, RULES.startsOn);
    const f = (date: string): DayFacts => ({ date, todosDone: 2, todosEarlier: 2, habitsLive: 3, habitsDone: 3, lines: 1, train: { run: 'done' }, trainRequired: true, trainLeft: 0, goalDay: 'done', held: false });
    for (let i = 0; i < 365; i++) s = reconcile(s, i % 7 < 5 ? [f(shiftDays(RULES.startsOn, i))] : [], noon(shiftDays(RULES.startsOn, i))).store;
    const day = shiftDays(RULES.startsOn, 365);
    const m = day.slice(0, 7);
    const k = await launch({ stored: s });
    // the real clock and the real Date from here: a faked Date is several times slower than the phone's, and every date
    // step in the rules makes one. The day is handed to the reconciler instead.
    vi.useRealTimers();
    const now = noon(day);
    const days = Array.from({ length: 28 }, (_, i) => `${m}-${String(i + 1).padStart(2, '0')}`);
    k.qc.setQueryData(['month', m], month(m, { checks: days.flatMap((d) => ['h1', 'h2', 'h3'].map((h) => check(h, d))), sessions: days.map((d) => session(`s-${d}`, d, { mark: 'done' })) }));
    k.qc.setQueryData(['month', shiftDays(day, -28).slice(0, 7)], month(shiftDays(day, -28).slice(0, 7)));
    k.qc.setQueryData(['todos'], Array.from({ length: 400 }, (_, i) => todo(`t${i}`, { doneOn: i < 3 ? day : i < 200 ? shiftDays(day, -(i % 90) - 2) : null })));
    k.qc.setQueryData(['goals'], Array.from({ length: 60 }, (_, i) => goalOf('day', shiftDays(day, -i), { id: `g${i}`, status: 'done', createdAt: noon(shiftDays(day, -i), 7).toISOString() })));
    k.engine.reconcileNow(k.qc, now);
    const performance = (globalThis as { performance: { now: () => number } }).performance;
    const times: number[] = [];
    for (let i = 0; i < 300; i++) {
      // a tap: one check flips, as `useHabitMutations().check` writes it
      k.qc.setQueryData<MonthBundle>(['month', m], (b) => ({ ...b!, checks: b!.checks.map((c) => (c.date === day && c.habitId === 'h1' ? { ...c, done: i % 2 === 0 } : c)) }));
      const t0 = performance.now();
      k.engine.reconcileNow(k.qc, now);
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    const median = times[150]!;
    const p95 = times[285]!;
    console.info(`orbs reconcile, two open days, 365 days of history: median ${median.toFixed(3)} ms, p95 ${p95.toFixed(3)} ms`);
    expect(median).toBeLessThan(1);
    expect(k.store.getOrbs()?.days[day]?.n).toBeGreaterThan(0);
  });
});

describe('the store on the device', () => {
  it('is read as untrusted, and only for the signed-in account', async () => {
    for (const stored of ['not json', '[]', '{"v":7}', JSON.stringify({ ...existing(), days: { nope: 1 } }), JSON.stringify({ ...existing({ days: { [Y]: { n: 9, a: 9, c: 1 } } }), userId: 'u_someone_else' })]) {
      const k = await launch({ stored });
      expect(k.store.openOrbs(U)).toBeNull();
      expect(k.store.getOrbs()).toBeNull();
    }
    const k = await launch({ stored: existing({ days: { [Y]: { n: 2, a: 2, c: 1 } } }) });
    expect(k.store.openOrbs(U)?.days[Y]?.n).toBe(2);
  });
  it('another account’s store is never used, never sent, and nothing is reconciled for an account that is not this device’s', async () => {
    const theirs = { ...existing({ days: { [Y]: { n: 9, a: 9, c: 1 } } }), userId: 'u_someone_else' };
    const k = await launch({ stored: theirs });
    // the device last ran for someone else: the shell wipes it and reloads; until then nothing is touched
    local.setItem('logbook.user', 'u_someone_else');
    k.intake.takeBootstrap({ rewards: null, serverTime: new Date().toISOString() });
    k.patchMonth(() => ({ checks: [check('h1', TODAY)] }));
    expect(k.run()).toEqual([]);
    expect(k.store.getOrbs()).toBeNull();
    await settle();
    vi.advanceTimersByTime(10_000);
    await settle();
    expect(api).not.toHaveBeenCalled();
    expect(local.getItem('logbook.orbs')).toBe(JSON.stringify(theirs));
  });
  it('is never written in a tap: only when idle, or when the page is hidden', async () => {
    const k = await launch({ stored: existing() });
    k.run();
    local.writes = 0;
    k.patchMonth(() => ({ checks: [check('h1', TODAY)] }));
    k.run();
    expect(local.writes).toBe(0);
    vi.advanceTimersByTime(700);
    expect(local.writes).toBe(1);
    expect(JSON.parse(local.getItem('logbook.orbs')!).days[TODAY].n).toBe(1);
    // hidden: at once
    k.patchMonth(() => ({ checks: [check('h1', TODAY), check('h2', TODAY)] }));
    k.run();
    doc.hidden = true;
    doc.fire('visibilitychange');
    expect(JSON.parse(local.getItem('logbook.orbs')!).days[TODAY].n).toBe(2);
    // one key for the store, one for the switches, both wiped with the account, neither inside prefs
    k.store.setSwitches({ weekTarget: 4 });
    expect([...local.m.keys()].filter((key) => key.includes('orbs')).sort()).toEqual(['logbook.orbs', 'logbook.orbs.set']);
    expect(local.getItem('logbook.prefs') ?? '').not.toMatch(/weekTarget|orbs/i);
    const account = await import('@/lib/account');
    account.sweepStorage();
    expect([...local.m.keys()].filter((key) => key.includes('orbs'))).toEqual([]);
  });
  it('storage that refuses does not stop anything', async () => {
    const k = await launch({ stored: existing() });
    k.store.openOrbs(U);
    local.broken = true;
    k.patchMonth(() => ({ checks: [check('h1', TODAY)] }));
    expect(() => k.run()).not.toThrow();
    expect(() => vi.advanceTimersByTime(3000)).not.toThrow();
    expect(() => k.store.setSwitches({ show: false })).not.toThrow();
    expect(k.store.getOrbs()?.days[TODAY]?.n).toBe(1);
    expect(k.store.getSwitches().show).toBe(false);
  });
  it('the switches are this device’s own, and the newest change from another phone is taken', async () => {
    const k = await launch({ stored: existing() });
    k.store.openOrbs(U);
    k.store.setSwitches({ weekTarget: 4, size: 'bold' });
    expect(JSON.parse(local.getItem('logbook.orbs.set')!)).toMatchObject({ on: true, show: true, weekTarget: 4, cadence: 1, size: 'bold' });
    expect(k.store.getOrbs()?.set).toMatchObject({ weekTarget: 4, size: 'bold' });
    // the merged store carries a later change
    const later = new Date(Date.now() + 60_000).toISOString();
    k.store.setOrbs({ ...k.store.getOrbs()!, set: { ...k.store.getOrbs()!.set, weekTarget: 3, at: later } });
    expect(k.store.getSwitches().weekTarget).toBe(3);
    expect(JSON.parse(local.getItem('logbook.orbs.set')!).weekTarget).toBe(3);
    // an older one is not
    k.store.setOrbs({ ...k.store.getOrbs()!, set: { ...k.store.getOrbs()!.set, weekTarget: 5, at: '2026-01-01T00:00:00.000Z' }, seen: { x: TODAY } });
    expect(k.store.getSwitches().weekTarget).toBe(3);
  });
  it('the source keeps its promises: no storage outside the two keys, no outbox, no id in what is stored', () => {
    const read = (f: string) => readFileSync(join(__dirname, f), 'utf8');
    expect(read('sync.ts')).not.toMatch(/from '@\/api\/outbox'|\bwrite\(/);
    expect(read('engine.ts')).not.toMatch(/localStorage|sessionStorage/);
    expect(read('sync.ts')).not.toMatch(/localStorage|sessionStorage/);
    expect(read('store.ts').match(/'logbook\.[a-z.]+'/g)).toEqual(["'logbook.orbs'", "'logbook.orbs.set'"]);
  });
});

describe('after a wipe', () => {
  const serve = (routes: Record<string, unknown>) =>
    api.mockImplementation(async (path, init) => {
      if ((init?.method ?? 'GET') !== 'GET') throw Object.assign(new Error('Not found'), { status: 404 });
      const hit = Object.keys(routes).find((r) => path.startsWith(r));
      if (!hit) throw Object.assign(new Error('Not found'), { status: 404 });
      return structuredClone(routes[hit]);
    });
  const history = () => {
    const from = RULES.startsOn;
    const checks: HabitCheck[] = [];
    for (let d = from; d < TODAY; d = shiftDays(d, 1)) if (parseISO(d).getDay() !== 0) checks.push(check('h1', d), check('h2', d));
    const byMonth = (m: string) => month(m, { checks: checks.filter((c) => c.date.startsWith(m)) });
    const months = [...new Set(checks.map((c) => c.date.slice(0, 7)))];
    return { months, routes: { ...Object.fromEntries(months.map((m) => [`/months/${m}`, byMonth(m)])), '/todos': [todo('t1', { doneOn: shiftDays(TODAY, -5) })], '/goals': [], '/learnings': { learnings: [], next: null } }, days: checks.length / 2 };
  };
  it('waits for this session’s first answer from the network, then rebuilds from the account’s own facts (the older server)', async () => {
    const h = history();
    serve(h.routes);
    const k = await launch({ stored: null, bare: true });
    // nothing from the network yet (a cold open from the saved copy, offline): no store, and no request
    k.run();
    await settle();
    expect(k.store.getOrbs()).toBeNull();
    expect(api).not.toHaveBeenCalled();
    // the bootstrap answers, from a server that has never heard of rewards
    k.intake.takeBootstrap({ serverTime: new Date().toISOString() });
    k.run();
    await vi.waitFor(() => expect(k.store.getOrbs()).not.toBeNull());
    const s = k.store.getOrbs()!;
    expect(s).toMatchObject({ userId: U, startedOn: RULES.startsOn, clock: TODAY });
    expect(Object.keys(s.days)).toHaveLength(h.days);
    expect(Object.values(s.days).every((r) => r.c === 1 && r.r === 1)).toBe(true);
    // at least the base total: two habits a day, and the one to-do
    expect(totalOf(s)).toBe(h.days * 2 + 1);
    // only reads the old server has, never a rewards route, and nothing was said
    expect(api.mock.calls.map(([p]) => p).filter((p) => p.includes('rewards'))).toEqual([]);
    expect(api.mock.calls.every(([, init]) => (init?.method ?? 'GET') === 'GET')).toBe(true);
    expect(toasts).toEqual([]);
    // the rebuild itself is quiet; today then earns as usual
    k.run();
    expect(events).toEqual([]);
    k.qc.setQueryData<MonthBundle>(['month', MONTH], (m) => ({ ...m!, checks: [...m!.checks, check('h1', TODAY)] }));
    expect(k.run()).toEqual([{ key: 'habit', n: 1, date: TODAY }]);
  });
  it('a reinstalled phone takes the switches the account holds; a phone with switches of its own keeps them', async () => {
    const kept = existing({ set: { on: true, show: false, weekTarget: 3, cadence: 2, size: 'bold', at: '2026-12-01T09:00:00.000Z' } });
    const fresh = await launch({ stored: null });
    fresh.intake.takeBootstrap({ rewards: kept, serverTime: new Date().toISOString() });
    fresh.run();
    await vi.waitFor(() => expect(fresh.store.getOrbs()).not.toBeNull());
    expect(fresh.store.getSwitches()).toMatchObject({ show: false, weekTarget: 3, cadence: 2, size: 'bold' });
    expect(JSON.parse(local.getItem('logbook.orbs.set')!).weekTarget).toBe(3);
    const own = await launch({ stored: null });
    own.store.setSwitches({ weekTarget: 4 });
    own.intake.takeBootstrap({ rewards: kept, serverTime: new Date().toISOString() });
    own.run();
    await vi.waitFor(() => expect(own.store.getOrbs()).not.toBeNull());
    expect(own.store.getSwitches().weekTarget).toBe(4);
    expect(own.store.getOrbs()?.set.weekTarget).toBe(4);
  });
  it('takes the account’s copy when the server keeps one, and never asks for a rewards route to do it', async () => {
    const kept = existing({ clock: TODAY, days: { [Y]: { n: 7, a: 5, k: { habit: 4, 'goal:day': 3 }, c: 1 } }, once: { [`week:${RULES.startsOn}`]: { on: shiftDays(RULES.startsOn, 8), n: 5 } } });
    serve({ '/learnings': { learnings: [], next: null } });
    const k = await launch({ stored: null });
    k.intake.takeBootstrap({ rewards: kept, serverTime: new Date().toISOString() });
    k.run();
    await vi.waitFor(() => expect(k.store.getOrbs()).not.toBeNull());
    expect(totalOf(k.store.getOrbs()!)).toBe(12);
    expect(k.store.getOrbs()!.days[Y]).toEqual(kept.days[Y]);
    expect(api.mock.calls.map(([p]) => p).filter((p) => p.includes('rewards'))).toEqual([]);
  });
  it('the copy never holds an open day: the days that were open when it was sent are read from the account’s facts', async () => {
    // the phone that signed out last night had counted yesterday (still open then, so never sent) and the day before
    const D2 = shiftDays(TODAY, -2);
    const D3 = shiftDays(TODAY, -3);
    const kept = existing({ clock: Y, days: { [D3]: { n: 1, a: 1, k: { habit: 1 }, c: 1 } } });
    serve({ '/learnings': { learnings: [], next: null } });
    const k = await launch({ stored: null });
    k.patchMonth(() => ({ checks: [check('h1', D3), check('h2', D3), check('h1', D2), check('h1', Y), check('h2', Y), check('h3', Y)] }));
    k.qc.setQueryData(['goals'], [goalOf('day', Y, { status: 'done', createdAt: noon(Y, 8).toISOString(), closedAt: noon(Y, 18).toISOString() })]);
    k.intake.takeBootstrap({ rewards: kept, serverTime: new Date().toISOString() });
    k.run();
    await vi.waitFor(() => expect(k.store.getOrbs()).not.toBeNull());
    const s = k.store.getOrbs()!;
    // yesterday and the day before, as the phone that held them would have counted them: the full day's +5 included.
    // Yesterday stays open (a run can still sync for it); the day before is closed.
    expect(s.days[Y]).toEqual({ n: 11, a: 4, k: { habit: 3, 'goal:day': 3, full: 5 } });
    expect(s.days[D2]).toEqual({ n: 1, a: 1, k: { habit: 1 }, c: 1 });
    // a day the copy holds stands as the copy has it, whatever the facts say now
    expect(s.days[D3]).toEqual({ n: 1, a: 1, k: { habit: 1 }, c: 1 });
    k.run();
    expect(k.store.getOrbs()!.days[Y]).toEqual({ n: 11, a: 4, k: { habit: 3, 'goal:day': 3, full: 5 } });
    expect(events).toEqual([]);
    expect(toasts).toEqual([]);
  });
  it('before 03:00 yesterday is left to the reconciler, which reads it in full', async () => {
    vi.setSystemTime(noon(TODAY, 1));
    const kept = existing({ clock: Y, days: {} });
    serve({ '/learnings': { learnings: [], next: null } });
    const k = await launch({ stored: null });
    k.patchMonth(() => ({ checks: [check('h1', Y), check('h2', Y), check('h3', Y)] }));
    k.qc.setQueryData(['goals'], [goalOf('day', Y, { status: 'done', createdAt: noon(Y, 8).toISOString(), closedAt: noon(Y, 18).toISOString() })]);
    k.intake.takeBootstrap({ rewards: kept, serverTime: new Date().toISOString() });
    k.run();
    await vi.waitFor(() => expect(k.store.getOrbs()).not.toBeNull());
    k.run();
    expect(k.store.getOrbs()!.days[Y]).toEqual({ n: 11, a: 4, k: { habit: 3, 'goal:day': 3, full: 5 } });
  });
  it('offline, a phone with the copy in hand but not the facts waits, and fills when they come', async () => {
    api.mockRejectedValue(new Error('offline'));
    const kept = existing({ clock: Y, days: {} });
    const k = await launch({ stored: null, bare: true });
    k.intake.takeBootstrap({ rewards: kept, serverTime: new Date().toISOString() });
    k.run();
    await settle(20);
    expect(k.store.getOrbs()).toBeNull();
    serve({ [`/months/${MONTH}`]: month(MONTH, { checks: [check('h1', Y)] }), '/todos': [], '/goals': [], '/learnings': { learnings: [], next: null } });
    vi.useRealTimers();
    await new Promise((r) => setTimeout(r, 5));
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(noon(TODAY));
    k.engine.resetOrbsEngineForTest();
    k.run();
    await vi.waitFor(() => expect(k.store.getOrbs()).not.toBeNull());
    expect(k.store.getOrbs()!.days[Y]).toEqual({ n: 1, a: 1, k: { habit: 1 } });
  });
  it('a first run on the day the account began starts empty, with nothing to read', async () => {
    const k = await launch({ stored: null, boot: boot({ onboardedAt: noon(TODAY, 9).toISOString() }) });
    k.intake.takeBootstrap({ serverTime: new Date().toISOString() });
    k.run();
    await vi.waitFor(() => expect(k.store.getOrbs()).not.toBeNull());
    expect(k.store.getOrbs()).toMatchObject({ startedOn: TODAY, days: {} });
    expect(api).not.toHaveBeenCalled();
  });
  it('offline, the rebuild fails without a word and is tried again later', async () => {
    api.mockRejectedValue(new Error('offline'));
    const k = await launch({ stored: null, bare: true });
    k.intake.takeBootstrap({ serverTime: new Date().toISOString() });
    k.run();
    await settle(20);
    expect(k.store.getOrbs()).toBeNull();
    expect(toasts).toEqual([]);
    const h = history();
    serve(h.routes);
    vi.useRealTimers();
    await new Promise((r) => setTimeout(r, 5));
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(noon(TODAY));
    k.engine.resetOrbsEngineForTest();
    k.run();
    await vi.waitFor(() => expect(k.store.getOrbs()).not.toBeNull());
    expect(Object.keys(k.store.getOrbs()!.days)).toHaveLength(h.days);
  });
});

describe('challenges, from the store', () => {
  /** Five weeks of record ending yesterday, every day counted, and the caches that cover them. */
  const veteran = async () => {
    const shared = await import('@logbook/shared');
    const monday = shared.mondayOf(TODAY);
    // put the clock on this week's day slot, so today is the day a challenge is offered
    const slot = shared.challengeSlots(U, monday).find((x) => x.kind === 'day')!;
    vi.setSystemTime(noon(slot.date));
    const from = shiftDays(monday, -35);
    const days: Rewards['days'] = {};
    const checks: HabitCheck[] = [];
    for (let d = from; d < slot.date; d = shiftDays(d, 1)) {
      days[d] = { n: 3, a: 3, k: { habit: 3 }, c: 1 };
      checks.push(check('h1', d), check('h2', d), check('h3', d));
    }
    const k = await launch({ stored: { ...emptyRewards(U, from), clock: shiftDays(slot.date, -1), days } });
    for (const m of [...new Set([...checks.map((c) => c.date.slice(0, 7)), slot.date.slice(0, 7)])]) k.qc.setQueryData(['month', m], month(m, { checks: checks.filter((c) => c.date.startsWith(m)) }));
    return { k, slot, shared };
  };
  it('offers the week’s day challenge on its day, once, from the person’s own record', async () => {
    const { k, slot } = await veteran();
    k.run();
    const offered = k.store.getOrbs()?.challenges[slot.key];
    // three habits and nothing else on the menu: "Every habit today"
    expect(offered).toMatchObject({ item: 'habits', target: 3, base: 0, state: 'offered' });
    // frozen: more facts do not change the offer
    k.qc.setQueryData(['goals'], [goalOf('day', slot.date, { createdAt: noon(slot.date, 7).toISOString() })]);
    k.run();
    expect(k.store.getOrbs()?.challenges[slot.key]).toBe(offered);
  });
  it('an added challenge is paid by the reconciler when the facts meet it, once, and the gain is published', async () => {
    const { k, slot, shared } = await veteran();
    k.run();
    const df = await import('./dayFacts');
    const caches = () => df.readCaches(k.qc, true, [slot.date.slice(0, 7)])!;
    k.store.updateOrbs((s) => shared.addChallenge(s, slot, df.challengeFacts(caches(), s, slot, slot.date), new Date()));
    expect(k.store.getOrbs()?.challenges[slot.key]?.state).toBe('added');
    const m = slot.date.slice(0, 7);
    k.qc.setQueryData<MonthBundle>(['month', m], (b) => ({ ...b!, checks: [...b!.checks, check('h1', slot.date), check('h2', slot.date), check('h3', slot.date)] }));
    const gained = k.run();
    expect(gained).toEqual([{ key: 'habit', n: 3, date: slot.date }, { key: slot.key, n: 5, date: slot.date }]);
    expect(k.store.getOrbs()?.challenges[slot.key]?.state).toBe('done');
    expect(k.store.getOrbs()?.once[slot.key]).toEqual({ on: slot.date, n: 5 });
    expect(k.store.getOrbs()?.keepsakes.challenge).toEqual({ on: slot.date });
    // unticking takes the habit's Orb and leaves the challenge's
    k.qc.setQueryData<MonthBundle>(['month', m], (b) => ({ ...b!, checks: b!.checks.filter((c) => !(c.date === slot.date && c.habitId === 'h3')) }));
    expect(k.run()).toEqual([]);
    expect(k.store.getOrbs()?.once[slot.key]?.n).toBe(5);
  });
  it('offers nothing while the months behind the baseline have not loaded, with Challenges off, or on a paused day', async () => {
    const a = await veteran();
    a.k.qc.removeQueries({ queryKey: ['month', shiftDays(a.slot.date, -28).slice(0, 7)] });
    if (shiftDays(a.slot.date, -28).slice(0, 7) !== a.slot.date.slice(0, 7)) {
      a.k.run();
      expect(a.k.store.getOrbs()?.challenges).toEqual({});
    }
    const b = await veteran();
    b.k.store.openOrbs(U);
    b.k.store.setSwitches({ cadence: 0 });
    b.k.run();
    expect(b.k.store.getOrbs()?.challenges).toEqual({});
    const c = await veteran();
    c.k.qc.setQueryData(['bootstrap'], boot({ status: { kind: 'travel', from: c.slot.date, until: null } }));
    c.k.run();
    expect(c.k.store.getOrbs()?.challenges).toEqual({});
  });
});

describe('before the start date', () => {
  it('nothing is earned, on the device’s own word or anyone else’s', async () => {
    vi.setSystemTime(noon(shiftDays(RULES.startsOn, -3)));
    const early = shiftDays(RULES.startsOn, -3);
    const k = await launch({ stored: null, boot: boot() });
    k.qc.setQueryData(['month', early.slice(0, 7)], month(early.slice(0, 7), { checks: [check('h1', early), check('h2', early)] }));
    k.intake.takeBootstrap({ serverTime: new Date().toISOString() });
    k.run();
    await vi.waitFor(() => expect(k.store.getOrbs()).not.toBeNull());
    k.run();
    expect(k.store.getOrbs()).toMatchObject({ startedOn: RULES.startsOn, days: {} });
    expect(events).toEqual([]);
  });
  it('the first day a store counts from is never before the start date, whatever storage or the account’s copy says', async () => {
    // an earlier server cut the start to its own date plus one (two days before the rules begin) and the phone took it
    const early = shiftDays(RULES.startsOn, -2);
    const k = await launch({ stored: { ...existing(), startedOn: early } });
    k.run();
    expect(k.store.getOrbs()!.startedOn).toBe(RULES.startsOn);
    // and a copy from the server that still says so does not bring it back
    api.mockImplementation(async (path, init) => {
      if (path === '/me/rewards' && init?.method === 'PUT') return { rewards: { ...(init.json as Rewards), startedOn: early } };
      throw Object.assign(new Error('Not found'), { status: 404 });
    });
    k.intake.takeBootstrap({ rewards: { ...existing(), startedOn: early }, serverTime: new Date().toISOString() });
    k.run();
    await vi.advanceTimersByTimeAsync(3000);
    k.run();
    await vi.advanceTimersByTimeAsync(3000);
    k.run();
    expect(k.store.getOrbs()!.startedOn).toBe(RULES.startsOn);
    // no ping-pong: the phone tells the server once, and is quiet after
    const puts = api.mock.calls.filter(([p, init]) => p === '/me/rewards' && init?.method === 'PUT').length;
    await vi.advanceTimersByTimeAsync(10_000);
    k.run();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(api.mock.calls.filter(([p, init]) => p === '/me/rewards' && init?.method === 'PUT').length).toBe(puts);
    expect(puts).toBeLessThanOrEqual(2);
  });
  it('a development build’s earlier start wins over the account’s copy, back to the day the account began and no further', async () => {
    const devStart = shiftDays(RULES.startsOn, -10);
    const born = shiftDays(RULES.startsOn, -6);
    const copy = existing({ days: { [Y]: { n: 1, a: 1, k: { habit: 1 }, c: 1 } } });
    // a seeded account, long there: the key's own day
    const old = await launch({ stored: null });
    local.setItem('logbook.dev.orbsStart', devStart);
    old.intake.takeBootstrap({ rewards: copy, serverTime: new Date().toISOString() });
    old.run();
    await vi.waitFor(() => expect(old.store.getOrbs()).not.toBeNull());
    old.run();
    expect(old.store.getOrbs()!.startedOn).toBe(devStart);
    expect(old.store.getOrbs()!.days[Y]?.n).toBe(1);
    // an account made after the key's day: the day it began
    const young = await launch({ stored: null, boot: boot({ onboardedAt: noon(born, 9).toISOString() }) });
    local.setItem('logbook.dev.orbsStart', devStart);
    young.intake.takeBootstrap({ rewards: copy, serverTime: new Date().toISOString() });
    young.run();
    await vi.waitFor(() => expect(young.store.getOrbs()).not.toBeNull());
    young.run();
    expect(young.store.getOrbs()!.startedOn).toBe(born);
    // without the key the copy's own start stands
    const plain = await launch({ stored: null });
    plain.intake.takeBootstrap({ rewards: copy, serverTime: new Date().toISOString() });
    plain.run();
    await vi.waitFor(() => expect(plain.store.getOrbs()).not.toBeNull());
    plain.run();
    expect(plain.store.getOrbs()!.startedOn).toBe(RULES.startsOn);
  });
  it('a development build can try it earlier with logbook.dev.orbsStart; the constant itself never moves', async () => {
    const early = shiftDays(RULES.startsOn, -3);
    vi.setSystemTime(noon(early));
    const k = await launch({ stored: null, boot: boot({ onboardedAt: noon(early, 8).toISOString() }) });
    local.setItem('logbook.dev.orbsStart', shiftDays(RULES.startsOn, -10));
    k.qc.setQueryData(['month', early.slice(0, 7)], month(early.slice(0, 7)));
    k.intake.takeBootstrap({ serverTime: new Date().toISOString() });
    k.run();
    await vi.waitFor(() => expect(k.store.getOrbs()).not.toBeNull());
    k.run();
    k.qc.setQueryData(['month', early.slice(0, 7)], month(early.slice(0, 7), { checks: [check('h1', early)] }));
    expect(k.run()).toEqual([{ key: 'habit', n: 1, date: early }]);
    expect(RULES.startsOn).toBe('2026-11-16');
    // and the release build has no such door: the read sits behind `import.meta.env.DEV`
    expect(readFileSync(join(__dirname, 'devStart.ts'), 'utf8')).toMatch(/if \(import\.meta\.env\.DEV\) \{\s+try \{\s+const v = localStorage\.getItem\(DEV_START_KEY\)/);
  });
});

describe('the older server: no rewards in the bootstrap', () => {
  it('makes zero requests for rewards and shows no toast, through a whole day of use and a sign-out', async () => {
    const k = await launch({ stored: existing() });
    const stop = k.engine.startOrbs(k.qc);
    k.intake.takeBootstrap({ serverTime: new Date().toISOString(), user: { id: U } });
    expect(k.intake.canSyncOrbs()).toBe(false);
    for (let i = 0; i < 3; i++) {
      k.patchMonth((m) => ({ checks: [...m.checks, check(`h${i + 1}`, TODAY)] }));
      vi.advanceTimersByTime(5000);
      await settle();
    }
    k.store.setSwitches({ weekTarget: 4 });
    k.store.markSeen('first');
    doc.hidden = true;
    doc.fire('visibilitychange');
    doc.hidden = false;
    doc.fire('visibilitychange');
    vi.advanceTimersByTime(60_000);
    await settle();
    // Sign out: the hook that would send one last time has nothing to say to this server
    const client = await import('@/api/client');
    await Promise.all([...client.beforeSignOut].map((f) => f()));
    await k.sync.sendOrbs();
    expect(k.store.getOrbs()?.days[TODAY]?.n).toBe(3);
    expect(api).not.toHaveBeenCalled();
    expect(toasts).toEqual([]);
    stop();
  });
  it('a bootstrap read from the phone’s saved copy says nothing either way: still zero requests', async () => {
    const k = await launch({ stored: existing() });
    const stop = k.engine.startOrbs(k.qc);
    k.patchMonth(() => ({ checks: [check('h1', TODAY)] }));
    vi.advanceTimersByTime(60_000);
    await settle();
    doc.hidden = true;
    doc.fire('visibilitychange');
    expect(api).not.toHaveBeenCalled();
    stop();
  });
});

describe('sync, where the server keeps a copy', () => {
  const closedDay = shiftDays(TODAY, -3);
  const mine = () => existing({ days: { [closedDay]: { n: 3, a: 3, k: { habit: 3 }, c: 1 } } });
  const answerMerged = () => api.mockImplementation(async (_path, init) => ({ rewards: init?.json }));
  it('fetchBootstrap takes rewards and serverTime off before the cache sees them, so a sync never changes its identity', async () => {
    const k = await launch({ stored: mine() });
    const raw = (rewards: unknown, serverTime: string) => ({ ...boot(), rewards, serverTime });
    api.mockResolvedValueOnce(raw(null, '2026-12-09T10:00:00.000Z')).mockResolvedValueOnce(raw(mine(), '2026-12-09T10:05:00.000Z'));
    const fetched = await k.qc.fetchQuery({ queryKey: ['bootstrap'], queryFn: k.queries.fetchBootstrap, staleTime: 0 });
    expect('rewards' in fetched).toBe(false);
    expect('serverTime' in fetched).toBe(false);
    const first = k.qc.getQueryData(['bootstrap']);
    expect(k.intake.getIntake()).toMatchObject({ has: true, rewards: null, n: 1 });
    await k.qc.fetchQuery({ queryKey: ['bootstrap'], queryFn: k.queries.fetchBootstrap, staleTime: 0 });
    // the same object: TanStack's structural sharing sees no change, so nothing downstream runs again
    expect(k.qc.getQueryData(['bootstrap'])).toBe(first);
    expect(k.intake.getIntake()).toMatchObject({ has: true, n: 2 });
    expect(k.intake.serverDayNow()).toBe('2026-12-09');
  });
  it('sends the closed days and the ledgers a while after a change, and merges the answer', async () => {
    answerMerged();
    const k = await launch({ stored: mine() });
    const stop = k.engine.startOrbs(k.qc);
    vi.advanceTimersByTime(20);
    k.intake.takeBootstrap({ rewards: null, serverTime: new Date().toISOString() });
    k.patchMonth(() => ({ checks: [check('h1', TODAY)] }));
    vi.advanceTimersByTime(20);
    expect(api).not.toHaveBeenCalled(); // not in the tap, not in its frame
    vi.advanceTimersByTime(3000);
    await settle();
    expect(api).toHaveBeenCalledTimes(1);
    const [path, init] = api.mock.calls[0]!;
    expect(path).toBe('/me/rewards');
    expect(init?.method).toBe('PUT');
    const body = init?.json as Rewards;
    expect(body.userId).toBe(U);
    // today is open: it is not sent. Each phone recomputes it from the synced facts.
    expect(Object.keys(body.days)).toEqual([closedDay]);
    expect(k.store.getOrbs()?.days[TODAY]?.n).toBe(1);
    // the answer changed nothing here, and nothing is sent again for it
    vi.advanceTimersByTime(60_000);
    await settle();
    expect(api).toHaveBeenCalledTimes(1);
    // a change to an open day alone sends nothing
    k.patchMonth(() => ({ checks: [check('h1', TODAY), check('h2', TODAY)] }));
    vi.advanceTimersByTime(60_000);
    await settle();
    expect(api).toHaveBeenCalledTimes(1);
    // something that is sent (a row marked seen) goes, once
    k.store.markSeen('first');
    vi.advanceTimersByTime(3000);
    await settle();
    expect(api).toHaveBeenCalledTimes(2);
    expect((api.mock.calls[1]![1]?.json as Rewards).seen).toEqual({ first: TODAY });
    expect(toasts).toEqual([]);
    stop();
  });
  it('takes in what another phone earned, by the shared merge', async () => {
    const other = shiftDays(TODAY, -4);
    const server = existing({ days: { [closedDay]: { n: 2, a: 2, k: { todo: 2 }, c: 1 }, [other]: { n: 6, a: 6, k: { habit: 6 }, c: 1 } } });
    api.mockResolvedValue({ rewards: server });
    const k = await launch({ stored: mine() });
    const stop = k.engine.startOrbs(k.qc);
    vi.advanceTimersByTime(20);
    k.intake.takeBootstrap({ rewards: server, serverTime: new Date().toISOString() });
    expect(k.store.getOrbs()?.days[other]?.n).toBe(6);
    // a maximum per kind, and the number their sum
    expect(k.store.getOrbs()?.days[closedDay]).toEqual({ n: 5, a: 3, k: { habit: 3, todo: 2 }, c: 1 });
    // this phone knew something the server did not: it is told
    vi.advanceTimersByTime(3000);
    await settle();
    expect(api).toHaveBeenCalledTimes(1);
    stop();
  });
  it('a bootstrap that brings exactly what this phone has sends nothing', async () => {
    const k = await launch({ stored: mine() });
    const stop = k.engine.startOrbs(k.qc);
    vi.advanceTimersByTime(20);
    const before = k.store.getOrbs();
    k.intake.takeBootstrap({ rewards: before, serverTime: new Date().toISOString() });
    vi.advanceTimersByTime(60_000);
    await settle();
    expect(api).not.toHaveBeenCalled();
    expect(k.store.getOrbs()).toBe(before);
    stop();
  });
  it.each([404, 405, 500, 501, 429, 413])('a send answered %i is dropped without a word, and the next change tries again', async (status) => {
    api.mockRejectedValue(Object.assign(new Error('no'), { status }));
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    const k = await launch({ stored: mine() });
    const stop = k.engine.startOrbs(k.qc);
    k.intake.takeBootstrap({ rewards: null, serverTime: new Date().toISOString() });
    vi.advanceTimersByTime(3000);
    await settle();
    expect(api).toHaveBeenCalledTimes(1);
    expect(toasts).toEqual([]);
    expect(k.store.getOrbs()?.days[closedDay]?.n).toBe(3);
    k.store.markSeen('first');
    vi.advanceTimersByTime(3000);
    await settle();
    expect(api).toHaveBeenCalledTimes(2);
    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
    expect(toasts).toEqual([]);
    stop();
  });
  it('sends at once when the page is hidden, and once before Sign out', async () => {
    answerMerged();
    const k = await launch({ stored: mine() });
    const stop = k.engine.startOrbs(k.qc);
    vi.advanceTimersByTime(20);
    k.intake.takeBootstrap({ rewards: null, serverTime: new Date().toISOString() });
    doc.hidden = true;
    doc.fire('visibilitychange');
    await settle();
    expect(api).toHaveBeenCalledTimes(1);
    doc.hidden = false;
    k.store.markSeen('first');
    const client = await import('@/api/client');
    expect(client.beforeSignOut.size).toBe(1);
    await Promise.all([...client.beforeSignOut].map((f) => f()));
    expect(api).toHaveBeenCalledTimes(2);
    // and it was written to the device first, in case the send does not make it
    expect(JSON.parse(local.getItem('logbook.orbs')!).seen).toEqual({ first: TODAY });
    stop();
  });
  it('an answer that is not this account’s store, or not a store, is ignored', async () => {
    const k = await launch({ stored: mine() });
    const stop = k.engine.startOrbs(k.qc);
    const before = k.store.getOrbs();
    for (const rewards of [{ ...mine(), userId: 'u_someone_else', days: { [closedDay]: { n: 99, a: 9, c: 1 } } }, 'nonsense', { v: 9 }, 42]) {
      k.intake.takeBootstrap({ rewards, serverTime: new Date().toISOString() });
      expect(k.store.getOrbs()).toBe(before);
    }
    stop();
  });
});
