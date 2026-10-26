import { fmtDate, shiftDays, weekdayIndex, type PlanBlock, type TrainingProfile } from '@logbook/shared';

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

/** The builder's verb (spec §7.4): it says what a tap does. `existing` planned sessions would be replaced from `from`. */
export const builderVerb = (existing: number, from: string) => (existing > 0 ? `Replace ${existing} planned ${existing === 1 ? 'session' : 'sessions'} from ${fmtDate('md', from)}` : 'Use this plan');
