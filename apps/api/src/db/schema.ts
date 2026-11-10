import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const id = () => text('id').primaryKey();
const userId = () => text('user_id').notNull();
const createdAt = () => text('created_at').notNull();

export const users = sqliteTable('users', {
  id: id(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: createdAt(),
  /** When first-run onboarding finished; null sends the app to /welcome. Accounts that predate onboarding were set by migration 0006. */
  onboardedAt: text('onboarded_at'),
  /** The training answers as JSON (`SavedTrainingProfile`): onboarding writes them, PATCH /me/training changes them. Migration 0007. */
  trainingProfile: text('training_profile'),
  /** The athlete's name ("Josh"): the avatar's initial and Settings → You. Null until given. Migration 0008. */
  name: text('name'),
  /** When the address was confirmed by the emailed link (or by a password reset, which proves the same inbox). Migration 0018. */
  emailVerifiedAt: text('email_verified_at'),
});

export const authSessions = sqliteTable('auth_sessions', {
  id: id(),
  userId: userId(),
  expiresAt: text('expires_at').notNull(),
  createdAt: createdAt(),
  userAgent: text('user_agent'),
});

/**
 * Single-use tokens sent by email: `reset` (30 minutes) and `verify` (7 days). Only the SHA-256 of a token is stored, so
 * a copy of the database cannot be used to take over an account. Migration 0018.
 */
export const authTokens = sqliteTable(
  'auth_tokens',
  {
    id: id(),
    userId: userId(),
    kind: text('kind').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: text('expires_at').notNull(),
    usedAt: text('used_at'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('auth_tokens_hash').on(t.tokenHash), index('auth_tokens_user').on(t.userId, t.kind)],
);

/**
 * Counters for sign-in, sign-up and reset limits that must outlive a restart, keyed by a hashed email or an address
 * (never the plain email). `count` since `window_start` (ms); `locked_until` (ms) while a delay is in force. Migration 0018.
 */
export const authThrottle = sqliteTable('auth_throttle', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
  windowStart: integer('window_start').notNull(),
  lockedUntil: integer('locked_until').notNull().default(0),
});

/** Small JSON documents keyed by name: morning settings, preferences. */
export const userSettings = sqliteTable(
  'user_settings',
  {
    userId: userId(),
    key: text('key').notNull(),
    json: text('json').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);

export const habits = sqliteTable(
  'habits',
  {
    id: id(),
    userId: userId(),
    name: text('name').notNull(),
    position: integer('position').notNull().default(0),
    createdOn: text('created_on').notNull(),
    archivedOn: text('archived_on'),
  },
  (t) => [index('habits_user').on(t.userId)],
);

export const habitChecks = sqliteTable(
  'habit_checks',
  {
    userId: userId(),
    habitId: text('habit_id').notNull(),
    date: text('date').notNull(),
    done: integer('done', { mode: 'boolean' }).notNull().default(false),
    note: text('note'),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.habitId, t.date] }), index('habit_checks_user_date').on(t.userId, t.date)],
);

export const planBlocks = sqliteTable(
  'plan_blocks',
  {
    id: id(),
    userId: userId(),
    name: text('name').notNull(),
    start: text('start').notNull(),
    end: text('end').notNull(),
    source: text('source'),
    summary: text('summary'),
    createdAt: createdAt(),
    /** Soft delete (migration 0008): DELETE /blocks/:id and a replacing template keep the row so Undo restores it exactly. */
    deletedAt: text('deleted_at'),
  },
  (t) => [index('plan_blocks_user').on(t.userId)],
);

