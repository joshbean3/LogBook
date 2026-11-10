/**
 * Progress's other numbers: the metric source built from the loaded months, this month against last month, the activity
 * list with its filters and source chips, and freshness words. Pure: the page and the tests share them. Strava data here is
 * for display only; none of it is handed to the assistant.
 */
import { dayStatus, fmtDate, isRace, label, monthOf, sessionMiles, shiftDays, type Activity, type ISODate, type LiftSet, type Session } from '@logbook/shared';
import type { AppSnapshot } from '@/api/snapshot';
import { cumulative } from '@/ui/charts';
import { dayMiles } from '../sessions/miles';
import type { HabitLike } from './data';
import type { HealthDay } from './healthDays';
import type { MetricSource } from './metrics';

// ---------- the metric source ----------
/**
 * The metric pages' view of the log. `easy` holds the ids of runs that count as easy (from `easyPace`). Habits follow the
 * consistency rule: a habit counts from the day it was made, and today only once it is done. `health` holds the account's
 * daily Apple Health readings by date, when there are any.
 */
export const snapSource = (snap: AppSnapshot, habits: HabitLike[], easy: ReadonlySet<string>, health?: ReadonlyMap<ISODate, HealthDay>): MetricSource => ({
  today: snap.today,
  loaded: (d) => snap.loaded(monthOf(d)),
  milesOn: (d) => dayMiles(snap, d).miles,
  runCountOn: (d) => dayMiles(snap, d).runs,
  runsOn: (d) => snap.runsOn(d),
  isEasy: (a) => easy.has(a.id),
  habitShare: (d) => {
    let of = 0;
    let done = 0;
    for (const h of habits) {
      if (h.createdOn && d < h.createdOn) continue;
      const ok = snap.isHabitDone(d, h.id);
      if (d === snap.today && !ok) continue;
      of++;
      if (ok) done++;
    }
    return of ? done / of : null;
  },
  trainingOn: (d) => {
    if (d > snap.today) return null;
    const st = dayStatus(snap, d);
    return st === 'done' || st === 'floor' || st === 'bonus' ? 1 : st === 'missed' ? 0 : null;
  },
  liftsOn: (d) => snap.liftsOn(d),
  healthOn: (d) => health?.get(d) ?? null,
});

// ---------- this month against last month ----------
export interface MonthCompare {
  /** The first of this month and of last month. */
  cur: ISODate;
  prev: ISODate;
  /** Points on the x axis: the longer of the two months. */
  length: number;
  /** Running miles by day of month; null after today (and on a day whose month has not loaded). */
  curLine: Array<number | null>;
  prevLine: Array<number | null>;
  curTotal: number;
  prevTotal: number;
  /** Last month's running total on the same day of the month as today. */
  prevByNow: number;
  /** Today's day of the month. */
  day: number;
  /** Last month is loaded (else its line is not drawn and its total is not said). */
  prevLoaded: boolean;
}

const daysIn = (first: ISODate) => {
  const [y, m] = first.split('-').map(Number) as [number, number];
  return new Date(y, m, 0).getDate();
};

/** Cumulative miles this month (up to today) and last month (all of it), day of month by day of month. */
export const monthCompare = (snap: AppSnapshot, today: ISODate): MonthCompare => {
  const cur = `${today.slice(0, 7)}-01`;
  const prev = `${shiftDays(cur, -1).slice(0, 7)}-01`;
  const nc = daysIn(cur);
  const np = daysIn(prev);
  const length = Math.max(nc, np);
  const prevLoaded = snap.loaded(monthOf(prev));
  const curLoaded = snap.loaded(monthOf(cur));
  const curDaily = Array.from({ length }, (_, i) => {
    const d = shiftDays(cur, i);
    return i < nc && d <= today && curLoaded ? dayMiles(snap, d).miles : null;
  });
  const prevDaily = Array.from({ length }, (_, i) => (i < np && prevLoaded ? dayMiles(snap, shiftDays(prev, i)).miles : null));
  const curLine = cumulative(curDaily);
  const prevLine = cumulative(prevDaily);
  const day = Number(today.slice(8, 10));
  const r1 = (v: number) => Math.round(v * 10) / 10;
  return {
    cur,
    prev,
    length,
    curLine,
    prevLine,
    curTotal: r1(curLine.reduce<number>((m, v) => (v != null ? v : m), 0)),
    prevTotal: r1(prevLine.reduce<number>((m, v) => (v != null ? v : m), 0)),
    prevByNow: r1(prevLine[Math.min(day, np) - 1] ?? 0),
    day,
    prevLoaded,
  };
};

/** The sentence under the two totals: ahead, behind or level with last month by this day. */
export const monthWords = (m: MonthCompare, monthName: (d: ISODate) => string) => {
  const last = monthName(m.prev);
  if (!m.prevLoaded) return 'Last month is still loading.';
  if (m.curTotal < 0.05 && m.prevByNow < 0.05) return `No miles yet this month or by this day in ${last}.`;
  const d = Math.round((m.curTotal - m.prevByNow) * 10) / 10;
  if (Math.abs(d) < 0.5) return `Level with ${last} by this day.`;
  return d > 0 ? `${d.toFixed(1)} mi ahead of ${last} by this day.` : `${Math.abs(d).toFixed(1)} mi behind ${last} by this day.`;
};

// ---------- the activity list ----------
export type FeedFilter = 'all' | 'runs' | 'lifts' | 'races';
export const FEED_FILTERS: Array<[FeedFilter, string]> = [
  ['all', 'All'],
  ['runs', 'Runs'],
  ['lifts', 'Lifts'],
  ['races', 'Races'],
];
export type FeedSource = 'Strava' | 'Manual';

