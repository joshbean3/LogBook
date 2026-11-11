/**
 * The hero chart's range views (1W, 1M, 3M, 6M, YTD, 12M, All): which days a range covers, how they fall into buckets
 * (days, weeks or months), what each bucket ran and what its plan still asks for, the grid values and the axis labels that
 * fit. Pure functions over ISO dates and a day reader, so the chart and its tests agree. Nothing here renders or reads the
 * clock: `today` is always passed in, and every date is a calendar date string (the day a run is filed under), so a time
 * zone never moves a run between buckets.
 */
import { addMonths, daysBetween, fmtDate, mondayOf, monthOf, monthStart, shiftDays, type ISODate } from '@logbook/shared';
import { dayRange } from '@/ui/charts/range';

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
const WEEKS: Partial<Record<ProgressRange, number>> = { '1M': 5, '3M': 13, '6M': 26 };
/** Months shown by 12M, this one included. */
const MONTHS_12M = 12;
/** Under three weeks of days, weekly bars are too few to compare: the range reads by day. */
const DAILY_UNDER = 21;
/**
 * The most weekly bars a chart draws: 6M's 26. At a phone's width more than that cannot be told apart or landed on with a
 * finger, so a longer YTD or All reads by month (as 12M always does).
 */
export const WEEKLY_MAX = 26;

const endOfWeek = (d: ISODate) => shiftDays(mondayOf(d), 6);
/** How many weekly bars the days from `from` to the end of this week would take. */
const weeksFrom = (from: ISODate, today: ISODate) => (daysBetween(mondayOf(from), endOfWeek(today)) + 1) / 7;
const endOfMonth = (d: ISODate) => shiftDays(addMonths(d, 1), -1);
const startOf = (unit: BucketUnit, d: ISODate) => (unit === 'day' ? d : unit === 'week' ? mondayOf(d) : monthStart(d));
const endOf = (unit: BucketUnit, d: ISODate) => (unit === 'day' ? d : unit === 'week' ? endOfWeek(d) : endOfMonth(d));
const next = (unit: BucketUnit, d: ISODate) => (unit === 'day' ? shiftDays(d, 1) : unit === 'week' ? shiftDays(d, 7) : addMonths(d, 1));

/**
 * The days and buckets a range covers on `today`. `first` is the first day of history (a planned or done run; null with
 * none), which only All reads. No range draws more than about 26 bars.
 * - 1W: this week, Monday to Sunday, by day.
 * - 1M: the four weeks before this one and this week, by week (a runner counts by the week, and 1W already gives the days).
 * - 3M, 6M: 13 and 26 weeks ending this week, by week.
 * - 12M: this month and the 11 before it, by month.
 * - YTD: January 1 to the end of this week, by week (the first week clipped to January 1); by day while the year is under
 *   three weeks old; by month (to the end of this month) once it holds more than 26 weeks.
 * - All: the first day of history to the end of this week, by week; by day under three weeks; by month (to the end of this
 *   month) once it holds more than 26 weeks.
 */
