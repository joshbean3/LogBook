import { countOf, dayFactsOf, isSkipMark, mondayOf, monthOf, periodOf, sessionStatus, counts, shiftDays, type Activity, type Aim, type ChallengeFacts, type DayFacts, type HabitCheck, type ISODate, type Learning, type LearningStats, type Rewards, type Session, type Slot, type Snapshot, type Todo, type TrainKind, type World } from '@logbook/shared';
import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import { keys } from '@/api/queries';
import { todosOf } from '@/api/shapes';
import { wholeMonth } from '@/api/monthShape';
import type { Bootstrap, MonthBundle } from '@/api/types';
import { goalsOf } from '@/features/goals/shape';
import { learnedKeys, rowsOf } from '@/features/learned/queries';
import { withoutFitnessBoot, withoutFitnessMonths } from '@/features/log/useLog';
import { inToday, liveOn } from '@/features/todos/groups';

/**
 * The one adapter from the app's caches to the rules' `DayFacts`. Everything the reconciler knows about a day comes
 * through here, and it reads the caches the way the screens do:
 *
 * - through the same Fitness filter as `useLog` (features/log/useLog.ts): with Fitness off the months carry no sessions,
 *   activities or lifts and the bootstrap no training status, so no training fact exists;
 * - to-dos and goals through the same shape checks the screens use (`todosOf`, `goalsOf`), so a row the screens would not
 *   draw is not a fact either;
 * - journal lines from every list of lines the app has loaded (a month, the whole list, a search), each line once.
 *
 * Nothing that leaves here carries a row id: a to-do, a habit or a goal still under its provisional id (`tmp-…`) and the
 * same row under the server's id give the same facts.
 */
export interface Caches {
  /** The bootstrap, through the Fitness filter. */
  boot: Bootstrap;
  /** The months that are loaded, through the Fitness filter. */
  months: Record<string, MonthBundle>;
  /** The to-dos, or null while they have not loaded. */
  todos: Todo[] | null;
  /** The goals, or null while they have not loaded. */
  goals: Aim[] | null;
  /** Every list of journal lines the app has loaded (`linesOf` reads them, each line once). */
  lists: ReadonlyArray<InfiniteData<{ learnings: Learning[]; next: string | null }, unknown> | undefined>;
  /** The journal's stats, when loaded: they name the days of the last week that hold a line. */
  stats: LearningStats | null;
  fitness: boolean;
  /** The identities the facts were read from: when none has changed, neither have the facts. */
  sig: readonly unknown[];
}

const shapes = new WeakMap<object, unknown>();
/** A cached list read through its shape check once per object (the check walks every row). */
const shaped = <T>(raw: unknown, read: (raw: unknown) => T[]): T[] => {
  if (!raw || typeof raw !== 'object') return read(raw);
  let out = shapes.get(raw) as T[] | undefined;
  if (!out) shapes.set(raw, (out = read(raw)));
  return out;
};
const filtered = new WeakMap<MonthBundle, MonthBundle>();
/** The months through `useLog`'s own Fitness filter, each filtered once per month object. */
const unfit = (months: Record<string, MonthBundle>): Record<string, MonthBundle> => {
  const out: Record<string, MonthBundle> = {};
  for (const m in months) {
    const raw = months[m]!;
    let f = filtered.get(raw);
    if (!f) filtered.set(raw, (f = withoutFitnessMonths({ [m]: raw })[m]!));
    out[m] = f;
  }
  return out;
};
const lineLists = new WeakMap<Caches, Learning[]>();
/** Every journal line the app has loaded, each once. */
export const linesOf = (c: Caches): Learning[] => {
  let out = lineLists.get(c);
  if (!out) {
    const seen = new Map<string, Learning>();
    for (const d of c.lists) for (const l of rowsOf(d)) seen.set(l.id, l);
    lineLists.set(c, (out = [...seen.values()]));
  }
  return out;
};

/** Read the caches as they stand. Null without a bootstrap (nobody is signed in, or nothing is loaded yet). */
export const readCaches = (qc: QueryClient, fitness: boolean, months: readonly string[]): Caches | null => {
  const raw = qc.getQueryData<Bootstrap>(keys.bootstrap);
  if (!raw) return null;
  const loaded: Record<string, MonthBundle> = {};
  const sig: unknown[] = [raw.habits, raw.user.status ?? null, raw.user.id, fitness];
  for (const m of months) {
    const b = qc.getQueryData<MonthBundle>(keys.month(m));
    sig.push(b ?? null);
    if (b) loaded[m] = b;
  }
  const todosRaw = qc.getQueryData<unknown>(keys.todos);
  const goalsRaw = qc.getQueryData<unknown>(['goals']);
  const lists = qc.getQueriesData<InfiniteData<{ learnings: Learning[]; next: string | null }, unknown>>({ queryKey: learnedKeys.lists });
  for (const [, d] of lists) sig.push(d ?? null);
  const stats = qc.getQueryData<LearningStats>(learnedKeys.stats) ?? null;
  sig.push(todosRaw ?? null, goalsRaw ?? null, stats);
  return {
    boot: fitness ? raw : withoutFitnessBoot(raw),
    months: fitness ? loaded : unfit(loaded),
    todos: todosRaw === undefined ? null : shaped(todosRaw, todosOf),
    goals: goalsRaw === undefined ? null : shaped(goalsRaw, goalsOf),
    lists: lists.map(([, d]) => d),
    stats,
    fitness,
    sig,
  };
};

