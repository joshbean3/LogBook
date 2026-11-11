/**
 * The Progress hero's numbers: planned against done, week by week, for running (miles) and for strength (lift sessions).
 * Pure functions over the snapshot so the card and its tests agree. Nothing here renders.
 */
import { counts, isSkipMark, label, mondayOf, monthOf, sessionStatus, shiftDays, type Activity, type ISODate, type LiftSet, type Session } from '@logbook/shared';
import type { AppSnapshot } from '@/api/snapshot';
import { dayMiles } from '../sessions/miles';
import { bucketRuns, bucketsBetween, rangeSpan, type DayRun, type ProgressRange, type RangeSpan, type RunBucket } from './ranges';

export type HeroMode = 'run' | 'lift';
export const HERO_MODES: HeroMode[] = ['run', 'lift'];
/** Weeks in the chart, this one included. No weeks ahead: the card is about what was planned and what got done. */
export const HERO_WEEKS = 12;
/** The window behind "86% over the last 4 weeks". */
export const RATE_WEEKS = 4;

/** One bar: what the week planned and what got done, in the mode's unit (miles, or sessions). */
export interface BarWeek {
  /** Monday. */
  w: ISODate;
  planned: number;
  done: number;
  current: boolean;
  /** A day of this week falls in a month that has not loaded: a quiet gap, left out of every summary. */
  missing: boolean;
}
export interface RunWeek extends BarWeek {
  runs: number;
  plannedRuns: number;
}
export interface LiftWeek extends BarWeek {
  sets: number;
  /** Weight times reps over every set, in pounds. */
  volume: number;
}

const days7 = (w: ISODate) => Array.from({ length: 7 }, (_, i) => shiftDays(w, i));
const isMissing = (w: ISODate, loaded?: (month: string) => boolean) => (loaded ? days7(w).some((d) => !loaded(monthOf(d))) : false);

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

export interface RunView {
  span: RangeSpan;
  /** The chart's points, in the span's unit. */
  buckets: RunBucket[];
  /** The same days by week: what the plan kept is graded by the week whatever the chart's unit. */
  weeks: RunBucket[];
}
/** Days already read, per snapshot (a new snapshot, new data, starts over): switching ranges reads no day twice. */
const dayCache = new WeakMap<AppSnapshot, Map<string, DayRun>>();
/** The running chart for a range: its buckets, and the same days by week. Each day is read once per snapshot. */
export const runRange = (snap: AppSnapshot, today: ISODate, range: ProgressRange, first: ISODate | null, loaded?: (month: string) => boolean): RunView => {
  const span = rangeSpan(range, today, first);
  let memo = dayCache.get(snap);
  if (!memo) dayCache.set(snap, (memo = new Map()));
  const day = (d: ISODate) => {
    const k = `${today}|${d}`;
    let r = memo!.get(k);
    if (!r) memo!.set(k, (r = runDay(snap, d, today)));
    return r;
  };
  const buckets = bucketRuns(span.buckets, day, today, loaded);
  const weeks = span.unit === 'week' ? buckets : bucketRuns(bucketsBetween('week', span.from, span.to, today), day, today, loaded);
  return { span, buckets, weeks };
};

/**
 * Weekly lift sessions. Planned: lift sessions on the plan, skips left out. Done: planned lifts that count (sets logged, a
 * lift activity, or marked done), plus a day with sets or a lift activity and no lift on the plan. Sets and volume come
 * from the logged sets.
 */
export const liftWeeks = (snap: AppSnapshot, today: ISODate, loaded?: (month: string) => boolean): LiftWeek[] => {
  const mon = mondayOf(today);
  return Array.from({ length: HERO_WEEKS }, (_, i) => {
    const w = shiftDays(mon, (i - HERO_WEEKS + 1) * 7);
    let planned = 0;
    let done = 0;
    let sets = 0;
    let volume = 0;
    for (const d of days7(w)) {
      const lifts = snap.sessionsOn(d).filter((s) => s.kind === 'lift' && !isSkipMark(s.mark));
      planned += lifts.length;
      if (d > today) continue;
      const ls = snap.liftsOn(d);
      sets += ls.length;
      volume += ls.reduce((s, x) => s + x.weight * x.reps, 0);
      const kept = lifts.filter((s) => counts(sessionStatus(snap, d, s))).length;
      const any = ls.length > 0 || snap.activitiesOn(d).some((a) => a.kind === 'lift');
      done += kept || (any ? 1 : 0);
    }
    return { w, planned, done, sets, volume, current: w === mon, missing: isMissing(w, loaded) };
  });
};

/**
 * How much of the plan got done over the last finished weeks that had a plan: done capped at planned each week (a big week
 * does not pay for a missed one), over planned. Null with no finished planned week in the window.
 */
export const completion = (weeks: BarWeek[], n = RATE_WEEKS): { rate: number; weeks: number } | null => {
  const done = weeks.filter((p) => !p.current && !p.missing && p.planned > 0).slice(-n);
  if (!done.length) return null;
  const planned = done.reduce((s, p) => s + p.planned, 0);
  const got = done.reduce((s, p) => s + Math.min(p.done, p.planned), 0);
  return { rate: got / planned, weeks: done.length };
};

/** One week's share of its plan, capped at 100%; null with nothing planned. */
export const weekRate = (p: Pick<BarWeek, 'planned' | 'done'>) => (p.planned > 0 ? Math.min(1, p.done / p.planned) : null);

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
