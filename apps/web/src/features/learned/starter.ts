import type { SessionKind } from '@logbook/shared';

/** What today already holds, as far as the field's first words need it. */
export interface DayFacts {
  /** Is Fitness on (lib/prefs.ts)? Off: `session` is never read, so the starter never speaks of training. */
  fitness: boolean;
  /** Today's session, once it is done. */
  session?: { kind: SessionKind; type?: string | null; title?: string | null } | null;
  /** A habit done today (its name is not used in the words: a name is the person's own and may not fit a sentence). */
  habit?: string | null;
  /** Today's goal, when one is set. */
  goal?: string | null;
}

export interface Starter {
  /** The field's first words: "On the bike today I learned". */
  text: string;
  /** Where they came from, for the caption beside the button: "From today's bike". Null for the plain start. */
  note: string | null;
}

/** The plain start: nothing in the day to begin from, or Fitness is off and only training happened. */
export const PLAIN_STARTER: Starter = { text: 'Today I learned', note: null };

const RUN: Starter = { text: 'On my run today I learned', note: 'From today’s run' };
const LIFT: Starter = { text: 'Lifting today I learned', note: 'From today’s lift' };
const BIKE: Starter = { text: 'On the bike today I learned', note: 'From today’s bike' };
const SWIM: Starter = { text: 'In the pool today I learned', note: 'From today’s swim' };
const WORKOUT: Starter = { text: 'In today’s workout I learned', note: 'From today’s workout' };
const HABITS: Starter = { text: 'Keeping my habits today I learned', note: 'From today’s habits' };
const GOAL: Starter = { text: 'Working on today’s goal I learned', note: 'From today’s goal' };

/** Every first-words the field can show. None of them alone is a line (`isStarterOnly`). */
export const ALL_STARTERS: readonly string[] = [PLAIN_STARTER, RUN, LIFT, BIKE, SWIM, WORKOUT, HABITS, GOAL].map((s) => s.text);

const fromSession = (s: NonNullable<DayFacts['session']>): Starter | null => {
  const words = `${s.type ?? ''} ${s.title ?? ''}`;
  if (s.kind === 'run') return RUN;
  if (s.kind === 'lift') return LIFT;
  if (s.kind !== 'cross') return null;
  if (/\b(bike|biking|ride|cycl\w*|spin)\b/i.test(words)) return BIKE;
  if (/\bswim\w*\b/i.test(words)) return SWIM;
  return WORKOUT;
};

/**
 * The words the Learned field starts with, from the person's own day. In order: today's done session (only when Fitness
 * is on), a habit done today, today's goal, else the plain "Today I learned". Pure: the view gathers the facts.
 */
export const lineStarter = (day: DayFacts): Starter => {
  const session = day.fitness && day.session ? fromSession(day.session) : null;
  if (session) return session;
  if (typeof day.habit === 'string' && day.habit.trim()) return HABITS;
  if (typeof day.goal === 'string' && day.goal.trim()) return GOAL;
  return PLAIN_STARTER;
};

/**
 * True when the words are nothing of the person's own: empty, or one of the starters and no more. Any starter, not only
 * the one showing: the day can change what the field starts with (a habit checked off, midnight) after it was touched.
 */
export const isStarterOnly = (text: string): boolean => {
  const v = text.trim();
  return v.length === 0 || ALL_STARTERS.includes(v);
};

/** True when the field holds words of the person's own: something, and more than a starter alone. */
export const hasOwnWords = (text: string, starter: Starter): boolean => !isStarterOnly(text) && text.trim() !== starter.text;