export const trainingSessions = sqliteTable(
  'training_sessions',
  {
    id: id(),
    userId: userId(),
    date: text('date').notNull(),
    position: integer('position').notNull().default(0),
    kind: text('kind').notNull(),
    type: text('type'),
    title: text('title'),
    details: text('details'),
    miles: real('miles'),
    minutes: integer('minutes'),
    blockId: text('block_id'),
    movedFrom: text('moved_from'),
    mark: text('mark'),
    /** How hard it felt, 1 to 10 (the effort check-in); null until asked. */
    effort: integer('effort'),
    /** Soft delete so Undo on the phone restores the exact row, plan membership and all. */
    deletedAt: text('deleted_at'),
    createdAt: createdAt(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('sessions_user_date').on(t.userId, t.date), index('sessions_block').on(t.blockId)],
);

export const liftSets = sqliteTable(
  'lift_sets',
  {
    id: id(),
    userId: userId(),
    date: text('date').notNull(),
    exercise: text('exercise').notNull(),
    weight: real('weight').notNull(),
    reps: integer('reps').notNull(),
    createdAt: createdAt(),
    deletedAt: text('deleted_at'),
  },
  (t) => [index('lift_sets_user_date').on(t.userId, t.date)],
);

export const todos = sqliteTable(
  'todos',
  {
    id: id(),
    userId: userId(),
    text: text('text').notNull(),
    note: text('note'),
    priority: integer('priority').notNull().default(0),
    /** Its own highlight (`TodoColor`); null shows its list's colour. Migration 0009. */
    color: text('color'),
    /** The list it is in (`todo_groups.id`); null when in none. Migration 0009. */
    groupId: text('group_id'),
    due: text('due'),
    bucket: text('bucket').notNull().default('today'),
    position: integer('position').notNull().default(0),
    createdOn: text('created_on').notNull(),
    doneOn: text('done_on'),
    deletedOn: text('deleted_on'),
    createdAt: createdAt(),
  },
  (t) => [index('todos_user').on(t.userId)],
);

/** The owner's named lists of to-dos ("Work", "Home"), each with a colour. Deleting one leaves its to-dos in no list. Migration 0009. */
export const todoGroups = sqliteTable(
  'todo_groups',
  {
    id: id(),
    userId: userId(),
    name: text('name').notNull(),
    color: text('color').notNull(),
    position: integer('position').notNull().default(0),
    createdAt: createdAt(),
    deletedAt: text('deleted_at'),
  },
  (t) => [index('todo_groups_user').on(t.userId)],
);

/** One goal per level (year, month, week, day) and period. Migration 0009. */
export const goals = sqliteTable(
  'goals',
  {
    id: id(),
    userId: userId(),
    level: text('level').notNull(),
    period: text('period').notNull(),
    text: text('text').notNull(),
    original: text('original'),
    why: text('why'),
    status: text('status').notNull().default('open'),
    reflection: text('reflection'),
    /** Its steps as JSON (`GoalStep[]`). Migration 0010. */
    steps: text('steps').notNull().default('[]'),
    createdAt: createdAt(),
    updatedAt: text('updated_at').notNull(),
    closedAt: text('closed_at'),
    deletedAt: text('deleted_at'),
  },
  (t) => [index('goals_user').on(t.userId), uniqueIndex('goals_user_level_period').on(t.userId, t.level, t.period)],
);

/** Every change to a goal, in order: what was set, sharpened, kept, edited, done, missed, cleared. Never deleted except with the account. Migration 0009. */
export const goalEvents = sqliteTable(
  'goal_events',
  {
    id: id(),
    userId: userId(),
    goalId: text('goal_id').notNull(),
    level: text('level').notNull(),
    period: text('period').notNull(),
    kind: text('kind').notNull(),
    text: text('text'),
    at: text('at').notNull(),
  },
  (t) => [index('goal_events_user_at').on(t.userId, t.at), index('goal_events_goal').on(t.goalId)],
);

export const morningDays = sqliteTable(
  'morning_days',
  {
    userId: userId(),
    date: text('date').notNull(),
    mode: text('mode').notNull(),
    type: text('type').notNull(),
    miles: real('miles').notNull(),
    minutes: integer('minutes').notNull(),
    wake: integer('wake').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })],
);

