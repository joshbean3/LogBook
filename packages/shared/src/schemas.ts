import { z } from 'zod';
import { isISODate } from './dates.js';
import { KINDS } from './sessions.js';
import { MAX_STEPS, STEP_MINS_MAX, STEP_NAME_MAX } from './morning.js';

export const zDate = z.string().refine(isISODate, 'Expected YYYY-MM-DD');
export const zMonth = z.string().regex(/^\d{4}-\d{2}$/, 'Expected YYYY-MM');
export const zKind = z.enum(['run', 'lift', 'cross', 'rest']);
export const zMark = z.enum(['done', 'floor', 'skip', 'sick']);

export const zRange = z.object({ from: zDate, to: zDate }).refine((r) => r.from <= r.to, 'from must be on or before to');

// ---------- auth ----------
export const zCredentials = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(200),
});

// ---------- sessions ----------
export const zSessionInput = z.object({
  id: z.string().min(1).max(40).optional(),
  date: zDate,
  kind: zKind,
  type: z.string().trim().max(30).nullable().optional(),
  title: z.string().trim().max(60).nullable().optional(),
  details: z.string().trim().max(600).nullable().optional(),
  miles: z.number().min(0).max(200).nullable().optional(),
  minutes: z.number().int().min(0).max(1440).nullable().optional(),
});
export type SessionInput = z.infer<typeof zSessionInput>;

export const zMoveSession = z.object({ to: zDate });
export const zMarkSession = z.object({ mark: zMark.nullable() });

// ---------- habits ----------
export const zHabitInput = z.object({ name: z.string().trim().min(1).max(80) });
export const zHabitsReorder = z.object({ order: z.array(z.string()).max(100) });
export const zHabitCheck = z.object({
  done: z.boolean().optional(),
  note: z.string().max(280).nullable().optional(),
});

// ---------- lifts ----------
export const zLiftInput = z.object({
  date: zDate,
  exercise: z.string().trim().min(1).max(60),
  weight: z.number().min(0).max(2000),
  reps: z.number().int().min(1).max(500),
});

// ---------- todos ----------
export const zTodoPriority = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);
export const zTodoColor = z.enum(['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink']);
export const zTodoGroupInput = z.object({ name: z.string().trim().min(1).max(30), color: zTodoColor });
export const zTodoGroupPatch = z.object({ name: z.string().trim().min(1).max(30).optional(), color: zTodoColor.optional(), position: z.number().int().min(0).max(10_000).optional() });
export const zTodoBucket = z.enum(['today', 'later', 'someday']);
export const zTodoInput = z.object({
  text: z.string().trim().min(1).max(200),
  date: zDate,
  priority: zTodoPriority.optional(),
  due: zDate.nullable().optional(),
  bucket: zTodoBucket.optional(),
  color: zTodoColor.nullable().optional(),
  groupId: z.string().min(1).max(64).nullable().optional(),
});
export const zTodosReorder = z.object({ order: z.array(z.string().min(1).max(64)).min(1).max(500) });
export const zTodoPatch = z.object({
  text: z.string().trim().min(1).max(200).optional(),
  /** A small note under the name; empty or null clears it. */
  note: z.string().trim().max(500).nullable().optional(),
  priority: zTodoPriority.optional(),
  /** Its own highlight; null clears it. */
  color: zTodoColor.nullable().optional(),
  /** The list it is in; null takes it out. */
  groupId: z.string().min(1).max(64).nullable().optional(),
  /** The day a Later item is for; null clears it. */
  due: zDate.nullable().optional(),
  bucket: zTodoBucket.optional(),
  position: z.number().int().min(0).max(1_000_000).optional(),
  /** Date it was checked off, or null to uncheck. */
  doneOn: zDate.nullable().optional(),
  /** Date it was deleted from (history before stays), or null to restore. */
  deletedOn: zDate.nullable().optional(),
});

