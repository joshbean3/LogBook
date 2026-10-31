import { fmtDate, periodEnd, periodName, periodSpan, periodStart, type Aim, type GoalLevel, type GoalStatus, type ISODate } from '@logbook/shared';

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
