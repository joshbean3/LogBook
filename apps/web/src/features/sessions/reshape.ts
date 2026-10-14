import { counts, fmtDate, heroSession, isSkipMark, label, sessionStatus, shiftDays, tone, type Session, type SessionInput } from '@logbook/shared';
import { useSessionMutations } from '@/api/queries';
import type { Log } from '../log/useLog';

/**
 * Reshaping a week: move a session to another day, swap it with what is there, and ease the days after a sick day.
 * Pure helpers first (tested by eye in REVIEW.md), then the hook that writes them.
 */

/** A hard day: a run that is not easy (quality or long) and not skipped. Two in a row is what the drop warns about. */
export const isHardSession = (s: Session) => s.kind === 'run' && !isSkipMark(s.mark) && (tone(s) === 'hard' || tone(s) === 'fast' || tone(s) === 'long');

type SessionsOn = (d: string) => Session[];

/** The sessions a day would hold after some sessions move. */
const after = (sessionsOn: SessionsOn, moves: Array<{ s: Session; to: string }>) => {
  const ids = new Set(moves.map((m) => m.s.id));
  return (d: string) => [...sessionsOn(d).filter((x) => !ids.has(x.id)), ...moves.filter((m) => m.to === d).map((m) => ({ ...m.s, date: d }))];
};

/** After these moves, does any of `days` sit next to another hard day while being hard itself? */
export const hardPair = (sessionsOn: SessionsOn, moves: Array<{ s: Session; to: string }>, days: string[]): string[] | null => {
  const on = after(sessionsOn, moves);
  const hard = (d: string) => on(d).some(isHardSession);
  for (const d of days) {
    if (!hard(d)) continue;
    if (hard(shiftDays(d, -1))) return [shiftDays(d, -1), d];
    if (hard(shiftDays(d, 1))) return [d, shiftDays(d, 1)];
  }
  return null;
};

/**
 * What dropping `s` on `to` does: a move, or a swap with the session that leads that day (its hero), when that one is not
 * already kept (a done session stays where it happened). Rest swaps too, so a rest day changes places with a run.
 */
export const dropPlan = (log: Log, s: Session, from: string, to: string): { swapWith: Session | null } => {
  const there = log.snap.sessionsOn(to).filter((x) => x.id !== s.id);
  const lead = heroSession(there);
  if (!lead) return { swapWith: null };
  if (counts(sessionStatus(log.snap, to, lead))) return { swapWith: null };
  // a lift beside a run on the target day stays put; only the day's lead changes places
  return { swapWith: from === to ? null : lead };
};

export interface ReshapeResult {
  swapped: Session | null;
  /** Two hard days back to back after the change: the pair of dates. */
  conflict: string[] | null;
  /** Puts everything back where it was. */
  undo: () => void;
  /** Words for the toast: "Moved to Fri, Oct 16" / "Swapped with Easy 4". */
  said: string;
}

/** Move or swap, optimistically, and say what happened. The caller picks the haptic and the toast. */
export const useReshape = () => {
  const { move, upsert, mark } = useSessionMutations();
  const reshape = (log: Log, s: Session, from: string, to: string): ReshapeResult | null => {
    if (from === to) return null;
    const { swapWith } = dropPlan(log, s, from, to);
    const moves = [{ s, to }, ...(swapWith ? [{ s: swapWith, to: from }] : [])];
    const conflict = hardPair(log.snap.sessionsOn, moves, [from, to]);
    move.mutate({ session: s, to });
    if (swapWith) move.mutate({ session: swapWith, to: from });
    const undo = () => {
      move.mutate({ session: { ...s, date: to }, to: from });
      if (swapWith) move.mutate({ session: { ...swapWith, date: from }, to });
    };
    const said = swapWith ? `Swapped with ${swapWith.kind === 'rest' ? 'rest' : label(swapWith)}` : `Moved to ${fmtDate('short', to)}`;
    return { swapped: swapWith, conflict, undo, said };
  };

  /**
   * "Not feeling 100%": the session is skipped as `sick` (it keeps the week), and the next three days can be eased:
   * quality runs become Easy at 70% (never under 3 mi), a long run drops to 75%. Returns the undo for the easing.
   */
  const easeAfter = (log: Log, date: string, days = 3): { eased: number; undo: () => void } => {
    const before: Session[] = [];
    for (let i = 1; i <= days; i++) {
      const d = shiftDays(date, i);
      for (const x of log.snap.sessionsOn(d)) {
        if (x.kind !== 'run' || isSkipMark(x.mark) || counts(sessionStatus(log.snap, d, x))) continue;
        const t = tone(x);
        if (t !== 'hard' && t !== 'fast' && t !== 'long') continue;
        const miles = Number(x.miles) || 0;
        const r05 = (v: number) => Math.round(v * 2) / 2;
        const next: SessionInput & { prevDate: string } =
          t === 'long'
            ? { id: x.id, prevDate: d, date: d, kind: 'run', type: x.type, title: null, details: x.details, miles: miles ? r05(miles * 0.75) : null, minutes: x.minutes }
            : { id: x.id, prevDate: d, date: d, kind: 'run', type: 'Easy', title: null, details: null, miles: miles ? Math.max(3, r05(miles * 0.7)) : null, minutes: x.minutes };
        before.push(x);
        upsert.mutate(next);
      }
    }
    const undo = () => {
      for (const x of before) upsert.mutate({ id: x.id, prevDate: x.date, date: x.date, kind: x.kind, type: x.type, title: x.title, details: x.details, miles: x.miles, minutes: x.minutes });
    };
    return { eased: before.length, undo };
  };

  const sick = (s: Session) => mark.mutate({ session: s, mark: 'sick' });
  return { reshape, easeAfter, sick };
};
