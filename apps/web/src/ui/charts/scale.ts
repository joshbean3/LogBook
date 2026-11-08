/**
 * The chart kit's arithmetic: scales, ticks, smooth paths, bands, rolling windows, trends and arcs. Pure functions with no
 * DOM and no React, so every chart in the app draws from the same numbers and the tests can check them.
 */

export type Pt = readonly [number, number];
export type Series = ReadonlyArray<number | null>;

const sum = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0);
const present = (xs: Series): number[] => xs.filter((v): v is number => v != null && Number.isFinite(v));

/** The mean of the values that are there; null when none are. */
export const mean = (xs: Series): number | null => {
  const v = present(xs);
  return v.length ? sum(v) / v.length : null;
};

/** The p-th percentile (0..1) by linear interpolation; null for an empty list. */
export const percentile = (xs: Series, p: number): number | null => {
  const v = present(xs).sort((a, b) => a - b);
  if (!v.length) return null;
  const k = Math.min(1, Math.max(0, p)) * (v.length - 1);
  const lo = Math.floor(k);
  const hi = Math.ceil(k);
  return v[lo]! + (v[hi]! - v[lo]!) * (k - lo);
};

/** Smallest and largest value present, or null. */
export const extent = (xs: Series): [number, number] | null => {
  const v = present(xs);
  return v.length ? [Math.min(...v), Math.max(...v)] : null;
};

/** A linear map from a domain onto a range. A zero-width domain maps to the middle of the range. */
export const scaleLinear =
  ([d0, d1]: readonly [number, number], [r0, r1]: readonly [number, number]) =>
  (v: number) =>
    d1 === d0 ? (r0 + r1) / 2 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);

const DEFAULT_STEPS = [-2, -1, 0, 1, 2, 3, 4, 5].flatMap((k) => [1, 2, 2.5, 5].map((m) => m * 10 ** k));

/** The tick step that gives at most `count` intervals across the span. `steps` lists the allowed intervals (pace: 15 s, 30 s, 60 s). */
export const tickStep = (lo: number, hi: number, count = 3, steps: readonly number[] = DEFAULT_STEPS) => {
  const span = Math.max(hi - lo, 1e-9);
  return steps.find((s) => span / s <= count) ?? steps[steps.length - 1]!;
};

/** Round tick values inside [lo, hi]. Never empty: a flat line gets one tick in the middle. */
export const niceTicks = (lo: number, hi: number, count = 3, steps?: readonly number[]): number[] => {
  const step = tickStep(lo, hi, count, steps);
  const out: number[] = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6 + 0);
  return out.length ? out : [Math.round(((lo + hi) / 2) * 1e6) / 1e6];
};

/**
 * A y domain that holds every value with a little room, widened outward to round ticks. `zero` pins the floor at 0 (miles,
 * volume); otherwise the floor follows the data (pace, heart rate). A flat or empty series still gets a usable domain.
 */
export const niceDomain = (values: Series, opts: { zero?: boolean; count?: number; steps?: readonly number[]; pad?: number } = {}): [number, number] => {
  const e = extent(values);
  if (!e) return [0, 1];
  let [lo, hi] = e;
  if (opts.zero) lo = Math.min(0, lo);
  if (hi - lo < 1e-9) {
    const d = Math.max(1, Math.abs(hi) * 0.1);
    lo = opts.zero ? Math.min(0, lo) : lo - d;
    hi = hi + d;
  }
  const pad = (hi - lo) * (opts.pad ?? 0.08);
  const rawLo = opts.zero && lo >= 0 ? lo : lo - pad;
  const rawHi = hi + pad;
  const step = tickStep(rawLo, rawHi, opts.count ?? 3, opts.steps);
  const nlo = opts.zero && lo >= 0 ? lo : Math.floor(rawLo / step) * step;
  return [nlo, Math.ceil(rawHi / step) * step];
};

/** Runs of consecutive points that are present: a null breaks the line. */
export const segments = (xs: Series): Array<Array<{ i: number; v: number }>> => {
  const out: Array<Array<{ i: number; v: number }>> = [];
  let cur: Array<{ i: number; v: number }> = [];
  xs.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) {
      if (cur.length) out.push(cur);
      cur = [];
    } else cur.push({ i, v });
  });
  if (cur.length) out.push(cur);
  return out;
};

const f = (n: number) => (Math.round(n * 10) / 10).toString();

/**
 * A smooth line through the points that never overshoots them (monotone cubic, Fritsch and Carlson): a run of equal
 * values stays flat and a peak stays the peak, so the curve never invents a number the data does not have.
 */
