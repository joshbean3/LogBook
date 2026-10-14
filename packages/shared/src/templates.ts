import { daysBetween, fmtDate, mondayOf, num, parseISO, shiftDays, type ISODate } from './dates.js';
import { TEMPLATE_MAX_WEEKS, type Goal, type SessionInput, type TemplateInput, type Weekday } from './schemas.js';
import { floorFor } from './sessions.js';

export const WEEKDAYS: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
/** Monday-based index 0..6. */
export const weekdayIndex = (w: Weekday): number => WEEKDAYS.indexOf(w);
export const weekdayOf = (d: ISODate): Weekday => WEEKDAYS[(parseISO(d).getDay() + 6) % 7]!;

interface GoalSpec {
  name: string;
  /** Race distance in miles; null for base. */
  raceMiles: number | null;
  /** Ceiling on the long run. */
  longCap: number;
  /** Ceiling on the weekly quality session; 0 for none. */
  qualityCap: number;
  /** Ceiling on weekly volume (the build also stops at 1.6x / +12 mi of the start). */
  peakCap: number;
  /** Long run share of the week with 4+ run days (25–30%). */
  longShare: number;
  /** Taper length in weeks before race day (the race week is the last of them). */
  taperWeeks: number;
  /** Length when neither `weeks` nor `raceDate` is given. */
  defaultWeeks: number;
  /** The quality session rotates through these, one per build week. */
  quality: readonly QualityKind[];
}

type QualityKind = 'intervals' | 'hills' | 'speed' | 'tempo' | 'threshold' | 'mp';

export const GOAL_SPECS: Record<Goal, GoalSpec> = {
  base: { name: 'Base', raceMiles: null, longShare: 0.28, longCap: 12, qualityCap: 0, peakCap: 45, taperWeeks: 0, defaultWeeks: 8, quality: [] },
  '5k': { name: '5K', raceMiles: 3.1, longShare: 0.25, longCap: 9, qualityCap: 6, peakCap: 40, taperWeeks: 1, defaultWeeks: 8, quality: ['intervals', 'hills', 'speed', 'tempo'] },
  '10k': { name: '10K', raceMiles: 6.2, longShare: 0.28, longCap: 12, qualityCap: 7, peakCap: 45, taperWeeks: 1, defaultWeeks: 10, quality: ['intervals', 'tempo', 'threshold', 'hills'] },
  half: { name: 'Half marathon', raceMiles: 13.1, longShare: 0.3, longCap: 14, qualityCap: 8, peakCap: 50, taperWeeks: 2, defaultWeeks: 12, quality: ['tempo', 'threshold', 'intervals', 'threshold'] },
  marathon: { name: 'Marathon', raceMiles: 26.2, longShare: 0.3, longCap: 20, qualityCap: 10, peakCap: 60, taperWeeks: 3, defaultWeeks: 16, quality: ['mp', 'threshold', 'mp', 'tempo'] },
};

/** Coaching constants, exported so the docs and tests read the same numbers. */
export const TEMPLATE_RULES = {
  /** Weekly growth on build weeks: 10% under 20 mi, 8% from 20 mi. */
  growSmall: 1.1,
  growLarge: 1.08,
  growThreshold: 20,
  /** Every 4th full week is a down week at 75% of the last build week. */
  downEvery: 4,
  downRatio: 0.75,
  /** Taper volume as a share of the last build week, earliest first; the last entry is race week (race miles extra). */
  taper: { 1: [0.55], 2: [0.75, 0.45], 3: [0.8, 0.6, 0.35] } as Record<number, number[]>,
  /** Long run share of the week: the goal's share (25–30%) with 4+ run days, +8 points with 3, 55% with 2, all of it with 1. */
  longShare: (days: number, goalShare: number) => (days >= 4 ? goalShare : days === 3 ? goalShare + 0.08 : days === 2 ? 0.55 : 1),
  longMin: 4,
  /** The quality session: about 20% of the week, 4 mi up to the goal's cap; only from 12 mi a week and 2 run days. */
  qualityShare: 0.2,
  qualityMin: 4,
  qualityFromMiles: 12,
  /** No easy run shorter than this (3 mi is past the 20-minute floor at any pace). */
  easyMin: 3,
} as const;

