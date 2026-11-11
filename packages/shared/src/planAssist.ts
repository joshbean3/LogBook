import { z } from 'zod';
import { daysBetween, isISODate, mondayOf, shiftDays, type ISODate } from './dates.js';
import { TEMPLATE_MAX_WEEKS, zDate, zGoal, zWeekday, type Goal, type TemplateInput, type Weekday } from './schemas.js';
import { GOAL_SPECS, WEEKDAYS, weekdayIndex, weekdayOf } from './templates.js';

/*
 * The plan builder with the assistant (`POST /plans/template/assist`). The person describes the plan they want; Claude
 * turns the words into a patch to the builder's own settings and nothing else; the app applies the patch to the answers
 * it holds. Three parts live here so the server and the app read the same rules:
 *
 *  - the builder's answers (`BuilderAnswers`) and what they mean in dates (`builderDates`, `builderInput`);
 *  - the contract: the request, the loose shape Claude is asked for, and the cleaned patch the server answers with
 *    (`cleanPlanPatch`: every value checked, clamped to the builder's limits or left out, each with a reason);
 *  - `applyPlanPatch`: the patch applied to real answers, with what changed and what could not be done.
 *
 * A patch says what was asked, not what the settings are now: "two more weeks" is `weeksChange: 2`, "4 runs a week" is
 * `runsPerWeek: 4`. So Claude never has to be told a setting to change it, and a setting that may not be sent (run days
 * and weekly miles read from the person's tracked runs) still changes correctly.
 */

// ---------- the builder's answers ----------

/** The limits of the builder's two numbers (its steppers hold the same). */
export const BUILDER_LIMITS = { weeksMin: 2, weeksMax: TEMPLATE_MAX_WEEKS, milesMin: 3, milesMax: 150 } as const;

/** The plan builder's answers, as the builder holds them. */
export interface BuilderAnswers {
  goal: Goal;
  /** Full weeks, 2 to 30. With a race day, the race is in the last of them. */
  weeks: number;
  /** Monday first. Never empty. */
  runDays: Weekday[];
  /** One of `runDays`. */
  longRunDay: Weekday;
  /** What the person runs a week now: week 1's miles. */
  weeklyMiles: number;
  /** The most miles a week the plan may build to; null leaves it to the plan. */
  peakMiles: number | null;
  /** Start tomorrow. Off, it starts next Monday (or on `startDate`). */
  soon: boolean;
  /** A set first day (the day after an ending plan, or a day the person named). It holds until Start tomorrow is toggled. */
  startDate: ISODate | null;
  /** End on a race day (race goals only). */
  race: boolean;
  /** The weekday of race day, in the plan's last week. */
  raceDay: Weekday;
}

/** The dates the answers stand for on `today`: the first day, the Monday week 1 starts, and race day (null without one). */
export const builderDates = (a: Pick<BuilderAnswers, 'goal' | 'weeks' | 'soon' | 'startDate' | 'race' | 'raceDay'>, today: ISODate): { startDate: ISODate; firstMon: ISODate; raceDate: ISODate | null } => {
  const startDate = a.startDate ?? (a.soon ? shiftDays(today, 1) : shiftDays(mondayOf(today), 7));
  const firstMon = weekdayOf(startDate) === 'mon' ? startDate : shiftDays(mondayOf(startDate), 7);
  const raceDate = a.goal !== 'base' && a.race ? shiftDays(firstMon, (a.weeks - 1) * 7 + weekdayIndex(a.raceDay)) : null;
  return { startDate, firstMon, raceDate };
};

/** What the answers send to `buildTemplate` and to `POST /plans/template`. */
export const builderInput = (a: BuilderAnswers, today: ISODate): TemplateInput & { raceDate: ISODate | null } => {
  const { startDate, raceDate } = builderDates(a, today);
  return { goal: a.goal, weeks: a.weeks, startDate, runDays: a.runDays, longRunDay: a.longRunDay, weeklyMiles: a.weeklyMiles, raceDate, ...(a.peakMiles != null ? { peakMiles: a.peakMiles } : {}) };
};

