import { daysBetween, fmtDate, mondayOf, shiftDays, type PlanBlock } from '@logbook/shared';
import { shortName } from './context';
import { PHASE_WORDS, type PhaseWeek } from './phases';

/**
 * A block's weeks as the builder numbers them (code review 2 #9): Monday-based, after a lead-in when it does not start on
 * a Monday (`·, W1, W2 …` in the builder's grid). `firstMon` is week 1's Monday; `weekOf(d)` is 0 in the lead-in.
 */
export const firstMonOf = (b: PlanBlock) => (mondayOf(b.start) === b.start ? b.start : shiftDays(mondayOf(b.start), 7));
export const planWeeks = (b: PlanBlock) => {
  const m = firstMonOf(b);
  return b.end < m ? 1 : Math.floor(daysBetween(m, b.end) / 7) + 1;
};
export const weekOf = (b: PlanBlock, d: string) => {
  const m = firstMonOf(b);
  return d < m ? 0 : Math.min(planWeeks(b), Math.floor(daysBetween(m, d) / 7) + 1);
};

/** A short date that never breaks between the month and the day (`Nov 16`). */
const md = (d: string) => fmtDate('md', d).replace(' ', ' ');

/** What Plan's plan card reads from the block (BlockCardData's fields). */
export interface TopBlock {
  t: string;
  b: PlanBlock | null;
  st: 'Upcoming' | 'Finished' | 'Active';
  weeks: number;
  wk: number;
  phases: Record<string, PhaseWeek>;
}

/**
 * The plan card across the top of Plan: the plan's name, one line on where it stands (`Week 3 of 12 · Build`, a down week
 * or race week said so; `Lead-in · Week 1 starts Nov 16`; `Starts Tuesday · 12 weeks`; `Ended Feb 7`), and how far through
 * the block today is (0 to 1: the days from week 1's Monday over its weeks; 0 before, 1 after). Null with no block.
 */
export const planCardWords = (d: TopBlock): { title: string; state: string; progress: number } | null => {
  const b = d.b;
  if (!b) return null;
  const title = shortName(b.name);
  const soon = (day: string) => (daysBetween(d.t, day) <= 6 ? fmtDate('dowLong', day) : md(day));
  if (d.st === 'Upcoming') return { title, state: `Starts ${soon(b.start)} · ${d.weeks} ${d.weeks === 1 ? 'week' : 'weeks'}`, progress: 0 };
  if (d.st === 'Finished') return { title, state: `Ended ${md(b.end)}`, progress: 1 };
  if (!d.wk) return { title, state: `Lead-in · Week 1 starts ${soon(firstMonOf(b))}`, progress: 0 };
  const ph = d.phases[mondayOf(d.t)];
  const phase = !ph ? '' : ph.phase === 'race' ? ' · Race week' : ph.down ? ' · Down week' : ` · ${PHASE_WORDS[ph.phase]}`;
  const progress = Math.min(1, Math.max(0, (daysBetween(firstMonOf(b), d.t) + 1) / (d.weeks * 7)));
  return { title, state: `Week ${d.wk} of ${d.weeks}${phase}`, progress };
};
