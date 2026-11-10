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
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;
/**
 * The passwords people pick most, which the sign-up, reset and change-password forms refuse (the server refuses the same
 * list). Lower case; the check ignores case.
 */
export const COMMON_PASSWORDS: ReadonlySet<string> = new Set([
  'password', 'password1', 'password12', 'password123', 'password1234', 'passw0rd', 'p@ssw0rd', 'p@ssword', 'pass1234', 'password!',
  '12345678', '123456789', '1234567890', '0123456789', '87654321', '0987654321', '11111111', '00000000', '12341234', '11223344',
  '123123123', '1q2w3e4r', '1q2w3e4r5t', '1qaz2wsx', 'qwertyui', 'qwertyuiop', 'qwerty123', 'qwerty12', 'qwerty1234', 'asdfghjk',
  'asdfghjkl', 'asdf1234', 'zxcvbnm1', 'zxcvbnm123', 'abcd1234', 'abc12345', 'abcdefgh', 'abcdefg1', 'a1b2c3d4', 'aa123456',
  'iloveyou', 'iloveyou1', 'iloveyou2', 'letmein1', 'letmein123', 'welcome1', 'welcome123', 'admin123', 'administrator', 'changeme',
  'changeme1', 'trustno1', 'sunshine', 'sunshine1', 'princess', 'princess1', 'football', 'football1', 'baseball', 'baseball1',
  'basketball', 'superman', 'superman1', 'batman123', 'starwars', 'starwars1', 'computer', 'computer1', 'internet', 'whatever',
  'whatever1', 'michael1', 'jennifer', 'jordan23', 'michelle', 'charlie1', 'liverpool', 'chocolate', 'butterfly', 'master123',
  'dragon123', 'monkey123', 'shadow123', 'mustang1', 'samsung1', 'google123', 'logbook1', 'logbook123', 'orby1234', 'orby12345', 'running1', 'running123',
  'marathon', 'marathon1', 'test1234', 'testtest', 'secret123', 'hello123', 'freedom1', 'qazwsxedc', 'q1w2e3r4', 'zaq12wsx',
]);
/**
 * Why a new password cannot be used, as a sentence to show, or null when it can: too short or too long, one of the most
 * common passwords, one character repeated, or the same as the account's email. Sign-up, reset and change password all
 * use it, on the device and on the server.
 */