export type TemplateWeekKind = 'lead-in' | 'build' | 'down' | 'taper' | 'race';

export interface TemplateWeek {
  /** 0 is the partial lead-in week when the block starts mid-week; full weeks are 1..n. */
  week: number;
  /** First date of the week inside the block. */
  start: ISODate;
  kind: TemplateWeekKind;
  /** Target volume for the week (race miles not included). */
  target: number;
  /** What the sessions add up to (race miles included). */
  miles: number;
  runs: number;
}

export interface TemplateSession extends SessionInput {
  date: ISODate;
  kind: 'run';
  type: string;
  title: null;
  details: string | null;
  miles: number;
  minutes: null;
  /** Which template week it belongs to (see `TemplateWeek.week`). */
  week: number;
  /** The floor in minutes, as `floorFor` words it for this type (20 or 30); null for the race, whose floor is showing up. Not stored: the app derives floors from the type. */
  floorMin: number | null;
}

export interface Template {
  name: string;
  summary: string;
  start: ISODate;
  end: ISODate;
  goal: Goal;
  raceDate: ISODate | null;
  weeks: TemplateWeek[];
  sessions: TemplateSession[];
}

export class TemplateError extends Error {}

const r05 = (v: number) => Math.round(v * 2) / 2;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The minutes in a floor sentence ("20 min easy" → 20), or null when it has none. */
export const floorMinutes = (s: Parameters<typeof floorFor>[0]): number | null => {
  const m = /(\d+)\s*min/.exec(floorFor(s));
  return m ? Number(m[1]) : null;
};

/** The workout line for a quality day of `miles`, in the plan sheet's own shorthand. */
const workout = (kind: QualityKind, miles: number, goal: Goal): { type: string; details: string } => {
  const wu = miles >= 6 ? 1.5 : 1;
  const work = Math.max(1, miles - 2 * wu);
  const ends = (mid: string) => `${num(wu)} mi wu, ${mid}, ${num(wu)} mi cd`;
  switch (kind) {
    case 'intervals': {
      const rep = goal === '5k' ? { m: 800, mi: 0.5 } : { m: 1000, mi: 0.62 };
      const n = clamp(Math.round(work / (rep.mi + 0.25)), 3, 10);
      return { type: 'Intervals', details: ends(`${n} × ${rep.m} m at ${goal === '5k' ? '5K' : '10K'} effort, 400 m jog`) };
    }
    case 'hills':
      return { type: 'Hills', details: ends(`${clamp(Math.round(work / 0.35), 4, 10)} × 60 s hills, jog down`) };
    case 'speed':
      return { type: 'Speed', details: ends(`${clamp(Math.round(work / 0.45), 4, 10)} × 1 min fast / 2 min easy`) };
    case 'tempo':
      return { type: 'Tempo', details: ends(`${num(r05(work))} mi at tempo`) };
    case 'threshold': {
      const reps = work >= 4 ? 3 : 2;
      return { type: 'Threshold', details: ends(`${reps} × ${num(Math.round((work / reps) * 4) / 4)} mi at threshold, 2 min jog`) };
    }
    case 'mp':
      return { type: 'Tempo', details: ends(`${num(r05(work))} mi at marathon pace`) };
  }
};

const run = (date: ISODate, week: number, type: string, miles: number, details: string | null = null): TemplateSession => {
  const s = { kind: 'run' as const, type };
  return { date, kind: 'run', type, title: null, details, miles, minutes: null, week, floorMin: /race/i.test(type) ? null : floorMinutes(s) };
};

/** Circular distance between two weekdays (0..3). */
const gap = (a: number, b: number) => Math.min((a - b + 7) % 7, (b - a + 7) % 7);