export interface FeedItem {
  key: string;
  date: ISODate;
  kind: 'run' | 'lift' | 'cross';
  source: FeedSource;
  title: string;
  race: boolean;
  /** The Strava activity behind the row (runs open the run detail from it). */
  activity: Activity | null;
  miles: number | null;
  sec: number | null;
  /** Lift sets logged by hand that day. */
  sets: LiftSet[];
  /** The planned session the row belongs to, when there is one. */
  session: Session | null;
}

const raceDay = (sessions: Session[]) => sessions.some((s) => s.kind === 'run' && isRace(s.type));

/**
 * Everything done from `from` to `to`, newest first: Strava activities (runs, lifts, anything else), runs marked Done by
 * hand with no activity behind them, and lift sets logged by hand. A race is a run on a day planned as a race, or an
 * activity Strava names a race. Days whose month has not loaded are left out, never shown as empty.
 */
export const activityFeed = (snap: AppSnapshot, from: ISODate, to: ISODate, filter: FeedFilter = 'all'): FeedItem[] => {
  const out: FeedItem[] = [];
  for (let d = to; d >= from; d = shiftDays(d, -1)) {
    if (!snap.loaded(monthOf(d))) continue;
    const sessions = snap.sessionsOn(d);
    const race = raceDay(sessions);
    const acts = [...snap.activitiesOn(d)].sort((a, b) => ((b.time ?? '') < (a.time ?? '') ? -1 : 1));
    const runSession = sessions.find((s) => s.kind === 'run') ?? null;
    // on a race day the race is the longest run (a warm-up or a shakeout that day is not)
    const longest = acts.filter((a) => a.kind === 'run').reduce<Activity | null>((b, a) => (!b || a.miles > b.miles ? a : b), null);
    for (const a of acts) {
      out.push({
        key: a.id,
        date: d,
        kind: a.kind,
        source: 'Strava',
        title: a.name || (a.kind === 'run' ? 'Run' : a.sportType),
        race: a.kind === 'run' && ((race && a === longest) || /\brace\b/i.test(a.name)),
        activity: a,
        miles: a.kind === 'run' || a.miles > 0.05 ? a.miles : null,
        sec: a.movingSec || null,
        sets: [],
        session: a.kind === 'run' ? runSession : (sessions.find((s) => s.kind === a.kind) ?? null),
      });
    }
    for (const s of sessions) {
      if (s.kind !== 'run') continue;
      const m = sessionMiles(snap, d, s);
      if (m.source !== 'planned' && m.source !== 'floor') continue;
      out.push({ key: `m-${s.id}`, date: d, kind: 'run', source: 'Manual', title: label(s), race: isRace(s.type), activity: null, miles: m.miles, sec: null, sets: [], session: s });
    }
    const sets = snap.liftsOn(d);
    if (sets.length) {
      const ls = sessions.find((s) => s.kind === 'lift') ?? null;
      out.push({ key: `l-${d}`, date: d, kind: 'lift', source: 'Manual', title: ls ? label(ls) : 'Lift', race: false, activity: null, miles: null, sec: null, sets, session: ls });
    }
  }
  return out.filter((x) => (filter === 'all' ? true : filter === 'runs' ? x.kind === 'run' : filter === 'lifts' ? x.kind === 'lift' : x.race));
};

/** The row's second line: "Nov 6 · 8:12 /mi · 52:10" for a run, "Nov 5 · 12 sets · Squat, Bench" for lifts. */
export const feedDetail = (x: FeedItem, today: ISODate, paceText: (s: number) => string, clock: (s: number) => string) => {
  const day = x.date === today ? 'Today' : x.date === shiftDays(today, -1) ? 'Yesterday' : fmtDate('md', x.date);
  if (x.kind === 'lift' && x.sets.length) {
    const names = [...new Set(x.sets.map((s) => s.exercise.trim()))];
    return [day, `${x.sets.length} ${x.sets.length === 1 ? 'set' : 'sets'}`, names.slice(0, 2).join(', ') + (names.length > 2 ? ` +${names.length - 2}` : '')].join(' · ');
  }
  const pace = x.miles && x.sec && x.miles > 0.2 ? `${paceText(x.sec / x.miles)} /mi` : null;
  return [day, pace, x.sec ? clock(x.sec) : x.source === 'Manual' ? 'Marked done' : null].filter(Boolean).join(' · ');
};

// ---------- freshness ----------
/** "just now", "6 m ago", "2 h ago", "yesterday", "Nov 3": how long ago an ISO time was. */
export const agoWords = (iso: string | null | undefined, now: number): string | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const s = Math.max(0, (now - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const then = new Date(t);
  const today = new Date(now);
  const y = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (then.getFullYear() === y.getFullYear() && then.getMonth() === y.getMonth() && then.getDate() === y.getDate()) return 'yesterday';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(then);
};

/** The freshness line: "Synced 6 m ago", "Syncing…", "Strava needs a look", or null without Strava. */
export const syncWords = (s: { connected: boolean; lastSyncAt: string | null; syncing: boolean; error: string | null } | null, now: number): string | null => {
  if (!s?.connected) return null;
  if (s.syncing) return 'Syncing…';
  if (s.error) return 'Sync paused. Check Strava in Settings';
  const a = agoWords(s.lastSyncAt, now);
  return a ? `Synced ${a}` : 'Not synced yet';
};