/** Has everything a day's facts are read from loaded? Until it has, the day is not reconciled (an unloaded month is not an empty day). */
export const factsReady = (c: Caches, day: ISODate): boolean => !!c.months[monthOf(day)] && c.todos !== null && c.goals !== null;

// ---------- the months, by day ----------
interface MonthIndex {
  sessions: Map<ISODate, Session[]>;
  activities: Map<ISODate, Activity[]>;
  checks: Map<ISODate, HabitCheck[]>;
  lifts: Map<ISODate, number>;
}
const NONE: never[] = [];
const indexes = new WeakMap<MonthBundle, MonthIndex>();
/**
 * A month's rows by day, built once per month object (a month keeps its identity until its data changes, so a tap
 * re-reads only the month it touched). The month is made whole first (`wholeMonth`, as `buildSnapshot` does for the
 * screens): a row the screens would not draw is not a fact here either.
 */
const indexOf = (raw: MonthBundle): MonthIndex => {
  let ix = indexes.get(raw);
  if (!ix) {
    const b = wholeMonth(raw);
    const by = <T extends { date: ISODate }>(rows: readonly T[]) => {
      const m = new Map<ISODate, T[]>();
      for (const r of rows) (m.get(r.date) ?? m.set(r.date, []).get(r.date)!).push(r);
      return m;
    };
    const sessions = by(b.sessions);
    for (const list of sessions.values()) list.sort((x, y) => x.position - y.position);
    const lifts = new Map<ISODate, number>();
    for (const l of b.lifts) lifts.set(l.date, (lifts.get(l.date) ?? 0) + 1);
    indexes.set(raw, (ix = { sessions, activities: by(b.activities), checks: by(b.checks), lifts }));
  }
  return ix;
};
/** The status rules' view of the months (`Snapshot`), read by day from the indexes above. */
const snapshotOf = (c: Caches, today: ISODate): Snapshot & { checksOn(d: ISODate): readonly HabitCheck[] } => {
  const at = (d: ISODate) => {
    const b = c.months[monthOf(d)];
    return b ? indexOf(b) : null;
  };
  return {
    today,
    easyPace: c.boot.morningSettings?.run?.pace ?? null,
    sessionsOn: (d) => at(d)?.sessions.get(d) ?? NONE,
    activitiesOn: (d) => at(d)?.activities.get(d) ?? NONE,
    liftSetCountOn: (d) => at(d)?.lifts.get(d) ?? 0,
    checksOn: (d) => at(d)?.checks.get(d) ?? NONE,
  };
};
const byDay = new WeakMap<object, Map<ISODate, Todo[]>>();
/** The to-dos checked off, by the day they were (built once per list object). */
const doneByDay = (todos: Todo[]): Map<ISODate, Todo[]> => {
  let m = byDay.get(todos);
  if (!m) {
    m = new Map();
    for (const t of todos) if (t.doneOn) (m.get(t.doneOn) ?? m.set(t.doneOn, []).get(t.doneOn)!).push(t);
    byDay.set(todos, m);
  }
  return m;
};
const dayGoals = new WeakMap<object, Map<string, Aim>>();
const goalByDay = (goals: Aim[]): Map<string, Aim> => {
  let m = dayGoals.get(goals);
  if (!m) {
    m = new Map();
    // the first of a period stands, as `find` would have it
    for (const g of goals) if (g.level === 'day' && !m.has(g.period)) m.set(g.period, g);
    dayGoals.set(goals, m);
  }
  return m;
};

const worlds = new WeakMap<Caches, { world: World; snap: ReturnType<typeof snapshotOf> }>();
const worldOf = (c: Caches, today: ISODate) => {
  let w = worlds.get(c);
  if (!w) {
    const snap = snapshotOf(c, today);
    let perDay: Map<ISODate, number> | null = null;
    const recent = Array.isArray(c.stats?.recent) ? c.stats.recent : [];
    const todos = c.todos ?? [];
    const goals = c.goals ?? [];
    const world: World = {
      snap,
      todos,
      todosDoneOn: (d) => doneByDay(todos).get(d) ?? NONE,
      habits: c.boot.habits,
      checksOn: snap.checksOn,
      goals,
      dayGoal: (d) => goalByDay(goals).get(d),
      // the lines on the device, or the server's word that the day holds one (a list not loaded, a line made elsewhere)
      linesOn: (d) => {
        if (!perDay) {
          perDay = new Map();
          for (const l of linesOf(c)) perDay.set(l.date, (perDay.get(l.date) ?? 0) + 1);
        }
        return perDay.get(d) ?? (recent.includes(d) ? 1 : 0);
      },
      status: c.boot.user.status,
      fitness: c.fitness,
    };
    worlds.set(c, (w = { world, snap }));
  }
  return w;
};

