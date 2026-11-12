import { GOAL_STEPS_MAX, type Aim, type GoalStep } from '@logbook/shared';

/**
 * The suggested goal: one idea for today's goal, taken from the person's own day. Pure, so Today's Plan your day and the
 * Goals poster ask the same question and get the same answer.
 *
 * The order, first match wins:
 *  1. yesterday's goal when it was not finished (still open, partly or missed): "An idea · from yesterday"
 *  2. the top open to-do: "from your to-dos"
 *  3. today's session, only while Fitness is on and it is not logged yet: "from Fitness"
 *  4. the habits: "from your habits", "All 7 habits, done by 9"
 * With none of these there is no idea, and the screen asks for the person's own words.
 */
export type IdeaSource = 'yesterday' | 'todos' | 'fitness' | 'habits';

export interface GoalIdea {
  source: IdeaSource;
  /** The goal as it would be set: "Bike 40 min, before lunch". */
  text: string;
  /** The band's caption: "An idea · from Fitness". */
  label: string;
  /** Yesterday's goal, when the idea is to carry it over: its why and its steps come with it. */
  from?: Aim;
}

export interface IdeaInput {
  /** Yesterday's day goal, if there was one. */
  yesterday?: Pick<Aim, 'text' | 'status'> | Aim | null;
  /** Today's open to-dos, in the order they matter. */
  todos?: readonly { text: string }[];
  /** Is Fitness on (lib/prefs.ts)? Off: the idea never comes from training. */
  fitness?: boolean;
  /** Today's session in a few words ("Bike 40 min", "Easy 3"), or null when there is none, it is rest, or it is logged. */
  session?: string | null;
  /** How many habits the person keeps. */
  habits?: number;
  /** Minutes after midnight, for the words that say when. */
  minutes?: number;
}

const FROM: Record<IdeaSource, string> = { yesterday: 'from yesterday', todos: 'from your to-dos', fitness: 'from Fitness', habits: 'from your habits' };
export const ideaLabel = (source: IdeaSource) => `An idea · ${FROM[source]}`;

/** When a session still fits in the day: "before lunch", "this afternoon", "this evening". */
export const sessionWhen = (minutes: number) => (minutes < 11 * 60 + 30 ? 'before lunch' : minutes < 17 * 60 ? 'this afternoon' : 'this evening');

/** The habits as a goal: "All 7 habits, done by 9" (the evening's nine; later than eight it reads "before bed"). */
export const habitsIdea = (n: number, minutes: number) => {
  const when = minutes < 20 * 60 ? 'done by 9' : 'done before bed';
  return n === 1 ? `Your one habit, ${when}` : n === 2 ? `Both habits, ${when}` : `All ${n} habits, ${when}`;
};

export const goalIdea = ({ yesterday, todos, fitness = true, session, habits = 0, minutes = 9 * 60 }: IdeaInput): GoalIdea | null => {
  const idea = (source: IdeaSource, text: string, from?: Aim): GoalIdea => ({ source, text, label: ideaLabel(source), ...(from ? { from } : {}) });
  // words that are missing or not words (a row in an old shape) are no idea, never a crash
  const words = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  if (yesterday && yesterday.status !== 'done' && words(yesterday.text)) return idea('yesterday', words(yesterday.text), 'id' in yesterday ? yesterday : undefined);
  const top = todos?.find((t) => words(t?.text));
  if (top) return idea('todos', words(top.text));
  if (fitness && session?.trim()) return idea('fitness', `${session.trim()}, ${sessionWhen(minutes)}`);
  if (habits > 0) return idea('habits', habitsIdea(habits, minutes));
  return null;
};

/** What the server takes for a goal (packages/shared schemas: zGoalPut, zGoalStep). */
const TEXT_MAX = 400;
const WHY_MAX = 300;
const STEP_MAX = 120;

/**
 * The idea as the goal that is saved when "Set this goal" is tapped: its words, and for yesterday's goal its why and its
 * steps. Everything is cut to what the server takes (400 for the words, 300 for the why, five steps of 120), so a goal
 * carried over from an older build or another device is never refused whole for one long line.
 */
export const ideaGoal = (it: GoalIdea): { text: string; why: string | null; steps: GoalStep[] } => {
  const steps = (Array.isArray(it.from?.steps) ? it.from.steps : [])
    .filter((s) => s && typeof s.id === 'string' && typeof s.text === 'string' && s.text.trim())
    .slice(0, GOAL_STEPS_MAX)
    .map((s) => ({ id: s.id.slice(0, 40), text: s.text.trim().slice(0, STEP_MAX), done: !!s.done }));
  const why = typeof it.from?.why === 'string' ? it.from.why.trim().slice(0, WHY_MAX) : '';
  return { text: it.text.trim().slice(0, TEXT_MAX), why: why || null, steps };
};
