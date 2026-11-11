/**
 * The Progress hero's numbers: what was done, bucket by bucket, for running (miles) and for strength (lift sessions), and
 * what the plan still asks for. Pure functions over the snapshot so the card and its tests agree. Nothing here renders.
 */
import { counts, isSkipMark, label, mondayOf, monthOf, sessionStatus, shiftDays, type Activity, type ISODate, type LiftSet, type Session } from '@logbook/shared';
import type { AppSnapshot } from '@/api/snapshot';
import { dayMiles } from '../sessions/miles';
import { bucketLifts, bucketRuns, rangeSpan, type DayLift, type DayRun, type LiftBucket, type ProgressRange, type RangeSpan, type RunBucket } from './ranges';

export type HeroMode = 'run' | 'lift';
export const HERO_MODES: HeroMode[] = ['run', 'lift'];
/** Weeks the strength list reaches back, this one included. */
export const HERO_WEEKS = 12;

/** One day's running: run miles planned (skips left out) and runs on the plan; miles and runs done (activities and runs
 * marked done, `dayMiles`), nothing done after today. */
export const runDay = (snap: AppSnapshot, d: ISODate, today: ISODate): DayRun => {
  let planned = 0;
  let plannedRuns = 0;
  for (const s of snap.sessionsOn(d))
    if (s.kind === 'run' && !isSkipMark(s.mark)) {
      planned += Number(s.miles) || 0;
      plannedRuns++;
    }
  if (d > today) return { planned, plannedRuns, done: 0, runs: 0 };
  const m = dayMiles(snap, d);
  return { planned, plannedRuns, done: m.miles, runs: m.runs };
};

/**
 * One day's lifting. Planned: lift sessions on the plan, skips left out. Done: planned lifts that count (sets logged, a
 * lift activity, or marked done), or one for a day with sets or a lift activity and no lift on the plan. Sets and volume
 * come from the logged sets. Nothing done after today.
 */
export const liftDay = (snap: AppSnapshot, d: ISODate, today: ISODate): DayLift => {
  const lifts = snap.sessionsOn(d).filter((s) => s.kind === 'lift' && !isSkipMark(s.mark));
  if (d > today) return { planned: lifts.length, done: 0, sets: 0, volume: 0 };
  const ls = snap.liftsOn(d);
  const kept = lifts.filter((s) => counts(sessionStatus(snap, d, s))).length;
  const any = ls.length > 0 || snap.activitiesOn(d).some((a) => a.kind === 'lift');
  return { planned: lifts.length, done: kept || (any ? 1 : 0), sets: ls.length, volume: ls.reduce((s, x) => s + x.weight * x.reps, 0) };
};

export interface RunView {
  span: RangeSpan;
  /** The chart's bars, in the span's unit. */
  buckets: RunBucket[];
}
export interface LiftView {
  span: RangeSpan;
  buckets: LiftBucket[];
}
/** Days already read, per snapshot (a new snapshot, new data, starts over): switching ranges reads no day twice. */
const runCache = new WeakMap<AppSnapshot, Map<string, DayRun>>();
const liftCache = new WeakMap<AppSnapshot, Map<string, DayLift>>();
const memoDay = <T>(cache: WeakMap<AppSnapshot, Map<string, T>>, snap: AppSnapshot, today: ISODate, read: (d: ISODate) => T) => {
  let memo = cache.get(snap);
  if (!memo) cache.set(snap, (memo = new Map()));
  return (d: ISODate) => {
    const k = `${today}|${d}`;
    let r = memo!.get(k);
    if (!r) memo!.set(k, (r = read(d)));
    return r;
  };
};
/** The running chart for a range: one bucket per bar. Each day is read once per snapshot. */
export const runRange = (snap: AppSnapshot, today: ISODate, range: ProgressRange, first: ISODate | null, loaded?: (month: string) => boolean): RunView => {
  const span = rangeSpan(range, today, first);
  return { span, buckets: bucketRuns(span.buckets, memoDay(runCache, snap, today, (d) => runDay(snap, d, today)), today, loaded) };
};
/** The strength chart for a range: lift sessions per bucket, with the sets and pounds behind them. */
export const liftRange = (snap: AppSnapshot, today: ISODate, range: ProgressRange, first: ISODate | null, loaded?: (month: string) => boolean): LiftView => {
  const span = rangeSpan(range, today, first);
  return { span, buckets: bucketLifts(span.buckets, memoDay(liftCache, snap, today, (d) => liftDay(snap, d, today)), today, loaded) };
};
/** Miles for a headline: "18", "18.5"; whole miles from 100 up, with a comma ("1,240"). */
export const miShort = (v: number) => (Math.abs(v) >= 100 ? Math.round(v).toLocaleString('en-US') : String(Math.round(v * 10) / 10));
/** Pounds: "7,450", "12.3K". */
export const lbShort = (v: number) => (v >= 10000 ? `${(v / 1000).toFixed(1)}K` : Math.round(v).toLocaleString('en-US'));

