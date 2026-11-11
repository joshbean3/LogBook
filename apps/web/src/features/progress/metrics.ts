/**
 * The metric pages' numbers (docs/inspiration.md §3 "Metric page", §6 "Progress"): one definition per metric, and one pure
 * function that turns a day-by-day source into everything the page draws (the line, the bars, the normal band, the
 * headline, the tiles, the trend table). The three Apple Health metrics (sleep, HRV, resting heart rate) read the daily
 * values the server holds for the account. Nothing here renders, and nothing here is sent anywhere.
 */
import { fmtDate, mi, shiftDays, type Activity, type ISODate, type LiftSet } from '@logbook/shared';
import { mean, normalBand, rolling, rollingSparse, standing, trendRows, type NormalBand, type RangeWindow, type Standing, type TrendRow } from '@/ui/charts';
import { HEALTH_BUILT, STRAVA_BUILT } from '@/lib/features';
import { paceText } from './data';
import type { HealthDay } from './healthDays';

export type MetricId = 'mileage' | 'pace' | 'consistency' | 'lifts' | 'sleep' | 'hrv' | 'rhr';
export const HEALTH_IDS: readonly MetricId[] = ['rhr', 'hrv', 'sleep'];
/** The metrics that have a page. A build without Apple Health has no health pages at all. */
export const METRIC_IDS: readonly MetricId[] = ['mileage', 'pace', 'consistency', 'lifts', ...(HEALTH_BUILT ? (['sleep', 'hrv', 'rhr'] as const) : [])];
export const isMetricId = (v: string | undefined): v is MetricId => !!v && (METRIC_IDS as readonly string[]).includes(v);

/** What a metric reads, day by day. The page builds it from the loaded months; the tests build it by hand. */
export interface MetricSource {
  today: ISODate;
  /** The day's month is loaded (a day not loaded is a gap, never a zero). */
  loaded(d: ISODate): boolean;
  /** Run miles that count (activities, and runs marked Done by hand). */
  milesOn(d: ISODate): number;
  /** How many runs. */
  runCountOn(d: ISODate): number;
  /** The run activities (pace needs time and distance). */
  runsOn(d: ISODate): Activity[];
  /** Whether a run counts as easy (planned Easy or Long, else by heart rate or pace; see `easyPace`). */
  isEasy(a: Activity): boolean;
  /** Share of habits done (0..1); null with no habits that day. */
  habitShare(d: ISODate): number | null;
  /** 1 for a day of the plan kept, 0 for one missed, null for a day with nothing to keep (rest, nothing planned, still open). */
  trainingOn(d: ISODate): number | null;
  liftsOn(d: ISODate): LiftSet[];
  /** The day's Apple Health readings (sleep, HRV, resting heart rate); null for a day with none. */
  healthOn(d: ISODate): HealthDay | null;
}

export interface Variant {
  id: string;
  /** The chip that switches to it. */
  chip: string;
  unit: string;
  /** What the line is, in words ("Miles in the 7 days to each day"). */
  lineName: string;
  /** A day's raw value; null when there is nothing to read (not loaded, no run, no habits). */
  daily(src: MetricSource, d: ISODate): number | null;
  /** The trailing window the line rolls over. */
  window: number;
  agg: 'sum' | 'mean';
  /** Most days have no value (pace, the plan): the line is carried between the days that do, and dots mark them. */
  sparse?: boolean;
  /** Faint daily bars behind the line. */
  bars?: boolean;
  /** The axis starts at zero. */
  zero?: boolean;
  /** Smaller is higher (pace). */
  invert?: boolean;
  /** The best point is the lowest one, drawn the usual way up (resting heart rate). Default: follows `invert`. */
  lowBest?: boolean;
  /** The second stat tile's label; default "Fastest" for an inverted metric, else "High". */
  bestLabel?: string;
  /** The unit on a trend tile, saying what the number covers ("mi, 7 days"); default: `unit`. */
  tileUnit?: string;
  /** A share: the page's chart keeps round percent steps and draws no average pill at zero. */
  percent?: boolean;
  format(v: number): string;
  axis(v: number): string;
  steps?: number[];
  /** The status words against your normal. */
  words: Record<Standing, string>;
  /** The trend table's change cell (default: a signed percent). */
  change?(r: TrendRow): string;
  /** The method footnote under the trend table. */
  method: string;
}

