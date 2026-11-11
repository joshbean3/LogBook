/**
 * The running chart's range views (1W, 1M, 3M, 6M, YTD, 12M, All): which days a range covers, how they fall into buckets
 * (days, weeks or months), what each bucket planned and ran, and which axis labels fit. Pure functions over ISO dates and a
 * day reader, so the chart and its tests agree. Nothing here renders or reads the clock: `today` is always passed in, and
 * every date is a calendar date string (the day a run is filed under), so a time zone never moves a run between buckets.
 */
import { addMonths, daysBetween, fmtDate, mondayOf, monthOf, monthStart, shiftDays, type ISODate } from '@logbook/shared';

export type ProgressRange = '1W' | '1M' | '3M' | '6M' | 'YTD' | '12M' | 'All';
export const PROGRESS_RANGES: readonly ProgressRange[] = ['1W', '1M', '3M', '6M', 'YTD', '12M', 'All'];
/** The default: closest to the week-by-week view the chart had before ranges (12 weeks), and the guide's (6.8). */
export const DEFAULT_RANGE: ProgressRange = '3M';
/** Each range in words, for VoiceOver and the large-text menu ("3 months"). */
export const RANGE_WORDS: Record<ProgressRange, string> = { '1W': 'This week', '1M': '1 month', '3M': '3 months', '6M': '6 months', YTD: 'This year', '12M': '12 months', All: 'All time' };

export type BucketUnit = 'day' | 'week' | 'month';
export interface Bucket {
  /** The bucket's own start: the day, the Monday, or the 1st of the month (it may sit before the range's first day). */
  key: ISODate;
  /** The first and last day the bucket counts: its own days clipped to the range. */
  from: ISODate;
  to: ISODate;
  /** Today falls in it. */
  current: boolean;
  /** It starts after today: plan only, nothing run yet. */
  future: boolean;
}
export interface RangeSpan {
  range: ProgressRange;
  unit: BucketUnit;
  /** First and last day counted. `to` is the end of the bucket holding today (so this week's plan is whole). */
  from: ISODate;
  to: ISODate;
  buckets: Bucket[];
}

/** Weeks shown by the weekly ranges, this one included. */
const WEEKS: Partial<Record<ProgressRange, number>> = { '1M': 5, '3M': 13, '6M': 26, '12M': 52 };
/** Under three weeks of days, weekly points are too few to draw a line: the range reads by day. */
const DAILY_UNDER = 21;
/** All reads by month once history is longer than about 18 months (a weekly line that long is a blur at phone width). */
export const MONTHLY_OVER = 548;

const endOfWeek = (d: ISODate) => shiftDays(mondayOf(d), 6);
const endOfMonth = (d: ISODate) => shiftDays(addMonths(d, 1), -1);
const startOf = (unit: BucketUnit, d: ISODate) => (unit === 'day' ? d : unit === 'week' ? mondayOf(d) : monthStart(d));
const endOf = (unit: BucketUnit, d: ISODate) => (unit === 'day' ? d : unit === 'week' ? endOfWeek(d) : endOfMonth(d));
const next = (unit: BucketUnit, d: ISODate) => (unit === 'day' ? shiftDays(d, 1) : unit === 'week' ? shiftDays(d, 7) : addMonths(d, 1));

/**
 * The days and buckets a range covers on `today`. `first` is the first day of run history (a planned or done run; null with
 * none), which only All reads.
 * - 1W: this week, Monday to Sunday, by day.
 * - 1M: the four weeks before this one and this week, by week (a plan is written and judged by the week; by day a month of
 *   runs and rest days is a sawtooth, and 1W already gives the days).
 * - 3M, 6M, 12M: 13, 26 and 52 weeks ending this week, by week.
 * - YTD: January 1 to the end of this week, by week (the first week clipped to January 1); by day while the year is under
 *   three weeks old.
 * - All: the first day of history to the end of this week, by week; by month once that is longer than about 18 months
 *   (to the end of this month); by day under three weeks.
 */
