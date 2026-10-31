import { aiSourcesNote } from './ai-sources.js';
import Anthropic from '@anthropic-ai/sdk';
import { isDirectApply, shiftDays, zAssistantOp, type AskContextInput, type AssistantChange, type AssistantProposal } from '@logbook/shared';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { DB } from '../db/index.js';
import { assistantActions, llmUsage, userMemory } from '../db/schema.js';
import { env } from '../env.js';
import { ApiError, nowISO, uid } from '../lib/util.js';
import { activityLines, contextFor, goalLines, habitLines, memoryBlock, profileBlock, sessionLines, weekSummary } from './assistant/context.js';
import { applyAction, labelOp } from './assistant/ops.js';
import { appendMessage, liveThread, windowOf, type ThreadRow } from './assistant/threads.js';

export { sessionLines } from './assistant/context.js';
export { applyAction, dismissAction, labelOp, proposalOf, recentActions, undoAction } from './assistant/ops.js';
export { liveThread, newThread, threadView } from './assistant/threads.js';

/** The assistant runs on Sonnet (the owner's choice: quick, and capable enough to edit a plan). */
export const ASSISTANT_MODEL = 'claude-sonnet-5-5';
const MAX_ROUNDS = 6;

/** The client, swappable for tests (`setAssistantClient`): anything with `beta.messages.stream`. */
export type AssistantClient = Pick<Anthropic, 'beta'>;
let client: AssistantClient | null = null;
let override: AssistantClient | null = null;
const anthropic = (): AssistantClient => override ?? (client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 120_000, maxRetries: 2 }));
export const setAssistantClient = (c: AssistantClient | null) => {
  override = c;
};

// ---------- the prompt ----------

const SYSTEM = `You are the assistant inside Logbook, a personal app for the owner's running and lifting plan, habits, to-dos, goals, reminders and mornings. The owner (named in the OWNER line when known; use their name, and never assume a pronoun they did not give you) asks you to look things up or change things.

${aiSourcesNote()}

How you work:
- Answer from the data you are given in the latest message's CONTEXT block. For sessions outside the dates shown call get_sessions; for a week's numbers get_week_summary; for habits, goals or activities on other days get_habits, get_goals, get_activities.
- When the owner asks for a change, work out every row it touches, then call propose_changes once with all of them. Most changes wait for the owner to tap Apply, so propose the whole change; do not ask for permission first. One small change asked plainly (check a habit, mark a session, check off or add a to-do, set a reminder or an alarm) is applied at once and the owner gets an Undo. If the request is ambiguous in a way that changes what you would do, ask one short question instead.
- "Push out a week" means moving each named session seven days later. "Missed" means a past session that is not marked done and has nothing logged that day. Keep each session's details; only its date moves. Never move sessions into the past.
- Use the ids exactly as given. Dates are YYYY-MM-DD. Times for set_alarm are HH:MM; a reminder's "at" is an ISO datetime with the owner's offset. Priorities: 3 is P1 (top), 2 is P2, 1 is P3, 0 none. A goal's period is the year (2026), the month (2026-10), the week's Monday, or the day. A day plan's bands hold to-do refs (todo:<id>) and goal-step refs (step:<goalId>:<stepId>).
- "Pick a plan" or "build a plan" means apply_plan_template from the training answers (goal, run days, long-run day, weekly miles) unless the owner says otherwise; start next Monday unless asked; replace only when asked or when the plan clearly supersedes the current block.
- When the owner tells you something about themselves worth keeping ("I run before work", "my knee is sore this month"), call remember with it; call forget to drop one that is no longer true. Do not store what the app already knows.
- Your summary in propose_changes is what the owner reads above the list: one plain sentence saying what will happen.
- When you are only answering a question, reply in two or three plain sentences. No markdown headings, no bullet lists unless asked for a list, no emoji.`;

