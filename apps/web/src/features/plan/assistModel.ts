import { fmtDate, GOAL_SPECS, type AppliedPatch, type PlanAssistResult, type PlanCannot, type PlanChange, type PlanPatchNote, type PlanPatchReason, type Weekday } from '@logbook/shared';
import { ApiError, NetworkError } from '@/api/client';

/*
 * The plan builder's assistant, in words (Builder.tsx, BuilderAssist.tsx): what one line says after an update, and what it
 * says when a request did not go through. Kept apart from the screen so the tests can read every sentence.
 *
 * The line about what changed is written from the difference between the answers before and after (`applyPlanPatch`'s
 * `changes`), never from the model's own words, so it cannot claim a change that did not happen.
 */

const DAY_NAME: Record<Weekday, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
const short = (d: Weekday) => DAY_NAME[d].slice(0, 3);
/** A short date that never breaks between the month and the day (`Mar 14`). */
const md = (d: string) => fmtDate('md', d).replace(' ', ' ');

/** One change as it reads in the line: `4 run days`, `long run Sunday`, `race day Mar 14`. */
export const changeWords = (c: PlanChange): string => {
  switch (c.field) {
    case 'goal':
      return c.goal === 'base' ? 'goal just running' : `goal ${GOAL_SPECS[c.goal].name.toLowerCase().replace(/^(\d+)k$/, '$1K')}`;
    case 'runDays':
      if (c.days.length === 7) return 'a run every day';
      return c.named ? `runs on ${c.days.map(short).join(', ')}` : `${c.days.length} run ${c.days.length === 1 ? 'day' : 'days'}`;
    case 'longRunDay':
      return `long run ${DAY_NAME[c.day]}`;
    case 'weeks':
      return `${c.weeks} weeks`;
    case 'raceDate':
      return `race day ${md(c.date)}`;
    case 'race':
      return c.on ? 'a race day' : 'no race day';
    case 'weeklyMiles':
      return `${c.miles} mi a week now`;
    case 'peakMiles':
      return c.miles == null ? 'the plan’s own peak' : `peak up to ${c.miles} mi`;
    case 'start':
      return c.soon ? 'start tomorrow' : `start ${md(c.date)}`;
  }
};

/** What changed, as one sentence: `Set 4 run days, long run Sunday, peak up to 35 mi.` Null when nothing did. */
export const setLine = (changes: PlanChange[]): string | null => (changes.length ? `Set ${changes.map(changeWords).join(', ')}.` : null);

const REASON: Record<PlanPatchReason, (value?: number) => string> = {
  weeks_min: () => 'A plan runs 2 weeks at least.',
  weeks_max: () => 'A plan runs 30 weeks at most.',
  miles_min: () => 'Weekly miles start at 3.',
  miles_max: () => 'Weekly miles stop at 150.',
  peak_max: () => 'The peak stops at 150 mi.',
  peak_below_now: () => 'The peak can’t be under what you run now.',
  runs_min: () => 'A week holds 1 to 7 run days.',
  runs_max: () => 'A week holds 1 to 7 run days.',
  keep_one_day: () => 'A plan needs at least one run day.',
  race_past: () => 'That race day has passed.',
  race_too_soon: () => 'That race is too soon for a plan.',
  race_too_far: () => 'That race is more than 30 weeks out. Build a base plan first.',
  race_needs_distance: () => 'Pick a race distance to set a race day.',
  race_weeks_fit: (n) => (n ? `Only ${n} weeks fit before race day.` : 'Fewer weeks fit before race day.'),
  start_past: () => 'The start has to be after today.',
  start_too_far: () => 'The start can be a year out at most.',
  bad_value: () => 'One part didn’t make sense, so it was left alone.',
};
/** Why a value was changed on its way in or left out, as a sentence. */
export const reasonWords = (n: PlanPatchNote): string => REASON[n.reason](n.value);

/** What the builder has no setting for, as sentences: lifts and cross training share one. */
export const cannotWords = (topics: readonly PlanCannot[]): string[] => {
  const out: string[] = [];
  if (topics.includes('lifts')) out.push('This plan holds runs only. Add lifts on the Fitness tab.');
  else if (topics.includes('cross')) out.push('This plan holds runs only.');
  if (topics.includes('paces')) out.push('Paces aren’t set here.');
  if (topics.includes('workouts')) out.push('The plan picks each week’s workouts.');
  if (topics.includes('other')) out.push('Some of that has no setting here.');
  return out;
};

/** When a request asked for nothing that is not already so. */
export const ALREADY_SET = 'That is how it is set already.';
/** The most sentences after the line: more than this is a paragraph, not a line. */
const NOTES_MAX = 3;

export interface AssistSaid {
  /** What changed (`Set ...`), or null when nothing did. */
  set: string | null;
  /** What could not be done, and anything the assistant had to say. Shown after `set`. */
  notes: string[];
}

/**
 * What the builder says after an update: the changes, then (at most three) the assistant's own sentence when it sent
 * one, what the builder has no setting for, and why a value was clamped or left out. With nothing changed and nothing
 * to say, it says the plan is already set that way.
 */
