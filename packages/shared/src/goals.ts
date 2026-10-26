import { addMonths, fmtDate, mondayOf, monthStart, parseISO, shiftDays, type ISODate } from './dates.js';

// ---------- goals: a year, a month, a week and a day, each set once for its period ----------

export type GoalLevel = 'year' | 'month' | 'week' | 'day';
export const GOAL_LEVELS: readonly GoalLevel[] = ['year', 'month', 'week', 'day'];

/** Open until the period is reviewed; the review says how it went. */
export type GoalStatus = 'open' | 'done' | 'partly' | 'missed';

export interface Aim {
  id: string;
  level: GoalLevel;
  /** The period it is for: `2026`, `2026-10`, the week's Monday `2026-10-26`, or the day `2026-10-26`. */
  period: string;
  /** The goal as it stands (the sharpened words, unless the owner kept his own). */
  text: string;
  /** What the owner typed, when the review changed it; null when the words are his. */
  original: string | null;
  /** One line on what the review changed and why; null when it changed nothing. */
  why: string | null;
  status: GoalStatus;
  /** A line written at the review. */
  reflection: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

/** Everything that happens to a goal, kept so the history can say what was set, changed, done and missed. */
export type GoalEventKind = 'set' | 'sharpened' | 'kept' | 'edited' | 'done' | 'partly' | 'missed' | 'reopened' | 'cleared';

export interface GoalEvent {
  id: string;
  goalId: string;
  level: GoalLevel;
  period: string;
  kind: GoalEventKind;
  /** The goal's words at that moment (or the reflection, for a review). */
  text: string | null;
  at: string;
}

/** The review's answer: the goal rewritten to the goal-setting rules, and what changed. */
export interface GoalRefinement {
  text: string;
  why: string | null;
  changed: boolean;
  /** False when the server has no Claude key: the words come back untouched. */
  available: boolean;
}

/** The period `date` falls in. */
export const periodOf = (level: GoalLevel, date: ISODate): string => (level === 'year' ? date.slice(0, 4) : level === 'month' ? date.slice(0, 7) : level === 'week' ? mondayOf(date) : date);

/** The first day of a period. */
export const periodStart = (level: GoalLevel, period: string): ISODate => (level === 'year' ? `${period}-01-01` : level === 'month' ? `${period}-01` : period);

/** The last day of a period: the deadline the goal is written against. */
export const periodEnd = (level: GoalLevel, period: string): ISODate => {
  if (level === 'year') return `${period}-12-31`;
  if (level === 'month') return shiftDays(addMonths(monthStart(`${period}-01`), 1), -1);
  if (level === 'week') return shiftDays(period, 6);
  return period;
};

/** The period before (or `n` before) this one. */
export const shiftPeriod = (level: GoalLevel, period: string, n: number): string => {
  if (level === 'year') return String(Number(period) + n);
  if (level === 'month') return addMonths(`${period}-01`, n).slice(0, 7);
  if (level === 'week') return shiftDays(period, 7 * n);
  return shiftDays(period, n);
};

/** True once the period's last day is behind `today`. */
export const periodPast = (level: GoalLevel, period: string, today: ISODate) => periodEnd(level, period) < today;

const MONTH = new Intl.DateTimeFormat('en-US', { month: 'long' });

/** What the period is called, from where `today` stands: `This week`, `Last month`, `Oct 19–25`, `2025`. */
export const periodName = (level: GoalLevel, period: string, today: ISODate): string => {
  const cur = periodOf(level, today);
  const rel = period === cur ? 0 : period === shiftPeriod(level, cur, -1) ? -1 : period === shiftPeriod(level, cur, 1) ? 1 : null;
  if (level === 'day') return rel === 0 ? 'Today' : rel === -1 ? 'Yesterday' : rel === 1 ? 'Tomorrow' : fmtDate('short', period);
  if (level === 'week') return rel === 0 ? 'This week' : rel === -1 ? 'Last week' : rel === 1 ? 'Next week' : periodSpan(level, period);
  if (level === 'month') return rel === 0 ? 'This month' : rel === -1 ? 'Last month' : periodSpan(level, period);
  return rel === 0 ? 'This year' : rel === -1 ? 'Last year' : period;
};

/** The period's own dates: `2026`, `October 2026`, `Oct 26–Nov 1`, `Mon, Oct 26`. */
export const periodSpan = (level: GoalLevel, period: string): string => {
  if (level === 'year') return period;
  if (level === 'month') return `${MONTH.format(parseISO(`${period}-01`))} ${period.slice(0, 4)}`;
  if (level === 'week') {
    const end = periodEnd(level, period);
    const a = fmtDate('md', period);
    const b = end.slice(5, 7) === period.slice(5, 7) ? String(parseISO(end).getDate()) : fmtDate('md', end);
    return `${a}–${b}`;
  }
  return fmtDate('short', period);
};

/** The level's noun, for copy: `year`, `month`, `week`, `day`. */
export const LEVEL_NOUN: Record<GoalLevel, string> = { year: 'year', month: 'month', week: 'week', day: 'day' };

/** The current goal of each level on `today` (or null), from a list of goals. */
export const currentGoals = (goals: readonly Aim[] | undefined, today: ISODate): Record<GoalLevel, Aim | null> => {
  const out = { year: null, month: null, week: null, day: null } as Record<GoalLevel, Aim | null>;
  for (const l of GOAL_LEVELS) out[l] = goals?.find((g) => g.level === l && g.period === periodOf(l, today)) ?? null;
  return out;
};

/** Past goals still open: the ones waiting on a review, newest first (a day before a week). */
export const awaitingReview = (goals: readonly Aim[] | undefined, today: ISODate): Aim[] =>
  (goals ?? [])
    .filter((g) => g.status === 'open' && periodPast(g.level, g.period, today))
    .sort((a, b) => (periodEnd(b.level, b.period) < periodEnd(a.level, a.period) ? -1 : periodEnd(b.level, b.period) > periodEnd(a.level, a.period) ? 1 : GOAL_LEVELS.indexOf(b.level) - GOAL_LEVELS.indexOf(a.level)));

/** What needs the owner today: the day's and the week's goal unset (the two that turn over), and reviews owed. */
export const goalsDue = (goals: readonly Aim[] | undefined, today: ISODate) => {
  const cur = currentGoals(goals, today);
  return { day: !cur.day, week: !cur.week, month: !cur.month, year: !cur.year, review: awaitingReview(goals, today).length };
};
