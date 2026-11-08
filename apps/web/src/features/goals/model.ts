import { fmtDate, periodEnd, periodName, periodOf, periodPast, periodSpan, periodStart, shiftPeriod, type Aim, type GoalLevel, type GoalStatus, type ISODate } from '@logbook/shared';

/** The words each level speaks in: its label, the question the editor asks, an example of a sharp goal. */
export const LEVEL: Record<GoalLevel, { label: string; ask: string; example: string; set: string }> = {
  year: { label: 'Year', ask: 'What will this year be about?', example: 'Run a half marathon under 1:40 by November.', set: 'Set the year’s goal' },
  month: { label: 'Month', ask: 'What will you finish this month?', example: 'Run 90 miles and lift twice every week.', set: 'Set the month’s goal' },
  week: { label: 'Week', ask: 'What will you get done this week?', example: 'Four runs, 20 miles, the long one on Saturday.', set: 'Set the week’s goal' },
  day: { label: 'Day', ask: 'What is the one thing for today?', example: 'Send the model to Ana by 3 pm.', set: 'Set today’s goal' },
};

/** The caps line over a goal: `THIS WEEK · OCT 26–NOV 1`, `TODAY · MON, OCT 26`, `THIS YEAR`. */
export const periodCaps = (level: GoalLevel, period: string, today: ISODate) => {
  const name = periodName(level, period, today);
  const span = periodSpan(level, period);
  return name === span || level === 'year' ? name : `${name} · ${span}`;
};

/** The deadline in words, for the editor's hint: `by Sunday`, `by Oct 31`, `by tonight`, `by Dec 31`. */
export const deadlineWords = (level: GoalLevel, period: string, today: ISODate) => {
  const end = periodEnd(level, period);
  if (end === today) return level === 'day' ? 'by tonight' : 'by tonight';
  if (level === 'week') return `by ${fmtDate('dowLong', end)}`;
  return `by ${fmtDate('md', end)}`;
};

export const STATUS_WORD: Record<GoalStatus, string> = { open: 'Open', done: 'Done', partly: 'Partly', missed: 'Missed' };

/** The editor's empty-goal line for a period, from where today stands: `Set today’s goal`, `Set tomorrow’s goal`, `Set Thu’s goal`. */
export const setWords = (level: GoalLevel, period: string, today: ISODate) => {
  const name = periodName(level, period, today);
  if (level === 'day') return name === 'Today' ? LEVEL.day.set : `Set ${name === 'Tomorrow' ? 'tomorrow' : name === 'Yesterday' ? 'yesterday' : fmtDate('dow', period)}’s goal`;
  if (level === 'week') return name === 'This week' ? LEVEL.week.set : `Set the goal for ${name === 'Next week' ? 'next week' : periodSpan(level, period)}`;
  return LEVEL[level].set;
};

export const goalOf = (goals: readonly Aim[] | undefined, level: GoalLevel, period: string) => goals?.find((g) => g.level === level && g.period === period) ?? null;

const dayMs = 864e5;
const localMs = (d: ISODate) => new Date(`${d}T00:00:00`).getTime();

/** How far through its period a goal is by the clock (0 to 1), and the time left in words: `9 h left`, `3 days left`. */
export const clockOf = (level: GoalLevel, period: string, now: number) => {
  const from = localMs(periodStart(level, period));
  const to = localMs(periodEnd(level, period)) + dayMs;
  const elapsed = Math.max(0, Math.min(1, (now - from) / (to - from)));
  const left = to - now;
  const words =
    left <= 0 ? 'Over' : now < from ? 'Not started' : left < 3600e3 ? `${Math.max(1, Math.round(left / 60e3))} min left` : left < 2 * dayMs && level === 'day' ? `${Math.round(left / 3600e3)} h left` : left < 1.5 * dayMs ? `${Math.round(left / 3600e3)} h left` : `${Math.ceil(left / dayMs)} days left`;
  return { elapsed, words };
};

/** How many periods the score looks back over, the current one included: a week of days, four weeks, a quarter, the year. */
export const SCORE_SPAN: Record<GoalLevel, number> = { day: 7, week: 4, month: 3, year: 1 };
const NOUN: Record<GoalLevel, [string, string]> = { day: ['day', 'days'], week: ['week', 'weeks'], month: ['month', 'months'], year: ['year', 'years'] };

export interface Tally {
  /** Goals answered (done, partly or missed) in the span. */
  closed: number;
  kept: number;
}
export interface Score extends Tally {
  level: GoalLevel;
  /** The span's caps: `LAST 4 WEEKS`, `THIS YEAR`. */
  caps: string;
  /** `week goals kept`. */
  words: string;
  /** The span before, or null when nothing was answered in it. */
  prev: Tally | null;
  /** `vs 2 of 3 the 4 weeks before`, or what is missing. */
  vs: string;
  /** Past goals in the span still waiting on an answer. */
  owed: number;
  /** `behind` (orange): a lower share kept than the span before, or under half with nothing to compare. Null with nothing answered. */
  tone: 'on' | 'behind' | null;
}