export interface MetricDef {
  id: MetricId;
  name: string;
  /** Read from Apple Health: with no readings the page says where the connection stands. */
  health?: boolean;
  variants: Variant[];
  /** The name on its trend tile, when the tile leads with a variant other than the first ("Plan" for Consistency). */
  tileName?: Partial<Record<string, string>>;
  /** Said where a number would be when there is no data yet. */
  emptyWord: string;
  /** Under the empty chart: two short lines. */
  emptyLine: string;
  what: string;
  why: string;
  how: string;
}

const sumOf = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const volume = (sets: LiftSet[]) => sumOf(sets.map((s) => s.weight * s.reps));
const thousands = (v: number) => (Math.abs(v) >= 10000 ? `${(v / 1000).toFixed(1)}K` : Math.round(v).toLocaleString('en-US'));
const whole = (v: number) => String(Math.round(v));
const USUAL = { above: 'Above your usual', within: 'Usual range', below: 'Below your usual' } as const;
const secs = (r: TrendRow) => {
  const d = Math.round((r.now ?? 0) - (r.before ?? 0));
  return d === 0 ? 'Level' : `${Math.abs(d)} s ${d < 0 ? 'faster' : 'slower'}`;
};
const points = (r: TrendRow) => {
  const d = Math.round((r.now ?? 0) - (r.before ?? 0));
  return d === 0 ? 'Level' : `${d > 0 ? '+' : '−'}${Math.abs(d)} pts`;
};
const paceOfDay = (src: MetricSource, d: ISODate, only?: (a: Activity) => boolean) => {
  if (!src.loaded(d)) return null;
  const runs = src.runsOn(d).filter((a) => a.miles > 0.2 && a.movingSec > 0 && (!only || only(a)));
  const miles = sumOf(runs.map((a) => a.miles));
  return miles > 0 ? sumOf(runs.map((a) => a.movingSec)) / miles : null;
};
const tenths = (v: number) => v.toFixed(1);
interface HealthSpec {
  id: MetricId;
  name: string;
  unit: string;
  /** The day's value in the metric's unit. */
  pick(h: HealthDay): number | null;
  format?(v: number): string;
  emptyLine: string;
  what: string;
  why: string;
  how: string;
  lowBest?: boolean;
  bestLabel?: string;
}
const health = (h: HealthSpec): MetricDef => ({
  id: h.id,
  name: h.name,
  health: true,
  emptyWord: 'No readings yet',
  emptyLine: h.emptyLine,
  what: h.what,
  why: h.why,
  how: h.how,
  variants: [
    {
      id: h.id,
      chip: h.name,
      unit: h.unit,
      lineName: `${h.name}, 7-day average`,
      daily: (src, d) => {
        const day = src.healthOn(d);
        return day ? h.pick(day) : null;
      },
      window: 7,
      agg: 'mean',
      lowBest: h.lowBest,
      bestLabel: h.bestLabel,
      format: h.format ?? whole,
      axis: h.format ?? whole,
      words: USUAL,
      method: 'Each row compares the average of the last N days with the N days before.',
    },
  ],
});

