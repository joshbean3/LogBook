import { fmtDate, heroSession, type Session } from '@logbook/shared';
import { useSessionMutations } from '@/api/queries';
import type { Log } from '../log/useLog';
import { dropPlan, hardPair, useReshape, type ReshapeResult } from '../sessions/reshape';

/**
 * Where a session goes when it is moved, one rule for Plan's drag and the Move sheet (code review 2 #3, feel review 2 C).
 *
 * From a day already past onto today or later, the session moves and the day it lands on keeps what it has: a swap would
 * send that day's session into the past, where it reads `Missed` (review-feel-1 #9). The two then sit under one label.
 * Anywhere else a move onto a day with something on it swaps with that day's lead session (`reshape`), as before.
 */
export const movesOnly = (from: string, to: string, today: string) => from < today && to >= today;

export const useMoveTo = () => {
  const { reshape } = useReshape();
  const { move } = useSessionMutations();
  return (log: Log, s: Session, from: string, to: string): ReshapeResult | null => {
    if (from === to) return null;
    if (!movesOnly(from, to, log.today)) return reshape(log, s, from, to);
    const conflict = hardPair(log.snap.sessionsOn, [{ s, to }], [from, to]);
    move.mutate({ session: s, to });
    return { swapped: null, conflict, undo: () => move.mutate({ session: { ...s, date: to }, to: from }), said: `Moved to ${fmtDate('short', to)}` };
  };
};

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
  if (!movesOnly(from, to, log.today) && dropPlan(log, s, from, to).swapWith) return 0;
  const i = dayOrder([...there, { ...s, date: to }]).findIndex((x) => x.id === s.id);
  return Math.max(0, i);
};