const tallyOf = (goals: readonly Aim[], level: GoalLevel, from: string, n: number, today: ISODate): Tally & { owed: number } => {
  let closed = 0;
  let kept = 0;
  let owed = 0;
  for (let i = 0; i < n; i++) {
    const g = goalOf(goals, level, shiftPeriod(level, from, -i));
    if (!g) continue;
    if (g.status === 'open') {
      if (periodPast(level, g.period, today)) owed++;
      continue;
    }
    closed++;
    if (g.status === 'done') kept++;
  }
  return { closed, kept, owed };
};

/**
 * The one honest number per level (docs/inspiration.md §6 Goals): of the goals answered over the last few periods (the
 * current one counts once it is answered), how many were kept, against the same span before it. Open goals are not
 * counted as missed; past ones still open are owed a review and said so.
 */
export const scoreOf = (goals: readonly Aim[], level: GoalLevel, today: ISODate): Score => {
  const n = SCORE_SPAN[level];
  const cur = periodOf(level, today);
  const now = tallyOf(goals, level, cur, n, today);
  const before = tallyOf(goals, level, shiftPeriod(level, cur, -n), n, today);
  const [one, many] = NOUN[level];
  const caps = n === 1 ? `This ${one}` : `Last ${n} ${many}`;
  const spanBefore = n === 1 ? `last ${one}` : `the ${n} ${many} before`;
  const prev = before.closed ? { closed: before.closed, kept: before.kept } : null;
  const rate = now.closed ? now.kept / now.closed : null;
  const tone = rate == null ? null : prev ? (rate < prev.kept / prev.closed ? 'behind' : 'on') : rate < 0.5 ? 'behind' : 'on';
  return {
    level,
    caps,
    closed: now.closed,
    kept: now.kept,
    words: `${one} goal${now.closed === 1 ? '' : 's'} kept`,
    prev,
    vs: prev ? `vs ${prev.kept} of ${prev.closed} ${spanBefore}` : `Nothing answered ${spanBefore}`,
    owed: now.owed,
    tone,
  };
};

/** What is left of a goal, in words, for its tile: `2 steps left, 3 days to go`, `3 days to go`, `Done`. */
export const leftWords = (goal: Aim, level: GoalLevel, period: string, now: number) => {
  if (goal.status !== 'open') return STATUS_WORD[goal.status];
  const clock = clockOf(level, period, now).words;
  const time = clock === 'Over' ? 'time is up' : clock === 'Not started' ? 'not started' : clock.replace(/ left$/, ' to go');
  const left = goal.steps.filter((s) => !s.done).length;
  if (!goal.steps.length) return time.charAt(0).toUpperCase() + time.slice(1);
  if (!left) return 'Every step done. Mark it kept';
  return `${left} step${left === 1 ? '' : 's'} left, ${time}`;
};

/** The period's time used, for the gauge: the share gone and its words, `4 of 7 days used`, `15 of 24 hours used`. */
export const timeUsed = (level: GoalLevel, period: string, now: number) => {
  const { elapsed } = clockOf(level, period, now);
  if (level === 'day') return { elapsed, words: `${Math.min(24, Math.floor(elapsed * 24))} of 24 hours used` };
  const days = Math.round((localMs(periodEnd(level, period)) - localMs(periodStart(level, period))) / dayMs) + 1;
  return { elapsed, words: `${Math.min(days, Math.floor(elapsed * days))} of ${days} days used` };
};

/** Each level's colour, from the feel palette: the day the sun, the week mint, the month coral, the year sky. */
export const LEVEL_HUE: Record<GoalLevel, string> = { day: 'var(--sun)', week: 'var(--mint)', month: 'var(--coral)', year: 'var(--sky)' };

/** `today (Sun, Nov 8)`, `this week (Nov 2–8)`, `November 2026`, `2026`: the period as the request names it. */
const periodPhrase = (level: GoalLevel, period: string, today: string) => {
  const name = periodName(level, period, today);
  const span = periodSpan(level, period);
  if (level === 'year' || level === 'month') return span;
  const rel = /^(Today|Tomorrow|This week|Next week)$/.test(name);
  return rel ? `${name.toLowerCase()} (${span})` : level === 'week' ? `the week of ${span}` : span;
};

/** The request the assistant opens with, for the owner to send or change. */
export const suggestRequest = (level: GoalLevel, period: string, today: string) =>
  `Suggest one ${LEVEL[level].label.toLowerCase()} goal for ${periodPhrase(level, period, today)}, based on my last 90 days of training, habits and goals. Make it specific and measurable, with two or three steps.`;
