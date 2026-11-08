import { DEFAULT_CONSENT, INTRO_KEYS, type Consent, type ConsentInput, type IntroKey } from '@logbook/shared';
import type { DB } from '../db/index.js';
import { nowISO } from '../lib/util.js';
import { readSetting, writeSetting } from '../routes/core.js';

/**
 * What the assistant may read, as the person chose it (user_settings `consent`). An account that never chose reads as the
 * default (training data on, health not asked), which is what the privacy page offers.
 */
export const readConsent = (db: DB, userId: string): Consent => {
  const c = readSetting<Partial<Consent>>(db, userId, 'consent');
  if (!c) return { ...DEFAULT_CONSENT };
  return { training: c.training !== false, health: typeof c.health === 'boolean' ? c.health : null, at: c.at ?? null };
};

/** Store a choice. `health` keeps its earlier value when the input leaves it out. */
export const writeConsent = (db: DB, userId: string, input: ConsentInput): Consent => {
  const cur = readConsent(db, userId);
  const next: Consent = { training: input.training, health: input.health === undefined ? cur.health : input.health, at: nowISO() };
  writeSetting(db, userId, 'consent', next);
  return next;
};

/**
 * May anything from the training log go to Claude for this account? The one check every Claude call that sends the
 * plan, sessions, goals or to-dos should make (see the report for where it still has to be wired).
 */
export const assistantMayReadTraining = (db: DB, userId: string): boolean => readConsent(db, userId).training;

/**
 * The one-time feature intros (user_settings `intros`). `seen` is null for an account that is not enrolled (one from before
 * first run had intros, so its owner never sees a sheet for a tab they already know); first run enrolls with `seen: []`.
 */
export const readIntros = (db: DB, userId: string): { seen: IntroKey[] | null } => {
  const v = readSetting<{ seen?: unknown }>(db, userId, 'intros');
  if (!v || !Array.isArray(v.seen)) return { seen: null };
  return { seen: v.seen.filter((k): k is IntroKey => (INTRO_KEYS as readonly string[]).includes(k as string)) };
};
export const enrollIntros = (db: DB, userId: string) => {
  const cur = readIntros(db, userId);
  if (cur.seen === null) writeSetting(db, userId, 'intros', { seen: [] });
  return readIntros(db, userId);
};
export const markIntroSeen = (db: DB, userId: string, key: IntroKey) => {
  const cur = readIntros(db, userId);
  // an account that is not enrolled stays that way: marking a key enrolls nothing
  if (cur.seen === null || cur.seen.includes(key)) return cur;
  writeSetting(db, userId, 'intros', { seen: [...cur.seen, key] });
  return readIntros(db, userId);
};
