import { numberWord, PAUSE_KINDS, RULES, ruleLine, TRAINING_STATUS_INFO } from '@logbook/shared';
import { num } from './model';

/**
 * "How Orbs work" as data: every section, row and number of the page, written from the engine's `RULES` and its own
 * lines (`ruleLine`), so the page cannot say one thing while the rules do another. A number in a sentence here is always
 * read from `rules`; the test changes the rules and expects the page to follow.
 *
 * A row that earns an Orb names which form (`gems`): the page is the legend of the earned Orbs, so no shape has to be
 * learned by heart.
 *
 * With Fitness off nothing names training: the session row, the training condition of a full day and Pause (the app's
 * statuses belong to training) are left out, and the day's ceiling is the sum without sessions.
 */
export type Rules = typeof RULES;
export interface HowRow {
  key: string;
  title: string;
  /** A second, quieter line. It wraps. */
  sub?: string;
  /** Quiet words before the value: a goal's reach, "× 3". */
  note?: string;
  /** The Orbs it pays, at the row's end: "1", "+5", "10 to 20". */
  value?: string;
  /** The Orb it earns, at the row's leading edge: keys for `gemFor` (features/orbs/gems). A session has one per kind. */
  gems?: readonly string[];
}
export interface HowSection {
  key: string;
  title: string;
  /** One line under the title, before the rows. */
  lead?: string;
  rows: HowRow[];
  /** A Dusk footnote under the rows. */
  foot?: string;
}

