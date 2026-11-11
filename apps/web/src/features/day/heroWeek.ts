import { counts, dayStatus, heroSession, isSkipMark, label, num, sessionStatus, shiftDays, weekSummary, type ISODate, type Session, type Snapshot } from '@logbook/shared';

/**
 * The hero's week, as data: everything Today's hero draws and prints for the shown day and its week, from one pure
 * function. It is written for the week horizon, the drawing that replaces the gauge of guide 6.5: the scene counts runs
 * (`runs`) or workouts (`workouts`), one mark each, the sun climbs by `share`, miles are the second number. The drawing
 * reads this and nothing else, so the picture, its label and the week sheet it opens can never count differently.
 *
 * One way of counting, and it is the app's own:
 *
 * - **The totals** are `weekSummary` (`@logbook/shared`), the function behind the week sheet, Plan's week line and the
 *   gauge this replaces: `runs.done` is its `runsDone`, `runs.planned` its `runsPlanned`, `miles` its `doneMiles` and
 *   `plannedMiles`. Nothing here adds a number up a second time.
 * - **The marks** are the same count, one run at a time: each mark's state is that session's `sessionStatus`, the function
 *   `weekSummary` counts with. The tests hold the two together: the done marks number `done`, the marks that are not
 *   `extra` number `planned`.
 *
 * What counts (each line is the existing rule, with where it lives):
 *
 * - A run or workout is **on the week** when its session stands: not skipped and not skipped for illness. A skipped session
 *   leaves the week: it is no mark, it is not planned, and its miles leave the planned miles (`weekSummary`, `weekTotals`).
 * - It is **done** when it counts (`counts(sessionStatus)`): marked Done or Floor by hand, or matched by what happened. A
 *   run is matched by a run that day, a lift by logged sets or a lift that synced, a cross session by a cross or lift
 *   activity. A floor is done here, as it is in the week's count.
 * - It is **missed** when its day has passed with nothing recorded. A missed run stays planned and is never done, so the
 *   count stays honest ("2 of 4").
 * - **Beyond the plan** (`extra`): a day with a run on it and no run session standing counts one run done, however many
 *   runs landed that day (`weekSummary`). A run that lands on a day that has a run session completes that session; it is
 *   not a second mark. Workouts follow the same rule, which is Progress's for lifts: a day with logged sets, a lift or a
 *   cross activity, and no lift or cross session standing, counts one workout done. An extra adds to `done` and never to
 *   `planned`, so a week can read "5 of 4", as the week sheet does.
 * - **Miles** are every mile run that week (`dayMiles`: what synced, plus runs marked Done at their planned miles and Floors
 *   at their floor minutes), against the miles of the runs that stand. Runs set in minutes plan no miles: a week with no
 *   planned miles has no mile target (`miles.planned` is null).
 *
 * Rules that had no home, decided here and tested in `heroWeek.test.ts`:
 *
 * - `share`, the sun's climb: done over planned, never more than 1. With nothing planned it is 1 once anything is done,
 *   else 0 (the gauge's rule for a week with no plan).
 * - `scene`: dusk when the shown day is a rest day, an empty day or a day whose sessions were all skipped, which is the
 *   day's own word (`dayStatus`: rest, empty, skipped). A day with a run or workout done and nothing planned is a bonus
 *   day in that vocabulary, never a rest day, so it is a day scene.
 * - `defaultView`: the kind of the session the card leads with (`heroSession`: a run before anything else), so a day with a
 *   run and a lift opens on runs, because the card's name is the run's. With no session standing: runs when a run landed,
 *   workouts when only a workout did, runs otherwise.
 * - `complete`: the week planned something, and every count that has a plan has reached it (the old week card's rule for
 *   "Every run done", `runsDone >= runsPlanned`, for runs and for workouts). Miles are not part of it: a run cut short still
 *   counts. A week with nothing planned is never complete, whatever was done.
 * - `emptyWeek`: not one session of any kind (rest and skipped included), no run and no workout on any of the seven days.
 * - `next`: the first session that stands (not rest, not skipped) in the seven days after the shown day, the same search the
 *   rest face's "Tomorrow: Long 5" line makes (`nextUp` in faces.ts calls `nextSession`).
 */