/** The quality day: the run day farthest from the long run, Tue/Wed/Thu first on ties, never the day before or after when avoidable. */
const pickQualityDay = (runDays: number[], long: number): number | null => {
  const pref = [2, 1, 3, 0, 4, 5, 6]; // wed, tue, thu, mon, fri, sat, sun (Monday-based)
  const cands = runDays.filter((d) => d !== long);
  if (!cands.length) return null;
  return [...cands].sort((a, b) => gap(b, long) - gap(a, long) || pref.indexOf(a) - pref.indexOf(b))[0]!;
};

interface WeekPlan {
  week: number;
  kind: TemplateWeekKind;
  target: number;
  dates: ISODate[];
  longDate: ISODate | null;
  qualityDate: ISODate | null;
  qualityKind: QualityKind | null;
  /** Base blocks put strides on the quality day instead. */
  strides: boolean;
}

const allocate = (p: WeekPlan, goal: Goal): TemplateSession[] => {
  const R = TEMPLATE_RULES;
  const spec = GOAL_SPECS[goal];
  const vol = r05(p.target);
  const n = p.dates.length;
  if (!n || vol <= 0) return [];
  const useQuality = !!(p.qualityDate && p.qualityKind && spec.qualityCap > 0 && n >= 2 && vol >= R.qualityFromMiles);
  let quality = useQuality ? clamp(r05(vol * R.qualityShare), R.qualityMin, spec.qualityCap) : 0;
  let long = p.longDate ? clamp(r05(vol * R.longShare(n, spec.longShare)), Math.min(R.longMin, vol), spec.longCap) : 0;
  let easyDates = p.dates.filter((d) => d !== p.longDate && !(useQuality && d === p.qualityDate));
  // drop easy days the volume can't fill at the minimum, the ones next to the long run or the quality day first
  const busy = [p.longDate, useQuality ? p.qualityDate : null].filter(Boolean) as ISODate[];
  const nearBusy = (d: ISODate) => Math.min(99, ...busy.map((b) => Math.abs(daysBetween(b, d))));
  while (easyDates.length && (vol - long - quality) / easyDates.length < R.easyMin) {
    const drop = [...easyDates].sort((a, b) => nearBusy(a) - nearBusy(b))[0]!;
    easyDates = easyDates.filter((d) => d !== drop);
  }
  let rest = vol - long - quality;
  if (!easyDates.length && rest > 0) {
    // nowhere else to put it: the long run takes it up to its cap, then the quality day
    const add = Math.min(rest, p.longDate ? spec.longCap - long : 0);
    long += add;
    rest -= add;
    if (rest > 0 && quality) quality = Math.min(spec.qualityCap, quality + rest);
  }
  let per = easyDates.length ? rest / easyDates.length : 0;
  // the long run is the longest run of the week
  if (long && per > long) {
    long = Math.min(spec.longCap, r05(per + 1));
    per = easyDates.length ? (vol - long - quality) / easyDates.length : 0;
  }
  const out: TemplateSession[] = [];
  const easies = easyDates.map((d) => ({ d, mi: Math.max(R.easyMin, r05(per)) }));
  // the rounding lands on the last easy run so the week adds up to its target
  if (easies.length) {
    const sum = easies.reduce((t, e) => t + e.mi, 0) + long + quality;
    const last = easies[easies.length - 1]!;
    last.mi = Math.max(R.easyMin, r05(last.mi + (vol - sum)));
  }
  for (const d of p.dates) {
    if (d === p.longDate && long) out.push(run(d, p.week, 'Long', long));
    else if (useQuality && d === p.qualityDate) {
      const w = workout(p.qualityKind!, quality, goal);
      out.push(run(d, p.week, w.type, quality, w.details));
    } else {
      const e = easies.find((x) => x.d === d);
      if (e) out.push(run(d, p.week, 'Easy', e.mi, p.strides && d === p.qualityDate ? 'Easy with 4 × 20 s strides' : null));
    }
  }
  return out;
};

