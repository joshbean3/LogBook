import type { Aim, GoalEvent } from './goals.js';
import type { ISODate } from './dates.js';

// ---------- training plan ----------
export type SessionKind = 'run' | 'lift' | 'cross' | 'rest';
/** `sick` is a skip for illness ("Not feeling 100%"): it reads as Skipped but keeps the week (see `weekStreak`). */
export type SessionMark = 'done' | 'floor' | 'skip' | 'sick';
export type Tone = 'easy' | 'long' | 'hard' | 'fast' | 'lift' | 'cross' | 'rest';

export interface Session {
  id: string;
  date: ISODate;
  position: number;
  kind: SessionKind;
  type: string | null;
  title: string | null;
  details: string | null;
  miles: number | null;
  minutes: number | null;
  blockId: string | null;
  movedFrom: ISODate | null;
  /** What the athlete said about it. Strava can also complete a session without a mark. */
  mark: SessionMark | null;
}

export type SessionStatus = 'done' | 'floor' | 'skipped' | 'missed' | 'open' | 'upcoming' | 'rest';
export type DayStatus = SessionStatus | 'bonus' | 'empty';

export interface PlanBlock {
  id: string;
  name: string;
  start: ISODate;
  end: ISODate;
  source: string | null;
  summary: string | null;
  createdAt: string;
  sessionCount?: number;
}

// ---------- what actually happened ----------
export type ActivityKind = 'run' | 'lift' | 'cross';
/** One lap/split: [meters, movingSeconds, avgHr | null] */
export type Lap = [number, number, number | null];

export interface Activity {
  id: string;
  date: ISODate;
  /** `HH:MM` local start time */
  time: string | null;
  name: string;
  sportType: string;
  kind: ActivityKind;
  miles: number;
  movingSec: number;
  elevFt: number;
  avgHr: number | null;
  maxHr: number | null;
  cadence: number | null;
  laps: Lap[] | null;
  /** When the per-activity detail (laps, HR) was last fetched. */
  perfAt: string | null;
  /** Strava's encoded summary polyline of the route, when the activity has one. */
  polyline: string | null;
}

export interface HrZone {
  zone: number;
  min: number;
  max: number | null;
}

// ---------- habits, logs ----------
export interface Habit {
  id: string;
  name: string;
  position: number;
  createdOn: ISODate;
  archivedOn: ISODate | null;
}

export interface HabitCheck {
  habitId: string;
  date: ISODate;
  done: boolean;
  note: string | null;
}

export interface LiftSet {
  id: string;
  date: ISODate;
  exercise: string;
  weight: number;
  reps: number;
  createdAt: string;
}

/** 0 none, then P3 (1), P2 (2), P1 (3): a higher number matters more. Each is a flag in its own colour. */
export type TodoPriority = 0 | 1 | 2 | 3;
/** A highlight a to-do (or a list) carries: a colour bar at the row's edge. */
export type TodoColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink';
export const TODO_COLORS: readonly TodoColor[] = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'];

/** A named list of to-dos ("Work", "Home"), with its colour and its place among the lists. */
export interface TodoGroup {
  id: string;
  name: string;
  color: TodoColor;
  position: number;
  createdAt: string;
}
/** When it is for: Today (the working list), Later (a date or just "not today"), Someday (parked). */
export type TodoBucket = 'today' | 'later' | 'someday';

export interface Todo {
  id: string;
  text: string;
  /** A small note under the name; null when there is none. */
  note: string | null;
  priority: TodoPriority;
  /** Its own highlight; null shows its list's colour (or none). */
  color: TodoColor | null;
  /** The list it belongs to; null when it is in none. */
  groupId: string | null;
  /** The date a Later item is for; it surfaces into Today on that day. */
  due: ISODate | null;
  bucket: TodoBucket;
  /** Manual order inside a bucket, set by dragging. */
  position: number;
  createdOn: ISODate;
  doneOn: ISODate | null;
  deletedOn: ISODate | null;
  createdAt: string;
}

export interface CoachRead {
  date: ISODate;
  key: string;
  text: string;
  createdAt: string;
}