// ---------- the request ----------

/** What a request asks the assistant to do. `shape` changes the builder's settings; other kinds join here later. */
export const PLAN_ASSIST_KINDS = ['shape'] as const;
export const zPlanAssistKind = z.enum(PLAN_ASSIST_KINDS);
export type PlanAssistKind = z.infer<typeof zPlanAssistKind>;
export const PLAN_ASSIST_WORDS_MAX = 600;

/**
 * The builder's settings as the request may carry them. Each one is null when it is not shared: the app leaves out a
 * setting it read from the person's tracked runs, and the server leaves them all out when the training switch is off.
 */
export const zPlanAssistSettings = z.object({
  goal: zGoal.nullable(),
  weeks: z.number().int().min(1).max(60).nullable(),
  runDays: z.array(zWeekday).max(7).nullable(),
  longRunDay: zWeekday.nullable(),
  weeklyMiles: z.number().min(0).max(500).nullable(),
  peakMiles: z.number().min(0).max(500).nullable(),
  startDate: zDate.nullable(),
  raceDate: zDate.nullable(),
});
export type PlanAssistSettings = z.infer<typeof zPlanAssistSettings>;

export const zPlanAssistRequest = z.object({
  kind: zPlanAssistKind,
  /** The person's own words. */
  words: z.string().trim().min(2).max(PLAN_ASSIST_WORDS_MAX),
  settings: zPlanAssistSettings.nullable().optional(),
});
export type PlanAssistRequest = z.infer<typeof zPlanAssistRequest>;

/**
 * Which answers may not be sent: the ones tracked runs (activities, which can come from Strava) had a part in and the
 * person has not set since.
 */
export interface AnswersFromRuns {
  runDays: boolean;
  weeklyMiles: boolean;
}

/** The settings a request carries: the answers in dates, with the ones read from tracked runs left out (null). */
export const shareableSettings = (a: BuilderAnswers, today: ISODate, fromRuns: AnswersFromRuns): PlanAssistSettings => {
  const { startDate, raceDate } = builderDates(a, today);
  return {
    goal: a.goal,
    weeks: a.weeks,
    runDays: fromRuns.runDays ? null : a.runDays,
    // the long-run day is picked from the run days, so it goes or stays with them
    longRunDay: fromRuns.runDays ? null : a.longRunDay,
    weeklyMiles: fromRuns.weeklyMiles ? null : a.weeklyMiles,
    peakMiles: a.peakMiles,
    startDate,
    raceDate,
  };
};

// ---------- what Claude is asked for, and the cleaned patch ----------

/** Things people ask for that the builder has no setting for. */
export const PLAN_ASSIST_CANNOT = ['lifts', 'cross', 'paces', 'workouts', 'other'] as const;
export type PlanCannot = (typeof PLAN_ASSIST_CANNOT)[number];

/** The shape Claude is asked to produce. Kept loose (no limits, strings for dates); `cleanPlanPatch` checks every value. */
export const zClaudeShapeOutput = z.object({
  goal: zGoal.nullable(),
  weeks: z.number().nullable(),
  weeksChange: z.number().nullable(),
  raceDate: z.string().nullable(),
  race: z.boolean().nullable(),
  runDays: z.array(zWeekday).nullable(),
  addRunDays: z.array(zWeekday).nullable(),
  removeRunDays: z.array(zWeekday).nullable(),
  runsPerWeek: z.number().nullable(),
  runsPerWeekChange: z.number().nullable(),
  longRunDay: zWeekday.nullable(),
  weeklyMiles: z.number().nullable(),
  weeklyMilesChange: z.number().nullable(),
  peakMiles: z.number().nullable(),
  start: z.enum(['tomorrow', 'monday']).nullable(),
  startDate: z.string().nullable(),
  cannot: z.array(z.enum(PLAN_ASSIST_CANNOT)),
  note: z.string().nullable(),
});

