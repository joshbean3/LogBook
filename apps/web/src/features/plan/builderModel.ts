import { fmtDate, shiftDays, weekdayIndex, type PlanBlock, type TrainingProfile, type Weekday } from '@logbook/shared';

/** What the builder starts from (contracts §F). Days are Monday-based indices (0 = Monday … 6 = Sunday, `weekdayIndex`). */
export interface BuilderPrefill {
  goal?: string;
  runDays?: number[];
  longRunDay?: number;
  weeklyMiles?: number;
  startDate: string;
}

/**
 * The next block after `block` (spec §7.4): the goal, run days, long-run day and weekly miles from the account's training
 * answers, starting the day after `block` ends.
 */
export const fromEndingBlock = (block: PlanBlock, profile: TrainingProfile): BuilderPrefill => ({
  goal: profile.goal,
  runDays: profile.runDays.map(weekdayIndex),
  longRunDay: weekdayIndex(profile.longRunDay),
  weeklyMiles: profile.weeklyMiles,
  startDate: shiftDays(block.end, 1),
});

/**
 * The builder's verb (spec §7.4): it says what a tap does, on one line. `existing` planned sessions would be replaced; the
 * date they go from is in the note above the button (`builderNote`).
 */
export const builderVerb = (existing: number) => (existing > 0 ? `Replace ${existing} ${existing === 1 ? 'session' : 'sessions'}` : 'Use this plan');
/** The line above the verb: what a replace clears and from when, or when the plan starts. */
export const builderNote = (existing: number, from: string, start: string) =>
  existing > 0 ? `Clears planned sessions from ${fmtDate('md', from)}. What you’ve done stays, and Undo puts it all back.` : `Starts ${fmtDate('short', start)}. Nothing is saved until you use it.`;

/**
 * The Start tomorrow row's line. A start that is not a Monday says both days: the plan starts then with a warm-up week,
 * and week 1 is the Monday after (`Starts Wednesday. Week 1 is Nov 16`).
 */
export const startWords = (soon: boolean, startDate: string, firstMon: string, set = false) =>
  !soon
    ? // a set first day (the day after an ending plan, or one the assistant was given) is when it starts with the switch off
      set
      ? `Else it starts ${fmtDate('md', startDate)}`
      : 'Else it starts next Monday'
    : startDate === firstMon
      ? `Week 1 starts ${fmtDate('md', startDate)}`
      : `Starts ${fmtDate('dowLong', startDate)}. Week 1 is ${fmtDate('md', firstMon)}`;

const RACE_DAY: Record<Weekday, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
/** The race switch's title: race day is in the plan's last week, on a Sunday unless the assistant was given another day. */
export const raceRowWords = (raceDay: Weekday) => `Race on the last ${RACE_DAY[raceDay]}`;

/** A typed number held to its range (a value outside it used to snap back to the old one with no word). */
export const clampTyped = (s: string, min: number, max: number): number | null => (Number(s) > 0 ? Math.min(max, Math.max(min, Math.round(Number(s)))) : null);
