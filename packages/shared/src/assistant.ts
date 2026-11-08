import { z } from 'zod';
import { fmtDate, isISODate, type ISODate } from './dates.js';
import { KINDS } from './sessions.js';

// ---------- the assistant: what it may change, as checked operations ----------

const zDay = z.string().refine(isISODate, 'a date as YYYY-MM-DD');
const zId = z.string().min(1).max(64);
const zMiles = z.number().min(0).max(200);
const zMinutes = z.number().int().min(0).max(1440);
/** Every change may carry a one-line reason, shown under it on its card. */
const why = { why: z.string().trim().transform((s) => s.slice(0, 140)).optional() };

/**
 * Every change the assistant can propose. Nothing runs until the owner taps Apply; then all of a proposal runs in one
 * transaction, with an undo record. The server checks each one against the owner's own rows before it is shown.
 */
export const zAssistantOp = z.discriminatedUnion('op', [
  z.object({ ...why, op: z.literal('move_session'), id: zId, to: zDay }),
  z.object({
    ...why,
    op: z.literal('update_session'),
    id: zId,
    type: z.string().max(30).nullable().optional(),
    title: z.string().max(60).nullable().optional(),
    details: z.string().max(600).nullable().optional(),
    miles: zMiles.nullable().optional(),
    minutes: zMinutes.nullable().optional(),
  }),
  z.object({
    ...why,
    op: z.literal('add_session'),
    date: zDay,
    kind: z.enum(KINDS as unknown as [string, ...string[]]),
    type: z.string().max(30).nullable().optional(),
    title: z.string().max(60).nullable().optional(),
    details: z.string().max(600).nullable().optional(),
    miles: zMiles.nullable().optional(),
    minutes: zMinutes.nullable().optional(),
  }),
  z.object({ ...why, op: z.literal('delete_session'), id: zId }),
  z.object({ ...why, op: z.literal('mark_session'), id: zId, mark: z.enum(['done', 'floor', 'skip', 'sick']).nullable() }),
  z.object({ ...why, op: z.literal('add_todo'), text: z.string().trim().min(1).max(200), priority: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(), due: zDay.nullable().optional(), bucket: z.enum(['today', 'later', 'someday']).optional(), groupId: zId.nullable().optional() }),
  z.object({
    ...why,
    op: z.literal('update_todo'),
    id: zId,
    text: z.string().trim().min(1).max(200).optional(),
    priority: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(),
    due: zDay.nullable().optional(),
    bucket: z.enum(['today', 'later', 'someday']).optional(),
    groupId: zId.nullable().optional(),
    done: z.boolean().optional(),
  }),
  z.object({ ...why, op: z.literal('delete_todo'), id: zId }),
  z.object({ ...why, op: z.literal('set_goal'), level: z.enum(['year', 'month', 'week', 'day']), period: z.string().min(4).max(10), text: z.string().trim().min(1).max(400), steps: z.array(z.string().trim().min(1).max(120)).max(5).optional() }),
  z.object({ ...why, op: z.literal('review_goal'), id: zId, status: z.enum(['open', 'done', 'partly', 'missed']) }),
]);
export type AssistantOp = z.infer<typeof zAssistantOp>;

/** A proposed change as the owner sees it: the operation and one line in words. */
export interface AssistantChange {
  op: AssistantOp;
  label: string;
  /** Why, in one line, when the assistant gave a reason. */
  reason?: string;
}

export type AssistantActionStatus = 'proposed' | 'applied' | 'dismissed' | 'undone';
export interface AssistantProposal {
  id: string;
  summary: string;
  changes: AssistantChange[];
  status: AssistantActionStatus;
  /**
   * The changes (by index) left out. Before Apply the app keeps the ones the owner removed here; after, the server says
   * which it skipped.
   */
  skipped?: number[];
}

/** What the app shows for a file sent with a turn: its name and type, and for a photo a small preview (a data URL). */
export interface AssistantFileShown {
  name: string;
  mediaType: AttachmentMediaType;
  thumb?: string;
}

