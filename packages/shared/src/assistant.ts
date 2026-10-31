import { z } from 'zod';
import { isISODate, type ISODate } from './dates.js';
import { zDayBands, zDaySlot } from './dayplan.js';
import { zClockMinutes, zGoal, zTemplateInput, zWeekday } from './schemas.js';
import { KINDS } from './sessions.js';

// ---------- the assistant: what it may change, as checked operations ----------

const zDay = z.string().refine(isISODate, 'a date as YYYY-MM-DD');
const zId = z.string().min(1).max(64);
const zMiles = z.number().min(0).max(200);
const zMinutes = z.number().int().min(0).max(1440);

/**
 * Every change the assistant can propose. Nothing runs until the owner taps Apply (or, for one small obviously reversible
 * change, at once with an Undo toast; `DIRECT_APPLY_OPS`); then all of a proposal runs in one transaction, with an undo
 * record. The server checks each one against the owner's own rows before it is shown.
 */
export const zAssistantOp = z.discriminatedUnion('op', [
  z.object({ op: z.literal('move_session'), id: zId, to: zDay }),
  z.object({
    op: z.literal('update_session'),
    id: zId,
    type: z.string().max(30).nullable().optional(),
    title: z.string().max(60).nullable().optional(),
    details: z.string().max(600).nullable().optional(),
    miles: zMiles.nullable().optional(),
    minutes: zMinutes.nullable().optional(),
  }),
  z.object({
    op: z.literal('add_session'),
    date: zDay,
    kind: z.enum(KINDS as unknown as [string, ...string[]]),
    type: z.string().max(30).nullable().optional(),
    title: z.string().max(60).nullable().optional(),
    details: z.string().max(600).nullable().optional(),
    miles: zMiles.nullable().optional(),
    minutes: zMinutes.nullable().optional(),
  }),
  z.object({ op: z.literal('delete_session'), id: zId }),
  z.object({ op: z.literal('mark_session'), id: zId, mark: z.enum(['done', 'floor', 'skip', 'sick']).nullable() }),
  z.object({ op: z.literal('add_todo'), text: z.string().trim().min(1).max(200), priority: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(), due: zDay.nullable().optional(), bucket: z.enum(['today', 'later', 'someday']).optional(), groupId: zId.nullable().optional() }),
  z.object({
    op: z.literal('update_todo'),
    id: zId,
    text: z.string().trim().min(1).max(200).optional(),
    priority: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(),
    due: zDay.nullable().optional(),
    bucket: z.enum(['today', 'later', 'someday']).optional(),
    groupId: zId.nullable().optional(),
    done: z.boolean().optional(),
  }),
  z.object({ op: z.literal('delete_todo'), id: zId }),
  z.object({ op: z.literal('set_goal'), level: z.enum(['year', 'month', 'week', 'day']), period: z.string().min(4).max(10), text: z.string().trim().min(1).max(400), steps: z.array(z.string().trim().min(1).max(120)).max(5).optional() }),
  z.object({ op: z.literal('review_goal'), id: zId, status: z.enum(['open', 'done', 'partly', 'missed']) }),
  // ---- v2 (docs/system.md §7): habits, the day's plan, the alarm, reminders, plan selection ----
  z.object({ op: z.literal('check_habit'), habitId: zId, date: zDay, done: z.boolean() }),
  z.object({ op: z.literal('add_habit'), name: z.string().trim().min(1).max(80) }),
  // the day's plan (docs/today-v6.md §4): timed slots, the older bands, or both; what is left out is kept as stored
  z.object({ op: z.literal('plan_day'), date: zDay, bands: zDayBands.optional(), slots: z.array(zDaySlot).max(60).optional() }).refine((o) => o.bands !== undefined || o.slots !== undefined, { message: 'Give bands, slots or both' }),
  z.object({ op: z.literal('set_alarm'), date: zDay, wake: zClockMinutes }),
  z.object({ op: z.literal('set_reminder'), title: z.string().trim().min(1).max(120), body: z.string().trim().max(300).nullable().optional(), at: z.iso.datetime({ offset: true }), route: z.string().max(120).nullable().optional() }),
  z.object({ op: z.literal('cancel_reminder'), id: zId }),
  z.object({
    op: z.literal('apply_plan_template'),
    goal: zGoal,
    startDate: zDay,
    runDays: z.array(zWeekday).min(1).max(7),
    longRunDay: zWeekday,
    weeklyMiles: zTemplateInput.shape.weeklyMiles,
    weeks: zTemplateInput.shape.weeks,
    raceDate: zDay.nullable().optional(),
    replace: z.boolean(),
  }),
]);
export type AssistantOp = z.infer<typeof zAssistantOp>;
export type AssistantOpName = AssistantOp['op'];