/** Every metric, in the order Progress lists them. */
export const METRICS: Record<MetricId, MetricDef> = {
  mileage: {
    id: 'mileage',
    name: 'Weekly mileage',
    emptyWord: 'No runs yet',
    emptyLine: 'No runs yet. Once you log one, it shows up here.',
    what: 'The miles you ran in the last 7 days, counted fresh each day.',
    why: 'Steady weekly mileage builds the base a race stands on. Big jumps from one week to the next are hard to absorb.',
    how: STRAVA_BUILT
      ? 'Each day adds up the runs from that day and the 6 before it: Strava activities, plus runs you marked Done by hand at their planned miles. The bars are single days. Your usual range is the middle half of your last 90 days.'
      : 'Each day adds up the runs you marked Done from that day and the 6 before it, at their planned miles. The bars are single days. Your usual range is the middle half of your last 90 days.',
    variants: [
      {
        id: 'miles',
        chip: 'Miles',
        unit: 'mi',
        tileUnit: 'mi, 7 days',
        lineName: 'Miles in the 7 days to each day',
        daily: (src, d) => (src.loaded(d) ? src.milesOn(d) : null),
        window: 7,
        agg: 'sum',
        bars: true,
        zero: true,
        format: mi,
        axis: whole,
        words: USUAL,
        method: 'Each row compares the miles in the last N days with the N days before.',
      },
      {
        id: 'runs',
        chip: 'Runs',
        unit: 'runs',
        tileUnit: 'runs, 7 days',
        lineName: 'Runs in the 7 days to each day',
        daily: (src, d) => (src.loaded(d) ? src.runCountOn(d) : null),
        window: 7,
        agg: 'sum',
        bars: true,
        zero: true,
        format: whole,
        axis: whole,
        words: USUAL,
        method: 'Each row compares the runs in the last N days with the N days before.',
      },
    ],
  },
  pace: {
    id: 'pace',
    name: 'Run pace',
    emptyWord: 'No timed runs yet',
    emptyLine: 'No timed runs yet. Runs that come with a time show their pace here.',
    what: 'Your average pace per mile, across your runs over the last 4 weeks.',
    why: 'Pace at the same effort is how fitness shows up. Easy runs getting quicker at the same heart rate is the base doing its job.',
    how: 'Each run day counts its moving time divided by its miles. The line averages the run days in the 28 days to each day. Easy runs are the ones planned as Easy or Long, else the ones at an easy heart rate. Faster is higher on the chart.',
    variants: [
      {
        id: 'all',
        chip: 'All runs',
        unit: '/mi',
        tileUnit: '/mi, 28 days',
        lineName: 'Average pace over 28 days',
        daily: (src, d) => paceOfDay(src, d),
        window: 28,
        agg: 'mean',
        sparse: true,
        invert: true,
        format: paceText,
        axis: paceText,
        steps: [5, 10, 15, 20, 30, 60, 120, 300],
        words: { above: 'Slower than usual', within: 'Usual range', below: 'Faster than usual' },
        change: secs,
        method: 'Each row compares the average pace of run days in the last N days with the N days before.',
      },
      {
        id: 'easy',
        chip: 'Easy runs',
        unit: '/mi',
        tileUnit: '/mi, 28 days',
        lineName: 'Average easy pace over 28 days',
        daily: (src, d) => paceOfDay(src, d, (a) => src.isEasy(a)),
        window: 28,
        agg: 'mean',
        sparse: true,
        invert: true,
        format: paceText,
        axis: paceText,
        steps: [5, 10, 15, 20, 30, 60, 120, 300],
        words: { above: 'Slower than usual', within: 'Usual range', below: 'Faster than usual' },
        change: secs,
        method: 'Each row compares the average pace of easy runs in the last N days with the N days before.',
      },
    ],
  },
  consistency: {
    id: 'consistency',
    name: 'Consistency',
    tileName: { habits: 'Habits', plan: 'On plan' },
    emptyWord: 'Nothing to count yet',
    emptyLine: 'Nothing to count yet. Habits you tap and sessions you keep land here.',
    what: 'How much of what you set out to do got done: your habits, or the sessions in your plan.',
    why: 'Fitness comes from weeks stacked on weeks. A rough day matters less than coming back the next one.',
    how: 'Habits: the share of your habits done each day, averaged over 7 days; today counts once a habit is done. Plan: each day with a session is kept (done, done at the floor, or a run off the plan) or missed, averaged over the days with something planned in the last 14. Rest days are left out.',
    variants: [
      {
        id: 'habits',
        chip: 'Habits',
        unit: '%',
        tileUnit: '%, 7 days',
        percent: true,
        steps: [50, 100],
        lineName: 'Habits done, 7-day average',
        daily: (src, d) => {
          if (!src.loaded(d)) return null;
          const s = src.habitShare(d);
          return s == null ? null : s * 100;
        },
        window: 7,
        agg: 'mean',
        zero: true,
        format: whole,
        axis: whole,
        words: USUAL,
        change: points,
        method: 'Each row compares the share of habits done in the last N days with the N days before.',
      },
      {
        id: 'plan',
        chip: 'Plan',
        unit: '%',
        tileUnit: '%, 14 days',
        percent: true,
        steps: [50, 100],
        lineName: 'Plan days kept, 14-day average',
        daily: (src, d) => {
          if (!src.loaded(d)) return null;
          const t = src.trainingOn(d);
          return t == null ? null : t * 100;
        },
        window: 14,
        agg: 'mean',
        sparse: true,
        zero: true,
        format: whole,
        axis: whole,
        words: USUAL,
        change: points,
        method: 'Each row compares the share of planned days kept in the last N days with the N days before.',
      },
    ],
  },
  lifts: {
    id: 'lifts',
    name: 'Lift volume',
    emptyWord: 'No lifts yet',
    emptyLine: 'No lifts yet. Log a set from a lift session and it shows up here.',
    what: 'The total weight you moved in the last 7 days: weight times reps, over every set.',
    why: 'Volume is the work that makes strength. Watching it keeps a heavy stretch of running from quietly crowding lifting out.',
    how: 'Each set counts its weight times its reps. Each day adds up its sets and the 6 days before. The bars are single days. Your usual range is the middle half of your last 90 days.',
    variants: [
      {
        id: 'volume',
        chip: 'Volume',
        unit: 'lb',
        tileUnit: 'lb, 7 days',
        lineName: 'Pounds moved in the 7 days to each day',
        daily: (src, d) => volume(src.liftsOn(d)),
        window: 7,
        agg: 'sum',
        bars: true,
        zero: true,
        format: thousands,
        axis: thousands,
        words: USUAL,
        method: 'Each row compares the volume lifted in the last N days with the N days before.',
      },
      {
        id: 'sets',
        chip: 'Sets',
        unit: 'sets',
        tileUnit: 'sets, 7 days',
        lineName: 'Sets in the 7 days to each day',
        daily: (src, d) => src.liftsOn(d).length,
        window: 7,
        agg: 'sum',
        bars: true,
        zero: true,
        format: whole,
        axis: whole,
        words: USUAL,
        method: 'Each row compares the sets logged in the last N days with the N days before.',
      },
    ],
  },
  sleep: health({
    id: 'sleep',
    name: 'Sleep',
    unit: 'h',
    pick: (h) => (h.sleepMin != null ? h.sleepMin / 60 : null),
    format: tenths,
    emptyLine: 'No nights yet. Sleep from Apple Health shows here.',
    what: 'How long you slept each night, from Apple Health.',
    why: 'Sleep is when training turns into fitness. A short week of nights often shows up in your runs first.',
    how: 'Hours asleep each night, averaged over 7 nights, against the middle half of your last 90 nights.',
  }),
  hrv: health({
    id: 'hrv',
    name: 'HRV',
    unit: 'ms',
    pick: (h) => h.hrvMs,
    emptyLine: 'No readings yet. HRV from Apple Health shows here.',
    what: 'Heart rate variability: the small changes in time between heartbeats, from Apple Health.',
    why: 'Higher than your usual often goes with feeling fresh. A run of low days often goes with fatigue or a hard stretch of training.',
    how: 'Each day’s value in milliseconds, averaged over 7 days, against the middle half of your last 90 days. Only your own normal matters, not anyone else’s.',
  }),
  rhr: health({
    id: 'rhr',
    name: 'Resting HR',
    unit: 'bpm',
    pick: (h) => h.restingHr,
    lowBest: true,
    bestLabel: 'Lowest',
    emptyLine: 'No readings yet. Resting heart rate from Apple Health shows here.',
    what: 'Your heart rate at rest, from Apple Health.',
    why: 'A resting rate that creeps up over a few days often goes with fatigue or a hard stretch of training.',
    how: 'The daily resting heart rate, averaged over 7 days, against the middle half of your last 90 days.',
  }),
};