/** A change to the builder's settings. A field that is absent was not asked for and stays as it is. */
export const zPlanPatch = z.object({
  goal: zGoal.optional(),
  weeks: z.number().int().min(BUILDER_LIMITS.weeksMin).max(BUILDER_LIMITS.weeksMax).optional(),
  weeksChange: z.number().int().optional(),
  raceDate: zDate.optional(),
  race: z.boolean().optional(),
  /** The whole set of run days, when the person named them all. */
  runDays: z.array(zWeekday).min(1).max(7).optional(),
  addRunDays: z.array(zWeekday).min(1).max(7).optional(),
  removeRunDays: z.array(zWeekday).min(1).max(7).optional(),
  /** How many days a week have a run, when the person gave a number and not the days. */
  runsPerWeek: z.number().int().min(1).max(7).optional(),
  runsPerWeekChange: z.number().int().optional(),
  longRunDay: zWeekday.optional(),
  weeklyMiles: z.number().int().min(BUILDER_LIMITS.milesMin).max(BUILDER_LIMITS.milesMax).optional(),
  weeklyMilesChange: z.number().int().optional(),
  /** A number is the ceiling; null gives the peak back to the plan. */
  peakMiles: z.number().int().min(BUILDER_LIMITS.milesMin).max(BUILDER_LIMITS.milesMax).nullable().optional(),
  start: z.enum(['tomorrow', 'monday']).optional(),
  startDate: zDate.optional(),
});
export type PlanPatch = z.infer<typeof zPlanPatch>;

/** Why a value was changed on its way in, or left out. */
export const PLAN_PATCH_REASONS = [
  'weeks_min',
  'weeks_max',
  'miles_min',
  'miles_max',
  'peak_max',
  'peak_below_now',
  'runs_min',
  'runs_max',
  'keep_one_day',
  'race_past',
  'race_too_soon',
  'race_too_far',
  'race_needs_distance',
  'race_weeks_fit',
  'start_past',
  'start_too_far',
  'bad_value',
] as const;
export type PlanPatchReason = (typeof PLAN_PATCH_REASONS)[number];
export const zPlanPatchNote = z.object({ reason: z.enum(PLAN_PATCH_REASONS), value: z.number().optional() });
export type PlanPatchNote = z.infer<typeof zPlanPatchNote>;

/** `POST /plans/template/assist` answers this. */
export const zPlanAssistResult = z.object({
  kind: zPlanAssistKind,
  patch: zPlanPatch,
  /** Values the server changed to fit the builder's limits or left out, each with why. */
  dropped: z.array(zPlanPatchNote).max(12),
  /** Kinds of things asked for that the builder has no setting for. */
  cannot: z.array(z.enum(PLAN_ASSIST_CANNOT)).max(PLAN_ASSIST_CANNOT.length),
  /** One sentence from the assistant, only when the safety rules call for one or nothing asked for fits the builder. */
  note: z.string().max(240).nullable(),
});
export type PlanAssistResult = z.infer<typeof zPlanAssistResult>;

const NOTE_MAX = 240;
/** How far out a named start or race day may be before it is refused outright (the app checks the weeks itself). */
const FAR_DAYS = 366;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const numberOf = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const dayOf = (v: unknown): Weekday | null => {
  const k = typeof v === 'string' ? v.trim().toLowerCase().slice(0, 3) : '';
  return (WEEKDAYS as readonly string[]).includes(k) ? (k as Weekday) : null;
};
/** Monday first, each day once. */
export const sortDays = (days: readonly Weekday[]): Weekday[] => WEEKDAYS.filter((d) => days.includes(d));

/**
 * Claude's answer, checked. Every value is read on its own: a number outside the builder's limits is clamped to them, a
 * value that is not what its field holds (a weekday that is no weekday, a date that is no date, a date that has passed)
 * is left out, and each of those is listed in `dropped` with its reason. A field Claude left null is absent from the
 * patch. Returns null when the answer is not an object at all.
 */
