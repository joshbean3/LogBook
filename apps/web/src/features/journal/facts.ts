import { periodOf, sessionKey, type Aim, type Habit, type ISODate, type Todo } from '@logbook/shared';
import type { AppSnapshot } from '@/api/snapshot';
import { runStamp } from './prompt';

/** `8:14` from seconds per mile. */
const pace = (secPerMile: number) => {
  const s = Math.round(secPerMile);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const miles = (m: number) => `${Math.round(m * 100) / 100} mi`;

export interface FactsInput {
  snap: AppSnapshot;
  date: ISODate;
  habits: readonly Habit[];
  goals: readonly Aim[] | undefined;
  todos: readonly Todo[] | undefined;
  /** The day's energy pick (1 to 5), when there is one. */
  energy?: number | null;
}

/**
 * What happened that day, as quiet facts: the run (its name, the miles and pace), the habits kept, the day goal's outcome,
 * the to-dos done. Each is a short phrase; the page joins them with " · ". Nothing absent is named.
 */
export const dayFacts = ({ snap, date, habits, goals, todos, energy }: FactsInput): string[] => {
  const out: string[] = [];
  const stamp = runStamp(snap, date);
  const runs = snap.runsOn(date);
  const ran = runs.reduce((a, r) => a + (r.miles || 0), 0);
  const sec = runs.reduce((a, r) => a + (r.movingSec || 0), 0);
  if (stamp) out.push(stamp);
  if (ran > 0) out.push(sec > 0 ? `${miles(ran)} at ${pace(sec / ran)}` : miles(ran));
  // other kept sessions that are not the run (a lift, cross-training)
  for (const s of snap.sessionsOn(date)) {
    if (s.kind === 'run' || s.kind === 'rest') continue;
    const k = sessionKey(snap, date, s);
    if (k === 'done' || k === 'floor') out.push(s.title || s.type || s.kind);
  }
  const live = habits.filter((h) => h.createdOn <= date && (!h.archivedOn || h.archivedOn > date));
  if (live.length) {
    const kept = live.filter((h) => snap.isHabitDone(date, h.id)).length;
    if (kept > 0) out.push(`${kept} of ${live.length} habits`);
  }
  const goal = goals?.find((g) => g.level === 'day' && g.period === periodOf('day', date));
  if (goal && goal.status !== 'open') out.push(`goal ${goal.status}`);
  const done = (todos ?? []).filter((t) => t.doneOn === date && !t.deletedOn).length;
  if (done > 0) out.push(`${done} ${done === 1 ? 'to-do' : 'to-dos'}`);
  if (energy) out.push(`energy ${energy}/5`);
  return out;
};

/** Run miles over a set of dates, for a month's meta ("84 mi"). */
export const milesOn = (snap: AppSnapshot, dates: readonly ISODate[]): number => dates.reduce((a, d) => a + snap.runsOn(d).reduce((b, r) => b + (r.miles || 0), 0), 0);