export const rangeSpan = (range: ProgressRange, today: ISODate, first: ISODate | null = null): RangeSpan => {
  const mon = mondayOf(today);
  let unit: BucketUnit = 'week';
  let from: ISODate;
  if (range === '1W') {
    unit = 'day';
    from = mon;
  } else if (range === 'YTD') {
    from = `${today.slice(0, 4)}-01-01`;
    if (daysBetween(from, today) + 1 < DAILY_UNDER) unit = 'day';
  } else if (range === 'All') {
    from = first && first < today ? first : today;
    const days = daysBetween(from, today) + 1;
    if (days > MONTHLY_OVER) unit = 'month';
    else if (days < DAILY_UNDER) unit = 'day';
  } else from = shiftDays(mon, -7 * (WEEKS[range]! - 1));
  // the range runs to the end of the bucket holding today, so its plan is whole (the days ahead are plan only); a short YTD or
  // All read by day still runs to Sunday, so this week's plan shows
  const to = unit === 'month' ? endOfMonth(today) : endOfWeek(today);
  const buckets = bucketsBetween(unit, from, to, today);
  return { range, unit, from, to, buckets };
};

/** The buckets of one unit from `from` to `to`, each clipped to them. */
export const bucketsBetween = (unit: BucketUnit, from: ISODate, to: ISODate, today: ISODate): Bucket[] => {
  const out: Bucket[] = [];
  for (let k = startOf(unit, from); k <= to; k = next(unit, k)) {
    const bFrom = k < from ? from : k;
    const e = endOf(unit, k);
    const bTo = e > to ? to : e;
    out.push({ key: k, from: bFrom, to: bTo, current: bFrom <= today && today <= bTo, future: bFrom > today });
  }
  return out;
};

/** Every month (`YYYY-MM`) a span touches: what has to be loaded to draw it. */
export const spanMonths = (span: Pick<RangeSpan, 'from' | 'to'>): string[] => {
  const out: string[] = [];
  for (let m = monthStart(span.from); m <= span.to; m = addMonths(m, 1)) out.push(monthOf(m));
  return out;
};

/** What one day planned and ran (miles and runs). Days after today only plan. */
export interface DayRun {
  planned: number;
  plannedRuns: number;
  done: number;
  runs: number;
}
export interface RunBucket extends Bucket {
  planned: number;
  plannedRuns: number;
  done: number;
  runs: number;
  /** Planned miles on the bucket's days before today: what the plan asked for before today. */
  plannedPast: number;
  /** Planned miles on its days up to today, today included: the plan by the end of today (the ruler's triangle). */
  plannedNow: number;
  /** A day of it falls in a month not loaded yet: a quiet gap, left out of every summary. */
  missing: boolean;
}

/**
 * Sums each bucket from a day reader: the plan over every day of the bucket (the days ahead included: that is what the week
 * asks for), runs and miles over the days up to today. `loaded(month)` marks a bucket that touches a month not in yet.
 */
export const bucketRuns = (buckets: Bucket[], day: (d: ISODate) => DayRun, today: ISODate, loaded?: (month: string) => boolean): RunBucket[] =>
  buckets.map((b) => {
    let planned = 0;
    let plannedRuns = 0;
    let plannedPast = 0;
    let plannedNow = 0;
    let done = 0;
    let runs = 0;
    let missing = false;
    for (let d = b.from; d <= b.to; d = shiftDays(d, 1)) {
      if (loaded && !loaded(monthOf(d))) {
        missing = true;
        continue;
      }
      const r = day(d);
      planned += r.planned;
      plannedRuns += r.plannedRuns;
      if (d < today) plannedPast += r.planned;
      if (d <= today) plannedNow += r.planned;
      if (d > today) continue;
      done += r.done;
      runs += r.runs;
    }
    const r1 = (v: number) => Math.round(v * 100) / 100;
    return { ...b, planned: r1(planned), plannedRuns, plannedPast: r1(plannedPast), plannedNow: r1(plannedNow), done: r1(done), runs, missing };
  });

