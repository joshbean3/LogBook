import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const id = () => text('id').primaryKey();
const userId = () => text('user_id').notNull();
const createdAt = () => text('created_at').notNull();

export const users = sqliteTable('users', {
  id: id(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: createdAt(),
});

export const authSessions = sqliteTable('auth_sessions', {
  id: id(),
  userId: userId(),
  expiresAt: text('expires_at').notNull(),
  createdAt: createdAt(),
  userAgent: text('user_agent'),
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
    createdOn: text('created_on').notNull(),
    doneOn: text('done_on'),
    deletedOn: text('deleted_on'),
    createdAt: createdAt(),
  },
  (t) => [index('todos_user').on(t.userId)],
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

export const uniqueEmail = uniqueIndex;
