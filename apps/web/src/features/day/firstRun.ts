import { shiftDays, toISO, type ISODate } from '@logbook/shared';
import type { Log } from '../log/useLog';

/**
 * Nothing is set up as far as the months and the bootstrap say: no plan (no block, no session a week either side), no habits,
 * no run, nothing written today. Today only. The first-run face also needs "no to-dos and no goals" (`nothingSetUp`): the day
 * page reads those two lists only on a day that passes this test, so every other day page never subscribes to them.
 */
export const looksNew = (log: Pick<Log, 'today' | 'habits' | 'boot' | 'snap'>, date: ISODate): boolean => {
  if (date !== log.today || log.habits.length || log.boot?.blocks?.length) return false;
  const around = Array.from({ length: 16 }, (_, i) => shiftDays(log.today, i - 7));
  if (around.some((d) => log.snap.sessionsOn(d).length > 0 || log.snap.activitiesOn(d).length > 0)) return false;
  return !log.snap.journalOn(date).length;
};

/** The rest of the first-run test, on a day that `looksNew`: not one to-do and not one goal. */
export const nothingSetUp = (todos: readonly unknown[], goals: readonly unknown[]): boolean => todos.length === 0 && goals.length === 0;

/** The local day setup was finished on (the account's `onboardedAt`, a timestamp), or null when it has none or it does not parse. */
export const setupDay = (onboardedAt: string | null | undefined): ISODate | null => {
  if (!onboardedAt) return null;
  const d = new Date(onboardedAt);
  return Number.isNaN(d.getTime()) ? null : toISO(d);
};

/**
 * The first day: today is the day setup was finished and nothing is on it yet (a plan made in setup starts tomorrow, so
 * there is no session, and no run has been logged). On that day the training card would only say "Nothing planned", so
 * Today leads with the day's own poster, whole: its lit stop ("Set this goal", from the idea in the band) is the one
 * first move, in place. From the first session or run on, and on every later day, the training card leads as always.
 */
export const isFirstDay = (log: Pick<Log, 'today' | 'boot' | 'snap'>, date: ISODate): boolean =>
  date === log.today && setupDay(log.boot?.user?.onboardedAt) === date && log.snap.sessionsOn(date).length === 0 && log.snap.activitiesOn(date).length === 0;
