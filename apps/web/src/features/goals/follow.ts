import { periodName, periodSpan, shiftDays, type Aim, type ISODate } from '@logbook/shared';
import { goalOf } from './model';

/* The rule the review row and the carry-over share (layout plan 2.2 G2, 3.3): never two rows for the same goal. Pure, so
   Goals and Today test the same thing. */

/**
 * Yesterday's day goal when it was reviewed and not hit (partly or missed) and today has no goal yet: the one goal the
 * carry-over offers. An open one is still owed a review, so `ReviewRow` names it (and the review sheet offers the carry
 * after Partly or Missed).
 */
export const carryable = (goals: readonly Aim[] | undefined, today: ISODate): Aim | null => {
  if (goalOf(goals, 'day', today)) return null;
  const y = goalOf(goals, 'day', shiftDays(today, -1));
  return y && (y.status === 'partly' || y.status === 'missed') ? y : null;
};

/** Where an owed goal came from, in a few words: "Yesterday’s goal", "Last week’s goal", else "Still open from Mon, Nov 9". */
export const owedWords = (g: Aim, today: ISODate) => {
  const name = periodName(g.level, g.period, today);
  return /^(Yesterday|Last (week|month|year))$/.test(name) ? `${name}’s goal` : `Still open from ${periodSpan(g.level, g.period)}`;
};

/**
 * The review sheet shows the goals owed one after another, and Done, Partly, Missed stay where they are while the next
 * goal comes in. A second tap in the same place (a double tap) would answer that next goal before anyone has read it, so
 * an answer is held until the goal has been on screen this long.
 */
export const ANSWER_HOLD_MS = 500;
/** Is it too soon to take an answer for a goal that appeared at `shownAt`? Both in ms on the same clock. */
export const answerHeld = (shownAt: number, now: number): boolean => now - shownAt < ANSWER_HOLD_MS;
