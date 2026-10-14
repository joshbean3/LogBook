import { z } from 'zod';
import { isISODate } from './dates.js';
import { KINDS } from './sessions.js';

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
export const zTodoPriority = z.union([z.literal(0), z.literal(1), z.literal(2)]);
export const zTodoBucket = z.enum(['today', 'later', 'someday']);
export const zTodoInput = z.object({
  text: z.string().trim().min(1).max(200),
  date: zDate,
  priority: zTodoPriority.optional(),
  due: zDate.nullable().optional(),
  bucket: zTodoBucket.optional(),
});
export const zTodosReorder = z.object({ order: z.array(z.string().min(1).max(64)).min(1).max(500) });
export const zTodoPatch = z.object({
  text: z.string().trim().min(1).max(200).optional(),
  /** A small note under the name; empty or null clears it. */
  note: z.string().trim().max(500).nullable().optional(),
  priority: zTodoPriority.optional(),
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
      /** The back-home blocks in order: all four keys, each once. */
      order: z
        .array(z.enum(['shower', 'ready', 'smoothie', 'prep']))
        .length(4)
        .refine((a) => new Set(a).size === a.length, { message: 'each block once' })
        .optional(),
      /** The athlete's own names for the blocks ("Out the door"); an empty string goes back to the default name. */
      names: z.object({ shower: z.string().trim().max(30), ready: z.string().trim().max(30), smoothie: z.string().trim().max(30), prep: z.string().trim().max(30) }).partial().optional(),
    })
    .optional(),
  focus: z.object({ word: z.string().max(40), quote: z.string().max(400), by: z.string().max(80) }).optional(),
});
export const zMorningDay = z.object({
  mode: z.enum(['run', 'gym', 'rest']),
  type: z.string().trim().min(1).max(30),
  miles: z.number().min(0.5).max(40),
  minutes: z.number().int().min(5).max(240),
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
export const zMePatch = z.object({ name: z.string().trim().max(60).nullable() });

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
