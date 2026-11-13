import { chapterNumber, chapterOf, countOf, dayLines, daysBetween, fmt, numberWord, parseISO, RULES, shiftDays, type Count, type DayKey, type ISODate, type Rewards } from '@logbook/shared';

/**
 * What the Orbs page says, worked out from the stored object (`Rewards`) with nothing drawn: the day's lines, the
 * keepsakes with their words, the one that comes next, and the rows that are new. Pure, so every word and number on the
 * page can be tested without a screen. The rules themselves live in packages/shared/src/rewards.ts; nothing here decides
 * what was earned.
 */

/** "1,000": a number as the page prints it. */
export const num = (n: number): string => n.toLocaleString('en-US');
/** "9 Orbs". The word is always plural or with a number (the words table); one is "1 Orb". */
export const orbs = (n: number): string => `${num(n)} ${n === 1 ? 'Orb' : 'Orbs'}`;

// ---------- today's lines ----------

const LINE: Record<DayKey, string> = {
  todo: 'To-dos',
  habit: 'Habits',
  'train:run': 'Run',
  'train:lift': 'Lift',
  'train:cross': 'Cross-training',
  'goal:day': 'Today’s goal',
  full: 'Full day',
  back: 'Good to see you',
};
export interface Line {
  key: string;
  label: string;
  n: number;
}
/**
 * A day's Orbs, line by line, in the order of the rules table: "To-dos 3", "Habits 4", "Today's goal 3", "Full day 5".
 * With Fitness off nothing names training: Orbs a session earned before the switch are one line, "Earlier today".
 */
export const linesOf = (s: Rewards, date: ISODate, fitness: boolean): Line[] => {
  const out: Line[] = [];
  let earlier = 0;
  for (const l of dayLines(s, date)) {
    if (!fitness && l.key.startsWith('train:')) earlier += l.n;
    else out.push({ key: l.key, label: LINE[l.key], n: l.n });
  }
  if (earlier) out.push({ key: 'train', label: 'Earlier today', n: earlier });
  return out;
};

const ONCE: Array<[prefix: string, label: string]> = [
  ['week:', 'Weeks in a row'],
  ['goal:week:', 'Week goal'],
  ['goal:month:', 'Month goal'],
  ['goal:year:', 'Year goal'],
  ['challenge:d:', 'Today’s challenge'],
  ['challenge:w:', 'This week’s challenge'],
];
/** What was paid once on `date` (a weekly bonus, a goal, a challenge): it is in the total and in no day's number. */
export const paidOn = (s: Rewards, date: ISODate): Line[] => {
  const out: Line[] = [];
  for (const [prefix, label] of ONCE) for (const k of Object.keys(s.once).sort()) if (k.startsWith(prefix) && s.once[k]!.on === date && s.once[k]!.n > 0) out.push({ key: k, label, n: s.once[k]!.n });
  return out;
};

// ---------- the poster's words ----------