// ---------- morning ----------
export const zMorningSettingsPatch = z.object({
  wake: z.number().int().min(0).max(1439).optional(),
  run: z.object({ pace: z.number().int().min(240).max(1200).optional(), wakeup: z.number().int().min(0).max(180).optional(), buffer: z.number().int().min(0).max(180).optional() }).optional(),
  gym: z.object({ length: z.number().int().min(0).max(240).optional(), walk: z.number().int().min(0).max(180).optional(), wakeup: z.number().int().min(0).max(180).optional() }).optional(),
  after: z
    .object({
      showerMode: z.enum(['fixed', 'after']).optional(),
      showerAt: z.number().int().min(0).max(1439).optional(),
      shower: z.number().int().min(0).max(180).optional(),
      ready: z.number().int().min(0).max(180).optional(),
      smoothie: z.number().int().min(0).max(180).optional(),
      prep: z.number().int().min(0).max(180).optional(),
      /** The back-home blocks in order: the four built-in keys and the athlete's own step ids, each once. */
      order: z
        .array(z.union([z.enum(['shower', 'ready', 'smoothie', 'prep']), z.string().regex(/^s_[a-z0-9]{4,16}$/)]))
        .min(4)
        .max(4 + MAX_STEPS)
        .refine((a) => new Set(a).size === a.length, { message: 'each block once' })
        .optional(),
      /** Steps of the athlete's own, the whole list (it replaces the stored one). */
      steps: z
        .array(z.object({ id: z.string().regex(/^s_[a-z0-9]{4,16}$/), name: z.string().trim().min(1).max(STEP_NAME_MAX), mins: z.number().int().min(1).max(STEP_MINS_MAX) }))
        .max(MAX_STEPS)
        .refine((a) => new Set(a.map((x) => x.id)).size === a.length, { message: 'each step once' })
        .optional(),
      /** The athlete's own names for the blocks ("Out the door"); an empty string goes back to the default name. */
      names: z.object({ shower: z.string().trim().max(30), ready: z.string().trim().max(30), smoothie: z.string().trim().max(30), prep: z.string().trim().max(30) }).partial().optional(),
    })
    .optional(),
  focus: z.object({ word: z.string().max(40), quote: z.string().max(400), by: z.string().max(80) }).optional(),
});
/**
 * PUT /morning/days/:date: the alarm for one morning, and nothing else (spec §4.3). The legacy `mode/type/miles/minutes`
 * an old client or a queued write may still send are stripped (zod drops unknown keys), never rejected.
 */
export const zMorningDay = z.object({
  wake: z.number().int().min(0).max(1439),
});

// ---------- journal ----------
export const zJournalInput = z.object({ date: zDate, text: z.string().trim().min(1).max(5000) });
export const zJournalPatch = z.object({ text: z.string().trim().min(1).max(5000).optional(), fav: z.boolean().optional() });
export const zQuoteInput = z.object({ text: z.string().trim().min(3).max(400), author: z.string().trim().max(80).default('') });
export const zPickKind = z.enum(['memory', 'quote']);

// ---------- plan builder ----------
export const zPlanMode = z.enum(['file', 'text', 'describe', 'revise']);
export const zPlanDraftRequest = z.object({
  mode: zPlanMode,
  text: z.string().max(200000).optional(),
  instructions: z.string().max(4000).optional(),
  start: zDate,
  end: zDate.optional(),
});
/** What Claude returns, after cleaning. */
export const zPlanSession = z.object({
  date: zDate,
  kind: zKind,
  type: z.string().nullable(),
  title: z.string().nullable(),
  details: z.string().nullable(),
  miles: z.number().nullable(),
  minutes: z.number().nullable(),
});
export const zPlanDraft = z.object({
  name: z.string().min(1).max(80),
  summary: z.string().max(300),
  notes: z.array(z.string().max(220)).max(5),
  start: zDate,
  end: zDate,
  sessions: z.array(zPlanSession).min(1).max(600),
});
export type PlanDraft = z.infer<typeof zPlanDraft>;
export const zPlanApply = z.object({
  draft: zPlanDraft,
  mode: z.enum(['replace', 'add']),
  source: zPlanMode.or(z.literal('chat')).optional(),
  /**
   * The plan stops at its last day: anything only planned after it is cleared, and a block still running past its start
   * ends the day before (one that starts inside it or later goes). Marked sessions are history and always stay.
   */
  only: z.boolean().optional(),
});