export const journalEntries = sqliteTable(
  'journal_entries',
  {
    id: id(),
    userId: userId(),
    date: text('date').notNull(),
    text: text('text').notNull(),
    fav: integer('fav', { mode: 'boolean' }).notNull().default(false),
    createdAt: createdAt(),
    editedAt: text('edited_at'),
    deletedAt: text('deleted_at'),
  },
  (t) => [index('journal_user_date').on(t.userId, t.date)],
);

/** The shared quote library, seeded from data/quotes.json. */
export const quotes = sqliteTable(
  'quotes',
  {
    id: id(),
    text: text('text').notNull(),
    author: text('author').notNull().default(''),
    theme: text('theme').notNull().default(''),
    work: text('work').notNull().default(''),
  },
  (t) => [index('quotes_theme').on(t.theme)],
);

export const userQuotes = sqliteTable(
  'user_quotes',
  {
    id: id(),
    userId: userId(),
    text: text('text').notNull(),
    author: text('author').notNull().default(''),
    createdAt: createdAt(),
    deletedAt: text('deleted_at'),
  },
  (t) => [index('user_quotes_user').on(t.userId)],
);

export const quotePrefs = sqliteTable(
  'quote_prefs',
  {
    userId: userId(),
    quoteId: text('quote_id').notNull(),
    fav: integer('fav', { mode: 'boolean' }).notNull().default(false),
    hidden: integer('hidden', { mode: 'boolean' }).notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.userId, t.quoteId] })],
);

/** What was shown on which day, and when each item was last shown, for the rotation. */
export const dailyPicks = sqliteTable(
  'daily_picks',
  {
    userId: userId(),
    date: text('date').notNull(),
    kind: text('kind').notNull(),
    itemId: text('item_id').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date, t.kind] })],
);

export const shownItems = sqliteTable(
  'shown_items',
  {
    userId: userId(),
    kind: text('kind').notNull(),
    itemId: text('item_id').notNull(),
    lastShown: text('last_shown').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.kind, t.itemId] })],
);

export const stravaAccounts = sqliteTable('strava_accounts', {
  userId: text('user_id').primaryKey(),
  athleteId: text('athlete_id').notNull(),
  athleteName: text('athlete_name'),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  expiresAt: integer('expires_at').notNull(),
  scope: text('scope'),
  connectedAt: createdAt(),
  lastSyncAt: text('last_sync_at'),
  lastError: text('last_error'),
});

export const activities = sqliteTable(
  'activities',
  {
    id: id(),
    userId: userId(),
    date: text('date').notNull(),
    time: text('time'),
    name: text('name').notNull(),
    sportType: text('sport_type').notNull(),
    kind: text('kind').notNull(),
    distanceM: real('distance_m').notNull().default(0),
    movingSec: integer('moving_sec').notNull().default(0),
    elapsedSec: integer('elapsed_sec').notNull().default(0),
    elevM: real('elev_m').notNull().default(0),
    avgHr: integer('avg_hr'),
    maxHr: integer('max_hr'),
    cadence: integer('cadence'),
    lapsJson: text('laps_json'),
    perfAt: text('perf_at'),
    perfFailed: integer('perf_failed').notNull().default(0),
    polyline: text('polyline'),
    deletedAt: text('deleted_at'),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('activities_user_date').on(t.userId, t.date)],
);

export const hrZones = sqliteTable('hr_zones', {
  userId: text('user_id').primaryKey(),
  zonesJson: text('zones_json').notNull(),
  fetchedAt: text('fetched_at').notNull(),
});

export const coachReads = sqliteTable(
  'coach_reads',
  {
    userId: userId(),
    date: text('date').notNull(),
    key: text('key').notNull(),
    text: text('text').notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date, t.key] })],
);