export const cleanPlanPatch = (raw: unknown, today: ISODate): Omit<PlanAssistResult, 'kind'> | null => {
  if (!isObject(raw)) return null;
  const patch: PlanPatch = {};
  const dropped: PlanPatchNote[] = [];
  const drop = (reason: PlanPatchReason, value?: number) => {
    if (!dropped.some((d) => d.reason === reason)) dropped.push(value === undefined ? { reason } : { reason, value });
  };
  const given = (k: string) => raw[k] !== null && raw[k] !== undefined;

  if (given('goal')) {
    const g = zGoal.safeParse(typeof raw.goal === 'string' ? raw.goal.trim().toLowerCase() : raw.goal);
    if (g.success) patch.goal = g.data;
    else drop('bad_value');
  }

  /** A whole number held to [lo, hi]; outside it, the nearest end and a reason. */
  const bounded = (k: string, lo: number, hi: number, low: PlanPatchReason, high: PlanPatchReason): number | undefined => {
    if (!given(k)) return undefined;
    const n = numberOf(raw[k]);
    if (n === null) return void drop('bad_value');
    const v = Math.round(n);
    if (v < lo) return drop(low, lo), lo;
    if (v > hi) return drop(high, hi), hi;
    return v;
  };
  /** A whole, non-zero change; its size is only held to what the field could ever move. */
  const change = (k: string, most: number): number | undefined => {
    if (!given(k)) return undefined;
    const n = numberOf(raw[k]);
    if (n === null) return void drop('bad_value');
    const v = Math.max(-most, Math.min(most, Math.round(n)));
    return v === 0 ? undefined : v;
  };
  const L = BUILDER_LIMITS;
  const weeks = bounded('weeks', L.weeksMin, L.weeksMax, 'weeks_min', 'weeks_max');
  if (weeks !== undefined) patch.weeks = weeks;
  else {
    const d = change('weeksChange', L.weeksMax - L.weeksMin);
    if (d !== undefined) patch.weeksChange = d;
  }
  const runs = bounded('runsPerWeek', 1, 7, 'runs_min', 'runs_max');
  if (runs !== undefined) patch.runsPerWeek = runs;
  else {
    const d = change('runsPerWeekChange', 6);
    if (d !== undefined) patch.runsPerWeekChange = d;
  }
  const miles = bounded('weeklyMiles', L.milesMin, L.milesMax, 'miles_min', 'miles_max');
  if (miles !== undefined) patch.weeklyMiles = miles;
  else {
    const d = change('weeklyMilesChange', L.milesMax - L.milesMin);
    if (d !== undefined) patch.weeklyMilesChange = d;
  }
  if (given('peakMiles')) {
    const n = numberOf(raw.peakMiles);
    if (n === null) drop('bad_value');
    // zero hands the peak back to the plan
    else if (Math.round(n) <= 0) patch.peakMiles = null;
    else if (Math.round(n) > L.milesMax) (drop('peak_max', L.milesMax), (patch.peakMiles = L.milesMax));
    else patch.peakMiles = Math.max(L.milesMin, Math.round(n));
  }

  const days = (k: string): Weekday[] | undefined => {
    if (!given(k)) return undefined;
    if (!Array.isArray(raw[k])) return void drop('bad_value');
    const list = (raw[k] as unknown[]).map(dayOf);
    if (list.some((d) => d === null)) drop('bad_value');
    const ok = sortDays(list.filter((d): d is Weekday => d !== null));
    return ok.length ? ok : undefined;
  };
  const all = days('runDays');
  if (all) patch.runDays = all;
  const add = days('addRunDays');
  if (add) patch.addRunDays = add;
  const remove = days('removeRunDays');
  if (remove) patch.removeRunDays = remove;
  if (given('longRunDay')) {
    const d = dayOf(raw.longRunDay);
    if (d) patch.longRunDay = d;
    else drop('bad_value');
  }

  const far = shiftDays(today, FAR_DAYS);
  const date = (k: string, past: PlanPatchReason, tooFar: PlanPatchReason): ISODate | undefined => {
    if (!given(k)) return undefined;
    const v = typeof raw[k] === 'string' ? (raw[k] as string).trim().slice(0, 10) : '';
    if (!isISODate(v)) return void drop('bad_value');
    if (v <= today) return void drop(past);
    if (v > far) return void drop(tooFar);
    return v;
  };
  const raceDate = date('raceDate', 'race_past', 'race_too_far');
  if (raceDate) patch.raceDate = raceDate;
  if (given('race')) {
    if (typeof raw.race === 'boolean') patch.race = raw.race;
    else drop('bad_value');
  }
  const startDate = date('startDate', 'start_past', 'start_too_far');
  if (startDate) patch.startDate = startDate;
  else if (given('start')) {
    if (raw.start === 'tomorrow' || raw.start === 'monday') patch.start = raw.start;
    else drop('bad_value');
  }

  const cannot: PlanCannot[] = [];
  if (Array.isArray(raw.cannot))
    for (const c of raw.cannot) {
      const topic = (PLAN_ASSIST_CANNOT as readonly string[]).includes(String(c)) ? (String(c) as PlanCannot) : 'other';
      if (!cannot.includes(topic)) cannot.push(topic);
    }
  // one plain line: no line breaks, no dashes standing in for commas
  const said = typeof raw.note === 'string' ? raw.note.replace(/\s*[—–]\s*/g, ', ').replace(/\s+/g, ' ').trim() : '';
  return { patch, dropped, cannot, note: said ? said.slice(0, NOTE_MAX) : null };
};

