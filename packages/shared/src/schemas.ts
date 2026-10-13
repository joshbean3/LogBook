import { z } from 'zod';
import { isISODate } from './dates.js';
import { KINDS } from './sessions.js';

export const zDate = z.string().refine(isISODate, 'Expected YYYY-MM-DD');
export const zMonth = z.string().regex(/^\d{4}-\d{2}$/, 'Expected YYYY-MM');
export const zKind = z.enum(['run', 'lift', 'cross', 'rest']);
export const zMark = z.enum(['done', 'floor', 'skip']);

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