/** The shape Claude is asked to produce. Kept loose; cleaned server-side. */
export const zClaudePlanOutput = z.object({
  name: z.string(),
  summary: z.string(),
  start: z.string(),
  end: z.string(),
  notes: z.array(z.string()),
  sessions: z.array(
    z.object({
      date: z.string(),
      kind: z.enum([...KINDS] as [string, ...string[]]),
      type: z.string(),
      title: z.string(),
      details: z.string(),
      miles: z.number().nullable(),
      minutes: z.number().nullable(),
    }),
  ),
});

export const zCoachRequest = z.object({ date: zDate, sessionId: z.string().nullable().optional() });

// ---------- reads ----------
const zTag = z.string().trim().min(1).max(30);
export const zLinkInput = z.object({
  url: z.string().trim().min(4).max(2000),
  note: z.string().trim().max(500).optional(),
});
export const zLinkPatch = z.object({
  /** ISO timestamp when read, or null to mark unread. */
  readAt: z.iso.datetime({ offset: true }).max(40).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
  tags: z.array(zTag).max(8).optional(),
  verdict: z.enum(['saved', 'dismissed']).nullable().optional(),
});
export const zPickFeedback = z.object({ id: z.string().min(1).max(40), verdict: z.enum(['saved', 'dismissed']) });
/** The shape the daily pick comes back in. Kept loose; cleaned server-side. */
export const zReadsPickOutput = z.object({
  url: z.string(),
  title: z.string(),
  why: z.string(),
  tags: z.array(z.string()),
});
export type ReadsPickOutput = z.infer<typeof zReadsPickOutput>;

// ---------- plan templates ----------
export const zWeekday = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
export type Weekday = z.infer<typeof zWeekday>;
export const zGoal = z.enum(['base', '5k', '10k', 'half', 'marathon']);
export type Goal = z.infer<typeof zGoal>;
/** Longest block a template builds, in full weeks. */
export const TEMPLATE_MAX_WEEKS = 30;
export const zTemplateInput = z
  .object({
    goal: zGoal,
    /** Full Monday-to-Sunday weeks. Optional: defaults by goal; ignored when `raceDate` is given (the race sets the length). */
    weeks: z.number().int().min(1).max(TEMPLATE_MAX_WEEKS).optional(),
    startDate: zDate,
    runDays: z.array(zWeekday).min(1).max(7),
    longRunDay: zWeekday,
    /** The athlete's current weekly miles: week 1's volume. */
    weeklyMiles: z.number().min(3).max(150),
    raceDate: zDate.nullable().optional(),
  })
  .refine((t) => !t.raceDate || t.raceDate > t.startDate, { message: 'raceDate must be after startDate', path: ['raceDate'] });
export type TemplateInput = z.input<typeof zTemplateInput>;
/** `POST /plans/template`: a template, and whether to clear future planned (not done) sessions in its window first. */
export const zTemplateRequest = zTemplateInput.and(z.object({ replace: z.boolean().optional() }));

// ---------- onboarding and account ----------
/** A clock time as minutes after midnight, or `HH:MM`. */
export const zClockMinutes = z.union([z.number().int().min(0).max(1439), z.string().regex(/^\d{1,2}:\d{2}$/, 'Expected HH:MM')]).transform((v, ctx) => {
  if (typeof v === 'number') return v;
  const [h, m] = v.split(':').map(Number) as [number, number];
  if (h > 23 || m > 59) {
    ctx.addIssue({ code: 'custom', message: 'Expected a time of day' });
    return z.NEVER;
  }
  return h * 60 + m;
});
/** Run pace in seconds per mile (240..1200), or `m:ss`. */
export const zPace = z.union([z.number().int().min(240).max(1200), z.string().regex(/^\d{1,2}:\d{2}$/, 'Expected m:ss')]).transform((v, ctx) => {
  if (typeof v === 'number') return v;
  const [m, s] = v.split(':').map(Number) as [number, number];
  const sec = m * 60 + s;
  if (s > 59 || sec < 240 || sec > 1200) {
    ctx.addIssue({ code: 'custom', message: 'Pace must be between 4:00 and 20:00 per mile' });
    return z.NEVER;
  }
  return sec;
});
export const zOnboarding = z
  .object({
    goal: zGoal,
    raceDate: zDate.nullable().optional(),
    runDays: z.array(zWeekday).min(1).max(7),
    longRunDay: zWeekday,
    weeklyMiles: z.number().min(3).max(150),
    /** Alarm. */
    wake: zClockMinutes,
    /** When they leave for work: the end of the morning timeline. */
    leave: zClockMinutes,
    pace: zPace.nullable().optional(),
    habits: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
    /** When the first block starts: the coming Monday (default) or tomorrow. */
    start: z.enum(['monday', 'tomorrow']).default('monday'),
    /** The client's local date, so "tomorrow" and "next Monday" are the athlete's, not the server's. Defaults to the server's date. */
    today: zDate.optional(),
  })
  .refine((o) => o.leave > o.wake, { message: 'leave must be after wake', path: ['leave'] });