/** Links to come back to, and the daily picks offered from them. */
export const links = sqliteTable(
  'links',
  {
    id: id(),
    userId: userId(),
    url: text('url').notNull(),
    title: text('title').notNull(),
    siteName: text('site_name').notNull().default(''),
    description: text('description'),
    imageUrl: text('image_url'),
    note: text('note'),
    tagsJson: text('tags_json').notNull().default('[]'),
    addedAt: text('added_at').notNull(),
    readAt: text('read_at'),
    source: text('source').notNull().default('me'),
    pickReason: text('pick_reason'),
    /** The day a pick was offered; null for a link the athlete saved. */
    pickDate: text('pick_date'),
    verdict: text('verdict'),
    /** Soft delete so Undo restores the exact row. */
    deletedAt: text('deleted_at'),
  },
  (t) => [index('links_user').on(t.userId), index('links_user_pick').on(t.userId, t.pickDate)],
);

/**
 * Idempotent writes (contract 4): the first answer to each `Idempotency-Key` a user sent, replayed for 24 hours to any
 * request that carries the same key, so a write the outbox sends twice lands once. Migration 0008.
 */
export const idempotencyKeys = sqliteTable(
  'idempotency_keys',
  {
    userId: userId(),
    key: text('key').notNull(),
    method: text('method').notNull(),
    path: text('path').notNull(),
    status: integer('status').notNull(),
    body: text('body').notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] }), index('idempotency_keys_created').on(t.createdAt)],
);

export const uniqueEmail = uniqueIndex;

/**
 * The assistant's proposals and what came of them: the owner's ask, Claude's summary, the checked operations, and, once
 * applied, the rows as they were (so Undo puts them back). Migration 0011.
 */
export const assistantActions = sqliteTable(
  'assistant_actions',
  {
    id: id(),
    userId: userId(),
    ask: text('ask').notNull(),
    summary: text('summary').notNull(),
    ops: text('ops').notNull(),
    labels: text('labels').notNull(),
    undo: text('undo'),
    status: text('status').notNull().default('proposed'),
    createdAt: createdAt(),
    appliedAt: text('applied_at'),
  },
  (t) => [index('assistant_actions_user').on(t.userId, t.createdAt)],
);

/** A day's plan: three bands (`DayBands` JSON) of to-do and goal-step references, in order. Migration 0012. */
export const dayPlans = sqliteTable(
  'day_plans',
  {
    id: id(),
    userId: userId(),
    date: text('date').notNull(),
    bands: text('bands').notNull().default('{"morning":[],"afternoon":[],"evening":[]}'),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [uniqueIndex('day_plans_user_date').on(t.userId, t.date)],
);

/** What I learned: one row per thing learned, several a day; soft-deleted so a delete can be undone. */
export const learnings = sqliteTable(
  'learnings',
  {
    id: id(),
    userId: userId(),
    date: text('date').notNull(),
    text: text('text').notNull(),
    createdAt: createdAt(),
    editedAt: text('edited_at'),
    deletedAt: text('deleted_at'),
  },
  (t) => [index('learnings_user_date').on(t.userId, t.date)],
);

/**
 * "Remember when" (the top of the Journal tab): one row per past journal entry or learning that has been shown, boosted or
 * hidden. `summary` is Claude's one-line reminder, written once and kept (never the plain fallback). Migration 0014.
 */
export const recallItems = sqliteTable(
  'recall_items',
  {
    userId: userId(),
    sourceKind: text('source_kind').notNull(),
    sourceId: text('source_id').notNull(),
    boost: integer('boost', { mode: 'boolean' }).notNull().default(false),
    hidden: integer('hidden', { mode: 'boolean' }).notNull().default(false),
    summary: text('summary'),
    summarizedAt: text('summarized_at'),
    lastShown: text('last_shown'),
  },
  (t) => [primaryKey({ columns: [t.userId, t.sourceKind, t.sourceId] })],
);

/** Day tags (the Journal's day page): one yes (1) or no (0) per tag per day. The list of tags is in user_settings. Migration 0016. */
export const dayTags = sqliteTable(
  'day_tags',
  {
    userId: userId(),
    date: text('date').notNull(),
    tag: text('tag').notNull(),
    value: integer('value', { mode: 'boolean' }).notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date, t.tag] })],
);

