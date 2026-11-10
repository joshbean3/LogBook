/**
 * Progress: every number on the page, from the log. Pure functions over the snapshot so the page, its sheets and its tests
 * agree. Nothing here renders.
 */
import { e1rm, fmtDate, isSkipMark, mondayOf, monthOf, parseISO, shiftDays, zoneOf, type Activity, type HrZone, type ISODate, type LiftSet } from '@logbook/shared';
import type { AppSnapshot } from '@/api/snapshot';
import { dayMiles } from '../sessions/miles';

// ---------- range ----------
export type Range = '3M' | '6M' | '1Y';
/** Weeks shown, the current one included. */
export const RANGE_WEEKS: Record<Range, number> = { '3M': 13, '6M': 26, '1Y': 52 };
export const RANGE_WORDS: Record<Range, string> = { '3M': '3 months', '6M': '6 months', '1Y': 'year' };
/** "in 3 months" / "this year": for subs and sheet eyebrows. */
export const rangePhrase = (r: Range) => (r === '1Y' ? 'in a year' : `in ${RANGE_WORDS[r]}`);
export const rangeLabel = (r: Range) => (r === '1Y' ? 'Last 12 months' : `Last ${RANGE_WORDS[r]}`);
/** Planned weeks drawn as ghosts after this one: where the block is heading, never most of the chart. */
export const FUTURE_WEEKS = 2;

// ---------- words ----------
const SMALL = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
/** "Three" for 3, "14" past twelve. Sentence-initial. */
export const Words = (n: number) => SMALL[n] ?? String(n);
export const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);
export const weekTitle = (monday: ISODate, today: ISODate) => (monday === mondayOf(today) ? 'This week' : monday === shiftDays(mondayOf(today), -7) ? 'Last week' : `Week of ${fmtDate('md', monday)}`);

