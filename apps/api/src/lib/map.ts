import { METERS_PER_MILE, type Activity, type Habit, type JournalEntry, type Lap, type LiftSet, type PlanBlock, type Session, type SessionKind, type SessionMark, type Todo, type TodoBucket, type TodoColor, type TodoPriority, TODO_COLORS, type Aim, type GoalEvent, type GoalLevel, type GoalStatus, type GoalEventKind, type GoalStep, type TodoGroup } from '@logbook/shared';
import type { InferSelectModel } from 'drizzle-orm';
import type { activities, goalEvents, goals, habits, journalEntries, liftSets, planBlocks, todoGroups, todos, trainingSessions } from '../db/schema.js';

export const toSession = (r: InferSelectModel<typeof trainingSessions>): Session => ({
  id: r.id,
  date: r.date,
  position: r.position,
  kind: r.kind as SessionKind,
  type: r.type,
  title: r.title,
  details: r.details,
  miles: r.miles,
  minutes: r.minutes,
  blockId: r.blockId,
  movedFrom: r.movedFrom,
  mark: (r.mark as SessionMark | null) ?? null,
});

export const toHabit = (r: InferSelectModel<typeof habits>): Habit => ({ id: r.id, name: r.name, position: r.position, createdOn: r.createdOn, archivedOn: r.archivedOn });

export const toLift = (r: InferSelectModel<typeof liftSets>): LiftSet => ({ id: r.id, date: r.date, exercise: r.exercise, weight: r.weight, reps: r.reps, createdAt: r.createdAt });

export const toTodo = (r: InferSelectModel<typeof todos>): Todo => ({
  id: r.id,
  text: r.text,
  note: r.note,
  priority: (r.priority === 1 || r.priority === 2 || r.priority === 3 ? r.priority : 0) as TodoPriority,
  color: TODO_COLORS.includes(r.color as TodoColor) ? (r.color as TodoColor) : null,
  groupId: r.groupId ?? null,
  due: r.due,
  bucket: (r.bucket === 'later' || r.bucket === 'someday' ? r.bucket : 'today') as TodoBucket,
  position: r.position,
  createdOn: r.createdOn,
  doneOn: r.doneOn,
  deletedOn: r.deletedOn,
  createdAt: r.createdAt,
});

export const toBlock = (r: InferSelectModel<typeof planBlocks>, sessionCount?: number): PlanBlock => ({ id: r.id, name: r.name, start: r.start, end: r.end, source: r.source, summary: r.summary, createdAt: r.createdAt, sessionCount });

export const toEntry = (r: InferSelectModel<typeof journalEntries>): JournalEntry => ({ id: r.id, date: r.date, text: r.text, createdAt: r.createdAt, editedAt: r.editedAt, fav: r.fav });

export const toActivity = (r: InferSelectModel<typeof activities>): Activity => ({
  id: r.id,
  date: r.date,
  time: r.time,
  name: r.name,
  sportType: r.sportType,
  kind: r.kind as Activity['kind'],
  miles: Math.round((r.distanceM / METERS_PER_MILE) * 100) / 100,
  movingSec: r.movingSec,
  elevFt: Math.round(r.elevM * 3.28084),
  avgHr: r.avgHr,
  maxHr: r.maxHr,
  cadence: r.cadence,
  laps: r.lapsJson ? (JSON.parse(r.lapsJson) as Lap[]) : null,
  perfAt: r.perfAt,
  polyline: r.polyline ?? null,
});

export const toTodoGroup = (r: InferSelectModel<typeof todoGroups>): TodoGroup => ({
  id: r.id,
  name: r.name,
  color: TODO_COLORS.includes(r.color as TodoColor) ? (r.color as TodoColor) : 'blue',
  position: r.position,
  createdAt: r.createdAt,
});

export const toGoal = (r: InferSelectModel<typeof goals>): Aim => ({
  id: r.id,
  level: r.level as GoalLevel,
  period: r.period,
  text: r.text,
  original: r.original,
  why: r.why,
  status: r.status as GoalStatus,
  reflection: r.reflection,
  steps: parseSteps(r.steps),
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  closedAt: r.closedAt,
});

/** A goal's steps from their JSON; anything unreadable is no steps. */
export const parseSteps = (raw: string | null): GoalStep[] => {
  try {
    const v = JSON.parse(raw ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is GoalStep => !!x && typeof x.id === 'string' && typeof x.text === 'string').map((x) => ({ id: x.id, text: x.text, done: !!x.done })) : [];
  } catch {
    return [];
  }
};

export const toGoalEvent = (r: InferSelectModel<typeof goalEvents>): GoalEvent => ({ id: r.id, goalId: r.goalId, level: r.level as GoalLevel, period: r.period, kind: r.kind as GoalEventKind, text: r.text, at: r.at });