// ---------- journal ----------
export interface JournalEntry {
  id: string;
  date: ISODate;
  text: string;
  createdAt: string;
  editedAt: string | null;
  fav: boolean;
}

export interface Quote {
  id: string;
  text: string;
  author: string;
  theme: string;
  work: string;
  /** Written by the athlete. */
  mine: boolean;
  fav: boolean;
}

export const QUOTE_THEMES = ['Living', 'The mind', 'Time', 'Acceptance', 'Self-respect', 'Love & people', 'Courage', 'Work', 'Solitude'] as const;

// ---------- morning ----------
export type MorningMode = 'run' | 'gym' | 'rest';
/** The four back-home blocks of the morning routine, which the athlete can put in any order. */
export type MorningAfterKey = 'shower' | 'ready' | 'smoothie' | 'prep';
/** A step the athlete added to the back-home routine ("Walk the dog"): its id starts `s_`. */
export type MorningStepId = `s_${string}`;
/** A slot in the back-home order: one of the four built-in blocks, or a step of the athlete's own. */
export type RoutineKey = MorningAfterKey | MorningStepId;
export interface MorningStep {
  id: MorningStepId;
  name: string;
  /** minutes, 1 to 180 */
  mins: number;
}
export interface MorningSettings {
  /** minutes after midnight */
  wake: number;
  run: { pace: number; wakeup: number; buffer: number };
  gym: { length: number; walk: number; wakeup: number };
  /**
   * Back home: the routine starts at `showerAt` (fixed) or straight after the workout, and runs its four blocks in `order`
   * (each key once; default shower, get ready, smoothie, final prep), with the athlete's own `steps` slotted in among them.
   * The leave time is the end of the last block either way.
   */
  after: {
    showerMode: 'fixed' | 'after';
    showerAt: number;
    shower: number;
    ready: number;
    smoothie: number;
    prep: number;
    order: RoutineKey[];
    /** Steps of the athlete's own, placed by their id in `order` (at most MAX_STEPS). */
    steps?: MorningStep[];
    /** The athlete's own names for the blocks (onboarding names the smoothie slot "Breakfast" or "Coffee" from its chips); `afterLabel` falls back to AFTER_LABELS. */
    names?: Partial<Record<MorningAfterKey, string>>;
  };
  focus: { word: string; quote: string; by: string };
}
/**
 * One morning's own setting (spec §4.3, M16): only the alarm. The session is the run, so the workout comes from the
 * session and never from here. Stored rows still carry the old `mode/type/miles/minutes` columns (neutral fillers that
 * nothing reads); every reader drops them.
 */
export interface MorningDayOverride {
  wake: number;
}
/**
 * A morning day as exports wrote it before the one-editor change (and still write it: the exporter keeps the stored
 * columns), so an old export file still imports. Nothing but the exporter and the import reads the four extra fields.
 */
export type LegacyMorningDay = MorningDayOverride & Partial<{ mode: MorningMode; type: string; miles: number; minutes: number }>;

// ---------- integrations ----------
export type ProviderId = 'strava' | 'coros';
export type ConnectionState = 'ok' | 'needs_reauth' | 'error' | 'revoked' | 'disconnected';
/** One integration as Settings → Connections shows it (`GET /connections`). */
export interface ProviderConnection {
  provider: ProviderId;
  name: string;
  configured: boolean;
  connected: boolean;
  status: ConnectionState;
  athleteName: string | null;
  lastSyncAt: string | null;
  syncing: boolean;
  error: string | null;
}

export interface StravaStatus {
  connected: boolean;
  status?: ConnectionState;
  athleteName: string | null;
  lastSyncAt: string | null;
  syncing: boolean;
  error: string | null;
  configured: boolean;
}

// ---------- reads ----------
/** Where a link came from: saved by the athlete, or offered as a daily pick. */
export type LinkSource = 'me' | 'pick';
/** What the athlete said about a pick. Null until they do. */
export type LinkVerdict = 'saved' | 'dismissed';

