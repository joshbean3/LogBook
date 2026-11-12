import type { Activity, CoachRead, HabitCheck, JournalEntry, LiftSet, Session, Todo } from '@logbook/shared';
import { BadShapeError } from './bootstrap';
import type { MonthBundle } from './types';

/**
 * What the app reads from the server and from its saved copy, checked where it comes in (to-dos and months; goals have their own: features/goals/shape.ts). A list that
 * is not a list reads as empty; a row that cannot be a to-do (no id, no words) is left out; a field in a shape
 * the app never wrote takes its plain default (a to-do's list is left as it came: one in no list shows in none, as before). So one bad row, a proxy's error page saved as an answer, or a copy saved by
 * an older build can never take a screen down. Rows that are already right are returned as they came (the same objects,
 * and the same list when every row is right), so nothing downstream re-renders for the check.
 */
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const words = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isDay = (v: unknown): v is string => typeof v === 'string' && DAY.test(v);
const dayOrNull = (v: unknown) => v === null || isDay(v);
const strOrNull = (v: unknown) => v === null || typeof v === 'string';

const PRIORITIES: readonly unknown[] = [0, 1, 2, 3];

const todoFine = (x: Record<string, unknown>) =>
  isDay(x.createdOn) && typeof x.createdAt === 'string' && PRIORITIES.includes(x.priority) && typeof x.position === 'number' && Number.isFinite(x.position) && dayOrNull(x.due) && dayOrNull(x.doneOn) && dayOrNull(x.deletedOn) && strOrNull(x.note) && strOrNull(x.color) && strOrNull(x.groupId);

/** One to-do, or null when the row cannot be one. */
export const todoOf = (x: unknown): Todo | null => {
  if (!isObj(x) || !words(x.id) || !words(x.text)) return null;
  if (todoFine(x)) return x as unknown as Todo;
  const createdAt = typeof x.createdAt === 'string' ? x.createdAt : '';
  return {
    ...(x as unknown as Todo),
    note: typeof x.note === 'string' ? x.note : null,
    priority: (PRIORITIES.includes(x.priority) ? x.priority : 0) as Todo['priority'],
    color: (typeof x.color === 'string' ? x.color : null) as Todo['color'],
    groupId: typeof x.groupId === 'string' ? x.groupId : null,
    due: isDay(x.due) ? x.due : null,
    position: typeof x.position === 'number' && Number.isFinite(x.position) ? x.position : 0,
    // a to-do with no day of its own has always been there: it shows on every day until it is done
    createdOn: isDay(x.createdOn) ? x.createdOn : isDay(createdAt.slice(0, 10)) ? createdAt.slice(0, 10) : '1970-01-01',
    doneOn: isDay(x.doneOn) ? x.doneOn : null,
    deletedOn: isDay(x.deletedOn) ? x.deletedOn : null,
    createdAt,
  };
};

/** The to-dos as the app reads them. */
export const todosOf = (raw: unknown): Todo[] => {
  if (!Array.isArray(raw)) return [];
  let same = true;
  const out: Todo[] = [];
  for (const x of raw) {
    const t = todoOf(x);
    if (t !== x) same = false;
    if (t) out.push(t);
  }
  return same ? (raw as Todo[]) : out;
};

// goals are read by their own rule: features/goals/shape.ts (goalsOf, goalOfRow)

// ---------- a month ----------
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const MARKS: readonly unknown[] = ['done', 'floor', 'skip', 'sick'];
const list = <T>(v: unknown, row: (x: Record<string, unknown>) => T | null): T[] => (Array.isArray(v) ? v.flatMap((x) => (isObj(x) ? (row(x) ?? []) : [])) : []);

const sessionOf = (x: Record<string, unknown>): Session | null =>
  words(x.id) && isDay(x.date) && words(x.kind)
    ? ({
        ...x,
        position: num(x.position) ? x.position : 0,
        type: typeof x.type === 'string' ? x.type : null,
        title: typeof x.title === 'string' ? x.title : null,
        details: typeof x.details === 'string' ? x.details : null,
        miles: num(x.miles) ? x.miles : null,
        minutes: num(x.minutes) ? x.minutes : null,
        mark: MARKS.includes(x.mark) ? x.mark : null,
      } as unknown as Session)
    : null;
const activityOf = (x: Record<string, unknown>): Activity | null =>
  words(x.id) && isDay(x.date) && words(x.kind)
    ? ({ ...x, time: typeof x.time === 'string' ? x.time : null, name: typeof x.name === 'string' ? x.name : '', miles: num(x.miles) ? x.miles : 0, movingSec: num(x.movingSec) ? x.movingSec : 0, elevFt: num(x.elevFt) ? x.elevFt : 0, polyline: typeof x.polyline === 'string' ? x.polyline : null } as unknown as Activity)
    : null;
const checkOf = (x: Record<string, unknown>): HabitCheck | null => (words(x.habitId) && isDay(x.date) ? ({ ...x, done: !!x.done, note: typeof x.note === 'string' ? x.note : null } as unknown as HabitCheck) : null);
const liftOf = (x: Record<string, unknown>): LiftSet | null => (words(x.id) && isDay(x.date) && typeof x.exercise === 'string' ? (x as unknown as LiftSet) : null);
const entryOf = (x: Record<string, unknown>): JournalEntry | null => (words(x.id) && isDay(x.date) && typeof x.text === 'string' ? ({ ...x, createdAt: typeof x.createdAt === 'string' ? x.createdAt : '' } as unknown as JournalEntry) : null);
const coachOf = (x: Record<string, unknown>): CoachRead | null => (isDay(x.date) && typeof x.key === 'string' && typeof x.text === 'string' ? (x as unknown as CoachRead) : null);

/**
 * A month as the app reads it. The whole app draws from the months (every tab builds its snapshot from them), so one that
 * is not a month is refused like a failed request (the last good copy stays, and a screen with none says "Not loaded"):
 * shown as an empty month it would look as if the plan were gone. Inside a month, a list that is missing reads as empty,
 * a row that cannot be read is left out, and a field in a shape the app never wrote takes its plain default.
 */
export const monthBundleOf = (raw: unknown, month: string): MonthBundle => {
  if (!isObj(raw) || !Array.isArray(raw.sessions)) throw new BadShapeError('month');
  return {
    month: typeof raw.month === 'string' ? raw.month : month,
    sessions: list(raw.sessions, sessionOf),
    checks: list(raw.checks, checkOf),
    lifts: list(raw.lifts, liftOf),
    activities: list(raw.activities, activityOf),
    morningDays: (isObj(raw.morningDays) ? raw.morningDays : {}) as MonthBundle['morningDays'],
    journal: list(raw.journal, entryOf),
    coach: list(raw.coach, coachOf),
  };
};
