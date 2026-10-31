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
  /** "About you, for the assistant": a sentence or two the owner wrote in Settings → You, read into the assistant's context. Migration 0013. */
  profileNote: text('profile_note'),
  /** IANA time zone (`X-Timezone` on every authed request), for reminders and the assistant. Migration 0014. */
  timezone: text('timezone'),
  /** `{ start: "22:00", end: "07:00" }` as JSON: a reminder due inside it moves to the window's end. Migration 0014. */
  quietHoursJson: text('quiet_hours_json'),
  /** When the address was confirmed through its mailed link; null until then (accounts from before 0016 were set to their created_at). Migration 0016. */
  emailVerifiedAt: text('email_verified_at'),
  /** When the password was last changed (a reset or Settings › Account); null when it is the one from sign-up. Migration 0016. */
  passwordChangedAt: text('password_changed_at'),
});

export const authSessions = sqliteTable('auth_sessions', {
  id: id(),
  userId: userId(),
  expiresAt: text('expires_at').notNull(),
  createdAt: createdAt(),
  userAgent: text('user_agent'),
  /** The last request on this session, written at most once an hour (Settings › Account › Sessions). Migration 0016. */
  lastSeenAt: text('last_seen_at'),
});

/**
 * One-time links sent by mail: `verify` (24 h) confirms an address, `reset` (1 h) sets a new password. Only a sha256 of the
 * 32-byte token is kept, so the table is worthless on its own; `used_at` makes each link single use. Migration 0016.
 */
export const emailTokens = sqliteTable(
  'email_tokens',
  {
    id: id(),
    userId: userId(),
    kind: text('kind').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: text('expires_at').notNull(),
    usedAt: text('used_at'),
    createdAt: createdAt(),
  },
  (t) => [index('email_tokens_user').on(t.userId), uniqueIndex('email_tokens_hash').on(t.tokenHash)],
);

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

/**
 * One row per connected provider (Strava, Coros): the OAuth tokens, the athlete it is, the sync cursor and the last error.
 * `status`: ok | needs_reauth | error | revoked. UNIQUE(provider, external_athlete_id): one Logbook account per athlete.
 * Migration 0015 (copied from the old `strava_accounts`).
 */