export interface Link {
  id: string;
  url: string;
  title: string;
  siteName: string;
  description: string | null;
  imageUrl: string | null;
  note: string | null;
  tags: string[];
  addedAt: string;
  /** When it was opened and read; null while it still waits. */
  readAt: string | null;
  source: LinkSource;
  /** For a pick: the one sentence on why it fits. */
  pickReason: string | null;
  /** For a pick: the day it was offered. */
  pickDate: ISODate | null;
  verdict: LinkVerdict | null;
}

/** Today's pick, or why there is none: `off` when picks are not configured, `empty` before there is anything to learn from, `limit` when today's refreshes are used up, `failed` when the search came back empty. */
export interface PickResult {
  date: ISODate;
  pick: Link | null;
  reason: 'off' | 'empty' | 'limit' | 'failed' | null;
  /** How many more manual refreshes are left today. */
  refreshesLeft: number;
}

// ---------- fix round contracts: plan writes with Undo, export v2 ----------

/** A block `POST /plans/template` ended the day before the new one (`prevEnd` was its end) or deleted (it had not started). */
export type EndedBlockRef = { id: string; prevEnd: ISODate } | { id: string; deleted: true };

/** `POST /plans/template` (201). `removed` is `replacedIds.length`. Keep the whole answer for Undo (`POST /plans/template/undo`). */
export interface TemplateAppliedV2 {
  block: PlanBlock;
  months: string[];
  removed: number;
  /** The planned, not-done sessions it soft-deleted (Undo restores exactly these). */
  replacedIds: string[];
  /** The active block it overlapped, if any: ended at startDate − 1, or deleted when it had not started. */
  endedBlock?: EndedBlockRef;
  /** Every block it ended or deleted (usually zero or one; `endedBlock` is the first). */
  endedBlocks: EndedBlockRef[];
}

/** One activity in an export: the stored row, lossless (meters, elapsed time, laps, route). */
export interface ExportActivity {
  id: string;
  date: ISODate;
  time: string | null;
  name: string;
  sportType: string;
  kind: ActivityKind;
  distanceM: number;
  movingSec: number;
  elapsedSec: number;
  elevM: number;
  avgHr: number | null;
  maxHr: number | null;
  cadence: number | null;
  laps: Lap[] | null;
  perfAt: string | null;
  polyline: string | null;
}

/** `GET /export` (version 2): the whole account. `POST /import` takes it back (idempotent by id). */
export interface ExportV2 {
  version: 2;
  exportedAt: string;
  user: { id: string; email: string; name: string | null; createdAt: string; onboardedAt: string | null };
  /** Every `user_settings` document by key (`morning`, …). */
  settings: Record<string, unknown>;
  trainingProfile: unknown | null;
  habits: Habit[];
  checks: HabitCheck[];
  blocks: PlanBlock[];
  sessions: Session[];
  activities: ExportActivity[];
  lifts: LiftSet[];
  todos: Todo[];
  journal: JournalEntry[];
  quotes: { own: Array<{ id: string; text: string; author: string; createdAt: string }>; prefs: Array<{ quoteId: string; fav: boolean; hidden: boolean }> };
  links: Link[];
  morningDays: Record<ISODate, LegacyMorningDay>;
  coach: CoachRead[];
  /** To-do lists (since goals and lists landed; absent in older exports). */
  todoGroups?: TodoGroup[];
  goals?: Aim[];
  goalEvents?: GoalEvent[];
}

// ---------- reminders ----------
export type ReminderSource = 'user' | 'agent' | 'system';
export type ReminderStatus = 'pending' | 'sent' | 'cancelled';
export interface Reminder {
  id: string;
  title: string;
  body: string | null;
  route: string | null;
  /** ISO instant. */
  fireAtUtc: string;
  /** The wall clock in the account's time zone, for the list. */
  local: { date: string; time: string } | null;
  rrule: string | null;
  source: ReminderSource;
  status: ReminderStatus;
  createdAt: string;
}
export interface NotificationSettings {
  /** "Today's goal is unset", fifteen minutes after the alarm. */
  goalUnset: boolean;
  /** "Tomorrow: Easy 5, out the door 6:50", at 21:00. */
  tomorrow: boolean;
  quietHours: { start: string; end: string } | null;
  timezone: string | null;
}