export type OnboardingInput = z.infer<typeof zOnboarding>;

/** The training answers kept on the account (goal, race day, run days, long-run day, weekly miles). No race day with `base`. */
export const zTrainingProfile = z.object({
  goal: zGoal,
  raceDate: zDate.nullable(),
  runDays: z.array(zWeekday).min(1).max(7),
  longRunDay: zWeekday,
  weeklyMiles: z.number().min(3).max(150),
});
export type TrainingProfile = z.infer<typeof zTrainingProfile>;
/** What `GET /me` and the bootstrap carry: the answers and when they were last saved (a newer plan block speaks for itself). */
export type SavedTrainingProfile = TrainingProfile & { updatedAt: string };
/** `PATCH /me/training`: any of the answers; the rest keep their stored values. */
export const zTrainingPatch = zTrainingProfile.partial().refine((o) => Object.keys(o).length > 0, { message: 'Nothing to change' });
export const zDeleteAccount = z.object({ password: z.string().min(1).max(200) });

// ---------- fix round contracts (docs/platform.md §7–§11) ----------

/** `PATCH /me`: the account's name ("Josh"); an empty string or null clears it. */
export const zMePatch = z
  .object({ name: z.string().trim().max(60).nullable().optional(), profileNote: z.string().trim().max(1000).nullable().optional() })
  .refine((o) => o.name !== undefined || o.profileNote !== undefined, { message: 'Nothing to change' });

/** What `POST /plans/template` did to a block the new one overlapped: ended it the day before (`prevEnd` was its end), or deleted it (it had not started). */
export const zEndedBlock = z.union([z.object({ id: z.string().min(1).max(64), prevEnd: zDate }), z.object({ id: z.string().min(1).max(64), deleted: z.literal(true) })]);
export type EndedBlock = z.infer<typeof zEndedBlock>;

/** `POST /plans/template/undo`: send back what `POST /plans/template` answered. */
export const zTemplateUndo = z.object({
  blockId: z.string().min(1).max(64),
  replacedIds: z.array(z.string().min(1).max(64)).max(5000).default([]),
  endedBlock: zEndedBlock.nullable().optional(),
  /** Every block it ended (`endedBlock` is the first of these); either works. */
  endedBlocks: z.array(zEndedBlock).max(100).optional(),
});
export type TemplateUndoInput = z.infer<typeof zTemplateUndo>;

// ---------- goals ----------
export const zGoalLevel = z.enum(['year', 'month', 'week', 'day']);
/** Set (or replace) the goal of one period. */
export const zGoalStep = z.object({ id: z.string().min(1).max(40), text: z.string().trim().min(1).max(120), done: z.boolean() });
export const zGoalSteps = z.array(zGoalStep).max(5);
export const zGoalPut = z.object({
  text: z.string().trim().min(1).max(400),
  /** The owner's own words, when the review rewrote them. */
  original: z.string().trim().max(400).nullable().optional(),
  why: z.string().trim().max(300).nullable().optional(),
  /** Which the owner chose after the review: the sharpened words, or his own. */
  chose: z.enum(['sharpened', 'kept', 'own']).optional(),
  steps: zGoalSteps.optional(),
});
export const zGoalPatch = z.object({
  status: z.enum(['open', 'done', 'partly', 'missed']).optional(),
  reflection: z.string().trim().max(500).nullable().optional(),
  /** The whole list, as it now stands: checks, adds, removes and edits all go this way. */
  steps: zGoalSteps.optional(),
});
export const zGoalRefine = z.object({ level: zGoalLevel, period: z.string().min(4).max(10), text: z.string().trim().min(1).max(400) });
/** What Claude returns for a goal review. */
export const zClaudeGoalOutput = z.object({ goal: z.string(), why: z.string(), changed: z.boolean(), steps: z.array(z.string()) });

