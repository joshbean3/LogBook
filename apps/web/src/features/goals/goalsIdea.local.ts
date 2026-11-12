import { shiftDays, type Aim, type ISODate, type Session } from '@logbook/shared';
import { goalOf } from './model';

/*
 * A stand-in, local to the Goals page, for the shared suggested-goal function (features/goals/goalIdea.ts, written with
 * Today's Plan your day). Same order, same shape of answer. At merge the page (GoalsHero.tsx) points at the shared one
 * and this file and its test go.
 */

/** Where an idea came from, as the band's caption says it: "An idea · from yesterday". */
export type IdeaSource = 'yesterday' | 'todo' | 'fitness' | 'habits';
export interface GoalIdea {
  text: string;
  source: IdeaSource;
  /** The band's caption. */
  caption: string;
  /** Yesterday's goal, when the idea is to carry it over: its why and its steps come with it. */
  carry?: Aim;
}

const CAPTION: Record<IdeaSource, string> = {
  yesterday: 'An idea · from yesterday',
  todo: 'An idea · from your to-dos',
  fitness: 'An idea · from Fitness',
  habits: 'An idea · from your habits',
};

/** A goal's words without the full stop a sentence ends in. */
const bare = (t: string) => t.trim().replace(/[.\s]+$/, '');

/** Today's session in a few words: its title, or its type and how far or how long ("Easy 4 mi", "Bike 40 min"). */
const sessionWords = (s: Pick<Session, 'kind' | 'type' | 'title' | 'miles' | 'minutes'>): string => {
  const name = s.title?.trim() || s.type?.trim() || (s.kind === 'run' ? 'Run' : s.kind === 'lift' ? 'Lift' : 'Session');
  if (/\d/.test(name)) return name;
  const much = s.miles ? `${s.miles} mi` : s.minutes ? `${s.minutes} min` : '';
  return much ? `${name} ${much}` : name;
};

export interface IdeaInput {
  goals: readonly Aim[] | undefined;
  today: ISODate;
  /** Today's open to-dos, in the order Today shows them. */
  todos: readonly { text: string }[];
  /** Today's sessions (the plan). Read only with Fitness on. */
  sessions: readonly Pick<Session, 'kind' | 'type' | 'title' | 'miles' | 'minutes' | 'mark'>[];
  /** The habits in use. */
  habits: readonly { name: string }[];
  fitness: boolean;
}

/**
 * One suggested goal for today, from the person's own data, in this order: yesterday's goal when it was not finished, the
 * top open to-do, today's session (only with Fitness on), the habits. Null when there is nothing to go on. Pure.
 */
export const localGoalIdea = ({ goals, today, todos, sessions, habits, fitness }: IdeaInput): GoalIdea | null => {
  const y = goalOf(goals, 'day', shiftDays(today, -1));
  if (y && y.status !== 'done') return { text: bare(y.text), source: 'yesterday', caption: CAPTION.yesterday, carry: y };
  const todo = todos.find((t) => t.text.trim());
  if (todo) return { text: bare(todo.text), source: 'todo', caption: CAPTION.todo };
  const sess = fitness ? sessions.find((s) => s.kind !== 'rest' && !s.mark) : undefined;
  if (sess) return { text: `${sessionWords(sess)} today`, source: 'fitness', caption: CAPTION.fitness };
  if (habits.length) return { text: habits.length === 1 ? `${bare(habits[0]!.name)}, done by 9` : `All ${habits.length} habits, done by 9`, source: 'habits', caption: CAPTION.habits };
  return null;
};