const lower = (n: number) => numberWord(n).toLowerCase();
const list = (words: readonly string[], last = 'or'): string => (words.length <= 1 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} ${last} ${words.at(-1)}`);

/** The most a day can pay, as the rows above it add up: 5 + 8 + 6 + 3 + 5 with Fitness on. */
export const dayCeiling = (rules: Rules, fitness: boolean): number => rules.todo.cap * rules.todo.each + rules.habit.cap * rules.habit.each + (fitness ? rules.train.done * rules.train.kinds : 0) + rules.goalDay + rules.full.bonus;

/** The four goals, nearest first, with what each pays: 3 times its reach. */
export const goalRows = (rules: Rules): HowRow[] =>
  (
    [
      ['day', 'Today’s goal'],
      ['week', 'This week’s goal'],
      ['month', 'This month’s goal'],
      ['year', 'This year’s goal'],
    ] as const
  ).map(([level, title]) => ({ key: `goal:${level}`, title, note: `× ${num(rules.goal.reach[level])}`, value: num(rules.goal.base * rules.goal.reach[level]), gems: [`goal:${level}`] }));

/** The weekly bonus, week by week, up to its top: 5, 10, 15, 20. */
export const weekSteps = (rules: Rules): number[] => Array.from({ length: rules.week.top }, (_, i) => rules.week.bonus * (i + 1));
/** The same as words: "5, 10, 15, then 20". */
const steps = (ns: readonly number[]): string => (ns.length > 1 ? `${ns.slice(0, -1).map(num).join(', ')}, then ${num(ns.at(-1)!)}` : ns.map(num).join(''));

/** The level thresholds as one line: "25, 75, 200, 500, 1,200, 2,500, 5,000, then every 5,000". */
export const levelsLine = (rules: Rules): string => `${rules.levels.map(num).join(', ')}, then every ${num(rules.levelStep)}`;

export const howSections = (opts: { fitness: boolean; target: 3 | 4 | 5; rules?: Rules }): HowSection[] => {
  const { fitness, target } = opts;
  const r = opts.rules ?? RULES;
  const earn: HowRow[] = [
    { key: 'todo', title: 'A to-do', sub: `The first ${num(r.todo.cap)} a day`, value: num(r.todo.each), gems: ['todo'] },
    { key: 'habit', title: 'A habit', sub: `Up to ${num(r.habit.cap)} a day`, value: num(r.habit.each), gems: ['habit'] },
    ...(fitness ? [{ key: 'train', title: 'A session', sub: `${num(r.train.floor)} for its floor. ${numberWord(r.train.kinds)} kinds a day at most.`, value: num(r.train.done), gems: ['train:run', 'train:lift', 'train:cross'] }] : []),
    { key: 'goal:day', title: 'Today’s goal', value: num(r.goalDay), gems: ['goal:day'] },
    { key: 'full', title: 'A full day', sub: fitness ? 'Today’s goal, your training or its floor, and every habit but one' : 'Today’s goal and every habit but one', value: `+${num(r.full.bonus)}`, gems: ['full'] },
    { key: 'line', title: 'Tonight’s line', sub: 'Makes the day count. It earns no Orb: it has its own light.' },
  ];
  const things = ['a to-do', 'a habit', ...(fitness ? ['a session or its floor'] : []), 'today’s goal', 'tonight’s line'];
  const pauses = PAUSE_KINDS.map((k) => TRAINING_STATUS_INFO[k].label);
  const week = weekSteps(r);
  const count: HowRow[] = [
    { key: 'day', title: 'A day counts', sub: `With one thing done: ${list(things)}.` },
    { key: 'week', title: 'A week counts', sub: `With ${lower(target)} days that count, Monday to Sunday. “Your week” sets it to ${list([5, 4, 3].map(lower))}.` },
    ...(fitness ? [{ key: 'pause', title: 'Pause', sub: `A day under ${list(pauses)} with nothing done is neither counted nor missed.` }] : []),
  ];
  const challenges: HowRow[] = [
    { key: 'offer', title: 'Offered, never assigned', sub: 'Add it, skip it or make it easier. Skipping costs nothing.' },
    { key: 'day', title: 'Today’s challenge', value: num(r.challenge.day), gems: ['challenge:d'] },
    { key: 'week', title: 'This week’s challenge', sub: `${num(r.challenge.weekFloor)} at its floor, ${num(r.challenge.weekFull)} in full`, value: `${num(r.challenge.weekFloor)} to ${num(r.challenge.weekFull)}`, gems: ['challenge:w'] },
    fitness ? { key: 'size', title: 'Never more than your plan holds', sub: 'Sized from your own last four weeks. No added distance, pace, weight or sessions.' } : { key: 'size', title: 'Sized from your own record', sub: 'What you met in your last four weeks, never a stretch past it.' },
  ];
  const forWhat: HowRow[] = [
    { key: 'levels', title: 'Levels', sub: `At ${levelsLine(r)}. A level never goes down.` },
    { key: 'chapters', title: 'Chapters', sub: `Every ${lower(r.chapterDays / 7)} weeks, on a Monday, one closes and leaves a keepsake.` },
    { key: 'keepsakes', title: 'Keepsakes', sub: 'Earned at fixed moments, never by chance: your firsts, weeks in a row, days in all, a month goal, a year goal, every chapter.' },
  ];
  const never: HowRow[] = [
    { key: 'bought', title: 'Nothing is bought' },
    { key: 'random', title: 'Nothing is random' },
    { key: 'taken', title: 'Nothing is taken away', sub: 'An untick today takes its own Orb with it. A day that has closed never changes.' },
    { key: 'closes', title: `A day closes at ${num(r.close.tapHour)} in the morning`, sub: 'So going back to an earlier day earns nothing.' },
  ];
  return [
    { key: 'earn', title: 'What earns Orbs', rows: earn, foot: `A day pays ${num(dayCeiling(r, fitness))} at most.` },
    { key: 'goals', title: 'Goals multiply by reach', lead: `A goal pays ${num(r.goal.base)} Orbs times how far it reaches.`, rows: goalRows(r), foot: 'Paid once, for a goal set ahead and marked done in its own time. A goal never shows its worth.' },
    {
      key: 'weeks',
      title: 'Weeks in a row',
      rows: [{ key: 'week', title: 'A week that counts', sub: `${num(r.week.bonus)} Orbs times the weeks in a row, up to × ${num(r.week.top)}: ${steps(week)}.`, value: `${num(week[0]!)} to ${num(week.at(-1)!)}`, gems: ['week'] }],
      foot: fitness ? 'A missed week steps it down one, never to nothing. A paused week leaves it where it was.' : 'A missed week steps it down one, never to nothing.',
    },
    { key: 'count', title: 'The count', rows: count, foot: 'One missed week is forgiven when the next one counts. Days in all never go down.' },
    { key: 'challenges', title: 'Challenges', rows: challenges },
    { key: 'for', title: 'What Orbs are for', rows: forWhat },
    { key: 'never', title: 'What Orbs never do', rows: never },
  ];
};