/** Days of history the page needs before the window: the rolling window, the 90 days of the normal and the trend table's 90 + 90. */
export const HISTORY_DAYS = 180;

export interface MetricModel {
  def: MetricDef;
  variant: Variant;
  window: RangeWindow;
  /** The window's dates. */
  dates: ISODate[];
  /** The rolling line over the window. */
  line: Array<number | null>;
  /** The window's daily values (bars, or dots for a sparse series). */
  daily: Array<number | null>;
  /** The line at the window's last day. */
  value: number | null;
  /** The day `value` is for. */
  valueDate: ISODate;
  band: NormalBand | null;
  /** Values the normal is built from so far (for "Building your normal: 9 of 14 days"). */
  bandHave: number;
  standing: Standing | null;
  /** The status word under the number. */
  status: string;
  /** The line's mean over the window: the dotted average. */
  avg: number | null;
  /** The best point of the line in the window (highest, or lowest pace) and its day. */
  best: { v: number; d: ISODate } | null;
  /** Sum metrics: the window's total. Mean metrics: how many days had a value. */
  total: number;
  days: number;
  trend: TrendRow[];
  /** The last day with data, anywhere up to today. */
  latest: ISODate | null;
  /** The first day with data in everything loaded (where `<` stops). */
  since: ISODate | null;
  hasData: boolean;
}