/** True when a patch asks for nothing. */
export const isEmptyPatch = (p: PlanPatch): boolean => Object.values(p).every((v) => v === undefined);

// ---------- applying a patch to the answers ----------

/**
 * The longest run of days in a row with a run, and without one, around the week (Sunday is next to Monday). Both read
 * from a set of Monday-based day numbers.
 */
const streaks = (set: ReadonlySet<number>): { run: number; rest: number } => {
  if (set.size >= 7) return { run: 7, rest: 0 };
  if (set.size === 0) return { run: 0, rest: 7 };
  // begin on the first day of a run of run days (a rest day followed by a run day), so no streak is cut in two
  const start = [0, 1, 2, 3, 4, 5, 6].find((i) => !set.has(i) && set.has((i + 1) % 7))!;
  let run = 0;
  let rest = 0;
  let curRun = 0;
  let curRest = 0;
  for (let k = 1; k <= 7; k++) {
    const i = (start + k) % 7;
    if (set.has(i)) {
      curRun++;
      curRest = 0;
      run = Math.max(run, curRun);
    } else {
      curRest++;
      curRun = 0;
      rest = Math.max(rest, curRest);
    }
  }
  return { run, rest };
};

/**
 * The run days for `count` runs a week, from the days there are now. More: every current day stays and days are added.
 * Fewer: days are taken away, never the long-run day. Of the sets that fit, it picks the one with the fewest runs on
 * days in a row, then the shortest gap without a run, then a rest day after the long run, then the earliest days: so
 * Tue, Thu, Sat, Sun grows to Tue, Wed, Thu, Sat, Sun and shrinks to Tue, Thu, Sun.
 */
export const resizeRunDays = (days: readonly Weekday[], long: Weekday, count: number): Weekday[] => {
  const cur = new Set(days.map(weekdayIndex));
  const longIdx = weekdayIndex(long);
  cur.add(longIdx);
  const n = Math.max(1, Math.min(7, Math.round(count)));
  if (n === cur.size) return sortDays(days.includes(long) ? days : [...days, long]);
  const grow = n > cur.size;
  let best: number[] | null = null;
  let bestScore: number[] = [];
  for (let mask = 1; mask < 128; mask++) {
    const set: number[] = [];
    for (let i = 0; i < 7; i++) if (mask & (1 << i)) set.push(i);
    if (set.length !== n || !set.includes(longIdx)) continue;
    if (grow ? ![...cur].every((i) => set.includes(i)) : !set.every((i) => cur.has(i))) continue;
    const s = streaks(new Set(set));
    const score = [s.run, s.rest, set.includes((longIdx + 1) % 7) ? 1 : 0, ...set];
    if (!best || lexLess(score, bestScore)) {
      best = set;
      bestScore = score;
    }
  }
  return (best ?? [...cur].sort((a, b) => a - b)).map((i) => WEEKDAYS[i]!);
};
const lexLess = (a: number[], b: number[]): boolean => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? -1;
    const y = b[i] ?? -1;
    if (x !== y) return x < y;
  }
  return false;
};

