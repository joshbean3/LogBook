import { stepRef, todoRef, type Aim, type GoalStep, type ISODate, type Todo } from '@logbook/shared';
import { byPosition, groupsOn, liveOn } from '../todos/groups';

/** One thing in the day: a to-do, or a step of the day's goal. */
export type Card = { ref: string; kind: 'todo'; todo: Todo; done: boolean } | { ref: string; kind: 'step'; goal: Aim; step: GoalStep; done: boolean };

/**
 * What a day holds: the day goal's steps first, then its to-dos. Today: the open Today items (and any Later item whose day has
 * come) and what was done today, which stays on the board, struck. Ahead: what is due that day. Behind: what was due, and
 * what got done.
 */
export const cardsFor = (todos: Todo[] | undefined, goal: Aim | null, date: ISODate, today: ISODate): Card[] => {
  const steps: Card[] = goal ? goal.steps.map((s) => ({ ref: stepRef(goal.id, s.id), kind: 'step', goal, step: s, done: s.done })) : [];
  let list: Todo[];
  if (date === today) {
    const g = groupsOn(todos, date);
    list = [...g[0]!.items, ...g[3]!.items];
  } else if (date < today) list = liveOn(todos, date).filter((x) => x.doneOn === date || (x.due === date && (!x.doneOn || x.doneOn > date))).sort(byPosition);
  else list = (todos ?? []).filter((x) => !x.deletedOn && !x.doneOn && x.due === date).sort(byPosition);
  return [...steps, ...list.map((x): Card => ({ ref: todoRef(x.id), kind: 'todo', todo: x, done: x.doneOn === date || (date === today && !!x.doneOn) }))];
};

/** How many open to-dos the path shows: the day's priorities. The rest wait behind "All to-dos". */
export const TOP = 3;

/** The day's to-dos as one list: the open ones in the order they matter, then what got done (steps live with the goal). */
export const focusOf = (cards: Card[]): Card[] => {
  const todos = cards.filter((c) => c.kind === 'todo');
  return [...todos.filter((c) => !c.done), ...todos.filter((c) => c.done)];
};

/** The list in its three parts: the priorities (the first three open), the rest still open, and what got done. */
export const splitFocus = (cards: Card[]) => {
  const open = cards.filter((c) => !c.done);
  return { top: open.slice(0, TOP), rest: open.slice(TOP), done: cards.filter((c) => c.done) };
};

/** How many done to-dos keep a stop of their own on the path; more than this fold into one "3 done" stop. */
export const DONE_SHOWN = 2;

/** The day's to-dos as the path draws them (Plan your day, the poster's line of stops). */
export interface DayPath {
  /** What got done, each a stop of its own (at most `DONE_SHOWN`); empty when they are folded. */
  done: Card[];
  /** How many done to-dos the one folded stop stands for; 0 when each has its own. */
  doneFolded: number;
  /** The open to-dos on the surface: the first three, in the order they matter. The first is the next move. */
  open: Card[];
  /** Open to-dos past the three: behind "All to-dos". */
  rest: number;
  total: number;
  doneCount: number;
}

/**
 * The path through a day's to-dos: what is behind you (two done stops at most, else one folded stop), the top three open
 * ones, and how many more wait behind "All to-dos".
 */
export const pathOf = (cards: Card[]): DayPath => {
  const { top, rest, done } = splitFocus(cards.filter((c) => c.kind === 'todo'));
  const folded = done.length > DONE_SHOWN;
  return { done: folded ? [] : done, doneFolded: folded ? done.length : 0, open: top, rest: rest.length, total: top.length + rest.length + done.length, doneCount: done.length };
};

/** The band's count: "1 of 3 done", "All 3 done" (one to-do says "1 of 1 done"). Nothing to count: null. */
export const countWords = (done: number, total: number): string | null => (total <= 0 ? null : done >= total && total > 1 ? `All ${total} done` : `${Math.min(done, total)} of ${total} done`);

/** The time left in a day, from minutes after midnight: "14 h left", "40 min left". */
export const leftWords = (minutes: number): string => {
  const left = Math.max(0, 1440 - minutes);
  return left < 60 ? `${Math.max(1, Math.round(left))} min left` : `${Math.round(left / 60)} h left`;
};

/**
 * A tap can land twice (a double tap, a slow second press). The first changes what is under the finger: the ticked
 * to-do becomes a done stop where it stood, "Set this goal" gives way to the to-dos, a done stop reopened lets the next
 * one move up. The second tap would then act on a stop the person never aimed at (un-tick what was just ticked, reopen a
 * second to-do, open an editor). So a tap that lands where the last one did (within `ECHO_PX`), less than `ECHO_MS` after
 * the change it made, on the stop that changed, is that tap's echo and is dropped. A tap anywhere else is a new tap: the
 * next to-do can be ticked, or the last one un-ticked from its words, at once. `id` is the stop that changed
 * (`data-stop`), or `'*'` when the whole line did; `x`, `y` is where the tap that made the change landed.
 */
export const ECHO_MS = 500;
export const ECHO_PX = 32;
export interface PathChange {
  id: string;
  at: number;
  x: number;
  y: number;
}
export const isEcho = (last: PathChange | null, stop: string | null | undefined, now: number, x: number, y: number): boolean =>
  !!last && now >= last.at && now - last.at < ECHO_MS && (last.id === '*' || (!!stop && last.id === stop)) && Math.hypot(x - last.x, y - last.y) <= ECHO_PX;
