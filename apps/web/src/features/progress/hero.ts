/**
 * The Progress hero's numbers: planned against done, week by week, for running (miles) and for strength (lift sessions).
 * Pure functions over the snapshot so the card and its tests agree. Nothing here renders.
 */
import { counts, isSkipMark, mondayOf, monthOf, sessionStatus, shiftDays, type ISODate } from '@logbook/shared';
import type { AppSnapshot } from '@/api/snapshot';
import { weekSeries } from './data';

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

/** Weekly run miles, planned (skips left out) against run (activities and runs marked done), from the shared week series. */
export const runWeeks = (snap: AppSnapshot, today: ISODate, loaded?: (month: string) => boolean): RunWeek[] =>
  weekSeries(snap, today, '3M', loaded)
    .filter((p) => !p.future)
    .slice(-HERO_WEEKS)
    .map((p) => ({ w: p.w, planned: p.planned, done: p.ran, runs: p.runs, plannedRuns: p.plannedRuns, current: p.current, missing: !!p.missing }));

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
export const weekRate = (p: BarWeek) => (p.planned > 0 ? Math.min(1, p.done / p.planned) : null);

/** Miles for a headline: "18", "18.5". */
export const miShort = (v: number) => String(Math.round(v * 10) / 10);
/** Pounds: "7,450", "12.3K". */
export const lbShort = (v: number) => (v >= 10000 ? `${(v / 1000).toFixed(1)}K` : Math.round(v).toLocaleString('en-US'));