// ---------- Apple Health (docs/health/apple-health.md §3.5). Migration 0017. ----------

/** A phone allowed to upload, by the hash of its token (the token itself lives in that phone's Keychain). */
export const healthDevices = sqliteTable(
  'health_devices',
  {
    id: id(),
    userId: userId(),
    tokenHash: text('token_hash').notNull(),
    name: text('name').notNull(),
    createdAt: createdAt(),
    lastSeenAt: text('last_seen_at'),
    revokedAt: text('revoked_at'),
  },
  (t) => [uniqueIndex('health_devices_token').on(t.tokenHash)],
);

/** Vitals and readings, one row per Health sample. `deleted_at` is never cleared: Health never reuses a UUID. */
export const healthSamples = sqliteTable(
  'health_samples',
  {
    userId: userId(),
    uuid: text('uuid').notNull(),
    type: text('type').notNull(),
    startAt: text('start_at').notNull(),
    endAt: text('end_at').notNull(),
    value: real('value').notNull(),
    unit: text('unit').notNull(),
    sourceBundle: text('source_bundle').notNull(),
    sourceName: text('source_name').notNull(),
    productType: text('product_type'),
    userEntered: integer('user_entered', { mode: 'boolean' }).notNull().default(false),
    tz: text('tz'),
    deletedAt: text('deleted_at'),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.uuid] }), index('health_samples_type').on(t.userId, t.type, t.startAt)],
);

/** The day sums (steps, energy, exercise) and the heart rate buckets. A day's time zone is frozen the first time it lands. */
export const healthDays = sqliteTable(
  'health_days',
  {
    userId: userId(),
    date: text('date').notNull(),
    metric: text('metric').notNull(),
    value: real('value'),
    bucketsJson: text('buckets_json'),
    dayStartAt: text('day_start_at').notNull(),
    tz: text('tz').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date, t.metric] })],
);

export const sleepSegments = sqliteTable(
  'sleep_segments',
  {
    userId: userId(),
    uuid: text('uuid').notNull(),
    startAt: text('start_at').notNull(),
    endAt: text('end_at').notNull(),
    stage: text('stage').notNull(),
    sourceBundle: text('source_bundle').notNull(),
    sourceName: text('source_name').notNull(),
    productType: text('product_type'),
    tz: text('tz'),
    deletedAt: text('deleted_at'),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.uuid] }), index('sleep_segments_start').on(t.userId, t.startAt)],
);

/** Workouts from Health, waiting to join the run list (phase 5 matches them with Strava). */
export const healthWorkouts = sqliteTable(
  'health_workouts',
  {
    userId: userId(),
    uuid: text('uuid').notNull(),
    activity: text('activity').notNull(),
    startAt: text('start_at').notNull(),
    endAt: text('end_at').notNull(),
    durationSec: real('duration_sec').notNull(),
    distanceM: real('distance_m'),
    energyKcal: real('energy_kcal'),
    avgHr: real('avg_hr'),
    maxHr: real('max_hr'),
    hrJson: text('hr_json'),
    sourceBundle: text('source_bundle').notNull(),
    sourceName: text('source_name').notNull(),
    productType: text('product_type'),
    tz: text('tz'),
    deletedAt: text('deleted_at'),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.uuid] }), index('health_workouts_start').on(t.userId, t.startAt)],
);

/** Batches already stored, so a re-sent batch is answered without being written twice. */
export const healthBatches = sqliteTable(
  'health_batches',
  {
    userId: userId(),
    batchId: text('batch_id').notNull(),
    storedAt: text('stored_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.batchId] })],
);

/** The connection: when, how far back, the last sync and its error, which types have shown up. */
export const healthSync = sqliteTable('health_sync', {
  userId: text('user_id').primaryKey(),
  connectedAt: text('connected_at').notNull(),
  lastSyncAt: text('last_sync_at'),
  lastError: text('last_error'),
  historyFrom: text('history_from').notNull(),
  typesSeenJson: text('types_seen_json').notNull().default('[]'),
});
