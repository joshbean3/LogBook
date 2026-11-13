/**
 * The habits chart at the top of Today's Habits, History (features/habits/HabitsHistory.tsx): what its headline says, at
 * rest and while a day is read. Pure, so the sheet and its tests agree. The numbers are the Consistency metric's habits
 * half (metrics.ts): the share of habits done each day, as a 7-day average.
 */
import { fmtDate } from '@logbook/shared';
import type { RangeKey } from '@/ui/charts';
import type { MetricModel } from './metrics';

/** The chart's ranges, in words that follow "over": the sheet's own 30 days first. */
export const HABIT_SPAN: Record<RangeKey, string> = { '1M': '30 days', '3M': '3 months', '6M': '6 months', '12M': '12 months' };
/** History opens on the 30 days its rows and grids show. */
export const HABIT_RANGE: RangeKey = '1M';

export interface HabitsHead {
  /** "62%" */
  big: string;
  /** Beside the number: what it counts. */
  context: string;
  /** One line under it. */
  take: string;
}

const pct = (v: number) => `${Math.round(v)}%`;

/**
 * What the chart draws: the range's line, or, when the habits are younger than the range, the line from their first day
 * (`since`), so a person four days in sees four days across the card and not a sliver at the edge of an empty month.
 */
export const habitsSeries = (m: Pick<MetricModel, 'line' | 'dates'>): { line: Array<number | null>; dates: string[]; since: string | null } => {
  const first = m.line.findIndex((x) => x != null);
  if (first <= 0) return { line: m.line, dates: m.dates, since: null };
  return { line: m.line.slice(first), dates: m.dates.slice(first), since: m.dates[first] ?? null };
};

/**
 * The headline at rest: the latest 7-day share and the average over what is drawn (the range, or since the first day).
 * Null before any habit has been tapped (or while nothing has loaded): History then draws no chart at all, never an
 * empty frame.
 */
export const habitsHead = (m: Pick<MetricModel, 'hasData' | 'value' | 'line' | 'dates' | 'avg'>, range: RangeKey): HabitsHead | null => {
  if (!m.hasData) return null;
  const last = m.value ?? [...m.line].reverse().find((x): x is number => x != null) ?? null;
  if (last == null) return null;
  const { since } = habitsSeries(m);
  const over = since ? `since ${fmtDate('md', since)}` : `over ${HABIT_SPAN[range]}`;
  return { big: pct(last), context: 'of habits done, last 7 days', take: m.avg != null ? `${pct(m.avg)} on average ${over}` : over.charAt(0).toUpperCase() + over.slice(1) };
};

/** The headline while a day is read: that day's 7-day share, and the day. A day with no value keeps the place with words. `m` is what is drawn (`habitsSeries`). */
export const habitsAt = (m: { line: Array<number | null>; dates: string[] }, i: number): HabitsHead => {
  const v = m.line[i];
  const day = m.dates[i] ? fmtDate('short', m.dates[i]!) : '';
  return v != null ? { big: pct(v), context: 'of habits done', take: `7 days to ${day}` } : { big: 'None', context: 'counted yet', take: day };
};

/** What VoiceOver hears for the headline. */
export const habitsHeadWords = (h: HabitsHead) => `${h.big} ${h.context}. ${h.take}.`;