export const smoothPath = (pts: readonly Pt[]): string => {
  const n = pts.length;
  if (!n) return '';
  if (n === 1) return `M${f(pts[0]![0])},${f(pts[0]![1])}`;
  if (n === 2) return `M${f(pts[0]![0])},${f(pts[0]![1])}L${f(pts[1]![0])},${f(pts[1]![1])}`;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1]![0] - pts[i]![0]);
    m.push(dx[i]! === 0 ? 0 : (pts[i + 1]![1] - pts[i]![1]) / dx[i]!);
  }
  const t: number[] = [m[0]!];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1]! * m[i]! <= 0 ? 0 : (m[i - 1]! + m[i]!) / 2);
  t.push(m[n - 2]!);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i]! / m[i]!;
    const b = t[i + 1]! / m[i]!;
    const h = a * a + b * b;
    if (h > 9) {
      const s = 3 / Math.sqrt(h);
      t[i] = s * a * m[i]!;
      t[i + 1] = s * b * m[i]!;
    }
  }
  let d = `M${f(pts[0]![0])},${f(pts[0]![1])}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i]!;
    const [x1, y1] = pts[i + 1]!;
    const h = dx[i]! / 3;
    d += `C${f(x0 + h)},${f(y0 + t[i]! * h)} ${f(x1 - h)},${f(y1 - t[i + 1]! * h)} ${f(x1)},${f(y1)}`;
  }
  return d;
};

/** The same line closed down to a baseline, for a soft fill under it. */
export const areaPath = (pts: readonly Pt[], baseline: number): string => {
  if (pts.length < 2) return '';
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  return `${smoothPath(pts)}L${f(last[0])},${f(baseline)}L${f(first[0])},${f(baseline)}Z`;
};

/**
 * A trailing window over a daily series: each day gets the sum (or mean) of itself and the `n - 1` days before. A day
 * that is null itself (not loaded, or in the future) stays null; a window with nothing present is null too.
 */
export const rolling = (xs: Series, n: number, agg: 'sum' | 'mean'): Array<number | null> =>
  xs.map((v, i) => {
    if (v == null) return null;
    const win = present(xs.slice(Math.max(0, i - n + 1), i + 1));
    if (!win.length) return null;
    return agg === 'sum' ? sum(win) : sum(win) / win.length;
  });

/**
 * Like `rolling('mean')`, but for a sparse series such as pace, where most days have no value: every day from the first
 * value on gets the mean of whatever falls in its window, so the line runs on between runs. Null before the first value,
 * and null for a window with nothing in it.
 */
export const rollingSparse = (xs: Series, n: number, live?: ReadonlyArray<boolean>): Array<number | null> =>
  xs.map((_, i) => {
    if (live && !live[i]) return null;
    const win = present(xs.slice(Math.max(0, i - n + 1), i + 1));
    return win.length ? sum(win) / win.length : null;
  });

/** A running total. Null days add nothing and stay null in the output (a day not reached yet draws no point). */
export const cumulative = (xs: Series): Array<number | null> => {
  let t = 0;
  return xs.map((v) => {
    if (v == null) return null;
    t += v;
    return t;
  });
};

/** At most `max` points, by averaging equal chunks (a 90-day sparkline at the width of a table row). */
export const downsample = (xs: Series, max: number): Array<number | null> => {
  if (xs.length <= max) return [...xs];
  const out: Array<number | null> = [];
  const size = xs.length / max;
  for (let k = 0; k < max; k++) out.push(mean(xs.slice(Math.floor(k * size), Math.floor((k + 1) * size))));
  return out;
};

// ---------- the personal normal ----------
export interface NormalBand {
  lo: number;
  hi: number;
  /** How many values it was built from. */
  n: number;
}
/** Values needed before a normal is drawn: two weeks of days. */
export const NORMAL_MIN = 14;
/**
 * Your normal: the middle half of your own recent values (25th to 75th percentile). Null until there are `min` values,
 * so a normal is never drawn from a handful of days.
 */
export const normalBand = (xs: Series, min = NORMAL_MIN): NormalBand | null => {
  const v = present(xs);
  if (v.length < min) return null;
  return { lo: percentile(v, 0.25)!, hi: percentile(v, 0.75)!, n: v.length };
};

export type Standing = 'above' | 'within' | 'below';
/** Where a value sits against the normal band. */
export const standing = (v: number | null, band: NormalBand | null): Standing | null => {
  if (v == null || !band) return null;
  if (v > band.hi + 1e-9) return 'above';
  if (v < band.lo - 1e-9) return 'below';
  return 'within';
};

// ---------- the trend table ----------
export const TREND_WINDOWS = [3, 7, 14, 30, 90] as const;
export type Direction = 'up' | 'down' | 'flat';
export interface TrendRow {
  days: number;
  /** The last `days` days, summed or averaged. */
  now: number | null;
  /** The `days` days before those. */
  before: number | null;
  /** (now − before) ÷ before; null when either side is missing or before is zero. */
  change: number | null;
  dir: Direction | null;
  /** The last `days` days, for the row's sparkline (at most 30 points). */
  spark: Array<number | null>;
}
/** Under this share of change a row reads as level. */
export const FLAT = 0.02;

const aggOf = (xs: Series, agg: 'sum' | 'mean') => {
  const v = present(xs);
  if (!v.length) return null;
  return agg === 'sum' ? sum(v) : sum(v) / v.length;
};

/**
 * One row per window: the last N days against the N days before them. `daily` ends today. Sums suit additive measures
 * (miles, volume), means suit rates (pace, a share of habits kept). A window whose stretch before reaches past the start
 * of the data says nothing rather than compare with a part-empty stretch. `sparkOf` (same length as `daily`, such as the
 * rolling line) feeds the sparklines; by default they draw the daily values.
 */
export const trendRows = (daily: Series, agg: 'sum' | 'mean', windows: readonly number[] = TREND_WINDOWS, sparkOf: Series = daily): TrendRow[] => {
  const first = daily.findIndex((v) => v != null);
  return windows.map((days) => {
    const L = daily.length;
    const last = daily.slice(Math.max(0, L - days));
    // the stretch before must lie wholly inside the data: half a window of history is not a fair comparison
    const prev = L >= days * 2 && first >= 0 && L - days * 2 >= first ? daily.slice(L - days * 2, L - days) : [];
    const now = aggOf(last, agg);
    // a window before the first value (or before the data starts) is not a zero to compare with
    const before = prev.length && prev.some((v) => v != null) ? aggOf(prev, agg) : null;
    const change = now != null && before != null && Math.abs(before) > 1e-9 ? (now - before) / Math.abs(before) : null;
    const dir: Direction | null = change == null ? (now != null && before != null && before === 0 && now === 0 ? 'flat' : null) : Math.abs(change) < FLAT ? 'flat' : change > 0 ? 'up' : 'down';
    return { days, now, before, change, dir, spark: downsample(sparkOf.slice(Math.max(0, sparkOf.length - days)), 30) };
  });
};

/** "+12%" / "−4%" / "0%", with a true minus sign. */
export const signedPercent = (ch: number) => {
  const p = Math.round(ch * 100);
  return p === 0 ? '0%' : `${p > 0 ? '+' : '−'}${Math.abs(p)}%`;
};

// ---------- x labels ----------
/** Indices to label along an axis of `n` points, at least `minGap` px apart, the first and the last always among them. */
export const labelIndices = (n: number, width: number, minGap = 56): number[] => {
  if (n <= 0) return [];
  if (n === 1) return [0];
  const fit = Math.max(2, Math.floor(width / minGap) + 1);
  const every = Math.max(1, Math.ceil((n - 1) / (fit - 1)));
  const out: number[] = [];
  for (let i = 0; i < n; i += every) out.push(i);
  const lastLabelled = out[out.length - 1]!;
  if (lastLabelled !== n - 1) {
    // too close to the end: the end wins
    if (((n - 1 - lastLabelled) / (n - 1)) * width < minGap && out.length > 1) out.pop();
    out.push(n - 1);
  }
  return out;
};

// ---------- arcs ----------
/** A point on a circle; angle in degrees, 0 at 3 o'clock, growing clockwise (SVG's y runs down). */
export const polar = (cx: number, cy: number, r: number, deg: number): Pt => {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};
/** An SVG arc from angle a0 to a1 (degrees, clockwise). */
export const arcPath = (cx: number, cy: number, r: number, a0: number, a1: number): string => {
  const span = Math.max(0, Math.min(359.999, a1 - a0));
  if (span <= 0) return '';
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a0 + span);
  return `M${f(x0)},${f(y0)}A${f(r)},${f(r)} 0 ${span > 180 ? 1 : 0} 1 ${f(x1)},${f(y1)}`;
};
/** A half gauge runs from 9 o'clock (180°) over the top to 3 o'clock (360°): the angle for a share 0..1. */
export const gaugeAngle = (share: number) => 180 + Math.min(1, Math.max(0, share)) * 180;
/** A share 0..1 clamped, or null. */
export const clamp01 = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? null : Math.min(1, Math.max(0, v)));
