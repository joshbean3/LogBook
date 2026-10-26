import { heroSession, type Session } from '@logbook/shared';
import type { Log } from '../log/useLog';
import { dropPlan, useReshape } from '../sessions/reshape';

/**
 * Where a session goes when it is moved, one rule for Plan's drag and the Move sheet (code review 2 #3, feel review 2 C):
 * WP2's `reshape`, whose `dropPlan` moves (never swaps) a session from a day already past onto today or later
 * (`movesOnly`, review-feel-1 #9) and anywhere else swaps with the day's lead session.
 */
export { movesOnly } from '../sessions/reshape';
export const useMoveTo = () => useReshape().reshape;

const isTraining = (s: Session) => s.kind !== 'rest';
/** The order a day's rows are drawn in (Week.tsx's DayRow): the lead session first, then the rest as stored. */
export const dayOrder = (sessions: Session[]) => {
  const training = sessions.filter(isTraining);
  const lead = heroSession(training);
  return lead ? [lead, ...training.filter((x) => x !== lead)] : [];
};

/**
 * The row `s` will occupy on `to` once moved there (0 = the day's first row), so the drag's pill flies to the slot the new
 * row appears in (feel review 2 E): a swap puts it first; a move only joins what is there (the write appends it).
 */
export const landingIndex = (log: Log, s: Session, from: string, to: string) => {
  const there = log.snap.sessionsOn(to).filter((x) => x.id !== s.id);
  if (dropPlan(log, s, from, to).swapWith) return 0;
  const i = dayOrder([...there, { ...s, date: to }]).findIndex((x) => x.id === s.id);
  return Math.max(0, i);
};