/** Pace in seconds per mile -> `8:14`. */
export const paceText = (sec: number) => {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
export const paceOfRun = (a: Activity) => (a.miles > 0.2 && a.movingSec > 0 ? a.movingSec / a.miles : null);

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const monthName = (d: ISODate) => new Intl.DateTimeFormat('en-US', { month: 'long' }).format(parseISO(d));
const days7 = (mon: ISODate) => Array.from({ length: 7 }, (_, i) => shiftDays(mon, i));

// ---------- the weekly series ----------
export interface WeekPoint {
  /** Monday. */
  w: ISODate;
  ran: number;
  runs: number;
  /** Planned run miles, skips left out. */
  planned: number;
  /** Planned runs, skips left out. */
  plannedRuns: number;
  /** Of `ran`, the miles logged by hand: runs marked Done with no activity (contract 5), drawn with a hairline. */
  logged: number;
  /** The longest run that week (an activity, or a run logged by hand). */
  long: number;
  longRun: Activity | null;
  current: boolean;
  future: boolean;
  /** A day of this week falls in a month that has not loaded (yet): drawn as a quiet gap, left out of every summary. */
  missing?: boolean;
  /** Trailing four-week average of finished weeks (null before the first run, on this week and the future). */
  avg: number | null;
}

/**
 * The weeks in view. `loaded(month)` (the snapshot's own) marks weeks that touch a month not loaded yet as `missing`: the
 * page builds from the months that are there and a missing one is a quiet gap (§8, critic C11), never the page skeleton.
 */
export const weekSeries = (snap: AppSnapshot, today: ISODate, r: Range, loaded?: (month: string) => boolean): WeekPoint[] => {
  const mon = mondayOf(today);
  const n = RANGE_WEEKS[r];
  const pts: WeekPoint[] = Array.from({ length: n + FUTURE_WEEKS }, (_, i) => {
    const w = shiftDays(mon, (i - n + 1) * 7);
    let ran = 0;
    let runs = 0;
    let logged = 0;
    let long = 0;
    let planned = 0;
    let plannedRuns = 0;
    let longRun: Activity | null = null;
    for (const d of days7(w)) {
      for (const s of snap.sessionsOn(d))
        if (s.kind === 'run' && !isSkipMark(s.mark)) {
          planned += Number(s.miles) || 0;
          plannedRuns++;
        }
      if (d > today) continue;
      const acts = snap.runsOn(d);
      for (const a of acts) {
        ran += a.miles;
        runs++;
        if (!longRun || a.miles > longRun.miles) longRun = a;
        long = Math.max(long, a.miles);
      }
      // a run marked Done (or Floor) that no activity covers counts its miles (contract 5)
      const dm = dayMiles(snap, d);
      if (dm.logged > 0) {
        const n = dm.runs - acts.length;
        ran += dm.logged;
        runs += n;
        logged += dm.logged;
        long = Math.max(long, dm.logged / Math.max(1, n));
      }
    }
    const missing = loaded ? days7(w).some((d) => !loaded(monthOf(d))) : false;
    return { w, ran, runs, logged, planned, plannedRuns, long, longRun, current: w === mon, future: w > mon, missing, avg: null };
  });
  const first = pts.findIndex((p) => p.ran > 0);
  pts.forEach((p, i) => {
    if (p.current || p.future || p.missing || first < 0 || i < first) return;
    const win = pts.slice(Math.max(first, i - 3), i + 1).filter((q) => !q.missing);
    p.avg = sum(win.map((q) => q.ran)) / win.length;
  });
  return pts;
};

// ---------- easy pace ----------
export interface EasyRun {
  a: Activity;
  pace: number;
  hr: number | null;
  why: 'planned' | 'zone' | 'hr' | 'pace';
}
export interface EasyPace {
  runs: EasyRun[];
  /** Weekly median easy pace (sec/mi), finished and current weeks with an easy run. */
  weekly: Array<{ w: ISODate; pace: number; hr: number | null }>;
  now: number | null;
  nowHr: number | null;
  then: number | null;
  thenMonth: string | null;
  basis: 'planned' | 'zones' | 'hr' | 'pace';
}

const EASY_TYPES = /easy|long|recovery|shakeout|base/i;
/**
 * Easy runs in the range: runs on a day planned as Easy/Long/Recovery; else, with heart-rate zones, runs averaging zone 2 or
 * under; else runs at or under the range's median heart rate; else the slower half by pace. Walk-heavy outings (pace
 * more than 35% slower than the median) are left out so one stroll does not drag the line.
 */
export const easyPace = (snap: AppSnapshot, from: ISODate, today: ISODate, zones: HrZone[] | null): EasyPace => {
  const all: Activity[] = [];
  for (let d = from; d <= today; d = shiftDays(d, 1)) all.push(...snap.runsOn(d));
  const paced = all.map((a) => ({ a, pace: paceOfRun(a) })).filter((x): x is { a: Activity; pace: number } => x.pace != null);
  const med = median(paced.map((x) => x.pace)) ?? 0;
  const sane = paced.filter((x) => x.pace <= med * 1.35);
  const hrs = sane.map((x) => x.a.avgHr).filter((h): h is number => h != null);
  const hrMed = median(hrs);
  const basis: EasyPace['basis'] = zones?.length ? 'zones' : hrs.length >= Math.max(3, sane.length * 0.6) ? 'hr' : 'pace';
  const runs: EasyRun[] = [];
  for (const x of sane) {
    const planned = snap.sessionsOn(x.a.date).find((s) => s.kind === 'run');
    const hr = x.a.avgHr ?? null;
    if (planned) {
      if (EASY_TYPES.test(planned.type ?? '')) runs.push({ ...x, hr, why: 'planned' });
      continue;
    }
    if (basis === 'zones') {
      const z = zoneOf(zones, hr);
      if (z != null && z <= 2) runs.push({ ...x, hr, why: 'zone' });
    } else if (basis === 'hr') {
      if (hr != null && hrMed != null && hr <= hrMed) runs.push({ ...x, hr, why: 'hr' });
    } else if (x.pace >= med) runs.push({ ...x, hr, why: 'pace' });
  }
  runs.sort((a, b) => (a.a.date < b.a.date ? -1 : 1));
  const byWeek = new Map<ISODate, EasyRun[]>();
  for (const r of runs) {
    const w = mondayOf(r.a.date);
    byWeek.set(w, [...(byWeek.get(w) ?? []), r]);
  }
  const weekly = [...byWeek.entries()].map(([w, rs]) => ({ w, pace: median(rs.map((r) => r.pace))!, hr: median(rs.map((r) => r.hr).filter((h): h is number => h != null)) }));
  const recent = runs.filter((r) => r.a.date >= shiftDays(mondayOf(today), -21));
  const early = runs.length >= 6 ? runs.filter((r) => r.a.date < shiftDays(runs[0]!.a.date, 28)) : [];
  const nowSet = recent.length ? recent : runs.slice(-3);
  return {
    runs,
    weekly,
    now: median(nowSet.map((r) => r.pace)),
    nowHr: median(nowSet.map((r) => r.hr).filter((h): h is number => h != null)),
    then: early.length && early.length < runs.length ? median(early.map((r) => r.pace)) : null,
    thenMonth: early.length ? monthName(early[0]!.a.date) : null,
    basis,
  };
};

// ---------- lifts ----------
export interface LiftDay {
  date: ISODate;
  weight: number;
  reps: number;
  e1rm: number;
}
export interface LiftGroup {
  name: string;
  /** The best set of each day in the range, oldest first. */
  days: LiftDay[];
  /** A bodyweight lift (no weight on any set): its line follows the best set's reps, not an estimated max. */
  reps: boolean;
  /** Change across the range, as a ratio of the first day's value; null with one day, or when there is nothing to compare from. */
  change: number | null;
}
/** What a day is worth on its lift's line: the estimated max, or the best set's reps for a bodyweight lift. */
export const liftValue = (g: Pick<LiftGroup, 'reps'>, d: Pick<LiftDay, 'reps' | 'e1rm'>) => (g.reps ? d.reps : d.e1rm);
/** A set in words: `185 × 5`, or `Bodyweight × 8` with no weight on it. */
export const setWords = (d: { weight: number; reps: number }) => (d.weight > 0 ? `${d.weight} × ${d.reps}` : `Bodyweight × ${d.reps}`);
export const liftGroups = (sets: LiftSet[], from: ISODate, today: ISODate): LiftGroup[] => {
  const by = new Map<string, { name: string; days: Map<ISODate, LiftDay> }>();
  for (const s of sets) {
    if (s.date < from || s.date > today) continue;
    const k = s.exercise.trim().toLowerCase();
    if (!by.has(k)) by.set(k, { name: s.exercise.trim(), days: new Map() });
    const g = by.get(k)!;
    const e = e1rm(s.weight, s.reps);
    const cur = g.days.get(s.date);
    // the day's best set: the highest estimated max, then the most reps (the only measure at bodyweight)
    if (!cur || e > cur.e1rm || (e === cur.e1rm && s.reps > cur.reps)) g.days.set(s.date, { date: s.date, weight: s.weight, reps: s.reps, e1rm: e });
  }
  return [...by.values()]
    .map((g) => {
      const all = [...g.days.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
      // a lift done both ways reads by its weighted days (a bodyweight day has no estimated max to put on that line)
      const weighted = all.filter((d) => d.weight > 0);
      const reps = weighted.length === 0;
      const days = reps ? all : weighted;
      const first = liftValue({ reps }, days[0]!);
      const last = liftValue({ reps }, days[days.length - 1]!);
      // nothing to compare from (a zero start) is no change at all, never a division by zero
      return { name: g.name, days, reps, change: days.length > 1 && first > 0 ? (last - first) / first : null };
    })
    .sort((a, b) => (a.days[a.days.length - 1]!.date < b.days[b.days.length - 1]!.date ? 1 : -1));
};
export const signedPct = (ch: number) => `${ch >= 0 ? '+' : '−'}${Math.abs(Math.round(ch * 100))}%`;

// ---------- consistency ----------
export interface HabitLike {
  id: string;
  name: string;
  createdOn: ISODate;
}