export const rangeSpan = (range: ProgressRange, today: ISODate, first: ISODate | null = null): RangeSpan => {
  const mon = mondayOf(today);
  let unit: BucketUnit = 'week';
  let from: ISODate;
  if (range === '1W') {
    unit = 'day';
    from = mon;
  } else if (range === '12M') {
    unit = 'month';
    from = addMonths(today, -(MONTHS_12M - 1));
  } else if (range === 'YTD' || range === 'All') {
    from = range === 'YTD' ? `${today.slice(0, 4)}-01-01` : first && first < today ? first : today;
    if (daysBetween(from, today) + 1 < DAILY_UNDER) unit = 'day';
    else if (weeksFrom(from, today) > WEEKLY_MAX) unit = 'month';
  } else from = shiftDays(mon, -7 * (WEEKS[range]! - 1));
  // the range runs to the end of the bucket holding today, so what its plan still asks for is whole; a short YTD or All
  // read by day still runs to Sunday, so the days ahead this week show
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
  /** Run miles on the plan over every day of the bucket (this week's plan, for the 1W headline). */
  planned: number;
  plannedRuns: number;
  done: number;
  runs: number;
  /** Planned miles on the bucket's days before today: what the plan asked for before today (1W: behind, or on plan). */
  plannedPast: number;
  /**
   * What the plan still asks for: planned miles on the days after today, and today's until it is run. The only plan the
   * chart draws (the plan is for what is ahead; history is what was run).
   */
  ahead: number;
  /** A day of it falls in a month not loaded yet: a quiet gap, left out of every summary. */
  missing: boolean;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Sums each bucket from a day reader: runs and miles over the days up to today, the plan over every day of the bucket, and
 * what of it is still ahead (the days after today, and today's until it is run). `loaded(month)` marks a bucket that
 * touches a month not in yet.
 */
export const bucketRuns = (buckets: Bucket[], day: (d: ISODate) => DayRun, today: ISODate, loaded?: (month: string) => boolean): RunBucket[] =>
  buckets.map((b) => {
    let planned = 0;
    let plannedRuns = 0;
    let plannedPast = 0;
    let ahead = 0;
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
      if (d > today) {
        ahead += r.planned;
        continue;
      }
      if (d === today) ahead += Math.max(0, r.planned - r.done);
      done += r.done;
      runs += r.runs;
    }
    return { ...b, planned: r2(planned), plannedRuns, plannedPast: r2(plannedPast), ahead: r2(ahead), done: r2(done), runs, missing };
  });

/** One day's lifting: lift sessions on the plan and done, the sets logged and the pounds they moved. */
export interface DayLift {
  planned: number;
  done: number;
  sets: number;
  volume: number;
}
export interface LiftBucket extends Bucket {
  /** Lift sessions on the plan over every day of the bucket. */
  planned: number;
  /** Lift sessions done, up to today. */
  done: number;
  /** Lift sessions the plan still asks for: the days after today, and today's until it is done. */
  ahead: number;
  sets: number;
  /** Weight times reps over every set, in pounds. */
  volume: number;
  missing: boolean;
}
/** The same sum for lifting: sessions done up to today, the plan, and what of it is still ahead. */
export const bucketLifts = (buckets: Bucket[], day: (d: ISODate) => DayLift, today: ISODate, loaded?: (month: string) => boolean): LiftBucket[] =>
  buckets.map((b) => {
    let planned = 0;
    let ahead = 0;
    let done = 0;
    let sets = 0;
    let volume = 0;
    let missing = false;
    for (let d = b.from; d <= b.to; d = shiftDays(d, 1)) {
      if (loaded && !loaded(monthOf(d))) {
        missing = true;
        continue;
      }
      const r = day(d);
      planned += r.planned;
      if (d > today) {
        ahead += r.planned;
        continue;
      }
      if (d === today) ahead += Math.max(0, r.planned - r.done);
      done += r.done;
      sets += r.sets;
      volume += r.volume;
    }
    return { ...b, planned, done, ahead, sets, volume: r2(volume), missing };
  });

/**
 * The usual bucket of a range: the mean of its finished buckets (the one holding today is not over, and the days ahead
 * have nothing), counted from the first bucket with anything in it, so a new log is not averaged over the empty weeks
 * before it began. Null with no finished bucket to count.
 */
export const usualOver = (buckets: Array<Pick<Bucket, 'current' | 'future'> & { done: number; missing: boolean }>): { mean: number; buckets: number } | null => {
  const start = buckets.findIndex((b) => !b.missing && b.done > 0);
  if (start < 0) return null;
  const done = buckets.filter((b, i) => i >= start && !b.current && !b.future && !b.missing);
  if (!done.length) return null;
  return { mean: done.reduce((s, b) => s + b.done, 0) / done.length, buckets: done.length };
};

// ---------- the grid ----------
/** The steps a gridline may sit on: round numbers a glance can add up (0, 5, 10 mi). */
const GRID_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
/**
 * The y scale for a chart of bars from zero: two or three labeled gridlines on round steps, and the top of the plot.
 * The step is the smallest that puts at most three lines under the tallest bar; a bar that stands more than half a step
 * over the last line gets one more line above it (while there are fewer than three), and there are always two. The top
 * is the tallest bar or the last line, whichever is higher, so the bars use the height they have.
 */
export const gridFor = (max: number): { lines: number[]; top: number } => {
  const m = Number.isFinite(max) && max > 0 ? max : 0;
  if (m <= 0) return { lines: [5, 10], top: 10 };
  const step = GRID_STEPS.find((s) => Math.floor(m / s + 1e-9) <= 3) ?? GRID_STEPS[GRID_STEPS.length - 1]!;
  let n = Math.floor(m / step + 1e-9);
  if (n < 3 && m > (n + 0.5) * step) n += 1;
  n = Math.max(2, n);
  const lines = Array.from({ length: n }, (_, i) => (i + 1) * step);
  return { lines, top: Math.max(m, n * step) };
};

// ---------- the axis ----------
export interface AxisLabel {
  i: number;
  text: string;
  now?: boolean;
}
const monthShort = (d: ISODate) => fmtDate('monthShort', d);
const DOW_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const dowLetter = (d: ISODate) => {
  const [y, m, dd] = d.split('-').map(Number) as [number, number, number];
  return DOW_LETTER[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()]!;
};

/** Where a label centered on `x` is drawn: kept whole inside the plot (0 to `plotW`). */
export const labelExtent = (x: number, w: number, plotW: number): readonly [number, number] => {
  const a = Math.max(0, Math.min(plotW - w, x - w / 2));
  return [a, a + w];
};

/**
 * The x labels that fit, never two that collide. Every label is centered under its bar and kept inside the plot. `x(i)`
 * is a bar's center, `width(text)` a label's drawn width, `gap` the room kept between two labels, `plotW` the plot's width.
 * - By day for 1W: every weekday letter (today's is marked `now`: the chart draws it in Night Ink).
 * - Otherwise "Now" sits under the bucket holding today, and the other labels are the most even set that fits around it:
 *   days by date ("Jan 5"); weeks by month ("Sep"), or month initials when every month fits that way, or by date in 1M;
 *   months by name or initial up to two years, by year at each January ("2025") beyond.
 */
export const axisLabels = (span: Pick<RangeSpan, 'range' | 'unit' | 'buckets'>, x: (i: number) => number, width: (text: string) => number, plotW: number, gap = 10): AxisLabel[] => {
  const bs = span.buckets;
  const n = bs.length;
  if (!n) return [];
  const extent = (l: AxisLabel) => labelExtent(x(l.i), width(l.text), plotW);
  const clash = (a: AxisLabel, b: AxisLabel, g = gap) => {
    const [p, q] = extent(a);
    const [r, s] = extent(b);
    return p < s + g && r < q + g;
  };
  const fits = (ls: AxisLabel[], g = gap) => ls.every((l, i) => ls.every((o, j) => i === j || !clash(l, o, g)));
  // two single letters read apart with less room between them than two words do
  const letterGap = Math.min(gap, 6);

  if (span.range === '1W' && span.unit === 'day') {
    const ls = bs.map((b, i) => ({ i, text: dowLetter(b.key), now: b.current || undefined }));
    return fits(ls) ? ls : ls.filter((l) => l.i % 2 === 0 || l.now);
  }
  const ci = bs.findIndex((b) => b.current);
  const nowL: AxisLabel | null = ci >= 0 ? { i: ci, text: 'Now', now: true } : null;

  // the candidate sets: names first, then initials where a unit has them
  const sets: AxisLabel[][] = [];
  if (span.unit === 'day') sets.push(bs.map((b, i) => ({ i, text: fmtDate('md', b.key) })).filter((l) => l.i === 0 || dowLetter(bs[l.i]!.key) === 'M'));
  else if (span.unit === 'week' && span.range === '1M') sets.push(bs.map((b, i) => ({ i, text: fmtDate('md', b.key) })));
  else if (span.unit === 'week') {
    // a month is named under the week its 1st falls in (the first week names its own month)
    const starts = bs
      .map((b, i) => ({ i, m: i === 0 ? b.from : monthStart(b.to) }))
      .filter(({ i }) => i === 0 || monthOf(bs[i]!.from) !== monthOf(bs[i]!.to) || bs[i]!.from.endsWith('-01'));
    sets.push(starts.map(({ i, m }) => ({ i, text: monthShort(m) })));
    sets.push(starts.map(({ i, m }) => ({ i, text: monthShort(m).charAt(0) })));
  } else if (n <= 24) {
    sets.push(bs.map((b, i) => ({ i, text: monthShort(b.key) })));
    sets.push(bs.map((b, i) => ({ i, text: monthShort(b.key).charAt(0) })));
  } else {
    const years = bs.map((b, i) => ({ i, b })).filter(({ b, i }) => i === 0 || b.key.slice(5, 7) === '01');
    sets.push(years.map(({ i, b }) => ({ i, text: b.key.slice(0, 4) })));
  }
  const withNow = (ls: AxisLabel[], g = gap) => {
    // the first bucket's own label (a part month or week at the start) gives way to the next one when they touch
    const lead = ls.length > 1 && ls[0]!.i === 0 && clash(ls[0]!, ls[1]!, g) ? ls.slice(1) : ls;
    if (!nowL) return lead;
    // the label under the bucket that is now gives way to "Now"; any that would touch it give way too
    return [...lead.filter((l) => l.i !== nowL.i && !clash(l, nowL)), nowL];
  };
  const byI = (ls: AxisLabel[]) => ls.sort((p, q) => p.i - q.i);
  // names when every one fits; initials when a long range has six or more and they all fit that way
  const [names, initials] = sets;
  const whole = withNow(names!);
  if (fits(whole)) return byI(whole);
  if (initials && initials.length >= 6) {
    const ls = withNow(initials, letterGap);
    // "Now" is a word: it keeps the full gap from its neighbors (withNow drops any that touch it)
    if (fits(ls.filter((l) => !l.now), letterGap)) return byI(ls);
  }
  // else every k-th name, counted back from the newest (an even rhythm, and the recent end is the one read most)
  for (let k = 2; k <= names!.length; k++) {
    const ls = withNow(names!.filter((_, j) => (names!.length - 1 - j) % k === 0));
    if (fits(ls) && ls.length >= 2) return byI(ls);
  }
  // else as many as fit, newest first, each kept clear of the ones kept
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

/** The days a bucket covers, for the readout while it is read ("Today", "Tue, Nov 10", "Oct 5 to 11", "October", "October 2025"). */
export const bucketDates = (unit: BucketUnit, b: Bucket, today: ISODate) => (unit === 'week' ? dayRange(b.from, b.to) : bucketTitle(unit, b, today));

/** What a range's buckets are called ("day", "week", "month"). */
export const UNIT_WORD: Record<BucketUnit, string> = { day: 'day', week: 'week', month: 'month' };

/** A bucket's name in words ("Tue, Nov 10", "Week of Oct 5", "This week", "October 2025"): what VoiceOver hears. */
export function bucketTitle(unit: BucketUnit, b: Bucket, today: ISODate): string {
  if (unit === 'day') return b.key === today ? 'Today' : fmtDate('short', b.key);
  if (unit === 'month') {
    return b.key.slice(0, 4) === today.slice(0, 4) ? fmtDate('month', b.key).replace(/ \d{4}$/, '') : fmtDate('month', b.key);
  }
  const mon = mondayOf(today);
  return b.key === mon ? 'This week' : b.key === shiftDays(mon, -7) ? 'Last week' : `Week of ${fmtDate('md', b.key)}`;
}