export const assistSaid = (applied: Pick<AppliedPatch, 'changes' | 'notes'>, result: Pick<PlanAssistResult, 'dropped' | 'cannot' | 'note'>): AssistSaid => {
  const set = setLine(applied.changes);
  const reasons: PlanPatchNote[] = [];
  for (const n of [...result.dropped, ...applied.notes]) if (!reasons.some((r) => r.reason === n.reason)) reasons.push(n);
  const notes = [...(result.note ? [result.note] : []), ...cannotWords(result.cannot), ...reasons.map(reasonWords)].filter((s, i, all) => all.indexOf(s) === i).slice(0, NOTES_MAX);
  if (!set && !notes.length) return { set: null, notes: [ALREADY_SET] };
  return { set, notes };
};

/** A control of the builder a change lands on (it shows a short halo). */
export type FlashKey = 'goal' | 'days' | 'weeks' | 'miles' | 'peak' | 'start' | 'race';
const FLASH: Record<PlanChange['field'], FlashKey> = { goal: 'goal', runDays: 'days', longRunDay: 'days', weeks: 'weeks', raceDate: 'race', race: 'race', weeklyMiles: 'miles', peakMiles: 'peak', start: 'start' };
/** The controls that changed, top to bottom, each once. A race day also moves the weeks. */
export const flashKeys = (changes: PlanChange[]): FlashKey[] => {
  const order: FlashKey[] = ['goal', 'days', 'weeks', 'miles', 'peak', 'start', 'race'];
  const hit = new Set<FlashKey>(changes.map((c) => FLASH[c.field]));
  if (changes.some((c) => c.field === 'raceDate')) hit.add('weeks');
  return order.filter((k) => hit.has(k));
};

// ---------- a request that did not go through ----------

export type AssistFailure =
  /** The account has not answered the permission step: show it, send nothing. */
  | { kind: 'consent' }
  /** The person tapped Stop (or left): no line. */
  | { kind: 'stopped' }
  /** One plain line, with Try again where sending the same words again can work. */
  | { kind: 'line'; line: string; retry: boolean };

/** Each line stands beside its Try again where it has one, so it says what happened and leaves the verb to the button. */
export const ASSIST_LINES = {
  offline: 'Couldn’t reach Orby. Check your connection.',
  slow: 'That took too long.',
  missing: 'The assistant can’t shape plans yet. Orby’s server needs an update.',
  unavailable: 'The assistant is not available right now. Try again later.',
  busy: 'The assistant is busy. Try again in a minute.',
  limit: 'You’ve asked a lot in a short time. Try again in a few minutes.',
  dayLimit: 'You’ve used today’s plan requests. They come back tomorrow.',
  finishing: 'The last request is still finishing. Try again in a moment.',
  refused: 'The assistant couldn’t help with that one. Say it another way.',
  tooLong: 'That was too long to send. Say it in fewer words.',
  invalid: 'The assistant’s answer didn’t come back right.',
  signIn: 'Sign in to continue, then try again.',
  ours: 'Something went wrong on our side.',
} as const;

const line = (text: string, retry = true): AssistFailure => ({ kind: 'line', line: text, retry });
/**
 * A 429 says how long to wait (Retry-After), and that tells the three limits apart: a few seconds is a request of this
 * account that is still running (one stopped a moment ago), minutes is the short window, hours is the day's budget, which
 * trying again cannot fix.
 */
const STILL_RUNNING_S = 10;
const DAY_LIMIT_AFTER_S = 15 * 60;

/**
 * Why a request to the builder's assistant did not go through, by status and code, never the server's own message. A
 * server that does not have the route yet (404, 405, 501: the app can be newer than the server) gets its own line.
 */
export const assistFailure = (e: unknown): AssistFailure => {
  if (e instanceof NetworkError) return line(ASSIST_LINES.offline);
  const status = e instanceof ApiError ? e.status : 0;
  const code = e instanceof ApiError ? e.code : null;
  if (code === 'cancelled') return { kind: 'stopped' };
  if (code === 'consent_required') return { kind: 'consent' };
  if (code === 'timeout' || code === 'claude_timeout' || status === 504) return line(ASSIST_LINES.slow);
  if (status === 404 || status === 405 || status === 501) return line(ASSIST_LINES.missing);
  if (status === 401 || code === 'unauthenticated') return line(ASSIST_LINES.signIn, false);
  if (code === 'claude_not_configured') return line(ASSIST_LINES.unavailable);
  if (code === 'claude_busy' || status === 503) return line(ASSIST_LINES.busy);
  if (status === 429 || code === 'rate_limited') {
    const wait = e instanceof ApiError ? e.retryAfter : null;
    if (wait != null && wait > DAY_LIMIT_AFTER_S) return line(ASSIST_LINES.dayLimit, false);
    return line(wait != null && wait <= STILL_RUNNING_S ? ASSIST_LINES.finishing : ASSIST_LINES.limit);
  }
  if (code === 'refused') return line(ASSIST_LINES.refused, false);
  if (status === 413 || status === 422 || status === 400 || code === 'validation') return line(ASSIST_LINES.tooLong, false);
  if (code === 'invalid_answer' || status === 502) return line(ASSIST_LINES.invalid);
  return line(ASSIST_LINES.ours);
};