/**
 * A training block from a few answers. Structure:
 * - Week 1 runs `weeklyMiles`; each build week adds 10% (8% from 20 mi), up to the goal's ceiling (and at most 1.6x / +12 mi).
 * - Every 4th full week is a down week at 75% of the last build week; the build resumes after it.
 * - Long run on `longRunDay`: 25–30% of the week with 4+ run days (5K 25%, base/10K 28%, half/marathon 30%; more with
 *   fewer run days), capped by goal (5K 9, 10K 12, half 14, marathon 20, base 12).
 * - One quality session a week for race goals, on the run day farthest from the long run, rotating by goal
 *   (5K intervals/hills/speed/tempo; 10K intervals/tempo/threshold/hills; half tempo/threshold/intervals;
 *   marathon marathon-pace/threshold/tempo). Down weeks swap it for a fartlek. Base blocks get strides instead.
 * - Easy runs fill the other run days (never under 3 mi; days the volume can't fill are dropped).
 * - With `raceDate`: the block ends on race day, the last 1 (5K, 10K), 2 (half) or 3 (marathon) weeks taper,
 *   race week keeps short easy runs (strides on the quality day, a 3 mi shakeout the day before), no long run, and the
 *   race itself is a `Race` session.
 * - A block that starts mid-week gets a lead-in week from `startDate` to Sunday: easy runs only, at week-1 volume for those days.
 * Every run gets a floor via its type (`floorFor`): 20 min for easy/quality, 30 min for long.
 * Names follow the app: type + miles, no title ("Easy 6", "Tempo 7", "Long 12", "Race 13.1").
 */
