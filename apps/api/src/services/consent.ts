import { CONSENT_VERSION, DEFAULT_CONSENT, INTRO_KEYS, type Consent, type ConsentEvent, type ConsentInput, type ConsentKind, type IntroKey } from '@logbook/shared';
import type { DB } from '../db/index.js';
import { ApiError, nowISO } from '../lib/util.js';
import { readSetting, writeSetting } from '../routes/core.js';
import { audit } from './audit.js';

/**
 * What may go to Claude, as the person chose it (user_settings `consent`). An account with no record has granted
 * nothing and was never asked (`at: null`). A switch counts as on only when it was stored as `true`.
 */
export const readConsent = (db: DB, userId: string): Consent => {
  const c = readSetting<Partial<Consent>>(db, userId, 'consent');
  if (!c) return { ...DEFAULT_CONSENT };
  return { training: c.training === true, health: typeof c.health === 'boolean' ? c.health : null, recall: c.recall === true, reads: c.reads === true, at: c.at ?? null, version: c.version ?? null };
};

const LOG_KEY = 'consentLog';
/** The log keeps its newest lines up to this many, so a script flipping a switch cannot grow the row without end. */
const LOG_MAX = 2000;
const SWITCHES = ['training', 'recall', 'reads', 'health'] as const;

/** The consent log, oldest first. */
export const readConsentLog = (db: DB, userId: string): ConsentEvent[] => {
  const log = readSetting<ConsentEvent[]>(db, userId, LOG_KEY);
  return Array.isArray(log) ? log : [];
};

/** Append lines to the consent log (user_settings `consentLog`). Nothing in it is ever edited. */
export const logConsent = (db: DB, userId: string, events: Array<{ kind: ConsentKind; value: boolean | null; version?: string | null }>, at = nowISO()) => {
  if (!events.length) return;
  const log = readConsentLog(db, userId);
  for (const e of events) log.push({ kind: e.kind, value: e.value, at, version: e.version ?? CONSENT_VERSION });
  writeSetting(db, userId, LOG_KEY, log.slice(-LOG_MAX));
  // the security log keeps that a choice changed (which switch, which way), under the hashed account id
  audit(db, 'consent', userId, events.map((e) => `${e.kind}:${e.value === true ? 'on' : e.value === false ? 'off' : 'unset'}`).join(','));
};

/**
 * Store a choice. Any switch the input leaves out keeps its earlier value. `at` moves only when the input carries a
 * switch (a body with none is not an answer). Every answer is appended to the consent log as `{ kind, value, at, version }`:
 * each switch the first time the person answers, and after that each switch whose value changed.
 */
export const writeConsent = (db: DB, userId: string, input: ConsentInput): Consent => {
  const cur = readConsent(db, userId);
  const given = SWITCHES.filter((k) => input[k] !== undefined);
  if (!given.length) return cur;
  const at = nowISO();
  const version = input.version ?? CONSENT_VERSION;
  const next: Consent = {
    training: input.training ?? cur.training,
    health: input.health === undefined ? cur.health : input.health,
    recall: input.recall ?? cur.recall,
    reads: input.reads ?? cur.reads,
    at,
    version,
  };
  const changed = given.filter((k) => cur.at === null || cur[k] !== next[k]);
  db.transaction(() => {
    writeSetting(db, userId, 'consent', next);
    logConsent(db, userId, changed.map((k) => ({ kind: k, value: next[k], version })), at);
  });
  return next;
};

/** May the plan, sessions, goals, to-dos or status go to Claude for this account? */
export const assistantMayReadTraining = (db: DB, userId: string): boolean => {
  const c = readConsent(db, userId);
  return c.at !== null && c.training;
};
/** May one past journal entry or learning, with the first name, go to Claude to write Remember when? */
export const mayWriteRecall = (db: DB, userId: string): boolean => {
  const c = readConsent(db, userId);
  return c.at !== null && c.recall;
};
/** May the saved links, notes and tags go to Claude to choose the daily pick? */
export const mayPickReads = (db: DB, userId: string): boolean => {
  const c = readConsent(db, userId);
  return c.at !== null && c.reads;
};

/**
 * The Claude calls a person starts by hand. Remember when and the daily pick run on their own and fall back quietly
 * instead. `shape` is the plan builder's assistant (a few settings from a sentence), apart from `plan` (a whole draft).
 * `challenge` is "Ask the assistant to pick" on a challenge (one item chosen from the rule's own menu).
 */
export type AiFlow = 'assistant' | 'plan' | 'goal' | 'shape' | 'challenge';
export const CONSENT_REQUIRED = 'Choose what the assistant can use first. Open Settings, Privacy.';

/**
 * The one gate in front of every Claude call a person starts (the assistant, the plan builder in every mode and its
 * settings assistant, the goal review, the challenge pick). An account that was never asked (`at: null`) sends nothing: not its data, not typed text, not a file. Throws
 * 403 `consent_required`; answers the stored choice otherwise, so the caller can leave out what a switch covers.
 */
export const requireAiPermission = (db: DB, userId: string, _flow: AiFlow): Consent => {
  const c = readConsent(db, userId);
  if (c.at === null) throw new ApiError(403, CONSENT_REQUIRED, 'consent_required');
  return c;
};

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