/** What the scene can count. Miles is not a list of marks: it is `HeroWeek.miles`. */
export type HeroView = 'runs' | 'workouts';
export type MarkState = 'done' | 'planned' | 'missed';

/** One run or workout on the week: a mark on the horizon. */
export interface HeroMark {
  /** Stable for a React key: the session's id, or `extra-<view>-<date>`. */
  id: string;
  date: ISODate;
  /** 0 to 6 from Monday: the day's column in the week strip above the card. */
  weekday: number;
  kind: 'run' | 'lift' | 'cross';
  /** done: it counts (Done or Floor, by hand or matched). planned: today or ahead, not done yet. missed: its day passed. */
  state: MarkState;
  /** On today (`snapshot.today`). */
  today: boolean;
  /** On the shown day. */
  shown: boolean;
  /** Beyond the plan: done with no session standing for it that day. Counts in `done`, never in `planned`. Always done. */
  extra: boolean;
  /** The session behind the mark (its name is `label(session)`); null for an extra. */
  session: Session | null;
}

/** One count of the week: runs, or workouts (lifts and cross sessions). */
export interface HeroCount {
  /** How many count as done, extras included. For runs: `weekSummary().runsDone`. */
  done: number;
  /** How many stand on the week, done or not, skipped ones left out. For runs: `weekSummary().runsPlanned`. */
  planned: number;
  /** The sun's climb, 0 to 1: done over planned, capped at 1; with nothing planned, 1 once anything is done. */
  share: number;
  /** Something is planned and `done` has reached it. */
  complete: boolean;
  /** One mark per session that stands, then one per extra, in date order (plan order within a day). */
  marks: HeroMark[];
}

export interface HeroMiles {
  /** Miles run this week, to two decimals (`weekSummary().doneMiles`). Print it with `tenth`. */
  done: number;
  /** The miles of the runs that stand; null when the week has no mile target. */
  planned: number | null;
  /** Done over planned, capped at 1; with no target, 1 once any mile is run. */
  share: number;
}

export interface HeroNext {
  date: ISODate;
  /** The session's short name ("Long 5", "Strength A"). */
  name: string;
  session: Session;
}

export interface HeroWeek {
  /** The shown day. */
  date: ISODate;
  /** The Monday of its week (what the week sheet opens with). */
  mon: ISODate;
  /** The shown day's column, 0 to 6 from Monday. */
  weekday: number;
  /** Today's column when today is in this week, else null. */
  todayWeekday: number | null;
  /** dusk: the shown day has no run and no workout on it (a rest day, an empty day, a day skipped). */
  scene: 'day' | 'dusk';
  /** Nothing at all on the week: no session of any kind, nothing run, nothing lifted. */
  emptyWeek: boolean;
  runs: HeroCount;
  /** Lifts and cross sessions. */
  workouts: HeroCount;
  miles: HeroMiles;
  /** What the scene counts when the day's page opens. */
  defaultView: HeroView;
  /** The week planned something, and every count that has a plan has reached it. */
  complete: boolean;
  /** The first session that stands in the seven days after the shown day; null with none. */
  next: HeroNext | null;
}

/** Miles as the week prints them everywhere: one decimal at most ("9.5", "4", never "9.46"). */
export const tenth = (miles: number): string => num(Math.round(miles * 10) / 10);

const standing = (s: Session) => s.kind !== 'rest' && !isSkipMark(s.mark);
const isRun = (s: Session) => s.kind === 'run';
const isWorkout = (s: Session) => s.kind === 'lift' || s.kind === 'cross';

/** A run landed that day. */
const ranOn = (snap: Snapshot, d: ISODate) => snap.activitiesOn(d).some((a) => a.kind === 'run');
/** A workout happened that day: logged sets, or a lift or cross activity. */
const workedOn = (snap: Snapshot, d: ISODate) => snap.liftSetCountOn(d) > 0 || snap.activitiesOn(d).some((a) => a.kind === 'lift' || a.kind === 'cross');
/** What an extra workout was, for its glyph: a lift when sets or a lift say so, else the cross activity. */
const workedKind = (snap: Snapshot, d: ISODate): 'lift' | 'cross' => (snap.liftSetCountOn(d) > 0 || snap.activitiesOn(d).some((a) => a.kind === 'lift') ? 'lift' : 'cross');

