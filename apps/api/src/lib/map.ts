import { METERS_PER_MILE, type Activity, type Habit, type JournalEntry, type Lap, type LiftSet, type PlanBlock, type Session, type SessionKind, type SessionMark, type Todo } from '@logbook/shared';
import type { InferSelectModel } from 'drizzle-orm';
import type { activities, habits, journalEntries, liftSets, planBlocks, todos, trainingSessions } from '../db/schema.js';

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

export const toTodo = (r: InferSelectModel<typeof todos>): Todo => ({ id: r.id, text: r.text, createdOn: r.createdOn, doneOn: r.doneOn, deletedOn: r.deletedOn, createdAt: r.createdAt });

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
});
