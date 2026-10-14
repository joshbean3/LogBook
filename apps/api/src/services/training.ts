import { zTrainingProfile, type SavedTrainingProfile, type TrainingProfile } from '@logbook/shared';
import { eq } from 'drizzle-orm';
import type { DB } from '../db/index.js';
import { users } from '../db/schema.js';
import { nowISO } from '../lib/util.js';

/**
 * The athlete's training answers (goal, race day, run days, long-run day, weekly miles), kept on `users.training_profile`
 * as JSON. Onboarding writes them; Settings changes them with PATCH /me/training; GET /me and the bootstrap read them.
 */

/** The stored answers, or null when there are none (an account from before onboarding) or the JSON no longer validates. */
export const readTrainingProfile = (db: DB, userId: string): SavedTrainingProfile | null => {
  const row = db.select({ json: users.trainingProfile }).from(users).where(eq(users.id, userId)).get();
  if (!row?.json) return null;
  try {
    const raw = JSON.parse(row.json) as Record<string, unknown>;
    const ok = zTrainingProfile.safeParse(raw);
    if (!ok.success) return null;
    return { ...ok.data, updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : nowISO() };
  } catch {
    return null;
  }
};

/** Normalize (no race day for base, the long-run day is a run day) and store; returns what was stored. */
export const writeTrainingProfile = (db: DB, userId: string, p: TrainingProfile): SavedTrainingProfile => {
  const runDays = p.runDays.includes(p.longRunDay) ? p.runDays : [...p.runDays, p.longRunDay];
  const saved: SavedTrainingProfile = { goal: p.goal, raceDate: p.goal === 'base' ? null : p.raceDate, runDays, longRunDay: p.longRunDay, weeklyMiles: p.weeklyMiles, updatedAt: nowISO() };
  db.update(users).set({ trainingProfile: JSON.stringify(saved) }).where(eq(users.id, userId)).run();
  return saved;
};