const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: 'get_sessions',
    description: 'Planned sessions between two dates (inclusive), with their ids, what was logged each day, and whether each is marked. Use for dates outside the CONTEXT block.',
    input_schema: { type: 'object', properties: { from: { type: 'string', description: 'YYYY-MM-DD' }, to: { type: 'string', description: 'YYYY-MM-DD, at most 120 days after from' } }, required: ['from', 'to'], additionalProperties: false },
  },
  {
    name: 'get_week_summary',
    description: 'One week against its plan: planned and run miles, sessions kept, and every session with its state. `mon` is any date in the week.',
    input_schema: { type: 'object', properties: { mon: { type: 'string', description: 'YYYY-MM-DD' } }, required: ['mon'], additionalProperties: false },
  },
  {
    name: 'get_habits',
    description: 'The habits with their ids and whether each is checked on a date (today unless given).',
    input_schema: { type: 'object', properties: { date: { type: 'string', description: 'YYYY-MM-DD' } }, additionalProperties: false },
  },
  { name: 'get_goals', description: 'The open goals and the recent closed ones, with ids, levels, periods and steps.', input_schema: { type: 'object', properties: {}, additionalProperties: false } },
  {
    name: 'get_activities',
    description: 'Recorded activities (Strava, COROS) between two dates: distance, pace, heart rate.',
    input_schema: { type: 'object', properties: { from: { type: 'string', description: 'YYYY-MM-DD' }, to: { type: 'string', description: 'YYYY-MM-DD, at most 365 days after from' } }, required: ['from', 'to'], additionalProperties: false },
  },
  {
    name: 'propose_changes',
    description:
      'Propose changes for the owner to approve. Each change is one operation: move_session {id, to}, update_session {id, type?, title?, details?, miles?, minutes?}, add_session {date, kind: run|lift|cross|rest, type?, title?, details?, miles?, minutes?}, delete_session {id}, mark_session {id, mark: done|floor|skip|sick|null}, add_todo {text, priority?, due?, bucket?: today|later|someday, groupId?}, update_todo {id, text?, priority?, due?, bucket?, groupId?, done?}, delete_todo {id}, set_goal {level: year|month|week|day, period, text, steps?}, review_goal {id, status: open|done|partly|missed}, check_habit {habitId, date, done}, add_habit {name}, plan_day {date, bands: {morning: ref[], afternoon: ref[], evening: ref[]}}, set_alarm {date, wake: "HH:MM"}, set_reminder {title, body?, at: ISO datetime with offset, route?}, cancel_reminder {id}, apply_plan_template {goal: base|5k|10k|half|marathon, startDate, runDays: [mon..sun], longRunDay, weeklyMiles, weeks?, raceDate?, replace: boolean}.',
    input_schema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'One plain sentence: what will happen when the owner taps Apply.' },
        changes: { type: 'array', items: { type: 'object', description: 'One operation, with an "op" field naming it.' }, minItems: 1, maxItems: 40 },
      },
      required: ['summary', 'changes'],
      additionalProperties: false,
    },
  },
  {
    name: 'remember',
    description: 'Keep a short fact about the owner for every later conversation ("runs before work", "knee sore this month").',
    input_schema: { type: 'object', properties: { text: { type: 'string', description: 'One sentence.' } }, required: ['text'], additionalProperties: false },
  },
  {
    name: 'forget',
    description: 'Drop a memory by its key (from the MEMORIES block).',
    input_schema: { type: 'object', properties: { key: { type: 'string' } }, required: ['key'], additionalProperties: false },
  },
];

const zProposal = z.object({ summary: z.string().trim().min(1).max(400), changes: z.array(zAssistantOp).min(1).max(40) });
const zDates = z.object({ from: z.string(), to: z.string() });
const isDay = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);

const CHANGE_VERBS = /\b(move|push|add|set|mark|check|uncheck|plan|delete|remove|cancel|remind|schedule|change|swap|skip|apply|build|pick|write|rebuild|replace|put|shift|drop|clear|reschedule|make)\b/i;
/** Effort per ask: a short question runs low; anything that names a change runs medium. */
export const effortFor = (text: string): 'low' | 'medium' => (CHANGE_VERBS.test(text) ? 'medium' : 'low');

// ---------- asking ----------

export interface AskInput {
  text: string;
  date: string;
  today: string;
  context?: AskContextInput;
}
export interface AskResult {
  text: string;
  proposal: AssistantProposal | null;
  months?: string[];
  threadId: string;
}

