import { daysBetween, fmtDate, mondayOf, monthOf, shiftDays, type PlanBlock } from '@logbook/shared';
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

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;
/** A short date that never breaks between the month and the day (`Nov 16`). */
const md = (d: string) => fmtDate('md', d).replace(' ', ' ');

/** What Plan's two top cards read from the block (BlockCardData's fields). */
export interface TopBlock {
  t: string;
  b: PlanBlock | null;
  st: 'Upcoming' | 'Finished' | 'Active';
  weeks: number;
  wk: number;
  phases: Record<string, PhaseWeek>;
  race: string | null;
}

/**
 * Where a week sits in the plan, in words for the week card: `Week 3 of 12` and its phase (`Build`, `Down week`, `Taper`,
 * `Race week`), the lead-in before week 1, or the week's dates when it is outside the plan (with when the plan starts or
 * ended).
 */
export const weekCardWords = (d: Pick<TopBlock, 'b' | 'weeks' | 'phases' | 't'>, mon: string): { title: string; sub: string; inPlan: boolean } => {
  const sun = shiftDays(mon, 6);
  const range = `${fmtDate('md', mon)} – ${monthOf(sun) === monthOf(mon) ? String(+sun.slice(8)) : fmtDate('md', sun)}`;
  const b = d.b;
  if (!b) return { title: range, sub: 'No plan running', inPlan: false };
  if (sun < b.start) return { title: range, sub: `Plan starts ${md(b.start)}`, inPlan: false };
  if (mon > b.end) return { title: range, sub: `Plan ${b.end < d.t ? 'ended' : 'ends'} ${md(b.end)}`, inPlan: false };
  const n = weekOf(b, sun < b.end ? sun : b.end);
  if (!n) return { title: 'Lead-in', sub: `Week 1 starts ${md(firstMonOf(b))}`, inPlan: true };
  const ph = d.phases[mon];
  const sub = !ph ? range : ph.phase === 'race' ? 'Race week' : ph.down ? 'Down week' : PHASE_WORDS[ph.phase];
  return { title: `Week ${n} of ${d.weeks}`, sub, inPlan: true };
};

/**
 * The plan in words for the plan card: its name; the race day, `Steady build` for a block with no race that builds, else
 * its last day; and where it stands (when it starts, the weeks to go, finished).
 */
export const planCardWords = (d: Pick<TopBlock, 'b' | 'weeks' | 'wk' | 'st' | 'race' | 't'>): { title: string; sub: string; foot: string } | null => {
  const b = d.b;
  if (!b) return null;
  const sub = d.race ? `Race ${md(d.race)}` : /\b(base|build|general|maintain|steady)\b/i.test(b.name) ? 'Steady build' : `Ends ${md(b.end)}`;
  const soon = (day: string) => (daysBetween(d.t, day) <= 6 ? fmtDate('dowLong', day) : md(day));
  const left = d.weeks - d.wk;
  const foot = d.st === 'Upcoming' ? `Starts ${soon(b.start)}` : d.st === 'Finished' ? `Finished ${md(b.end)}` : !d.wk ? `Week 1 starts ${soon(firstMonOf(b))}` : left ? `${plural(left, 'week')} to go` : 'Last week';
  return { title: shortName(b.name), sub, foot };
};