export const passwordProblem = (password: string, email?: string | null): string | null => {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Keep your password under ${PASSWORD_MAX} characters.`;
  const p = password.trim().toLowerCase();
  if (!p || new Set(p).size === 1) return 'That password is too easy to guess. Pick another.';
  if (COMMON_PASSWORDS.has(p)) return 'That password is too common. Pick another.';
  const e = email?.trim().toLowerCase();
  if (e && (p === e || p === e.split('@')[0])) return 'Your password cannot be your email.';
  return null;
};

export const zCredentials = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(PASSWORD_MIN).max(PASSWORD_MAX),
});
/** POST /auth/login: any password the account might have been given, so an older weak one still signs in. */
export const zLogin = z.object({ email: zCredentials.shape.email, password: z.string().min(1).max(PASSWORD_MAX) });
/** POST /auth/forgot: always answered `{ ok: true }`, whether or not the address has an account. */
export const zForgotPassword = z.object({ email: zCredentials.shape.email });
/** POST /auth/reset: the token from the emailed link and the new password. */
/** A token of the wrong length is not refused here: the route answers it as a spent link (400 `reset_invalid`, contract 3). */
export const zResetPassword = z.object({ token: z.string().max(2000), password: zCredentials.shape.password });
/** POST /me/password: the current password and the new one. */
export const zChangePassword = z.object({ current: z.string().min(1).max(200), next: zCredentials.shape.password });
/** POST /auth/logout: optionally the Apple Health device (`deviceId` from connect) to revoke with the session. */
export const zLogout = z.object({ healthTokenId: z.string().min(1).max(64).optional() });

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

// ---------- what I learned ----------
/** One thing learned, in a sentence or a few: trimmed, 1..1000 characters. */
export const LEARNING_MAX = 1000;
export const zLearningText = z.string().trim().min(1).max(LEARNING_MAX);
/** `date` defaults to the request's local day. */
export const zLearningInput = z.object({ date: zDate.optional(), text: zLearningText });
export const zLearningPatch = z.object({ text: zLearningText });
/** `month` ('2026-11') keeps one month; `q` keeps the ones whose words contain it (any case). */
export const zLearningQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(60),
  before: z.string().max(80).optional(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
  q: z.string().trim().min(1).max(100).optional(),
});
export const zLearning = z.object({ id: z.string(), date: zDate, text: z.string(), createdAt: z.string(), editedAt: z.string().nullable() });
export type LearningInput = z.infer<typeof zLearningInput>;
export type LearningPatch = z.infer<typeof zLearningPatch>;
export type Learning = z.infer<typeof zLearning>;
/** A page of learnings, newest first; `next` is the `before` cursor for the page after it (null at the end). */
export interface LearningPage {
  learnings: Learning[];
  next: string | null;
}
/** A month in the archive, newest first: how many things, on how many days, and the newest one's words. */
export interface LearningMonth {
  month: string;
  count: number;
  days: number;
  latest: string;
}
/** `days`: distinct days with an entry; `streak`: consecutive days ending today or yesterday; `total`: every entry. */
export interface LearningStats {
  days: number;
  streak: number;
  total: number;
}
/** `GET /learnings/echoes`: "From your archive", one learning from about a year ago, one from about a month ago, one at random (kept for the day). */
export interface LearningEchoes {
  yearAgo: Learning | null;
  monthAgo: Learning | null;
  random: Learning | null;
}

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
    /** null: "No running plan for now". Setup finishes with no block, and the run answers below may be left out. */
    goal: zGoal.nullable(),
    raceDate: zDate.nullable().optional(),
    runDays: z.array(zWeekday).min(1).max(7).optional(),
    longRunDay: zWeekday.optional(),
    weeklyMiles: z.number().min(3).max(150).optional(),
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
    /** The account's name, saved with the rest of first run. */
    name: z.string().trim().min(1).max(80).optional(),
    /** The morning routine, in the shape the morning settings use. */
    routine: zMorningSettingsPatch.optional(),
    /** When they usually train. */
    trainWhen: z.enum(['morning', 'afternoon', 'none']).optional(),
    /** When work ends (minutes after midnight), for the afternoon plan. */
    offWork: zClockMinutes.optional(),
  })
  .refine((o) => o.leave > o.wake, { message: 'leave must be after wake', path: ['leave'] })
  .refine((o) => o.goal === null || (!!o.runDays && !!o.longRunDay && o.weeklyMiles !== undefined), { message: 'A running plan needs run days, a long-run day and weekly miles', path: ['runDays'] });
export type OnboardingInput = z.infer<typeof zOnboarding>;
/** When the person usually trains and when work ends, as onboarding saved it (user setting `trainWhen`, in the bootstrap). */
export interface TrainWhenSetting {
  when: 'morning' | 'afternoon' | 'none';
  /** Minutes after midnight; null when not given. */
  offWork: number | null;
}

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
  /** The sessions the write added (`POST /plans/apply` answers them). With them only those go; needed when the write kept an existing block (a revise). */
  addedIds: z.array(z.string().min(1).max(64)).max(5000).optional(),
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

/**
 * What may go to Claude, by flow (user_settings `consent`), asked before the first use of each flow and changed in
 * Settings, Privacy. Everything is off until the person says yes.
 * - `training`: the plan, sessions, goals, to-dos and status, for the assistant, the plan builder and the goal review.
 * - `recall`: one past journal entry or learning plus the first name, for Remember when.
 * - `reads`: saved links, notes and tags, for the daily pick.
 * - `health`: stays null in 1.0. No health data goes to AI.
 * - `at`: when a choice was last stored. Null means never asked: the server then makes no Claude call at all.
 * - `version`: the wording the person agreed to.
 */
export const CONSENT_VERSION = '2026-11';
export const zConsentInput = z.object({
  training: z.boolean().optional(),
  health: z.boolean().nullable().optional(),
  /** One past journal entry or learning plus the first name, for Remember when. */
  recall: z.boolean().optional(),
  /** Saved links, notes and tags, for the daily pick. */
  reads: z.boolean().optional(),
  /** The wording the person agreed to. */
  version: z.string().max(20).nullable().optional(),
});
export type ConsentInput = z.infer<typeof zConsentInput>;
export interface Consent {
  training: boolean;
  health: boolean | null;
  recall: boolean;
  reads: boolean;
  at: string | null;
  version: string | null;
}
/** An account that never chose: nothing granted, never asked. */
export const DEFAULT_CONSENT: Consent = { training: false, health: null, recall: false, reads: false, at: null, version: null };
/** What a consent log line records: `training`, `recall`, `reads` and `health` are the switches; `apple_health` is connecting or disconnecting Apple Health. */
export const CONSENT_KINDS = ['training', 'recall', 'reads', 'health', 'apple_health'] as const;
export type ConsentKind = (typeof CONSENT_KINDS)[number];
/** One line of the append-only consent log (user_settings `consentLog`). */
export interface ConsentEvent {
  kind: ConsentKind;
  value: boolean | null;
  at: string;
  version: string | null;
}
/** The one-time feature intros (user_settings `intros`): which have been shown. Only accounts that went through first run are enrolled. */
export const INTRO_KEYS = ['plan', 'learned', 'journal'] as const;
export type IntroKey = (typeof INTRO_KEYS)[number];
export const zIntroSeen = z.object({ key: z.enum(INTRO_KEYS) });
