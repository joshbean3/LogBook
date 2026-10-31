import { z } from 'zod';
import { isISODate, type ISODate } from './dates.js';
import { KINDS } from './sessions.js';

// ---------- the assistant: what it may change, as checked operations ----------

const zDay = z.string().refine(isISODate, 'a date as YYYY-MM-DD');
const zId = z.string().min(1).max(64);
const zMiles = z.number().min(0).max(200);
const zMinutes = z.number().int().min(0).max(1440);

/**
 * Every change the assistant can propose. Nothing runs until the owner taps Apply; then all of a proposal runs in one
 * transaction, with an undo record. The server checks each one against the owner's own rows before it is shown.
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
]);
export type AssistantOp = z.infer<typeof zAssistantOp>;

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
}

export interface AssistantReply {
  text: string;
  proposal: AssistantProposal | null;
  /** False when the server has no Claude key. */
  available: boolean;
}

export const zAssistantAsk = z.object({
  /** The day the owner was looking at when he asked (the page's date). */
  date: zDay,
  turns: z
    .array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(8000) }))
    .min(1)
    .max(40),
});

export interface AssistantApplied {
  proposal: AssistantProposal;
  /** Months whose data changed, for the client to refetch. */
  months: string[];
}

export type { ISODate };