const hasValue = (v: Variant, x: number | null) => x != null && (v.agg === 'mean' || x > 0);

/**
 * Everything one metric page draws, for one variant and one window. The line starts where the data does (no long run of
 * zeros before the first run), the normal band waits for two weeks of values, and the trend table always reads up to today.
 */
export const buildMetric = (def: MetricDef, variantId: string | null, src: MetricSource, window: RangeWindow): MetricModel => {
  const variant = def.variants.find((v) => v.id === variantId) ?? def.variants[0]!;
  const end = src.today > window.to ? src.today : window.to;
  const startA = shiftDays(window.from, -(90 + variant.window));
  const startB = shiftDays(src.today, -(HISTORY_DAYS + variant.window));
  const start = startA < startB ? startA : startB;
  const all: ISODate[] = [];
  for (let d = start; d <= end; d = shiftDays(d, 1)) all.push(d);
  const raw = all.map((d) => variant.daily(src, d));
  const first = raw.findIndex((x) => hasValue(variant, x));
  // before the first value there is no data, not a zero
  const dailyAll = raw.map((x, i) => (first < 0 || i < first ? null : x));
  const live = all.map((d, i) => first >= 0 && i >= first && src.loaded(d));
  const lineAll = variant.sparse ? rollingSparse(dailyAll, variant.window, live) : rolling(dailyAll.map((x, i) => (live[i] ? (x ?? (variant.agg === 'sum' ? 0 : null)) : null)), variant.window, variant.agg);
  // a mean metric's day with no value (no habits that day) has no point: rolling keeps a null day null
  const lineFixed = lineAll;
  const wi = all.indexOf(window.from);
  const wj = all.indexOf(window.to);
  const line = lineFixed.slice(wi, wj + 1);
  const daily = dailyAll.slice(wi, wj + 1);
  const dates = all.slice(wi, wj + 1);
  // the headline is the window's last day; reading back from it to the newest point if that day has none
  let vi = line.length - 1;
  while (vi >= 0 && line[vi] == null) vi--;
  const value = vi >= 0 ? line[vi]! : null;
  const valueDate = vi >= 0 ? dates[vi]! : window.to;
  // the normal: the middle half of the 90 days to the window's end
  const normalFrom = Math.max(0, wj - 89);
  const normalVals = lineFixed.slice(normalFrom, wj + 1);
  const band = normalBand(normalVals);
  const bandHave = normalVals.filter((v) => v != null).length;
  const st = standing(value, band);
  const hasData = first >= 0;
  const status = !hasData ? def.emptyWord : value == null ? 'Nothing in this stretch' : st ? variant.words[st] : `Building your normal: ${Math.min(bandHave, 13)} of 14 days`;
  let best: MetricModel['best'] = null;
  line.forEach((v, i) => {
    if (v == null) return;
    if (!best || ((variant.lowBest ?? variant.invert) ? v < best.v : v > best.v)) best = { v, d: dates[i]! };
  });
  const present = daily.filter((x): x is number => x != null);
  const ti = all.indexOf(src.today);
  const trendDaily = dailyAll.slice(Math.max(0, ti - 179), ti + 1).map((x, k, arr) => {
    // a sum metric's quiet day inside the data is a zero, not a gap
    const idx = ti - (arr.length - 1) + k;
    return variant.agg === 'sum' && x == null && live[idx] ? 0 : x;
  });
  let latest: ISODate | null = null;
  for (let i = dailyAll.length - 1; i >= 0; i--)
    if (hasValue(variant, dailyAll[i]!)) {
      latest = all[i]!;
      break;
    }
  return {
    def,
    variant,
    window,
    dates,
    line,
    daily,
    value,
    valueDate,
    band,
    bandHave,
    standing: st,
    status,
    avg: mean(line),
    best,
    total: variant.agg === 'sum' ? sumOf(present) : present.length,
    days: present.length,
    trend: trendRows(trendDaily, variant.agg, undefined, lineFixed.slice(Math.max(0, ti - 179), ti + 1)),
    latest,
    since: first >= 0 ? all[first]! : null,
    hasData,
  };
};