/**
 * The plan kept over a range: each finished week that had a plan, done capped at planned (a big week does not pay for a missed
 * one). Read from weekly buckets whatever the chart's unit, so a month of the All view grades the same as its weeks. Null with
 * no finished week that had a plan.
 */
export const keptOver = (weeks: RunBucket[]): { rate: number; behind: number; weeks: number } | null => {
  const done = weeks.filter((w) => !w.current && !w.future && !w.missing && w.planned > 0);
  if (!done.length) return null;
  const planned = done.reduce((s, w) => s + w.planned, 0);
  const got = done.reduce((s, w) => s + Math.min(w.done, w.planned), 0);
  return { rate: got / planned, behind: Math.max(0, planned - got), weeks: done.length };
};

// ---------- the axis ----------
export interface AxisLabel {
  i: number;
  text: string;
  now?: boolean;
  anchor: 'start' | 'middle' | 'end';
}
const monthShort = (d: ISODate) => fmtDate('monthShort', d);
const DOW_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const dowLetter = (d: ISODate) => {
  const [y, m, dd] = d.split('-').map(Number) as [number, number, number];
  return DOW_LETTER[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()]!;
};

/**
 * The x labels that fit, never two that collide. `x(i)` is a bucket's position, `width(text)` a label's drawn width, `gap`
 * the room kept between two labels, `plotW` the plot's width (a label never runs past either end).
 * - By day for 1W: every weekday letter (today's is marked `now`; the ruler above already says NOW).
 * - Otherwise "Now" sits under the bucket holding today, and the other labels are the most even set that fits around it:
 *   days by date ("Jan 5"); weeks by month ("Sep"), or month initials when every month fits that way, or by date in 1M;
 *   months by year at each January ("2025").
 */