export const buildTemplate = (input: TemplateInput): Template => {
  const R = TEMPLATE_RULES;
  const spec = GOAL_SPECS[input.goal];
  const raceDate = input.raceDate ?? null;
  const runIdx = [...new Set([...input.runDays, input.longRunDay].map(weekdayIndex))].sort((a, b) => a - b);
  const longIdx = weekdayIndex(input.longRunDay);
  const qualIdx = pickQualityDay(runIdx, longIdx);
  const start = input.startDate;
  const firstMonday = weekdayOf(start) === 'mon' ? start : shiftDays(mondayOf(start), 7);
  let W: number;
  if (raceDate) {
    if (raceDate < firstMonday) throw new TemplateError('The race is too close for a block: pick a later race date or start sooner.');
    W = daysBetween(firstMonday, mondayOf(raceDate)) / 7 + 1;
    if (W > TEMPLATE_MAX_WEEKS) throw new TemplateError(`The race is more than ${TEMPLATE_MAX_WEEKS} weeks out. Build a base block first.`);
  } else W = input.weeks ?? spec.defaultWeeks;
  const end = raceDate ?? shiftDays(firstMonday, W * 7 - 1);

  // ---------- weekly volumes ----------
  const startVol = r05(input.weeklyMiles);
  const cap = Math.max(startVol, Math.min(spec.peakCap, Math.max(startVol * 1.6, startVol + 12)));
  const taperN = raceDate ? Math.min(spec.taperWeeks, Math.max(1, W - 1)) : 0;
  const plans: Array<{ week: number; kind: TemplateWeekKind; target: number }> = [];
  let build = startVol;
  for (let w = 1; w <= W; w++) {
    const taperAt = w - (W - taperN) - 1; // 0.. for taper weeks
    if (taperAt >= 0) {
      const ratios = R.taper[taperN] ?? [0.6];
      plans.push({ week: w, kind: w === W ? 'race' : 'taper', target: r05(build * ratios[taperAt]!) });
    } else if (w === 1) plans.push({ week: w, kind: 'build', target: build });
    else if (w % R.downEvery === 0) plans.push({ week: w, kind: 'down', target: r05(build * R.downRatio) });
    else {
      build = r05(Math.min(cap, build * (build < R.growThreshold ? R.growSmall : R.growLarge)));
      plans.push({ week: w, kind: 'build', target: build });
    }
  }

  // ---------- days ----------
  const weekDates = (monday: ISODate, from: ISODate, to: ISODate) =>
    runIdx.map((i) => shiftDays(monday, i)).filter((d) => d >= from && d <= to);
  const plansOut: WeekPlan[] = [];
  if (start < firstMonday) {
    const dates = weekDates(mondayOf(start), start, shiftDays(firstMonday, -1));
    const frac = dates.length / runIdx.length;
    // a few easy days to ease in: no long run, no quality
    plansOut.push({ week: 0, kind: 'lead-in', target: startVol * frac, dates, longDate: null, qualityDate: null, qualityKind: null, strides: false });
  }
  let q = 0;
  for (const p of plans) {
    const monday = shiftDays(firstMonday, (p.week - 1) * 7);
    const last = p.kind === 'race' && raceDate ? shiftDays(raceDate, -1) : shiftDays(monday, 6);
    const dates = weekDates(monday, monday, last);
    const qualityDate = qualIdx == null ? null : (dates.find((d) => weekdayIndex(weekdayOf(d)) === qualIdx) ?? null);
    let longDate = dates.find((d) => weekdayIndex(weekdayOf(d)) === longIdx) ?? null;
    let qualityKind: QualityKind | null = null;
    let strides = false;
    if (p.kind === 'build' || p.kind === 'taper') {
      if (spec.quality.length) qualityKind = spec.quality[q++ % spec.quality.length]!;
      else strides = p.week >= 3;
    } else if (p.kind === 'down') {
      strides = true;
    } else if (p.kind === 'race') {
      strides = true;
      longDate = null; // no long run in race week
    }
    // weeks with a quality kind but down: a fartlek stands in (handled below), race week: strides on the quality day
    plansOut.push({ week: p.week, kind: p.kind, target: p.target, dates, longDate, qualityDate, qualityKind, strides });
  }

  const sessions: TemplateSession[] = [];
  const weeks: TemplateWeek[] = [];
  for (const p of plansOut) {
    let ss = allocate(p, input.goal);
    if (p.kind === 'down' && spec.quality.length && p.qualityDate) {
      // a down week keeps one light touch of speed: the quality day becomes a fartlek
      ss = ss.map((s) => (s.date === p.qualityDate && s.type === 'Easy' ? run(s.date, s.week, 'Fartlek', s.miles, 'Easy with 6 × 1 min pickups') : s));
    }
    if (p.kind === 'race' && raceDate && spec.raceMiles) {
      // the day before is a shakeout
      const eve = shiftDays(raceDate, -1);
      ss = ss.map((s) => (s.date === eve ? run(eve, s.week, 'Easy', R.easyMin, 'Shakeout with 4 × 20 s strides') : s));
      ss.push(run(raceDate, p.week, 'Race', spec.raceMiles, `${spec.name}. Race day.`));
    }
    ss.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    sessions.push(...ss);
    const miles = Math.round(ss.reduce((t, s) => t + s.miles, 0) * 10) / 10;
    weeks.push({ week: p.week, start: p.dates[0] ?? (p.week === 0 ? start : shiftDays(firstMonday, (p.week - 1) * 7)), kind: p.kind, target: r05(p.target), miles, runs: ss.length });
  }

  const peak = Math.max(...weeks.map((w) => w.target));
  const maxLong = Math.max(0, ...sessions.filter((s) => s.type === 'Long').map((s) => s.miles));
  const name = raceDate ? `${spec.name} · ${fmtDate('md', raceDate)}` : `${spec.name} · ${W} weeks`;
  const bits = [
    `${num(startVol)} to ${num(peak)} mi a week`,
    'a down week every 4th',
    maxLong ? `long run up to ${num(maxLong)} mi` : null,
    spec.quality.length ? 'one quality session a week' : 'strides once a week',
    raceDate ? `${taperN}-week taper to race day` : null,
  ].filter(Boolean);
  const summary = `${bits.join(', ')}.`.replace(/^./, (c) => c.toUpperCase());
  return { name, summary, start, end, goal: input.goal, raceDate, weeks, sessions };
};
