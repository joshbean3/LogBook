import { buildTemplate, builderInput, GOAL_SPECS, mondayOf, shiftDays, TemplateError, weekdayOf, weekSummary, WEEKDAYS, type AnswersFromRuns, type BuilderAnswers, type Goal, type Template, type TemplateInput, type Weekday } from '@logbook/shared';
import type { Log } from '../log/useLog';
import type { BuilderPrefill } from './builderModel';

/*
 * Where the builder's first answers come from (Builder.tsx opens on them): the prefill (the next plan, from the ending
 * one), else the account's training answers, else what the last four weeks say. It also says which answers tracked runs
 * had a part in, because those are never sent to the assistant. No screen code here, so the tests can read it.
 */

/**
 * What the last four weeks say: the days you run and your weekly miles. `fromRuns` marks each one that tracked runs
 * (activities: Strava, or an import) had a part in. Such an answer is never sent to the assistant until the person has
 * set it themselves: nothing from Strava goes to Claude, a number worked out from it included. Miles that come only from
 * runs the person marked done are their own, and a stand-in for an empty calendar is nobody's.
 */
export const habitsOf = (log: Log) => {
  const t = log.today;
  const mon = mondayOf(t);
  const seen = new Map<Weekday, number>();
  let miles = 0;
  for (let w = 1; w <= 4; w++) {
    const m = shiftDays(mon, -7 * w);
    miles += weekSummary(log.snap, m).doneMiles;
    for (let i = 0; i < 7; i++) {
      const d = shiftDays(m, i);
      if (log.snap.runsOn(d).length) seen.set(weekdayOf(d), (seen.get(weekdayOf(d)) ?? 0) + 1);
    }
  }
  const days = WEEKDAYS.filter((d) => (seen.get(d) ?? 0) >= 2);
  const runDays = days.length >= 2 ? days : (['tue', 'thu', 'sat', 'sun'] as Weekday[]);
  const avg = Math.round(miles / 4);
  return { runDays, weeklyMiles: Math.min(150, Math.max(10, avg || 15)), fromRuns: { runDays: days.length >= 2, weeklyMiles: avg > 0 && seen.size > 0 } };
};

/**
 * The starting point: the prefill (the next block, from the ending one), else the account's training answers (onboarding,
 * Settings › Training), else what the last four weeks say.
 */
export const startOf = (log: Log, prefill?: BuilderPrefill) => {
  const h = habitsOf(log);
  const prof = log.boot?.user.trainingProfile ?? null;
  const pick = prefill?.runDays?.length ? WEEKDAYS.filter((_, i) => prefill.runDays!.includes(i)) : prof?.runDays?.length ? WEEKDAYS.filter((d) => prof.runDays.includes(d)) : null;
  const runDays = pick?.length ? pick : h.runDays;
  const long = prefill?.longRunDay !== undefined ? WEEKDAYS[prefill.longRunDay] : prof?.longRunDay;
  const miles = prefill?.weeklyMiles ?? prof?.weeklyMiles;
  const goal = prefill?.goal ?? prof?.goal;
  return {
    runDays,
    longDay: long && runDays.includes(long) ? long : runDays.includes('sun') ? 'sun' : runDays[runDays.length - 1]!,
    weeklyMiles: miles ? Math.min(150, Math.max(3, Math.round(miles))) : h.weeklyMiles,
    goal: (goal && goal in GOAL_SPECS ? goal : 'base') as Goal,
    // only what the calendar's runs supplied: a prefill or the training answers are the person's own
    fromRuns: { runDays: !pick?.length && h.fromRuns.runDays, weeklyMiles: !miles && h.fromRuns.weeklyMiles } as AnswersFromRuns,
  };
};

/** The plan the answers build (`builderInput` is the same rule for the first render, every change and the write). */
export const build = (input: TemplateInput): { tpl: Template | null; error: string | null } => {
  try {
    return { tpl: buildTemplate(input), error: null };
  } catch (e) {
    return { tpl: null, error: e instanceof TemplateError ? e.message : 'That plan doesn’t work. Change the weeks or the days.' };
  }
};
/** The controls' first values: the prefill, the training answers, the last four weeks (startOf); built once per open. */
export const seedOf = (log: Log, prefill?: BuilderPrefill) => {
  const start0 = startOf(log, prefill);
  const t = log.today;
  // a prefilled start (the day after the ending plan) holds until "Start tomorrow" is toggled; never today or earlier
  const a: BuilderAnswers = { goal: start0.goal, weeks: GOAL_SPECS[start0.goal].defaultWeeks, runDays: start0.runDays, longRunDay: start0.longDay, weeklyMiles: start0.weeklyMiles, peakMiles: null, soon: false, startDate: prefill?.startDate && prefill.startDate > t ? prefill.startDate : null, race: true, raceDay: 'sun' };
  return { a, fromRuns: start0.fromRuns, built: build(builderInput(a, t)) };
};
export type Seed = ReturnType<typeof seedOf>;