const share = (done: number, planned: number) => (planned > 0 ? Math.min(1, done / planned) : done > 0 ? 1 : 0);

/**
 * One count's marks for the week: each session of the group that stands, with its own status, and one extra for a day
 * where the group has nothing standing and something was done.
 */
const marksOf = (snap: Snapshot, days: ISODate[], shown: ISODate, view: HeroView): HeroMark[] => {
  const mine = view === 'runs' ? isRun : isWorkout;
  const out: HeroMark[] = [];
  days.forEach((d, weekday) => {
    const at = { date: d, weekday, today: d === snap.today, shown: d === shown };
    const live = snap
      .sessionsOn(d)
      .filter((s) => mine(s) && standing(s))
      .sort((a, b) => a.position - b.position);
    for (const s of live) {
      const st = sessionStatus(snap, d, s);
      out.push({ ...at, id: s.id, kind: s.kind as HeroMark['kind'], state: counts(st) ? 'done' : st === 'missed' ? 'missed' : 'planned', extra: false, session: s });
    }
    if (!live.length && (view === 'runs' ? ranOn(snap, d) : workedOn(snap, d))) out.push({ ...at, id: `extra-${view}-${d}`, kind: view === 'runs' ? 'run' : workedKind(snap, d), state: 'done', extra: true, session: null });
  });
  return out;
};

const countOf = (done: number, planned: number, marks: HeroMark[]): HeroCount => ({ done, planned, share: share(done, planned), complete: planned > 0 && done >= planned, marks });

/**
 * The first session that stands (not rest, not skipped) in the seven days after `date`, with its day: the first in plan
 * order on the first day that has one. The rest face's row and the dusk card's line both read this.
 */
export const nextSession = (snap: Snapshot, date: ISODate): HeroNext | null => {
  for (let i = 1; i <= 7; i++) {
    const d = shiftDays(date, i);
    const s = [...snap.sessionsOn(d)].sort((a, b) => a.position - b.position).find(standing);
    if (s) return { date: d, name: label(s), session: s };
  }
  return null;
};

/** The hero's week for the shown day. Pure: the same snapshot and day always give the same answer. */
export const heroWeek = (snap: Snapshot, date: ISODate): HeroWeek => {
  const sum = weekSummary(snap, date);
  const days = sum.days.map((d) => d.date);
  const todayAt = days.indexOf(snap.today);

  // the totals are the week's own (the week sheet's numbers); the marks are the same count, one run at a time
  const runs = countOf(sum.runsDone, sum.runsPlanned, marksOf(snap, days, date, 'runs'));
  const lifts = marksOf(snap, days, date, 'workouts');
  const workouts = countOf(lifts.filter((m) => m.state === 'done').length, lifts.filter((m) => !m.extra).length, lifts);
  const planned = sum.plannedMiles > 0 ? sum.plannedMiles : null;
  const miles: HeroMiles = { done: sum.doneMiles, planned, share: share(sum.doneMiles, planned ?? 0) };

  // the day's own word: rest, an empty day and a day skipped are the days with no run and no workout on them
  const word = dayStatus(snap, date);
  const scene = word === 'rest' || word === 'empty' || word === 'skipped' ? 'dusk' : 'day';

  // the card leads with `heroSession` (a run before anything else): the scene opens on what the card's name is
  const lead = heroSession(snap.sessionsOn(date));
  const defaultView: HeroView = lead && standing(lead) ? (isRun(lead) ? 'runs' : 'workouts') : !ranOn(snap, date) && workedOn(snap, date) ? 'workouts' : 'runs';

  const withPlan = [runs, workouts].filter((c) => c.planned > 0);
  return {
    date,
    mon: sum.weekStart,
    weekday: days.indexOf(date),
    todayWeekday: todayAt >= 0 ? todayAt : null,
    scene,
    emptyWeek: sum.days.every((d) => d.status === 'empty'),
    runs,
    workouts,
    miles,
    defaultView,
    complete: withPlan.length > 0 && withPlan.every((c) => c.complete),
    next: nextSession(snap, date),
  };
};
