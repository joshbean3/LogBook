import { shiftDays, type ISODate } from '@logbook/shared';
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
