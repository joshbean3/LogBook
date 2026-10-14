import { monthOf, today, type Activity, type HabitCheck, type JournalEntry, type LiftSet, type Session, type Snapshot } from '@logbook/shared';
import { useMemo } from 'react';
import type { MonthBundle } from './types';

/** The shared status rules read the world through this; here it's built from whatever months are cached. */
export interface AppSnapshot extends Snapshot {
  loaded(month: string): boolean;
  checksOn(date: string): HabitCheck[];
  checkOf(date: string, habitId: string): HabitCheck | undefined;
  isHabitDone(date: string, habitId: string): boolean;
  liftsOn(date: string): LiftSet[];
  journalOn(date: string): JournalEntry[];
  coachOn(date: string, key: string): string | null;
  morningOverride(date: string): MonthBundle['morningDays'][string] | null;
  runsOn(date: string): Activity[];
}

export const buildSnapshot = (bundles: Record<string, MonthBundle>, t = today(), easyPace: number | null = null): AppSnapshot => {
  const byDate = <T>(pick: (b: MonthBundle) => T[], dateOf: (x: T) => string) => {
    const cache = new Map<string, T[]>();
    return (d: string): T[] => {
      const hit = cache.get(d);
      if (hit) return hit;
      const b = bundles[monthOf(d)];
      const out = b ? pick(b).filter((x) => dateOf(x) === d) : [];
      cache.set(d, out);
      return out;
    };
  };
  const sessionsOn = byDate((b) => b.sessions, (s: Session) => s.date);
  const activitiesOn = byDate((b) => b.activities, (a: Activity) => a.date);
  const checksOn = byDate((b) => b.checks, (c: HabitCheck) => c.date);
  const liftsOn = byDate((b) => b.lifts, (l: LiftSet) => l.date);
  const journalOn = byDate((b) => b.journal, (j: JournalEntry) => j.date);
  return {
    today: t,
    easyPace,
    sessionsOn: (d) => [...sessionsOn(d)].sort((a, b) => a.position - b.position),
    activitiesOn,
    liftSetCountOn: (d) => liftsOn(d).length,
    loaded: (m) => !!bundles[m],
    checksOn,
    checkOf: (d, id) => checksOn(d).find((c) => c.habitId === id),
    isHabitDone: (d, id) => !!checksOn(d).find((c) => c.habitId === id)?.done,
    liftsOn,
    journalOn: (d) => [...journalOn(d)].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    coachOn: (d, key) => bundles[monthOf(d)]?.coach.find((c) => c.date === d && c.key === key)?.text ?? null,
    morningOverride: (d) => bundles[monthOf(d)]?.morningDays[d] ?? null,
    runsOn: (d) => activitiesOn(d).filter((a) => a.kind === 'run'),
  };
};

/** `easyPace` (sec/mi) lets a run logged without Strava count its floor minutes as miles at your own pace. */
export const useSnapshot = (bundles: Record<string, MonthBundle>, t: string, easyPace: number | null = null) => useMemo(() => buildSnapshot(bundles, t, easyPace), [bundles, t, easyPace]);
