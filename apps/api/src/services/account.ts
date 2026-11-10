import { eq, getTableName, type SQL } from 'drizzle-orm';
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { DB } from '../db/index.js';
import {
  activities,
  authSessions,
  authTokens,
  coachReads,
  dailyPicks,
  habitChecks,
  habits,
  hrZones,
  idempotencyKeys,
  journalEntries,
  learnings,
  liftSets,
  links,
  morningDays,
  planBlocks,
  quotePrefs,
  recallItems,
  shownItems,
  stravaAccounts,
  assistantActions,
  dayPlans,
  goalEvents,
  goals,
  todoGroups,
  todos,
  trainingSessions,
  userQuotes,
  userSettings,
  users,
} from '../db/schema.js';
import { dayTags, healthBatches, healthDays, healthDevices, healthSamples, healthSync, healthWorkouts, sleepSegments } from '../db/schema.js';

/**
 * Every table that holds a user's rows, with its `user_id` column. A new table with a `user_id` must be added here;
 * the `DELETE /me` tests in `routes/platform.test.ts` fail if one is missing. (`quotes` is the shared library and has no owner.)
 */
export const USER_TABLES: Array<{ table: SQLiteTable; userId: SQLiteColumn }> = [
  { table: authSessions, userId: authSessions.userId },
  { table: authTokens, userId: authTokens.userId },
  { table: userSettings, userId: userSettings.userId },
  { table: habits, userId: habits.userId },
  { table: habitChecks, userId: habitChecks.userId },
  { table: planBlocks, userId: planBlocks.userId },
  { table: trainingSessions, userId: trainingSessions.userId },
  { table: liftSets, userId: liftSets.userId },
  { table: todos, userId: todos.userId },
  { table: todoGroups, userId: todoGroups.userId },
  { table: goals, userId: goals.userId },
  { table: goalEvents, userId: goalEvents.userId },
  { table: assistantActions, userId: assistantActions.userId },
  { table: dayPlans, userId: dayPlans.userId },
  { table: morningDays, userId: morningDays.userId },
  { table: journalEntries, userId: journalEntries.userId },
  { table: learnings, userId: learnings.userId },
  { table: userQuotes, userId: userQuotes.userId },
  { table: quotePrefs, userId: quotePrefs.userId },
  { table: dailyPicks, userId: dailyPicks.userId },
  { table: shownItems, userId: shownItems.userId },
  { table: recallItems, userId: recallItems.userId },
  { table: stravaAccounts, userId: stravaAccounts.userId },
  { table: activities, userId: activities.userId },
  { table: hrZones, userId: hrZones.userId },
  { table: coachReads, userId: coachReads.userId },
  { table: links, userId: links.userId },
  { table: idempotencyKeys, userId: idempotencyKeys.userId },
  { table: dayTags, userId: dayTags.userId },
  { table: healthDevices, userId: healthDevices.userId },
  { table: healthSamples, userId: healthSamples.userId },
  { table: healthDays, userId: healthDays.userId },
  { table: sleepSegments, userId: sleepSegments.userId },
  { table: healthWorkouts, userId: healthWorkouts.userId },
  { table: healthBatches, userId: healthBatches.userId },
  { table: healthSync, userId: healthSync.userId },
];

export const userTableNames = (): string[] => USER_TABLES.map((t) => getTableName(t.table));

/** Delete the account and every row it owns, in one transaction. Returns rows removed per table. */
export const deleteAccount = (db: DB, userId: string): Record<string, number> => {
  const out: Record<string, number> = {};
  db.transaction((tx) => {
    for (const { table, userId: col } of USER_TABLES) out[getTableName(table)] = tx.delete(table).where(eq(col, userId) as SQL).run().changes;
    out.users = tx.delete(users).where(eq(users.id, userId)).run().changes;
  });
  return out;
};