/**
 * The variant a tile leads with, and a page opens on: the first one with something above zero in it, so an account that
 * follows a plan and ticks no habits reads its plan (never a flat 0%), and bodyweight lifting reads its sets. With nothing
 * anywhere it is the first variant.
 */
export const leadVariant = (def: MetricDef, src: MetricSource, window: RangeWindow): string => {
  let withData: string | null = null;
  for (const v of def.variants) {
    const m = buildMetric(def, v.id, src, window);
    if (!m.hasData) continue;
    if (m.daily.some((x) => x != null && x > 0) || m.line.some((x) => x != null && x > 0)) return v.id;
    withData ??= v.id;
  }
  return withData ?? def.variants[0]!.id;
};

/** "Usual 18–26 mi": the band in the metric's own words, for the right of the status line. */
export const bandWords = (m: MetricModel) => {
  if (!m.band) return null;
  const v = m.variant;
  const [a, b] = [m.band.lo, m.band.hi];
  const unit = v.unit === '%' ? '%' : v.unit.startsWith('/') ? v.unit : ` ${v.unit}`;
  return `Usual ${v.format(a)}–${v.format(b)}${unit}`;
};

/** `1 day`, `14 days`. */
export const daysWords = (n: number, noun = 'day') => `${n} ${n === 1 ? noun : `${noun}s`}`;

/** "Nov 8" or "7 days to Nov 8": the date under the big number. */
export const valueDateWords = (m: MetricModel, today: ISODate) => {
  const d = m.valueDate === today ? 'today' : fmtDate('md', m.valueDate);
  return m.variant.window > 1 ? `${m.variant.window} days to ${d}` : d;
};
