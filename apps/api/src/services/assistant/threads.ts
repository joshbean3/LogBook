import type Anthropic from '@anthropic-ai/sdk';
import type { AssistantThread, AssistantTurn } from '@logbook/shared';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { DB } from '../../db/index.js';
import { assistantActions, assistantMessages, assistantThreads } from '../../db/schema.js';
import { nowISO, uid } from '../../lib/util.js';
import { proposalOf } from './ops.js';

type ThreadRow = typeof assistantThreads.$inferSelect;
type MessageRow = typeof assistantMessages.$inferSelect;
export type Content = Anthropic.Beta.BetaMessageParam['content'];
type Block = Exclude<Content, string>[number];

/** How many stored messages go to the model; older ones fold into `compacted_summary`. */
export const WINDOW = 30;
/** How long the compacted summary may grow. */
export const SUMMARY_MAX = 2400;

export const liveThread = (db: DB, userId: string): ThreadRow => {
  const row = db.select().from(assistantThreads).where(eq(assistantThreads.userId, userId)).orderBy(desc(assistantThreads.updatedAt)).limit(1).get();
  return row ?? newThread(db, userId);
};

export const newThread = (db: DB, userId: string): ThreadRow => {
  const now = nowISO();
  const id = uid('th');
  db.insert(assistantThreads).values({ id, userId, title: null, createdAt: now, updatedAt: now, compactedSummary: null }).run();
  return db.select().from(assistantThreads).where(eq(assistantThreads.id, id)).get()!;
};

export const messagesOf = (db: DB, threadId: string): MessageRow[] => db.select().from(assistantMessages).where(eq(assistantMessages.threadId, threadId)).orderBy(asc(assistantMessages.createdAt), asc(assistantMessages.id)).all();

const parse = (m: MessageRow): Content => {
  try {
    return JSON.parse(m.contentJson) as Content;
  } catch {
    return '';
  }
};

/** Thinking blocks belong to the turn that made them; the stored history keeps text, tool calls and results. */
const storable = (content: Content): Content => (typeof content === 'string' ? content : content.filter((b) => b.type !== 'thinking' && b.type !== 'redacted_thinking'));

export const appendMessage = (db: DB, threadId: string, userId: string, role: 'user' | 'assistant', content: Content, actionId: string | null = null): MessageRow => {
  const now = nowISO();
  const id = `${now}_${uid('m', 6)}`;
  db.insert(assistantMessages).values({ id, threadId, userId, role, contentJson: JSON.stringify(storable(content)), actionId, createdAt: now }).run();
  db.update(assistantThreads).set({ updatedAt: now }).where(eq(assistantThreads.id, threadId)).run();
  return db.select().from(assistantMessages).where(eq(assistantMessages.id, id)).get()!;
};

export const textOf = (content: Content): string => (typeof content === 'string' ? content : content.filter((b): b is Anthropic.Beta.BetaTextBlockParam => b.type === 'text').map((b) => b.text).join('\n')).trim();
const isToolResult = (content: Content) => typeof content !== 'string' && content.some((b) => b.type === 'tool_result');

/** A plain user message (not a tool result): where a model window may start. */
const startsTurn = (m: MessageRow) => m.role === 'user' && !isToolResult(parse(m));

/**
 * The model's view of a thread: the last ~WINDOW messages, cut at a user message so no tool_result is orphaned, and the
 * earlier part folded into the thread's summary (`compact`). Returns the window as message params.
 */
export const windowOf = (db: DB, thread: ThreadRow): { messages: Anthropic.Beta.BetaMessageParam[]; summary: string | null } => {
  const all = messagesOf(db, thread.id);
  let start = Math.max(0, all.length - WINDOW);
  while (start > 0 && !startsTurn(all[start]!)) start--;
  if (start > 0) {
    const older = all.slice(0, start);
    const summary = compact(thread.compactedSummary, older);
    db.update(assistantThreads).set({ compactedSummary: summary }).where(eq(assistantThreads.id, thread.id)).run();
    db.delete(assistantMessages).where(and(eq(assistantMessages.threadId, thread.id), inArray(assistantMessages.id, older.map((m) => m.id)))).run();
    thread.compactedSummary = summary;
  }
  const kept = all.slice(start);
  return { messages: kept.map((m) => ({ role: m.role as 'user' | 'assistant', content: parse(m) })), summary: thread.compactedSummary };
};

/**
 * Deterministic compaction: the summary so far plus one line per spoken turn of the messages that fall out of the
 * window (tool calls and results are left out), trimmed from the front to SUMMARY_MAX characters.
 */
export const compact = (prev: string | null, older: Array<Pick<MessageRow, 'role' | 'contentJson' | 'actionId'>>): string => {
  const lines: string[] = [];
  for (const m of older) {
    let content: Content;
    try {
      content = JSON.parse(m.contentJson) as Content;
    } catch {
      continue;
    }
    if (isToolResult(content)) continue;
    const text = textOf(content).replace(/\s+/g, ' ').slice(0, 240);
    const proposed = typeof content !== 'string' && content.some((b) => b.type === 'tool_use' && (b as { name?: string }).name === 'propose_changes');
    if (!text && !proposed) continue;
    lines.push(`${m.role === 'user' ? 'Owner' : 'Assistant'}: ${text}${proposed ? ' [proposed changes]' : ''}`);
  }
  const joined = [prev, ...lines].filter(Boolean).join('\n');
  return joined.length > SUMMARY_MAX ? `…${joined.slice(-SUMMARY_MAX)}` : joined;
};

/** The thread as the client shows it: one turn per spoken message, a proposal on the assistant turn that made it. */
export const threadView = (db: DB, userId: string, thread: ThreadRow): AssistantThread => {
  const turns: AssistantTurn[] = [];
  const msgs = messagesOf(db, thread.id);
  const actionIds = msgs.map((m) => m.actionId).filter((x): x is string => !!x);
  const actions = actionIds.length ? db.select().from(assistantActions).where(and(eq(assistantActions.userId, userId), inArray(assistantActions.id, actionIds))).all() : [];
  const byId = new Map(actions.map((a) => [a.id, proposalOf(a)]));
  for (const m of msgs) {
    const content = parse(m);
    if (isToolResult(content)) continue;
    const text = textOf(content);
    const proposal = m.actionId ? (byId.get(m.actionId) ?? null) : null;
    if (!text && !proposal) continue;
    turns.push({ role: m.role as 'user' | 'assistant', text, proposal, createdAt: m.createdAt });
  }
  return { id: thread.id, title: thread.title, createdAt: thread.createdAt, turns };
};

export type { Block, ThreadRow };
