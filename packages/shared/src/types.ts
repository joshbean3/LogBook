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

/** 0 none, 1 medium (one dot), 2 high (two dots). Never a colour. */
export type TodoPriority = 0 | 1 | 2;
/** When it is for: Today (the working list), Later (a date or just "not today"), Someday (parked). */
export type TodoBucket = 'today' | 'later' | 'someday';

export interface Todo {
  id: string;
  text: string;
  /** A small note under the name; null when there is none. */
  note: string | null;
  priority: TodoPriority;
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
export interface MorningSettings {
  /** minutes after midnight */
  wake: number;
  run: { pace: number; wakeup: number; buffer: number };
  gym: { length: number; walk: number; wakeup: number };
  /**
   * Back home: the routine starts at `showerAt` (fixed) or straight after the workout, and runs its four blocks in `order`
   * (each key once; default shower, get ready, smoothie, final prep). The leave time is the end of the last block either way.
   */
  after: { showerMode: 'fixed' | 'after'; showerAt: number; shower: number; ready: number; smoothie: number; prep: number; order: MorningAfterKey[] };
  focus: { word: string; quote: string; by: string };
}
export interface MorningDayOverride {
  mode: MorningMode;
  type: string;
  miles: number;
  minutes: number;
  wake: number;
}

// ---------- integrations ----------
export interface StravaStatus {
  connected: boolean;
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
