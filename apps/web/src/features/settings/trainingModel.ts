/**
 * Checks on a change to the training answers before a plan is rebuilt from them (Settings, You and Training).
 */

/** A rebuild that raises the week by more than this share is warned about first. */
export const MILES_JUMP = 0.3;

/**
 * The jump in weekly miles a rebuild would make, when it is more than 30% over what the person runs now: the two numbers
 * and the rise in percent. Null when there is nothing to warn about (no current plan, a drop, a rise of 30% or less).
 */
export const milesJump = (from: number | null | undefined, to: number): { from: number; to: number; pct: number } | null => {
  if (!from || from <= 0 || !(to > from * (1 + MILES_JUMP))) return null;
  return { from, to, pct: Math.round(((to - from) / from) * 100) };
};
/** The warning the Rebuild card shows for it. */
export const jumpWords = (j: { from: number; to: number; pct: number }): string => `That is ${j.pct}% more than now, ${j.from} to ${j.to} miles a week. Jumps this big are where injuries tend to start.`;

/** Said under the run days when the last one is tapped: a plan needs one. */
export const LAST_RUN_DAY = 'Keep at least one run day.';
