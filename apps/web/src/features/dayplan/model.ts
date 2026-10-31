import { isSkipMark, label, sessionStatus, stepRef, todoRef, tone, type Aim, type GoalStep, type ISODate, type Session, type SessionStatus, type Snapshot, type Todo, type Tone } from '@logbook/shared';
import { clientKey } from '@/api/queries';
import { byPosition, byPriority, groupsOn, liveOn } from '../todos/groups';
import { sessionRef } from './types';

/** One thing the day can hold: a to-do, a step of the day's goal, or a session. `ref` is what the plan stores. */
export type DayItem =
  | { ref: string; altRefs?: string[]; kind: 'todo'; todo: Todo; done: boolean; title: string }
  | { ref: string; altRefs?: string[]; kind: 'step'; goal: Aim; step: GoalStep; done: boolean; title: string }
  | { ref: string; altRefs?: string[]; kind: 'session'; session: Session; done: boolean; title: string; tone: Tone; status: SessionStatus; auto: boolean };

/**
 * What a day holds of to-dos and steps: the day goal's steps first, then its to-dos. Today: the open Today items (and any
 * Later item whose day has come) and what was done today, which stays on the day, struck. Ahead: what is due that day.
 * Behind: what was due, and what got done. A to-do made offline is known under its provisional id too (`altRefs`), so a
 * slot written before the server named it still finds it.
 */
export const itemsFor = (todos: Todo[] | undefined, goal: Aim | null, date: ISODate, today: ISODate): DayItem[] => {
  const steps: DayItem[] = goal ? goal.steps.map((s) => ({ ref: stepRef(goal.id, s.id), kind: 'step', goal, step: s, done: s.done, title: s.text })) : [];
  let list: Todo[];
  if (date === today) {
    const g = groupsOn(todos, date);
    list = [...g[0]!.items, ...g[3]!.items];
  } else if (date < today) list = liveOn(todos, date).filter((x) => x.doneOn === date || (x.due === date && (!x.doneOn || x.doneOn > date))).sort(byPosition);
  else list = (todos ?? []).filter((x) => !x.deletedOn && !x.doneOn && x.due === date).sort(byPriority);
  return [
    ...steps,
    ...list.map((x): DayItem => {
      const alias = clientKey(x.id);
      return { ref: todoRef(x.id), ...(alias !== x.id ? { altRefs: [todoRef(alias)] } : {}), kind: 'todo', todo: x, done: x.doneOn === date || (date === today && !!x.doneOn), title: x.text };
    }),
  ];
};

/** The day's sessions as items (a rest "session" is not a block). */
export const sessionItemsOf = (sessions: readonly Session[], snap: Snapshot, date: ISODate): DayItem[] =>
  sessions
    .filter((s) => s.kind !== 'rest')
    .map((s) => {
      const status = sessionStatus(snap, date, s);
      const done = status === 'done' || status === 'floor';
      return { ref: sessionRef(s.id), kind: 'session', session: s, done, title: label(s), tone: tone(s), status, auto: done && s.mark !== status && !isSkipMark(s.mark) };
    });