// ---------- reminders and push ----------
export const zClockTime = z.string().regex(/^\d{2}:\d{2}$/, 'Expected HH:MM');
/** Daily, or weekly on named days (`weekly:mon,wed`). Stored as `FREQ=DAILY` / `FREQ=WEEKLY;BYDAY=MO,WE`. */
export const zRrule = z.string().regex(/^(daily|weekly:(mon|tue|wed|thu|fri|sat|sun)(,(mon|tue|wed|thu|fri|sat|sun))*|FREQ=DAILY|FREQ=WEEKLY;BYDAY=(MO|TU|WE|TH|FR|SA|SU)(,(MO|TU|WE|TH|FR|SA|SU))*)$/, 'daily, or weekly:mon,wed');
/**
 * `POST /reminders`: a title, when (`at` as an ISO datetime with its offset, or a local `date` + `time` read in the
 * account's time zone), an optional repeat, and the route a tap opens.
 */
export const zReminderInput = z
  .object({
    title: z.string().trim().min(1).max(120),
    body: z.string().trim().max(300).nullable().optional(),
    route: z.string().trim().max(120).regex(/^\/[\w\-/?=&.%]*$/, 'a path inside the app').nullable().optional(),
    at: z.iso.datetime({ offset: true }).optional(),
    date: zDate.optional(),
    time: zClockTime.optional(),
    rrule: zRrule.nullable().optional(),
  })
  .refine((r) => !!r.at || (!!r.date && !!r.time), { message: 'Give at, or date and time', path: ['at'] });
export type ReminderInput = z.infer<typeof zReminderInput>;

export const zQuietHours = z.object({ start: zClockTime, end: zClockTime }).nullable();
/** `PATCH /notifications/settings`: the two system reminders and quiet hours. */
export const zNotificationSettingsPatch = z.object({
  goalUnset: z.boolean().optional(),
  tomorrow: z.boolean().optional(),
  quietHours: zQuietHours.optional(),
});
export const zPushSubscribe = z.object({
  kind: z.enum(['webpush', 'apns']),
  endpoint: z.string().min(8).max(2000),
  keys: z.object({ p256dh: z.string().max(400), auth: z.string().max(200) }).optional(),
  userAgent: z.string().max(200).optional(),
});
export const zPushUnsubscribe = z.object({ endpoint: z.string().min(8).max(2000) });

// ---------- the day (docs/today-v6.md §5) ----------
/** A range of the clock in minutes from midnight, 0..1439, the start before the end. */
const zMinuteRange = z.object({ start: z.number().int().min(0).max(1439), end: z.number().int().min(0).max(1439) }).refine((r) => r.start < r.end, { message: 'start must be before end', path: ['end'] });
/** `user_settings` key `day`: the timeline's window and the work hours (`GET/PATCH /me/day`; the bootstrap's `daySettings`). */
export const zDaySettings = z.object({ window: zMinuteRange, workHours: zMinuteRange });
export type DaySettings = z.infer<typeof zDaySettings>;
export const zDaySettingsPatch = z.object({ window: zMinuteRange.optional(), workHours: zMinuteRange.optional() }).refine((p) => p.window !== undefined || p.workHours !== undefined, { message: 'Nothing to change' });
/** 6:00 to 23:00, working 9:00 to 18:00. */
export const DEFAULT_DAY_SETTINGS: DaySettings = { window: { start: 360, end: 1380 }, workHours: { start: 540, end: 1080 } };