// ---------- the strength list: one card per workout, planned or done ----------
export type LiftStatus = 'done' | 'planned' | 'missed' | 'skipped';
export const LIFT_STATUS_WORD: Record<LiftStatus, string> = { done: 'Done', planned: 'Planned', missed: 'Missed', skipped: 'Skipped' };
export interface LiftItem {
  key: string;
  date: ISODate;
  /** The lift on the plan, when there is one. */
  session: Session | null;
  /** A lift synced from a watch (Strava weight training), when that is all there is. */
  activity: Activity | null;
  /** The day's logged sets (on the day's first lift session when there are two). */
  sets: LiftSet[];
  status: LiftStatus;
  /** The workout's name: the session's ("Strength A"), or "Lifted" for sets with nothing on the plan. */
  title: string;
  /** What it was, or is meant to be: "5 exercises · 18 sets · 7,450 lb"; the plan's details while only planned. */
  detail: string | null;
  /** Both in one line: "Strength A · 5 exercises · 18 sets · 7,450 lb". */
  summary: string;
}

const join = (parts: Array<string | null | undefined | false>) => parts.filter(Boolean).join(' · ');
const minutes = (a: Activity) => `${Math.max(1, Math.round(a.movingSec / 60))} min`;
/** "5 exercises · 18 sets · 7,450 lb"; one exercise is named ("Squat · 3 sets · 2,775 lb"). */
const setsWords = (sets: LiftSet[]) => {
  if (!sets.length) return null;
  const ex = new Set(sets.map((x) => x.exercise.trim().toLowerCase())).size;
  const vol = sets.reduce((t, x) => t + x.weight * x.reps, 0);
  return join([ex === 1 ? sets[0]!.exercise.trim() : `${ex} exercises`, `${sets.length} ${sets.length === 1 ? 'set' : 'sets'}`, vol > 0 ? `${lbShort(vol)} lb` : null]);
};
/** The first line of a session's details, for a lift that is only planned. */
const firstLine = (t: string | null) => t?.split('\n')[0]?.trim() || null;

/**
 * The strength workouts from `from` to the end of this week, newest first: each lift session on the plan (done, planned,
 * missed or skipped), and a day with sets or a synced lift and nothing on the plan ("Lifted"). Days not loaded are left out.
 */
export const liftLog = (snap: AppSnapshot, today: ISODate, from: ISODate): LiftItem[] => {
  const out: LiftItem[] = [];
  for (let d = shiftDays(mondayOf(today), 6); d >= from; d = shiftDays(d, -1)) {
    if (!snap.loaded(monthOf(d))) continue;
    const lifts = snap.sessionsOn(d).filter((s) => s.kind === 'lift');
    const sets = d > today ? [] : snap.liftsOn(d);
    const act = d > today ? null : (snap.activitiesOn(d).find((a) => a.kind === 'lift') ?? null);
    lifts.forEach((s, i) => {
      const st = sessionStatus(snap, d, s);
      const status: LiftStatus = counts(st) ? 'done' : st === 'skipped' ? 'skipped' : st === 'missed' ? 'missed' : 'planned';
      const mine = i === 0 ? sets : [];
      const did = status === 'done' ? (setsWords(mine) ?? (i === 0 && act ? minutes(act) : 'Marked done')) : null;
      const plan = firstLine(s.details) ?? (s.minutes ? `${s.minutes} min` : null);
      const title = label(s);
      const detail = did ?? plan;
      out.push({ key: s.id, date: d, session: s, activity: null, sets: mine, status, title, detail, summary: join([title, detail]) });
    });
    if (!lifts.length && (sets.length || act)) {
      const title = sets.length || !act?.name ? 'Lifted' : act.name;
      const detail = setsWords(sets) ?? (act ? minutes(act) : null);
      out.push({ key: `l-${d}`, date: d, session: null, activity: sets.length ? null : act, sets, status: 'done', title, detail, summary: join([title, detail]) });
    }
  }
  return out;
};