/** One thing a patch changed, in the order the builder shows its controls. */
export type PlanChange =
  | { field: 'goal'; goal: Goal }
  /** `named`: the person said which days (so the line lists them); else they gave a count. */
  | { field: 'runDays'; days: Weekday[]; named: boolean }
  | { field: 'longRunDay'; day: Weekday }
  | { field: 'weeks'; weeks: number }
  | { field: 'raceDate'; date: ISODate }
  | { field: 'race'; on: boolean }
  | { field: 'weeklyMiles'; miles: number }
  | { field: 'peakMiles'; miles: number | null }
  | { field: 'start'; date: ISODate; soon: boolean };

export interface AppliedPatch {
  next: BuilderAnswers;
  changes: PlanChange[];
  /** What could not be done as asked, each with why. */
  notes: PlanPatchNote[];
}

/**
 * A patch applied to the builder's answers. Nothing the patch does not name changes, except what a named change brings
 * with it: a new goal takes that goal's usual length (as picking it by hand does), a race day sets the weeks, the long-run
 * day joins the run days, a long-run day that is no longer a run day moves to the last run day, and a peak never sits
 * under the weekly miles. Order: goal, start, weeks, race, run days, weekly miles, peak.
 *
 * A race day with a length ("12 weeks, race on March 14") keeps both when it can: the plan starts later, on the Monday
 * that puts race day in its last week. When that Monday has passed, the weeks that fit are used and a note says so.
 */
