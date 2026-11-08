import { fmtDate, mondayOf, num, shiftDays } from '@logbook/shared';
import { PHASE_WORDS, type PhaseWeek, type TrainingPhase } from './phases';

/** What a phase is for, in a few plain words (the phase chip's second line under Plan's title). */
export const PHASE_LINE: Record<TrainingPhase, string> = { base: 'Easy miles first', build: 'Miles climb', peak: 'Biggest weeks', taper: 'Easing off', race: 'Race day ahead' };

/** A block's name without the length it often ends with (`Half marathon · 12 weeks`): a chip has room for the name only. */
export const shortName = (name: string) => name.replace(/\s*·\s*\d+\s*weeks?$/i, '') || name;

/**
 * The phase words for a page: a week's own phase (a down week says so), or, for a month, the phases its weeks run through
 * (`Base to build`, `4 weeks`). Null when none of the page's weeks is in the block.
 */
export const phaseWords = (phases: Record<string, PhaseWeek>, mons: string[]): { phase: TrainingPhase; title: string; sub: string } | null => {
  const ws = mons.map((m) => phases[m]).filter((w): w is PhaseWeek => !!w);
  if (!ws.length) return null;
  const first = ws[0]!;
  if (mons.length === 1) return { phase: first.phase, title: PHASE_WORDS[first.phase], sub: first.down ? 'A lighter week' : PHASE_LINE[first.phase] };
  const last = ws[ws.length - 1]!;
  if (first.phase === last.phase) return { phase: first.phase, title: PHASE_WORDS[first.phase], sub: PHASE_LINE[first.phase] };
  return { phase: last.phase, title: `${PHASE_WORDS[first.phase]} to ${PHASE_WORDS[last.phase].toLowerCase()}`, sub: `${ws.length} weeks` };
};

const tenth = (v: number) => num(Math.round(v * 10) / 10);
const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

/**
 * The head of a week's mileage card: the big number and its unit (what was run, `10.5` `of 26 mi`; a week ahead, what it
 * plans, `26` `mi planned`; nothing at all, a dash, never a zero as the headline), the runs as a status word, and whether
 * the week ran its target.
 */
export const mileageHead = (w: { ran: number; planned: number; runsDone: number; runsPlanned: number; ahead: boolean }) => {
  const { ran, planned, ahead } = w;
  const value = ahead ? (planned ? tenth(planned) : '–') : ran > 0 || planned > 0 ? tenth(ran) : '–';
  const unit = ahead ? 'mi planned' : planned > 0 ? `of ${tenth(planned)} mi` : 'mi';
  const runsWord = w.runsPlanned ? (ahead ? plural(w.runsPlanned, 'run') : `${w.runsDone} of ${plural(w.runsPlanned, 'run')}`) : '';
  return { value, unit, runsWord, hit: !ahead && planned > 0 && ran >= planned - 0.05 };
};

/** A week's name for its section header: `This week`, `Last week`, `Next week`, else `Week of Nov 16`. */
export const weekTitle = (mon: string, today: string) => {
  const now = mondayOf(today);
  return mon === now ? 'This week' : mon === shiftDays(now, -7) ? 'Last week' : mon === shiftDays(now, 7) ? 'Next week' : `Week of ${fmtDate('md', mon)}`;
};