/**
 * One day's facts, from the caches. `today` is the day the rules stand on (a day's goal earns in its day or the day
 * after); for a rebuild of an old day pass the day itself.
 */
export const dayFacts = (c: Caches, day: ISODate, today: ISODate = day): DayFacts => dayFactsOf(worldOf(c, today).world, day, today);

/** Days of a week on which every habit that was live was checked (and there was at least one): what "Every habit on N days" counts. */
export const habitDaysIn = (c: Caches, monday: ISODate, until: ISODate): number => {
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const d = shiftDays(monday, i);
    if (d > until || !c.months[monthOf(d)]) continue;
    const done = new Set<string>();
    for (const k of worldOf(c, until).snap.checksOn(d)) if (k.done) done.add(k.habitId);
    let live = 0;
    let all = true;
    for (const h of c.boot.habits) {
      if (h.createdOn >= d || (h.archivedOn && h.archivedOn < d)) continue;
      live++;
      if (!done.has(h.id)) all = false;
    }
    if (live >= 1 && all) n++;
  }
  return n;
};

/** A to-do made within this long after a list challenge was added still counts as on its list: two clocks made the two times. */
const LIST_CLOCK_SLACK_MS = 60_000;
/** What a challenge is read against, for a slot: the slot's day (a week slot: today), and the slot's week so far. */
export const challengeFacts = (c: Caches, store: Rewards, slot: Slot, today: ISODate): ChallengeFacts => {
  const monday = slot.kind === 'week' ? slot.date : mondayOf(slot.date);
  const dayOf = slot.kind === 'day' ? slot.date : today;
  const { snap } = worldOf(c, today);
  const day = dayFacts(c, dayOf, today);
  const planned: TrainKind[] = [];
  if (c.fitness) for (const s of snap.sessionsOn(dayOf)) if (s.kind !== 'rest' && !isSkipMark(s.mark) && !planned.includes(s.kind)) planned.push(s.kind);
  let sessions = 0;
  let done = 0;
  let fullDays = 0;
  let paused = 0;
  const end = shiftDays(monday, 6);
  for (let i = 0; i < 7; i++) {
    const d = shiftDays(monday, i);
    const rec = store.days[d];
    if (rec?.k?.full) fullDays++;
    if (rec?.h) paused++;
    if (!c.fitness) continue;
    for (const s of snap.sessionsOn(d)) {
      if (s.kind === 'rest' || isSkipMark(s.mark)) continue;
      sessions++;
      if (counts(sessionStatus(snap, d, s))) done++;
    }
  }
  const weekGoal = (c.goals ?? []).find((g) => g.level === 'week' && g.period === periodOf('week', monday));
  const within = today > end ? end : today;
  const open = liveOn(c.todos ?? [], dayOf, today).filter((t) => (!t.doneOn || t.doneOn > dayOf) && inToday(t, dayOf));
  const doneThen = (doneByDay(c.todos ?? []).get(dayOf) ?? NONE).filter((t) => !(t.deletedOn && t.deletedOn <= dayOf));
  // "Clear this morning's list", once added: the to-dos that were there at that moment (made no later than it was added,
  // give or take a minute between two clocks; no row id is kept), still open on the list or checked off that day. One
  // written afterwards is in neither number. When no to-do of the day passes at all (every one was written offline and
  // given its time later), the times tell nothing and the day's counts stand, as they did before.
  const ch = slot.kind === 'day' ? store.challenges[slot.key] : undefined;
  const addedAt = ch && ch.item === 'list' && ch.state === 'added' ? Date.parse(ch.at) + LIST_CLOCK_SLACK_MS : NaN;
  const wasThere = (t: Todo) => {
    const made = Date.parse(t.createdAt);
    return Number.isNaN(made) || made <= addedAt;
  };
  const listed = { open: open.filter(wasThere).length, done: doneThen.filter(wasThere).length };
  const list = Number.isNaN(addedAt) || (!listed.open && !listed.done && open.length + doneThen.length > 0) ? null : listed;
  let newest = '';
  // the newest of everything the list holds now, open or checked off today (what was done before it is added is its base)
  for (const t of [...open, ...doneThen]) if (!Number.isNaN(Date.parse(t.createdAt)) && (!newest || Date.parse(t.createdAt) > Date.parse(newest))) newest = t.createdAt;
  return {
    today,
    fitness: c.fitness,
    day,
    todosOpen: open.length,
    ...(list ? { list } : null),
    ...(newest ? { todosNewest: newest } : null),
    planned,
    week: {
      monday,
      counted: countOf(store, within).thisWeek,
      fullDays,
      habitDays: habitDaysIn(c, monday, within),
      goal: !weekGoal ? 'none' : weekGoal.status === 'done' ? 'done' : 'open',
      sessions: { planned: sessions, done },
      paused: paused + (day.held && !store.days[dayOf]?.h ? 1 : 0),
    },
  };
};