/** One turn as the app keeps it: the words, the files sent with it, and the proposal an assistant turn carried. */
export interface AssistantTurn {
  role: 'user' | 'assistant';
  text: string;
  files?: AssistantFileShown[];
  proposal?: AssistantProposal | null;
  /** Up to three follow-ups the owner might send next, in his own words. */
  replies?: string[];
  /** An ask that did not go through: shown with Retry, never sent back to the assistant. */
  error?: boolean;
  /** A short summary of how the assistant reasoned, and for how many seconds (shown folded, "Thought for 6s"). */
  thoughts?: string;
  thoughtSeconds?: number;
  /** The owner stopped this answer partway: its words so far are kept, never sent back as if finished. */
  stopped?: boolean;
  /** What it looked at on the way ("Read your plan, Nov 3 to 9"), shown with its reasoning. */
  steps?: string[];
  /** The owner's verdict on an answer (thumbs), kept with the conversation. */
  rating?: 'up' | 'down';
}

// ---------- attachments: photos and PDFs sent to the assistant ----------

/** Photos go as JPEG, PNG, WebP or GIF; files as PDF. The app turns every photo into a JPEG before it sends it. */
export const ATTACHMENT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
export const ATTACHMENT_TYPES = [...ATTACHMENT_IMAGE_TYPES, 'application/pdf'] as const;
export type AttachmentMediaType = (typeof ATTACHMENT_TYPES)[number];
/**
 * Limits, in decoded bytes: Claude takes a photo up to 5 MB and a request up to 32 MB (PDFs up to 600 pages); these
 * leave room for the conversation and keep an upload from the phone quick.
 */
export const ATTACHMENT_LIMITS = { perTurn: 4, perRequest: 4, imageBytes: 5 * 1024 * 1024, pdfBytes: 10 * 1024 * 1024, requestBytes: 20 * 1024 * 1024 } as const;
/** The bytes a base64 string decodes to. */
export const base64Bytes = (b64: string) => Math.floor((b64.length * 3) / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);
export const isImageType = (t: string): t is (typeof ATTACHMENT_IMAGE_TYPES)[number] => (ATTACHMENT_IMAGE_TYPES as readonly string[]).includes(t);

export const zAttachment = z
  .object({
    name: z.string().trim().min(1).max(200),
    mediaType: z.enum(ATTACHMENT_TYPES),
    /** Base64, no data-URL prefix and no line breaks. */
    data: z.string().min(4).regex(/^[A-Za-z0-9+/]+={0,2}$/, 'base64 with no line breaks'),
  })
  .superRefine((a, ctx) => {
    const bytes = base64Bytes(a.data);
    const max = a.mediaType === 'application/pdf' ? ATTACHMENT_LIMITS.pdfBytes : ATTACHMENT_LIMITS.imageBytes;
    if (bytes > max) ctx.addIssue({ code: 'custom', path: ['data'], message: `${a.name} is over ${Math.round(max / 1024 / 1024)} MB` });
  });
export type Attachment = z.infer<typeof zAttachment>;

/**
 * An answer while it is being written (GET /assistant/jobs/:id, status running): what it is doing now, the words so far
 * (the suggested-replies line held back until it is whole), and a running summary of its reasoning.
 */
export type AssistantPhase = 'thinking' | 'reading' | 'writing' | 'proposing';
export interface AssistantLive {
  phase: AssistantPhase;
  text: string;
  thoughts: string;
  /** Seconds since the ask started, as the server counts them. */
  seconds: number;
  /** What it has looked at so far, in words. */
  steps?: string[];
}
export const PHASE_WORDS: Record<AssistantPhase, string> = { thinking: 'Thinking', reading: 'Reading your plan', writing: 'Writing', proposing: 'Drafting the changes' };

/**
 * The words of a reply as they stream: everything before the suggested-replies line, and nothing of a tag still being
 * written ("…next week.<rep" shows "…next week."), so the reader never sees markup flash.
 */
