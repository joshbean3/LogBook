import { shiftDays, toISO } from '@logbook/shared';
import { and, eq, getTableName, inArray, isNotNull, lt, notExists, sql, type SQL } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { DB } from '../db/index.js';
import { activities, assistantActions, goalEvents, goals, healthSamples, healthWorkouts, journalEntries, learnings, liftSets, links, planBlocks, recallItems, sleepSegments, todoGroups, todos, trainingSessions, userQuotes } from '../db/schema.js';

/**
 * How long deleted things are kept. A delete in the app is a soft delete, so it can be undone; this is where it
 * becomes final. The privacy policy states the same numbers.
 * - Anything deleted (a session, a plan, a lift set, a to-do or list, a goal, a journal entry, a quote, a saved link,
 *   a learning, a run or a Health reading its source removed) is removed for good 30 days later.
 * - The assistant's proposals (what was asked, what it proposed, what Undo would restore) are removed after 90 days.
 * Volume snapshots and the off-site backup keep a copy for 5 more days (RUNBOOK.md).
 */
export const DELETED_KEEP_DAYS = 30;
export const ASSISTANT_ACTIONS_KEEP_DAYS = 90;

/** Every table with a `deleted_at` stamp. A new soft-deleted table goes here; the retention test fails if one is missing. */
export const SOFT_DELETED: Array<{ table: SQLiteTable; deletedAt: SQLiteColumn }> = [
  { table: planBlocks, deletedAt: planBlocks.deletedAt },
  { table: trainingSessions, deletedAt: trainingSessions.deletedAt },
  { table: liftSets, deletedAt: liftSets.deletedAt },
  { table: todoGroups, deletedAt: todoGroups.deletedAt },
  { table: goals, deletedAt: goals.deletedAt },
  { table: journalEntries, deletedAt: journalEntries.deletedAt },
  { table: userQuotes, deletedAt: userQuotes.deletedAt },
  { table: activities, deletedAt: activities.deletedAt },
  { table: links, deletedAt: links.deletedAt },
  { table: learnings, deletedAt: learnings.deletedAt },
  { table: healthSamples, deletedAt: healthSamples.deletedAt },
  { table: sleepSegments, deletedAt: sleepSegments.deletedAt },
  { table: healthWorkouts, deletedAt: healthWorkouts.deletedAt },
];

/**
 * The daily purge. Returns rows removed per table. Safe to run at any time and any number of times.
 * A to-do carries the day it was deleted from (`deleted_on`), not a stamp; it goes 30 days after that day.
 */
export const purgeDeleted = (db: DB, now = Date.now()): Record<string, number> => {
  const cutoff = new Date(now - DELETED_KEEP_DAYS * 864e5).toISOString();
  const cutoffDay = shiftDays(toISO(new Date(now)), -DELETED_KEEP_DAYS);
  const out: Record<string, number> = {};
  db.transaction((tx) => {
    // what hangs off a row that is about to go: a goal's history, and the "Remember when" line written about an entry
    const goneGoals = tx.select({ id: goals.id }).from(goals).where(and(isNotNull(goals.deletedAt), lt(goals.deletedAt, cutoff))).all().map((g) => g.id);
    out.goal_events = 0;
    for (let i = 0; i < goneGoals.length; i += 500) out.goal_events += tx.delete(goalEvents).where(inArray(goalEvents.goalId, goneGoals.slice(i, i + 500))).run().changes;

    for (const { table, deletedAt } of SOFT_DELETED) out[getTableName(table)] = tx.delete(table).where(and(isNotNull(deletedAt), lt(deletedAt, cutoff)) as SQL).run().changes;
    out.todos = tx.delete(todos).where(and(isNotNull(todos.deletedOn), lt(todos.deletedOn, cutoffDay))).run().changes;

    // a recall row whose entry or learning no longer exists (it may hold a one-line summary of it)
    const orphanJournal = and(eq(recallItems.sourceKind, 'journal'), notExists(tx.select({ x: sql`1` }).from(journalEntries).where(eq(journalEntries.id, recallItems.sourceId))));
    const orphanLearning = and(eq(recallItems.sourceKind, 'learning'), notExists(tx.select({ x: sql`1` }).from(learnings).where(eq(learnings.id, recallItems.sourceId))));
    out.recall_items = tx.delete(recallItems).where(orphanJournal).run().changes + tx.delete(recallItems).where(orphanLearning).run().changes;

    out.assistant_actions = tx.delete(assistantActions).where(lt(assistantActions.createdAt, new Date(now - ASSISTANT_ACTIONS_KEEP_DAYS * 864e5).toISOString())).run().changes;
  });
  return out;
};