/** The band under the scene: "LEVEL 5" over "216 to level 6". */
export const levelBand = (l: { level: number; left: number }): { label: string; words: string } => ({ label: `Level ${num(l.level)}`, words: `${num(l.left)} to level ${num(l.level + 1)}` });
/** The sun's place on its way: the share of this level already earned. 0 at a level's start, never 1. */
export const levelProgress = (l: { into: number; span: number }): number => (l.span > 0 ? Math.max(0, Math.min(1, l.into / l.span)) : 0);

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
const list = (words: readonly string[]): string => (words.length <= 1 ? (words[0] ?? '') : words.length === 2 ? `${words[0]} and ${words[1]}` : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`);
/** The week's marks in words, for VoiceOver: "This week: Monday, Tuesday and Thursday count." Nothing is said of the others. */
export const weekSaid = (c: Pick<Count, 'marks'>): string => {
  const days = DAY_NAMES.filter((_, i) => c.marks[i]);
  return days.length ? `This week: ${list(days)} ${days.length === 1 ? 'counts' : 'count'}.` : 'This week';
};

// ---------- keepsakes ----------

export type KeepsakeGlyph = 'first' | 'full' | 'challenge' | 'goal' | 'chapter';
export interface KeepsakeView {
  key: string;
  /** The day it was earned. */
  on: ISODate;
  /** What the disc holds: a numeral ("4", "100"), a glyph, or for a chapter both (the glyph over its number). */
  numeral?: string;
  glyph?: KeepsakeGlyph;
  /** Its words: "4 weeks in a row", "First light", "Chapter 2". */
  title: string;
  /** One plain line about it, for its sheet. */
  line: string;
  /** A goal's own words, or the one line a chapter keeps. */
  words?: string;
  /** What `words` is. */
  wordsCaption?: string;
  /** Facts, as label and value: a chapter's days, sessions and goals met; a goal's Orbs. */
  facts: Array<{ label: string; value: string }>;
}

const monthName = (ym: string): string => fmt.month.format(parseISO(`${ym}-01`));
/** A date under a disc: "Nov 16", and "Nov 2025" once it is another year. */
export const shortDate = (d: ISODate, today: ISODate): string => (d.slice(0, 4) === today.slice(0, 4) ? fmt.md.format(parseISO(d)) : `${fmt.monthShort.format(parseISO(d))} ${d.slice(0, 4)}`);
/** A date in full: "Monday, November 16", with the year once it is another one. */
export const longDate = (d: ISODate, today: ISODate): string => (d.slice(0, 4) === today.slice(0, 4) ? fmt.long.format(parseISO(d)) : `${fmt.long.format(parseISO(d))}, ${d.slice(0, 4)}`);

/** One keepsake as the page shows it. Null for a key this build does not know. With Fitness off nothing names training. */
export const keepsakeView = (s: Rewards, key: string, fitness: boolean): KeepsakeView | null => {
  const k = s.keepsakes[key];
  if (!k) return null;
  const base = { key, on: k.on, facts: [] as KeepsakeView['facts'] };
  if (key === 'first') return { ...base, glyph: 'first', title: 'First light', line: 'Your first Orb. You earn one for each thing you finish.' };
  if (key === 'full') return { ...base, glyph: 'full', title: 'First full day', line: fitness ? 'Today’s goal, your training and your habits, all in one day.' : 'Today’s goal and your habits, all in one day.' };
  if (key === 'challenge') return { ...base, glyph: 'challenge', title: 'First challenge', line: 'The first challenge you added and finished.' };
  const [what, a, b] = key.split(':');
  if (what === 'weeks' && Number(a) > 0) return { ...base, numeral: num(Number(a)), title: `${num(Number(a))} weeks in a row`, line: 'Each of those weeks counted.' };
  if (what === 'days' && Number(a) > 0) return { ...base, numeral: num(Number(a)), title: `${num(Number(a))} days in all`, line: 'Each of those days held at least one thing done.' };
  if (what === 'goal' && (a === 'month' || a === 'year') && b) {
    const paid = s.once[key]?.n;
    return {
      ...base,
      glyph: 'goal',
      title: a === 'month' ? 'Month goal' : 'Year goal',
      line: a === 'month' ? `Your goal for ${monthName(b)}, done.` : `Your goal for ${b}, done.`,
      words: k.t,
      wordsCaption: 'Your goal',
      facts: paid ? [{ label: 'Orbs', value: num(paid) }] : [],
    };
  }
  if (what === 'chapter' && a) {
    const n = chapterNumber(s, key);
    const end = shiftDays(a, RULES.chapterDays - 1);
    const facts: KeepsakeView['facts'] = [];
    if (k.d) facts.push({ label: 'Days', value: num(k.d) });
    if (k.s && fitness) facts.push({ label: 'Sessions', value: num(k.s) });
    if (k.g) facts.push({ label: 'Goals met', value: num(k.g) });
    return { ...base, glyph: 'chapter', numeral: num(n), title: `Chapter ${num(n)}`, line: `${numberWord(RULES.chapterDays / 7)} weeks, ${fmt.md.format(parseISO(a))} to ${fmt.md.format(parseISO(end))}.`, words: k.t, wordsCaption: 'A line from it', facts };
  }
  return null;
};

/** Every keepsake earned, newest first (the newest is the one that glows). Ties are settled by the key, so the order is the same on every device. */
export const keepsakesOf = (s: Rewards, fitness: boolean): KeepsakeView[] =>
  Object.keys(s.keepsakes)
    .map((key) => keepsakeView(s, key, fitness))
    .filter((v): v is KeepsakeView => v !== null)
    .sort((x, y) => (x.on !== y.on ? (x.on < y.on ? 1 : -1) : x.key < y.key ? -1 : 1));

export interface NextKeepsake {
  /** What the dashed ring holds. */
  numeral: string;
  glyph?: KeepsakeGlyph;
  /** "Next: 4 weeks in a row". Never how near it is. */
  words: string;
}
/**
 * The one keepsake that comes next, for the dashed ring: the nearest of the next count of days in all, the next count of
 * weeks in a row and the chapter that closes next. It says what is next and never how far off it is. Null before the
 * first Orb (the empty page has no grid) and past the last listed counts with no chapter ahead.
 */
export const nextKeepsake = (s: Rewards, today: ISODate): NextKeepsake | null => {
  if (!s.keepsakes.first) return null;
  const c = countOf(s, today);
  const options: Array<{ away: number; next: NextKeepsake }> = [];
  const days = RULES.keepsakes.days.find((n) => n > c.days && !s.keepsakes[`days:${n}`]);
  if (days) options.push({ away: days - c.days, next: { numeral: num(days), words: `Next: ${num(days)} days in all` } });
  const weeks = RULES.keepsakes.weeks.find((n) => n > c.weeks && !s.keepsakes[`weeks:${n}`]);
  if (weeks) options.push({ away: (weeks - c.weeks) * 7, next: { numeral: num(weeks), words: `Next: ${num(weeks)} weeks in a row` } });
  const ch = chapterOf(s, today);
  if (today >= s.startedOn && !s.keepsakes[`chapter:${ch.start}`]) options.push({ away: daysBetween(today, ch.closes), next: { numeral: num(ch.n), glyph: 'chapter', words: `Next: chapter ${num(ch.n)}, on ${fmt.md.format(parseISO(ch.closes))}` } });
  options.sort((x, y) => x.away - y.away);
  return options[0]?.next ?? null;
};

// ---------- what is new and has no keepsake: a week goal ----------

export interface NewRow {
  key: string;
  title: string;
  n: number;
  on: ISODate;
}
/** The "New" rows that are not keepsakes: a week goal that was paid and has not been seen. Newest first, as `newKeys` gives them. */
export const newRows = (s: Rewards, keys: readonly string[]): NewRow[] =>
  keys.flatMap((key) => {
    const o = s.once[key];
    return key.startsWith('goal:week:') && o && !s.keepsakes[key] ? [{ key, title: 'Week goal, done', n: o.n, on: o.on }] : [];
  });

/** Is this the page before the first Orb? Then it shows the poster at rest, the rule and "How Orbs work", and no grid. */
export const isEmpty = (total: number): boolean => total <= 0;
/** Has the store's first day come? Before it (`RULES.startsOn` in a release build) nothing earns yet, and the page says when it starts. */
export const notStarted = (s: Rewards | null, today: ISODate): boolean => !!s && today < s.startedOn;
