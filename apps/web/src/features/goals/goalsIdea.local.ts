import { shiftDays, type Aim, type ISODate, type Session } from '@logbook/shared';
import { goalIdea, type IdeaSource } from './goalIdea';
import { goalOf } from './model';

/*
 * The Goals page's way into the shared suggested-goal function (features/goals/goalIdea.ts): it gathers what the page
 * has loaded and hands back the idea in the shape the poster reads.
 */

/** Where an idea came from, as the band's caption says it: "An idea · from yesterday". */
export type { IdeaSource };
export interface GoalIdea {
  text: string;
  source: IdeaSource;
  /** The band's caption. */
  caption: string;
  /** Yesterday's goal, when the idea is to carry it over: its why and its steps come with it. */
  carry?: Aim;
}

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
  /** Minutes after midnight, for the words that say when. */
  minutes?: number;
}

/**
 * One suggested goal for today, from the person's own data: the shared rule (goalIdea.ts, the one Today's Plan your day
 * uses), fed from what the Goals page has loaded, so both screens offer the same idea in the same words. Pure.
 */
export const localGoalIdea = ({ goals, today, todos, sessions, habits, fitness, minutes }: IdeaInput): GoalIdea | null => {
  const sess = fitness ? sessions.find((s) => s.kind !== 'rest' && !s.mark) : undefined;
  const idea = goalIdea({ yesterday: goalOf(goals, 'day', shiftDays(today, -1)), todos, fitness, session: sess ? sessionWords(sess) : null, habits: habits.length, ...(minutes == null ? {} : { minutes }) });
  if (!idea) return null;
  return { text: bare(idea.text), source: idea.source, caption: idea.label, ...(idea.from ? { carry: idea.from } : {}) };
};