export const providerConnections = sqliteTable(
  'provider_connections',
  {
    userId: userId(),
    provider: text('provider').notNull(),
    externalAthleteId: text('external_athlete_id').notNull(),
    athleteName: text('athlete_name'),
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token').notNull(),
    /** Unix seconds. */
    expiresAt: integer('expires_at').notNull(),
    scope: text('scope'),
    /** Provider-specific sync cursor (an ISO time or an opaque token). */
    cursor: text('cursor'),
    lastSyncAt: text('last_sync_at'),
    lastError: text('last_error'),
    status: text('status').notNull().default('ok'),
    connectedAt: text('connected_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.provider] }), uniqueIndex('provider_connections_athlete').on(t.provider, t.externalAthleteId)],
);

/**
 * OAuth clients this server registered with a provider's authorization server (RFC 7591 dynamic registration), one per
 * provider and issuer: COROS's MCP server hands out a client id on first connect instead of a developer console. The
 * redirect URI is kept so a changed APP_URL re-registers. Migration 0018.
 */
export const providerClients = sqliteTable(
  'provider_clients',
  {
    provider: text('provider').notNull(),
    issuer: text('issuer').notNull(),
    clientId: text('client_id').notNull(),
    clientSecret: text('client_secret'),
    redirectUri: text('redirect_uri').notNull(),
    registeredAt: text('registered_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.provider, t.issuer] })],
);

/**
 * Activities as a provider recorded them. Keyed by (user, provider, external id) so two accounts on the same athlete never
 * collide; `id` stays the row id the client knows (unique). `duplicate_of` marks a row another provider also recorded
 * (same start within two minutes, distance within 2%): it is kept but left out of status and miles. Migration 0015.
 */
export const activities = sqliteTable(
  'activities',
  {
    id: text('id').notNull(),
    userId: userId(),
    provider: text('provider').notNull().default('strava'),
    externalId: text('external_id').notNull(),
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
    /** When the detail fetch last failed; retried after 24 hours. */
    perfFailedAt: text('perf_failed_at'),
    polyline: text('polyline'),
    duplicateOf: text('duplicate_of'),
    deletedAt: text('deleted_at'),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.provider, t.externalId] }), uniqueIndex('activities_id').on(t.id), index('activities_user_date').on(t.userId, t.date)],
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

// ---------- the assistant, v2 (migration 0013) ----------

/** One conversation with the assistant. The live thread is the newest; `POST /assistant/new` starts another. */
export const assistantThreads = sqliteTable(
  'assistant_threads',
  {
    id: id(),
    userId: userId(),
    title: text('title'),
    createdAt: createdAt(),
    updatedAt: text('updated_at').notNull(),
    /** What the messages before the kept window said, in a paragraph, once the thread outgrew the model call. */
    compactedSummary: text('compacted_summary'),
  },
  (t) => [index('assistant_threads_user').on(t.userId, t.updatedAt)],
);

/** Every message of a thread as the model saw or said it: the full content blocks (tool_use and tool_result included) as JSON. */
export const assistantMessages = sqliteTable(
  'assistant_messages',
  {
    id: id(),
    threadId: text('thread_id').notNull(),
    userId: userId(),
    role: text('role').notNull(),
    contentJson: text('content_json').notNull(),
    /** The proposal (`assistant_actions.id`) an assistant message carried, when it called propose_changes. */
    actionId: text('action_id'),
    createdAt: createdAt(),
  },
  (t) => [index('assistant_messages_thread').on(t.threadId, t.createdAt)],
);

/** What the assistant was told to remember ("I run before work"), injected into every turn. */
export const userMemory = sqliteTable(
  'user_memory',
  {
    userId: userId(),
    key: text('key').notNull(),
    text: text('text').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);

/** Tokens per model call, for the bill. */
export const llmUsage = sqliteTable(
  'llm_usage',
  {
    id: id(),
    userId: userId(),
    kind: text('kind').notNull(),
    model: text('model').notNull(),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    cachedTokens: integer('cached_tokens').notNull().default(0),
    ms: integer('ms').notNull().default(0),
    at: text('at').notNull(),
  },
  (t) => [index('llm_usage_user_at').on(t.userId, t.at)],
);

// ---------- reminders and push (migration 0014) ----------

/** A device that takes pushes: a Web Push subscription (`endpoint_or_token` is the endpoint) or an APNs token. */
export const pushSubscriptions = sqliteTable(
  'push_subscriptions',
  {
    id: id(),
    userId: userId(),
    kind: text('kind').notNull(),
    endpointOrToken: text('endpoint_or_token').notNull(),
    p256dh: text('p256dh'),
    auth: text('auth'),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
    lastOkAt: text('last_ok_at'),
    failedAt: text('failed_at'),
  },
  (t) => [index('push_subscriptions_user').on(t.userId), uniqueIndex('push_subscriptions_endpoint').on(t.userId, t.endpointOrToken)],
);

/**
 * A reminder: fires once at `fire_at_utc` (and, with an `rrule`, again at the next occurrence). `source`: user | agent |
 * system; `dedupe_key` keeps the system's own ("goal-unset:2026-10-31") from doubling. `status`: pending | sent | cancelled.
 */
export const reminders = sqliteTable(
  'reminders',
  {
    id: id(),
    userId: userId(),
    title: text('title').notNull(),
    body: text('body'),
    route: text('route'),
    fireAtUtc: text('fire_at_utc').notNull(),
    rrule: text('rrule'),
    source: text('source').notNull().default('user'),
    assistantActionId: text('assistant_action_id'),
    dedupeKey: text('dedupe_key'),
    status: text('status').notNull().default('pending'),
    createdAt: createdAt(),
  },
  (t) => [index('reminders_due').on(t.status, t.fireAtUtc), index('reminders_user').on(t.userId, t.fireAtUtc), uniqueIndex('reminders_dedupe').on(t.userId, t.dedupeKey)],
);

/** Every push attempt: which reminder, which device, what came back. */
export const notificationLog = sqliteTable(
  'notification_log',
  {
    id: id(),
    userId: userId(),
    reminderId: text('reminder_id').notNull(),
    subscriptionId: text('subscription_id'),
    status: text('status').notNull(),
    error: text('error'),
    at: text('at').notNull(),
  },
  (t) => [index('notification_log_user').on(t.userId, t.at)],
);

// ---------- ops (migration 0017) ----------

/**
 * Advisory leases: one row per job family (`job:<name>`) and one for the migration lock. A process holds a lease by
 * name until `expires_at` (ms since the epoch); `lib/leases.ts` takes it with one upsert, so two processes on the
 * same file (the API and the worker) never run the same job at once. Created by db/index.ts before the migrations run.
 */
export const leases = sqliteTable('leases', {
  name: text('name').primaryKey(),
  holder: text('holder').notNull(),
  expiresAt: integer('expires_at').notNull(),
});

/** One row per job run (`services/ops/jobs.ts`): what ran, when, whether it worked, and what it did (`meta`, JSON). Kept 14 days. */
export const jobRuns = sqliteTable(
  'job_runs',
  {
    id: id(),
    name: text('name').notNull(),
    startedAt: text('started_at').notNull(),
    finishedAt: text('finished_at'),
    ok: integer('ok'),
    error: text('error'),
    meta: text('meta'),
  },
  (t) => [index('job_runs_name_started').on(t.name, t.startedAt), index('job_runs_started').on(t.startedAt)],
);

/** Fixed-window counters behind `lib/ratelimit.ts`: `key` is `<limit>:<user or ip>`, `window_start` ms since the epoch. */
export const rateLimits = sqliteTable('rate_limits', {
  key: text('key').primaryKey(),
  windowStart: integer('window_start').notNull(),
  count: integer('count').notNull(),
});