export const visibleReply = (raw: string): string => {
  const at = raw.search(/<(replies|title)>/i);
  if (at >= 0) return raw.slice(0, at).trimEnd();
  const lt = raw.lastIndexOf('<');
  const tail = raw.slice(lt).toLowerCase();
  if (lt >= 0 && ('<replies>'.startsWith(tail) || '<title>'.startsWith(tail))) return raw.slice(0, lt).trimEnd();
  return raw;
};

export interface AssistantReply {
  text: string;
  /** A short summary of the reasoning, and how long the answer took (seconds). */
  thoughts?: string;
  thoughtSeconds?: number;
  proposal: AssistantProposal | null;
  /** Up to three follow-ups in the owner's voice; none without a key or when Claude wrote none that read right. */
  replies?: string[];
  /** A short name for the conversation, on its first answer ("Moving the tempo"). */
  title?: string;
  /** What it looked at on the way. */
  steps?: string[];
  /** False when the server has no Claude key. */
  available: boolean;
}

// ---------- screen context: where the conversation was opened from ----------

export const ASSISTANT_SCREENS = ['today', 'plan', 'progress', 'goals', 'learned', 'journal'] as const;
export const zAssistantScreen = z.object({
  tab: z.enum(ASSISTANT_SCREENS),
  /** Today: the day shown. */
  date: zDay.optional(),
  /** Plan: the week shown (its Monday), or the month. */
  week: zDay.optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});
export type AssistantScreen = z.infer<typeof zAssistantScreen>;

const TAB_NAME: Record<AssistantScreen['tab'], string> = { today: 'Today', plan: 'Plan', progress: 'Progress', goals: 'Goals', learned: 'Learned', journal: 'Journal' };
/** The screen in words, as the chip shows it and the assistant reads it: "Plan, week of Nov 9", "Today, Sun Nov 8". */
export const screenLabel = (s: AssistantScreen): string => {
  const name = TAB_NAME[s.tab];
  if (s.tab === 'today' && s.date) return `${name}, ${fmtDate('dow', s.date)} ${fmtDate('md', s.date)}`;
  if (s.tab === 'plan' && s.week) return `${name}, week of ${fmtDate('md', s.week)}`;
  if (s.tab === 'plan' && s.month) return `${name}, ${fmtDate('month', `${s.month}-01`)}`;
  return name;
};

export const zAssistantAsk = z
  .object({
    /** The day the owner was looking at when they asked (the page's date). */
    date: zDay,
    /** Where the conversation was opened from, unless the owner removed it. */
    screen: zAssistantScreen.optional(),
    turns: z
      .array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(8000), attachments: z.array(zAttachment).max(ATTACHMENT_LIMITS.perTurn).optional() }))
      .min(1)
      .max(40),
  })
  .superRefine((a, ctx) => {
    const all = a.turns.flatMap((t) => t.attachments ?? []);
    if (all.length > ATTACHMENT_LIMITS.perRequest) ctx.addIssue({ code: 'custom', path: ['turns'], message: `At most ${ATTACHMENT_LIMITS.perRequest} files at a time` });
    const bytes = all.reduce((n, f) => n + base64Bytes(f.data), 0);
    if (bytes > ATTACHMENT_LIMITS.requestBytes) ctx.addIssue({ code: 'custom', path: ['turns'], message: `The files come to over ${ATTACHMENT_LIMITS.requestBytes / 1024 / 1024} MB together` });
    const last = a.turns[a.turns.length - 1];
    if (last && last.role === 'user' && !last.text.trim() && !last.attachments?.length) ctx.addIssue({ code: 'custom', path: ['turns'], message: 'Say something or attach a file' });
  });

/** Apply, leaving out the changes (by index) the owner removed. */
export const zAssistantApply = z.object({ skip: z.array(z.number().int().min(0).max(999)).max(999).optional() });
export type AssistantApply = z.infer<typeof zAssistantApply>;

export interface AssistantApplied {
  proposal: AssistantProposal;
  /** Months whose data changed, for the client to refetch. */
  months: string[];
}

export type { ISODate };
