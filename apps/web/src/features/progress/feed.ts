/**
 * Progress's other numbers: the metric source built from the loaded months, and freshness words. Pure: the page and the
 * tests share them.
 */
import { dayStatus, monthOf, type ISODate } from '@logbook/shared';
import type { AppSnapshot } from '@/api/snapshot';
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
