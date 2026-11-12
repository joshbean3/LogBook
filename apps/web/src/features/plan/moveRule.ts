import { heroSession, type Session } from '@logbook/shared';
import { useReshape } from '../sessions/reshape';

/**
 * Where a session goes when it is moved (the Move sheet; code review 2 #3, feel review 2 C):
 * WP2's `reshape`, whose `dropPlan` moves (never swaps) a session from a day already past onto today or later
 * (`movesOnly`, review-feel-1 #9) and anywhere else swaps with the day's lead session.
 */
export { movesOnly } from '../sessions/reshape';
export const useMoveTo = () => useReshape().reshape;

const isTraining = (s: Session) => s.kind !== 'rest';
/** The order a day's stops are drawn in (weekStops.ts): the lead session first, then the rest as stored. */
export const dayOrder = (sessions: Session[]) => {
  const training = sessions.filter(isTraining);
  const lead = heroSession(training);
  return lead ? [lead, ...training.filter((x) => x !== lead)] : [];
};
