import { fmtDate, shiftDays } from '@logbook/shared';

/** The seven days the lights show: six days ago (left) to tonight (right). "This week" on this page means these. */
export const lastSeven = (today: string): string[] => Array.from({ length: 7 }, (_, i) => shiftDays(today, i - 6));

const NARROW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
export const letterOf = (d: string): string => {
  const [y, m, day] = d.split('-').map(Number) as [number, number, number];
  return NARROW[new Date(Date.UTC(y, m - 1, day)).getUTCDay()]!;
};

export interface LearnedWeek {
  /** The six days before tonight, oldest first, for `WeekLights`. */
  days: Array<{ date: string; letter: string; lit: boolean }>;
  /** How many of those six have a line. */
  before: number;
  /** Tonight has its line. */
  tonight: boolean;
  /** Lines kept this week: a light each, tonight's included once it is kept. */
  kept: number;
}

/**
 * The week as the lights draw it. A light is a day with a line, so the count is of lights: a second line on the same day
 * adds no light. A missed day is an unlit light and changes nothing else.
 */
export const learnedWeek = (today: string, lit: ReadonlySet<string>): LearnedWeek => {
  const days = lastSeven(today)
    .slice(0, 6)
    .map((date) => ({ date, letter: letterOf(date), lit: lit.has(date) }));
  const before = days.filter((d) => d.lit).length;
  const tonight = lit.has(today);
  return { days, before, tonight, kept: before + (tonight ? 1 : 0) };
};

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh'] as const;
/** "third" for 3. The week has seven lights, so seven is as far as it goes. */
export const ordinal = (n: number): string => ORDINALS[Math.min(Math.max(n, 1), 7) - 1]!;

export const linesKept = (n: number): string => `${n} ${n === 1 ? 'line' : 'lines'} kept`;

/**
 * The band's two lines. Before writing: the count so far and which light tonight's line would be ("Tonight's line lights
 * the third"); with none kept this week, an invitation. After: the count alone. Lines kept, never days in a row.
 * `everKept`: the person has kept a line before this week (so "first" means this week's first, not their first ever).
 */
export const bandWords = (week: LearnedWeek, everKept: boolean): { label: string; words: string } => {
  if (week.tonight) return { label: 'This week', words: linesKept(week.kept) };
  if (week.before === 0) return { label: 'This week', words: everKept ? 'Tonight’s line lights the first' : 'Your first line lights tonight' };
  return { label: `This week · ${linesKept(week.before)}`, words: `Tonight’s line lights the ${ordinal(week.before + 1)}` };
};

const LIST = new Intl.ListFormat('en-US', { style: 'long', type: 'conjunction' });

/**
 * The lights' one VoiceOver label: the count, the days that are lit by name, and whether tonight's line is kept.
 * "2 lines kept this week, on Monday and Wednesday. Tonight's line is not written yet." Tonight is said by the last
 * sentence, not in the list of days.
 */
export const lightsLabel = (week: LearnedWeek): string => {
  const names = week.days.filter((d) => d.lit).map((d) => fmtDate('dowLong', d.date));
  const head = week.kept ? `${linesKept(week.kept)} this week${names.length ? `, on ${LIST.format(names)}` : ''}.` : 'No lines kept this week yet.';
  return `${head} ${week.tonight ? 'Tonight’s line is kept.' : 'Tonight’s line is not written yet.'}`;
};