export const applyPlanPatch = (a: BuilderAnswers, patch: PlanPatch, today: ISODate): AppliedPatch => {
  const L = BUILDER_LIMITS;
  const next: BuilderAnswers = { ...a, runDays: [...a.runDays] };
  const notes: PlanPatchNote[] = [];
  const note = (reason: PlanPatchReason, value?: number) => {
    if (!notes.some((n) => n.reason === reason)) notes.push(value === undefined ? { reason } : { reason, value });
  };

  if (patch.goal && patch.goal !== a.goal) {
    next.goal = patch.goal;
    next.weeks = GOAL_SPECS[patch.goal].defaultWeeks;
  }

  if (patch.startDate) {
    if (patch.startDate <= today) note('start_past');
    else {
      next.startDate = patch.startDate;
      next.soon = false;
    }
  } else if (patch.start) {
    next.soon = patch.start === 'tomorrow';
    next.startDate = null;
  }

  const holdWeeks = (w: number) => {
    if (w < L.weeksMin) return note('weeks_min', L.weeksMin), L.weeksMin;
    if (w > L.weeksMax) return note('weeks_max', L.weeksMax), L.weeksMax;
    return w;
  };
  const askedWeeks = patch.weeks !== undefined;
  if (patch.weeks !== undefined) next.weeks = holdWeeks(patch.weeks);
  else if (patch.weeksChange) next.weeks = holdWeeks(next.weeks + patch.weeksChange);

  let racePatched = false;
  if (patch.raceDate) {
    if (next.goal === 'base') note('race_needs_distance');
    else {
      const raceMon = mondayOf(patch.raceDate);
      let { firstMon } = builderDates(next, today);
      let startDate = next.startDate;
      let soon = next.soon;
      let weeks = daysBetween(firstMon, raceMon) / 7 + 1;
      if (askedWeeks && weeks > next.weeks) {
        // both a length and a race day: the plan starts later, so its last week holds the race
        startDate = shiftDays(raceMon, -(next.weeks - 1) * 7);
        soon = false;
        firstMon = startDate;
        weeks = next.weeks;
      } else if (askedWeeks && weeks < next.weeks && weeks >= L.weeksMin) note('race_weeks_fit', weeks);
      if (weeks < L.weeksMin) note('race_too_soon');
      else if (weeks > L.weeksMax) note('race_too_far');
      else {
        next.weeks = weeks;
        next.startDate = startDate;
        next.soon = soon;
        next.race = patch.race ?? true;
        next.raceDay = weekdayOf(patch.raceDate);
        racePatched = true;
      }
    }
  } else if (patch.race !== undefined) {
    if (patch.race && next.goal === 'base') note('race_needs_distance');
    else next.race = patch.race;
  }

  let days = sortDays(next.runDays);
  let named = false;
  if (patch.runDays?.length) {
    days = sortDays(patch.runDays);
    named = true;
  }
  if (patch.addRunDays?.length) {
    days = sortDays([...days, ...patch.addRunDays]);
    named = true;
  }
  if (patch.removeRunDays?.length) {
    const left = days.filter((d) => !patch.removeRunDays!.includes(d));
    if (!left.length) note('keep_one_day');
    else {
      days = left;
      named = true;
    }
  }
  let long = next.longRunDay;
  if (patch.longRunDay) {
    long = patch.longRunDay;
    if (!days.includes(long)) days = sortDays([...days, long]);
  } else if (!days.includes(long)) long = days[days.length - 1]!;
  if (patch.runsPerWeek !== undefined || patch.runsPerWeekChange) {
    const want = patch.runsPerWeek ?? days.length + (patch.runsPerWeekChange ?? 0);
    const n = want < 1 ? (note('runs_min', 1), 1) : want > 7 ? (note('runs_max', 7), 7) : want;
    days = resizeRunDays(days, long, n);
  }
  next.runDays = days;
  next.longRunDay = long;

  const holdMiles = (m: number) => {
    if (m < L.milesMin) return note('miles_min', L.milesMin), L.milesMin;
    if (m > L.milesMax) return note('miles_max', L.milesMax), L.milesMax;
    return m;
  };
  if (patch.weeklyMiles !== undefined) next.weeklyMiles = holdMiles(Math.round(patch.weeklyMiles));
  else if (patch.weeklyMilesChange) next.weeklyMiles = holdMiles(Math.round(next.weeklyMiles + patch.weeklyMilesChange));

  if (patch.peakMiles === null) next.peakMiles = null;
  else if (patch.peakMiles !== undefined) {
    let p = Math.min(L.milesMax, Math.round(patch.peakMiles));
    if (p < next.weeklyMiles) {
      note('peak_below_now', next.weeklyMiles);
      p = next.weeklyMiles;
    }
    next.peakMiles = p;
  }
  // a peak already set never sits under the miles run now
  if (next.peakMiles != null && next.peakMiles < next.weeklyMiles) next.peakMiles = next.weeklyMiles;

  const before = builderDates(a, today);
  const after = builderDates(next, today);
  const changes: PlanChange[] = [];
  if (next.goal !== a.goal) changes.push({ field: 'goal', goal: next.goal });
  if (next.runDays.join() !== sortDays(a.runDays).join()) changes.push({ field: 'runDays', days: next.runDays, named: named || next.runDays.length === a.runDays.length });
  if (next.longRunDay !== a.longRunDay) changes.push({ field: 'longRunDay', day: next.longRunDay });
  // with a race day asked for, the weeks follow from it: the line names the day, not the count
  const raceShown = racePatched && !!after.raceDate;
  if (next.weeks !== a.weeks && !raceShown) changes.push({ field: 'weeks', weeks: next.weeks });
  if (raceShown && after.raceDate !== before.raceDate) changes.push({ field: 'raceDate', date: after.raceDate! });
  else if (next.race !== a.race && next.goal !== 'base') changes.push({ field: 'race', on: next.race });
  if (next.weeklyMiles !== a.weeklyMiles) changes.push({ field: 'weeklyMiles', miles: next.weeklyMiles });
  if (next.peakMiles !== a.peakMiles) changes.push({ field: 'peakMiles', miles: next.peakMiles });
  if (after.startDate !== before.startDate) changes.push({ field: 'start', date: after.startDate, soon: next.soon && !next.startDate });
  return { next, changes, notes };
};