export const axisLabels = (span: Pick<RangeSpan, 'range' | 'unit' | 'buckets'>, x: (i: number) => number, width: (text: string) => number, plotW: number, gap = 10): AxisLabel[] => {
  const bs = span.buckets;
  const n = bs.length;
  if (!n) return [];
  const anchorAt = (i: number): AxisLabel['anchor'] => (i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle');
  const extent = (l: AxisLabel) => {
    const w = width(l.text);
    let a = l.anchor === 'start' ? x(l.i) : l.anchor === 'end' ? x(l.i) - w : x(l.i) - w / 2;
    a = Math.max(0, Math.min(plotW - w, a));
    return [a, a + w] as const;
  };
  const clash = (a: AxisLabel, b: AxisLabel) => {
    const [p, q] = extent(a);
    const [r, s] = extent(b);
    return p < s + gap && r < q + gap;
  };
  const fits = (ls: AxisLabel[]) => ls.every((l, i) => ls.every((o, j) => i === j || !clash(l, o)));

  if (span.range === '1W' && span.unit === 'day') {
    const ls = bs.map((b, i) => ({ i, text: dowLetter(b.key), now: b.current || undefined, anchor: 'middle' as const }));
    return fits(ls) ? ls : ls.filter((l) => l.i % 2 === 0 || l.now);
  }
  const ci = bs.findIndex((b) => b.current);
  const nowL: AxisLabel | null = ci >= 0 ? { i: ci, text: 'Now', now: true, anchor: anchorAt(ci) } : null;

  // the candidate sets: names first, then (by week) month initials
  const sets: AxisLabel[][] = [];
  if (span.unit === 'day') sets.push(bs.map((b, i) => ({ i, text: fmtDate('md', b.key), anchor: anchorAt(i) })).filter((l) => l.i === 0 || dowLetter(bs[l.i]!.key) === 'M'));
  else if (span.unit === 'week' && span.range === '1M') sets.push(bs.map((b, i) => ({ i, text: fmtDate('md', b.key), anchor: anchorAt(i) })));
  else if (span.unit === 'week') {
    // a month is named under the week its 1st falls in (the first week names its own month)
    const starts = bs
      .map((b, i) => ({ i, m: i === 0 ? b.from : monthStart(b.to) }))
      .filter(({ i }) => i === 0 || monthOf(bs[i]!.from) !== monthOf(bs[i]!.to) || bs[i]!.from.endsWith('-01'));
    sets.push(starts.map(({ i, m }) => ({ i, text: monthShort(m), anchor: anchorAt(i) })));
    sets.push(starts.map(({ i, m }) => ({ i, text: monthShort(m).charAt(0), anchor: anchorAt(i) })));
  } else {
    const years = bs.map((b, i) => ({ i, b })).filter(({ b, i }) => i === 0 || b.key.slice(5, 7) === '01');
    sets.push(years.map(({ i, b }) => ({ i, text: b.key.slice(0, 4), anchor: anchorAt(i) })));
  }
  const withNow = (ls: AxisLabel[]) => {
    // the first bucket's own label (a part month or week at the start) gives way to the next one when they touch
    const lead = ls.length > 1 && ls[0]!.i === 0 && clash(ls[0]!, ls[1]!) ? ls.slice(1) : ls;
    if (!nowL) return lead;
    // the label under the bucket that is now gives way to "Now"; any that would touch it give way too
    return [...lead.filter((l) => l.i !== nowL.i && !clash(l, nowL)), nowL];
  };
  const byI = (ls: AxisLabel[]) => ls.sort((p, q) => p.i - q.i);
  // month names when every month fits; month initials when a long range has six or more and they all fit that way
  const [names, initials] = sets;
  const whole = withNow(names!);
  if (fits(whole)) return byI(whole);
  if (initials && initials.length >= 6) {
    const ls = withNow(initials);
    if (fits(ls)) return byI(ls);
  }
  // else as many as fit, newest first (the recent end of the chart is the one read most), each kept clear of the ones kept
  const kept: AxisLabel[] = nowL ? [nowL] : [];
  for (const l of [...names!].reverse()) if (l.i !== nowL?.i && kept.every((k) => !clash(l, k))) kept.push(l);
  return byI(kept);
};

// ---------- words ----------
const monthYear = (d: ISODate) => `${fmtDate('monthShort', d)} ${d.slice(0, 4)}`;

/** The headline's words after the number, for a range ("mi in 3 months", "mi since Oct 12", "mi this year"). */
export const rangeContext = (span: Pick<RangeSpan, 'range' | 'from'>, today: ISODate) => {
  switch (span.range) {
    case '1M':
      return `since ${fmtDate('md', span.from)}`;
    case '3M':
      return 'in 3 months';
    case '6M':
      return 'in 6 months';
    case '12M':
      return 'in 12 months';
    case 'YTD':
      return 'this year';
    case 'All':
      return span.from.slice(0, 4) === today.slice(0, 4) ? `since ${fmtDate('md', span.from)}` : `since ${monthYear(span.from)}`;
    default:
      return 'this week';
  }
};

/** A bucket's name while it is read ("Tue, Nov 10", "Week of Oct 5", "This week", "October 2025"). */
export const bucketTitle = (unit: BucketUnit, b: Bucket, today: ISODate) => {
  if (unit === 'day') return b.key === today ? 'Today' : fmtDate('short', b.key);
  if (unit === 'month') {
    return b.key.slice(0, 4) === today.slice(0, 4) ? fmtDate('month', b.key).replace(/ \d{4}$/, '') : fmtDate('month', b.key);
  }
  const mon = mondayOf(today);
  return b.key === mon ? 'This week' : b.key === shiftDays(mon, -7) ? 'Last week' : `Week of ${fmtDate('md', b.key)}`;
};