/**
 * One ask on the live thread: the owner's words go on the thread, Claude reads the context, may look things up or
 * remember something, and either answers or proposes changes (saved, not applied; or applied at once when the proposal
 * is one small reversible change). Text streams through `onText` as it arrives.
 */
export const ask = async (db: DB, userId: string, input: AskInput, opts: { onText?: (delta: string) => void; thread?: ThreadRow } = {}): Promise<AskResult> => {
  if (!env.claudeConfigured) throw new ApiError(503, 'The assistant needs ANTHROPIC_API_KEY on the server.', 'claude_not_configured');
  const thread = opts.thread ?? liveThread(db, userId);
  const { messages: history, summary } = windowOf(db, thread);
  const profile = profileBlock(db, userId);
  const userText = input.text.trim();
  appendMessage(db, thread.id, userId, 'user', userText);
  const messages: Anthropic.Beta.BetaMessageParam[] = [...history, { role: 'user', content: [{ type: 'text', text: `CONTEXT\n${contextFor(db, userId, input.today, input.date, input.context, profile.name)}` }, { type: 'text', text: userText }] }];
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: `${profile.text}\n\n${memoryBlock(db, userId)}${summary ? `\n\nEARLIER IN THIS CONVERSATION (compacted):\n${summary}` : ''}`, cache_control: { type: 'ephemeral' } },
  ];
  const effort = effortFor(userText);
  // what this turn said so far (text before a tool call carries into the reply)
  let said = '';

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const started = Date.now();
    const stream = anthropic().beta.messages.stream({
      model: ASSISTANT_MODEL,
      max_tokens: 16000,
      system,
      tools: TOOLS,
      tool_choice: { type: 'auto' },
      output_config: { effort },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages,
    });
    let roundText = '';
    for await (const ev of stream) {
      if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
        roundText += ev.delta.text;
        opts.onText?.(ev.delta.text);
      }
    }
    const res = await stream.finalMessage();
    logUsage(db, userId, 'assistant', res.model ?? ASSISTANT_MODEL, res.usage, Date.now() - started);
    if (roundText.trim()) said += (said ? '\n' : '') + roundText.trim();
    if (res.stop_reason === 'refusal') {
      const text = 'I can’t help with that one.';
      appendMessage(db, thread.id, userId, 'assistant', text);
      return { text, proposal: null, threadId: thread.id };
    }
    // the whole turn goes back as it came (tool calls and thinking blocks included)
    messages.push({ role: 'assistant', content: res.content });
    const calls = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
    if (!calls.length || res.stop_reason === 'max_tokens') {
      const text = said || 'Done.';
      appendMessage(db, thread.id, userId, 'assistant', res.content.length ? res.content : text);
      return { text, proposal: null, threadId: thread.id };
    }

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    let proposalOut: { proposal: AssistantProposal; months?: string[] } | null = null;
    for (const call of calls) {
      const r = (content: string, is_error = false): Anthropic.Beta.BetaToolResultBlockParam => ({ type: 'tool_result', tool_use_id: call.id, content, ...(is_error ? { is_error: true } : {}) });
      switch (call.name) {
        case 'get_sessions': {
          const q = zDates.safeParse(call.input);
          const ok = q.success && isDay(q.data.from) && isDay(q.data.to) && q.data.from <= q.data.to && q.data.to <= shiftDays(q.data.from, 120);
          results.push(ok ? r(sessionLines(db, userId, q.data!.from, q.data!.to, input.today)) : r('Give from and to as YYYY-MM-DD, at most 120 days apart.', true));
          break;
        }
        case 'get_week_summary': {
          const q = z.object({ mon: z.string() }).safeParse(call.input);
          results.push(q.success && isDay(q.data.mon) ? r(weekSummary(db, userId, q.data.mon, input.today)) : r('Give mon as YYYY-MM-DD.', true));
          break;
        }
        case 'get_habits': {
          const q = z.object({ date: z.string().optional() }).safeParse(call.input);
          const d = q.success && q.data.date && isDay(q.data.date) ? q.data.date : input.today;
          results.push(r(habitLines(db, userId, d)));
          break;
        }
        case 'get_goals':
          results.push(r(goalLines(db, userId, input.today)));
          break;
        case 'get_activities': {
          const q = zDates.safeParse(call.input);
          const ok = q.success && isDay(q.data.from) && isDay(q.data.to) && q.data.from <= q.data.to && q.data.to <= shiftDays(q.data.from, 365);
          results.push(ok ? r(activityLines(db, userId, q.data!.from, q.data!.to)) : r('Give from and to as YYYY-MM-DD, at most a year apart.', true));
          break;
        }
        case 'remember': {
          const q = z.object({ text: z.string().trim().min(1).max(300) }).safeParse(call.input);
          if (!q.success) {
            results.push(r('Give text, one sentence.', true));
            break;
          }
          const key = uid('mem', 6);
          db.insert(userMemory).values({ userId, key, text: q.data.text, updatedAt: nowISO() }).run();
          results.push(r(`Remembered (${key}).`));
          break;
        }
        case 'forget': {
          const q = z.object({ key: z.string().min(1).max(40) }).safeParse(call.input);
          const n = q.success ? db.delete(userMemory).where(and(eq(userMemory.userId, userId), eq(userMemory.key, q.data.key))).run().changes : 0;
          results.push(n ? r('Forgotten.') : r('No memory with that key.', true));
          break;
        }
        case 'propose_changes': {
          const p = zProposal.safeParse(call.input);
          if (!p.success) {
            results.push(r(`The changes did not validate: ${p.error.issues.slice(0, 4).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`, true));
            break;
          }
          try {
            const changes: AssistantChange[] = p.data.changes.map((op) => ({ op, label: labelOp(db, userId, op, input.today) }));
            const id = uid('aa');
            db.insert(assistantActions).values({ id, userId, ask: userText.slice(0, 2000), summary: p.data.summary, ops: JSON.stringify(p.data.changes), labels: JSON.stringify(changes.map((c) => c.label)), undo: null, status: 'proposed', createdAt: nowISO(), appliedAt: null }).run();
            let proposal: AssistantProposal = { id, summary: p.data.summary, changes, status: 'proposed' };
            let months: string[] | undefined;
            if (isDirectApply(p.data.changes)) {
              // docs/system.md §7: one obviously reversible change applies at once, with Undo
              const applied = applyAction(db, userId, id, input.today);
              proposal = applied.proposal;
              months = applied.months;
            }
            proposalOut = { proposal, months };
            results.push(r(proposal.status === 'applied' ? `Applied at once (proposal ${id}); the owner has an Undo.` : `Proposal ${id} is shown to the owner with ${changes.length} change${changes.length === 1 ? '' : 's'}; nothing is applied until they tap Apply.`));
          } catch (e) {
            results.push(r(e instanceof Error ? e.message : 'A change did not check out.', true));
          }
          break;
        }
        default:
          results.push(r(`Unknown tool ${call.name}.`, true));
      }
    }
    messages.push({ role: 'user', content: results });
    if (proposalOut) {
      const { proposal, months } = proposalOut as { proposal: AssistantProposal; months?: string[] };
      // the turn ends here: the proposal is the answer, and the tool's result goes on the thread so the next ask follows it cleanly
      appendMessage(db, thread.id, userId, 'assistant', res.content, proposal.id);
      appendMessage(db, thread.id, userId, 'user', results);
      return { text: said, proposal, months, threadId: thread.id };
    }
    appendMessage(db, thread.id, userId, 'assistant', res.content);
    appendMessage(db, thread.id, userId, 'user', results);
  }
  const text = 'That took too many steps. Try asking for one change at a time.';
  appendMessage(db, thread.id, userId, 'assistant', text);
  return { text, proposal: null, threadId: thread.id };
};

/** Tokens per model call, for the bill. */
export const logUsage = (db: DB, userId: string, kind: string, model: string, usage: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number | null } | null | undefined, ms: number) => {
  db.insert(llmUsage).values({ id: uid('lu'), userId, kind, model, inputTokens: usage?.input_tokens ?? 0, outputTokens: usage?.output_tokens ?? 0, cachedTokens: usage?.cache_read_input_tokens ?? 0, ms, at: nowISO() }).run();
};