/** A proposal of exactly one of these applies at once (the owner gets a toast with Undo instead of a card). */
export const DIRECT_APPLY_OPS: readonly AssistantOpName[] = ['check_habit', 'mark_session', 'update_todo', 'add_todo', 'set_reminder', 'set_alarm'];
/** One obviously reversible change: in the list above, and for update_todo only a check-off. */
export const isDirectApply = (ops: readonly AssistantOp[]): boolean => {
  if (ops.length !== 1) return false;
  const op = ops[0]!;
  if (!DIRECT_APPLY_OPS.includes(op.op)) return false;
  if (op.op === 'update_todo') return op.done !== undefined && Object.keys(op).filter((k) => k !== 'op' && k !== 'id' && k !== 'done').length === 0;
  return true;
};

/** A proposed change as the owner sees it: the operation and one line in words. */
export interface AssistantChange {
  op: AssistantOp;
  label: string;
}

export type AssistantActionStatus = 'proposed' | 'applied' | 'dismissed' | 'undone';
export interface AssistantProposal {
  id: string;
  summary: string;
  changes: AssistantChange[];
  status: AssistantActionStatus;
}

/** One turn as the app keeps it: the words, and the proposal an assistant turn carried. */
export interface AssistantTurn {
  role: 'user' | 'assistant';
  text: string;
  proposal?: AssistantProposal | null;
  createdAt?: string;
}

/** The live conversation (`GET /assistant/thread`). */
export interface AssistantThread {
  id: string;
  title: string | null;
  createdAt: string;
  turns: AssistantTurn[];
}

export interface AssistantReply {
  text: string;
  proposal: AssistantProposal | null;
  /** When the proposal was applied at once (`isDirectApply`): the months whose data changed, for the client to refetch. */
  months?: string[];
  /** Likewise, the days whose plan changed. */
  dates?: string[];
  threadId?: string;
  /** False when the server has no Claude key. */
  available: boolean;
}

/** Where the owner asked from (docs/system.md §7): the tab and the object on screen. */
export const zAskContext = z.object({
  tab: z.enum(['today', 'goals', 'plan', 'journal']),
  date: zDay.optional(),
  level: z.enum(['day', 'week', 'month', 'year']).optional(),
});
export type AskContextInput = z.infer<typeof zAskContext>;

export const zAssistantAsk = z
  .object({
    /** The day the owner was looking at when asking (the page's date). */
    date: zDay,
    /** The ask. */
    text: z.string().trim().min(1).max(8000).optional(),
    /** The old client's whole conversation; only its last user turn is read now (the thread lives on the server). */
    turns: z
      .array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(8000) }))
      .min(1)
      .max(40)
      .optional(),
    context: zAskContext.optional(),
  })
  .refine((a) => !!a.text || !!a.turns?.length, { message: 'Say something', path: ['text'] });
export type AssistantAsk = z.infer<typeof zAssistantAsk>;

export interface AssistantApplied {
  proposal: AssistantProposal;
  /** Months whose data changed, for the client to refetch. */
  months: string[];
  /** Days whose plan (`GET /day-plans/:date`) changed, for the client to refetch. */
  dates?: string[];
}

export type { ISODate };
