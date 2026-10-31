import Anthropic from '@anthropic-ai/sdk';
import { fmtDate, METERS_PER_MILE, mondayOf, monthOf, periodOf, shiftDays, zAssistantOp, type AssistantChange, type AssistantOp, type AssistantProposal } from '@logbook/shared';
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { DB } from '../db/index.js';
import { activities, assistantActions, goalEvents, goals, planBlocks, todoGroups, todos, trainingSessions } from '../db/schema.js';
import { env } from '../env.js';
import { ApiError, nowISO, uid } from '../lib/util.js';

/** The assistant runs on Sonnet (the owner's choice: quick, and capable enough to edit a plan). */
export const ASSISTANT_MODEL = 'claude-sonnet-5-5';
const MAX_ROUNDS = 6;

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 120_000, maxRetries: 2 }));

type SessionRow = typeof trainingSessions.$inferSelect;
type TodoRow = typeof todos.$inferSelect;
type GoalRow = typeof goals.$inferSelect;

const dow = (d: string) => fmtDate('short', d);
const sessionName = (s: Pick<SessionRow, 'title' | 'type' | 'kind' | 'miles'>) => s.title || [s.type, s.miles ? `${s.miles}` : null].filter(Boolean).join(' ') || s.kind;

// ---------- what Claude is shown ----------

const sessionsBetween = (db: DB, userId: string, from: string, to: string) =>
  db
    .select()
    .from(trainingSessions)
    .where(and(eq(trainingSessions.userId, userId), isNull(trainingSessions.deletedAt), gte(trainingSessions.date, from), lte(trainingSessions.date, to)))
    .orderBy(asc(trainingSessions.date), asc(trainingSessions.position))
    .all();

/** One line per session, with what was logged that day, so Claude can tell done from missed. */
export const sessionLines = (db: DB, userId: string, from: string, to: string, today: string): string => {
  const rows = sessionsBetween(db, userId, from, to);
  const acts = db
    .select({ date: activities.date, kind: activities.kind, meters: activities.distanceM })
    .from(activities)
    .where(and(eq(activities.userId, userId), isNull(activities.deletedAt), gte(activities.date, from), lte(activities.date, to)))
    .all();
  const logged = (d: string) => acts.filter((a) => a.date === d).map((a) => `${a.kind}${a.meters ? ` ${Math.round((a.meters / METERS_PER_MILE) * 10) / 10} mi` : ''}`);
  if (!rows.length) return '(nothing planned)';
  return rows
    .map((s) => {
      const l = logged(s.date);
      const state = s.mark ? `marked ${s.mark}` : s.date < today ? (l.length ? 'not marked' : 'not marked, nothing logged') : s.date === today ? 'today' : 'ahead';
      return `- ${s.id} | ${s.date} ${dow(s.date)} | ${s.kind}: ${sessionName(s)}${s.miles ? ` (${s.miles} mi)` : ''}${s.minutes ? ` (${s.minutes} min)` : ''} | ${state}${l.length ? ` | logged: ${l.join(', ')}` : ''}${s.movedFrom ? ` | moved from ${s.movedFrom}` : ''}`;
    })
    .join('\n');
};

const contextFor = (db: DB, userId: string, today: string, date: string): string => {
  const mon = mondayOf(today);
  const from = shiftDays(mon, -7);
  const to = shiftDays(mon, 27);
  const blocks = db
    .select()
    .from(planBlocks)
    .where(and(eq(planBlocks.userId, userId), isNull(planBlocks.deletedAt), gte(planBlocks.end, shiftDays(today, -7))))
    .orderBy(asc(planBlocks.start))
    .all();
  const open = db
    .select()
    .from(todos)
    .where(and(eq(todos.userId, userId), isNull(todos.deletedOn), isNull(todos.doneOn)))
    .orderBy(desc(todos.priority), asc(todos.position))
    .limit(60)
    .all();
  const lists = db.select().from(todoGroups).where(and(eq(todoGroups.userId, userId), isNull(todoGroups.deletedAt))).all();
  const listName = new Map(lists.map((g) => [g.id, g.name]));
  const gs = db
    .select()
    .from(goals)
    .where(and(eq(goals.userId, userId), isNull(goals.deletedAt), gte(goals.period, shiftDays(today, -14).slice(0, 4))))
    .orderBy(desc(goals.period))
    .limit(40)
    .all()
    .filter((g) => g.status === 'open' || g.period >= periodOf(g.level as 'day', shiftDays(today, -7)));
  const prio = ['', 'P3', 'P2', 'P1'];
  return [
    `TODAY: ${today} (${fmtDate('long', today)}). The owner is looking at ${date === today ? 'today' : `${date} (${fmtDate('long', date)})`}. Weeks run Monday to Sunday; this week starts ${mon}.`,
    '',
    `PLAN BLOCKS: ${blocks.length ? blocks.map((b) => `${b.name} (${b.start} to ${b.end})`).join('; ') : 'none'}`,
    '',
    `SESSIONS ${from} to ${to} (id | date | what | state):`,
    sessionLines(db, userId, from, to, today),
    '',
    `OPEN TO-DOS (id | priority | when | list | text):`,
    open.length ? open.map((t) => `- ${t.id} | ${prio[t.priority] || 'none'} | ${t.bucket}${t.due ? ` ${t.due}` : ''} | ${t.groupId ? (listName.get(t.groupId) ?? '-') : '-'} | ${t.text}`).join('\n') : '(none)',
    `TO-DO LISTS: ${lists.length ? lists.map((g) => `${g.id} ${g.name}`).join('; ') : 'none'}`,
    '',
    `GOALS (id | level | period | status | text):`,
    gs.length ? gs.map((g) => `- ${g.id} | ${g.level} | ${g.period} | ${g.status} | ${g.text}`).join('\n') : '(none)',
  ].join('\n');
};

const SYSTEM = `You are the assistant inside Logbook, a personal app for one person's running and lifting plan, habits, to-dos and goals. He asks you to look things up or change things.

How you work:
- Answer from the data you are given in the latest message's CONTEXT block. For sessions outside the dates shown, call get_sessions.
- When he asks for a change, work out every row it touches, then call propose_changes once with all of them. Nothing changes until he taps Apply, so propose the whole change; do not ask for permission first. If the request is ambiguous in a way that changes what you would do, ask one short question instead.
- "Push out a week" means moving each named session seven days later. "Missed" means a past session that is not marked done and has nothing logged that day. Keep each session's details; only its date moves. Never move sessions into the past.
- Use the ids exactly as given. Dates are YYYY-MM-DD. Priorities: 3 is P1 (top), 2 is P2, 1 is P3, 0 none. A goal's period is the year (2026), the month (2026-10), the week's Monday, or the day.
- Your summary in propose_changes is what he reads above the list: one plain sentence saying what will happen.
- When you are only answering a question, reply in two or three plain sentences. No markdown headings, no bullet lists unless he asks for a list, no emoji.`;

const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: 'get_sessions',
    description: 'Planned sessions between two dates (inclusive), with their ids, what was logged each day, and whether each is marked. Use for dates outside the CONTEXT block.',
    input_schema: { type: 'object', properties: { from: { type: 'string', description: 'YYYY-MM-DD' }, to: { type: 'string', description: 'YYYY-MM-DD, at most 120 days after from' } }, required: ['from', 'to'], additionalProperties: false },
  },
  {
    name: 'propose_changes',
    description:
      'Propose changes for the owner to approve. Each change is one operation: move_session {id, to}, update_session {id, type?, title?, details?, miles?, minutes?}, add_session {date, kind: run|lift|cross|rest, type?, title?, details?, miles?, minutes?}, delete_session {id}, mark_session {id, mark: done|floor|skip|sick|null}, add_todo {text, priority?, due?, bucket?: today|later|someday, groupId?}, update_todo {id, text?, priority?, due?, bucket?, groupId?, done?}, delete_todo {id}, set_goal {level: year|month|week|day, period, text, steps?}, review_goal {id, status: open|done|partly|missed}.',
    input_schema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'One plain sentence: what will happen when he taps Apply.' },
        changes: { type: 'array', items: { type: 'object', description: 'One operation, with an "op" field naming it.' }, minItems: 1, maxItems: 40 },
      },
      required: ['summary', 'changes'],
      additionalProperties: false,
    },
  },
];

// ---------- checking and labelling a proposal ----------

const zProposal = z.object({ summary: z.string().trim().min(1).max(400), changes: z.array(zAssistantOp).min(1).max(40) });

const sessionOf = (db: DB, userId: string, id: string) => {
  const row = db.select().from(trainingSessions).where(and(eq(trainingSessions.userId, userId), eq(trainingSessions.id, id), isNull(trainingSessions.deletedAt))).get();
  if (!row) throw new Error(`No session with id ${id}.`);
  return row;
};
const todoOf = (db: DB, userId: string, id: string) => {
  const row = db.select().from(todos).where(and(eq(todos.userId, userId), eq(todos.id, id), isNull(todos.deletedOn))).get();
  if (!row) throw new Error(`No to-do with id ${id}.`);
  return row;
};
const goalOf = (db: DB, userId: string, id: string) => {
  const row = db.select().from(goals).where(and(eq(goals.userId, userId), eq(goals.id, id), isNull(goals.deletedAt))).get();
  if (!row) throw new Error(`No goal with id ${id}.`);
  return row;
};
const listOf = (db: DB, userId: string, id: string) => {
  const row = db.select().from(todoGroups).where(and(eq(todoGroups.userId, userId), eq(todoGroups.id, id), isNull(todoGroups.deletedAt))).get();
  if (!row) throw new Error(`No list with id ${id}.`);
  return row;
};
const goalPeriodOk = (level: string, period: string) =>
  level === 'year' ? /^\d{4}$/.test(period) : level === 'month' ? /^\d{4}-\d{2}$/.test(period) : /^\d{4}-\d{2}-\d{2}$/.test(period) && periodOf(level as 'week', period) === period;
const P = ['no priority', 'P3', 'P2', 'P1'];

/** Checks an operation against the owner's rows and says it in words. Throws with a message Claude can act on. */
export const labelOp = (db: DB, userId: string, op: AssistantOp, today: string): string => {
  switch (op.op) {
    case 'move_session': {
      const s = sessionOf(db, userId, op.id);
      if (op.to < today) throw new Error(`Cannot move ${op.id} into the past (${op.to}).`);
      return `Move ${sessionName(s)} from ${dow(s.date)} to ${dow(op.to)}`;
    }
    case 'update_session': {
      const s = sessionOf(db, userId, op.id);
      const what = [op.title !== undefined ? `title “${op.title ?? ''}”` : null, op.type !== undefined ? `type ${op.type ?? 'none'}` : null, op.miles !== undefined ? `${op.miles ?? 0} mi` : null, op.minutes !== undefined ? `${op.minutes ?? 0} min` : null, op.details !== undefined ? 'details' : null].filter(Boolean).join(', ');
      return `Change ${sessionName(s)} on ${dow(s.date)}: ${what || 'no change'}`;
    }
    case 'add_session':
      return `Add ${sessionName({ title: op.title ?? null, type: op.type ?? null, kind: op.kind, miles: op.miles ?? null })} on ${dow(op.date)}`;
    case 'delete_session': {
      const s = sessionOf(db, userId, op.id);
      return `Remove ${sessionName(s)} from ${dow(s.date)}`;
    }
    case 'mark_session': {
      const s = sessionOf(db, userId, op.id);
      return op.mark ? `Mark ${sessionName(s)} on ${dow(s.date)} ${op.mark === 'skip' ? 'skipped' : op.mark}` : `Clear the mark on ${sessionName(s)} (${dow(s.date)})`;
    }
    case 'add_todo': {
      if (op.groupId) listOf(db, userId, op.groupId);
      return `Add to-do “${op.text}”${op.priority ? `, ${P[op.priority]}` : ''}${op.due ? `, for ${dow(op.due)}` : op.bucket === 'someday' ? ', someday' : ''}`;
    }
    case 'update_todo': {
      const t = todoOf(db, userId, op.id);
      if (op.groupId) listOf(db, userId, op.groupId);
      if (op.done) return `Check off “${t.text}”`;
      const what = [op.text ? `rename to “${op.text}”` : null, op.priority !== undefined ? P[op.priority] : null, op.due !== undefined ? (op.due ? `for ${dow(op.due)}` : 'no date') : null, op.bucket ? op.bucket : null, op.groupId !== undefined ? 'list' : null, op.done === false ? 'reopen' : null].filter(Boolean).join(', ');
      return `Change “${t.text}”: ${what || 'no change'}`;
    }
    case 'delete_todo': {
      const t = todoOf(db, userId, op.id);
      return `Delete to-do “${t.text}”`;
    }
    case 'set_goal':
      if (!goalPeriodOk(op.level, op.period)) throw new Error(`${op.period} is not a ${op.level}.`);
      return `Set the ${op.level} goal (${op.period}): “${op.text}”${op.steps?.length ? ` with ${op.steps.length} steps` : ''}`;
    case 'review_goal': {
      const g = goalOf(db, userId, op.id);
      return `Mark the ${g.level} goal “${g.text}” ${op.status}`;
    }
  }
};

// ---------- asking ----------

export interface AskResult {
  text: string;
  proposal: AssistantProposal | null;
}

/** One ask: Claude reads the context, may look up sessions, and either answers or proposes changes (saved, not applied). */
export const ask = async (db: DB, userId: string, turns: Array<{ role: 'user' | 'assistant'; text: string }>, date: string, today: string): Promise<AskResult> => {
  if (!env.claudeConfigured) throw new ApiError(503, 'The assistant needs ANTHROPIC_API_KEY on the server.', 'claude_not_configured');
  const history = turns.slice(-20);
  const last = history[history.length - 1]!;
  if (last.role !== 'user') throw new ApiError(400, 'The last turn must be yours.');
  const messages: Anthropic.Beta.BetaMessageParam[] = history.slice(0, -1).map((t) => ({ role: t.role, content: t.text }));
  messages.push({ role: 'user', content: [{ type: 'text', text: `CONTEXT\n${contextFor(db, userId, today, date)}` }, { type: 'text', text: last.text }] });

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const res = await anthropic().beta.messages.create({
      model: ASSISTANT_MODEL,
      max_tokens: 16000,
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      tools: TOOLS,
      tool_choice: { type: 'auto' },
      output_config: { effort: 'medium' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages,
    });
    if (res.stop_reason === 'refusal') return { text: 'I can’t help with that one.', proposal: null };
    // the whole turn goes back as it came (tool calls and thinking blocks included)
    messages.push({ role: 'assistant', content: res.content });
    const calls = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
    const said = res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    if (!calls.length || res.stop_reason === 'max_tokens') return { text: said || 'Done.', proposal: null };

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const call of calls) {
      if (call.name === 'get_sessions') {
        const q = z.object({ from: z.string(), to: z.string() }).safeParse(call.input);
        const ok = q.success && /^\d{4}-\d{2}-\d{2}$/.test(q.data.from) && /^\d{4}-\d{2}-\d{2}$/.test(q.data.to) && q.data.from <= q.data.to && q.data.to <= shiftDays(q.data.from, 120);
        results.push(ok ? { type: 'tool_result', tool_use_id: call.id, content: sessionLines(db, userId, q.data!.from, q.data!.to, today) } : { type: 'tool_result', tool_use_id: call.id, is_error: true, content: 'Give from and to as YYYY-MM-DD, at most 120 days apart.' });
        continue;
      }
      if (call.name === 'propose_changes') {
        const p = zProposal.safeParse(call.input);
        if (!p.success) {
          results.push({ type: 'tool_result', tool_use_id: call.id, is_error: true, content: `The changes did not validate: ${p.error.issues.slice(0, 4).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}` });
          continue;
        }
        try {
          const changes: AssistantChange[] = p.data.changes.map((op) => ({ op, label: labelOp(db, userId, op, today) }));
          const id = uid('aa');
          db.insert(assistantActions).values({ id, userId, ask: last.text.slice(0, 2000), summary: p.data.summary, ops: JSON.stringify(p.data.changes), labels: JSON.stringify(changes.map((c) => c.label)), undo: null, status: 'proposed', createdAt: nowISO(), appliedAt: null }).run();
          return { text: said, proposal: { id, summary: p.data.summary, changes, status: 'proposed' } };
        } catch (e) {
          results.push({ type: 'tool_result', tool_use_id: call.id, is_error: true, content: e instanceof Error ? e.message : 'A change did not check out.' });
        }
        continue;
      }
      results.push({ type: 'tool_result', tool_use_id: call.id, is_error: true, content: `Unknown tool ${call.name}.` });
    }
    messages.push({ role: 'user', content: results });
  }
  return { text: 'That took too many steps. Try asking for one change at a time.', proposal: null };
};

// ---------- applying and undoing ----------

interface UndoRecord {
  sessions: SessionRow[];
  todos: TodoRow[];
  goals: GoalRow[];
  created: { sessions: string[]; todos: string[]; goals: string[] };
}

export const proposalOf = (row: typeof assistantActions.$inferSelect): AssistantProposal => {
  const ops = JSON.parse(row.ops) as AssistantOp[];
  const labels = JSON.parse(row.labels) as string[];
  return { id: row.id, summary: row.summary, changes: ops.map((op, i) => ({ op, label: labels[i] ?? op.op })), status: row.status as AssistantProposal['status'] };
};

const actionOf = (db: DB, userId: string, id: string) => {
  const row = db.select().from(assistantActions).where(and(eq(assistantActions.userId, userId), eq(assistantActions.id, id))).get();
  if (!row) throw new ApiError(404, 'Proposal not found');
  return row;
};

/** Runs a proposal in one transaction, keeping the rows it touched as they were. Answers the months that changed. */
export const applyAction = (db: DB, userId: string, id: string, today: string) => {
  const row = actionOf(db, userId, id);
  if (row.status !== 'proposed') throw new ApiError(409, row.status === 'applied' ? 'Already applied.' : 'This proposal is closed.');
  const ops = JSON.parse(row.ops) as AssistantOp[];
  const undo: UndoRecord = { sessions: [], todos: [], goals: [], created: { sessions: [], todos: [], goals: [] } };
  const months = new Set<string>();
  const now = nowISO();
  const keepSession = (s: SessionRow) => undo.sessions.some((x) => x.id === s.id) || undo.sessions.push({ ...s });
  const keepTodo = (t: TodoRow) => undo.todos.some((x) => x.id === t.id) || undo.todos.push({ ...t });
  const keepGoal = (g: GoalRow) => undo.goals.some((x) => x.id === g.id) || undo.goals.push({ ...g });
  const nextPos = (date: string) => (db.select({ m: sql<number>`coalesce(max(${trainingSessions.position}), -1)` }).from(trainingSessions).where(and(eq(trainingSessions.userId, userId), eq(trainingSessions.date, date))).get()?.m ?? -1) + 1;
  const logGoal = (g: { id: string; level: string; period: string }, kind: string, text: string | null) => db.insert(goalEvents).values({ id: uid('ge'), userId, goalId: g.id, level: g.level, period: g.period, kind, text, at: now }).run();

  try {
    db.transaction(() => {
      for (const op of ops) {
        labelOp(db, userId, op, today); // the rows may have changed since it was proposed
        switch (op.op) {
          case 'move_session': {
            const s = sessionOf(db, userId, op.id);
            keepSession(s);
            months.add(monthOf(s.date)).add(monthOf(op.to));
            const movedFrom = s.movedFrom === op.to ? null : (s.movedFrom ?? s.date);
            db.update(trainingSessions).set({ date: op.to, movedFrom, position: nextPos(op.to), updatedAt: now }).where(eq(trainingSessions.id, s.id)).run();
            break;
          }
          case 'update_session': {
            const s = sessionOf(db, userId, op.id);
            keepSession(s);
            months.add(monthOf(s.date));
            const set: Partial<SessionRow> = { updatedAt: now };
            if (op.type !== undefined) set.type = op.type;
            if (op.title !== undefined) set.title = op.title || null;
            if (op.details !== undefined) set.details = op.details || null;
            if (op.miles !== undefined) set.miles = op.miles && op.miles > 0 ? Math.round(op.miles * 10) / 10 : null;
            if (op.minutes !== undefined) set.minutes = op.minutes && op.minutes > 0 ? op.minutes : null;
            db.update(trainingSessions).set(set).where(eq(trainingSessions.id, s.id)).run();
            break;
          }
          case 'add_session': {
            const sid = uid('p');
            months.add(monthOf(op.date));
            db.insert(trainingSessions)
              .values({ id: sid, userId, date: op.date, position: nextPos(op.date), kind: op.kind, type: op.type ?? null, title: op.title || null, details: op.details || null, miles: op.kind === 'run' && op.miles ? Math.round(op.miles * 10) / 10 : null, minutes: op.minutes || null, blockId: null, movedFrom: null, mark: null, deletedAt: null, createdAt: now, updatedAt: now })
              .run();
            undo.created.sessions.push(sid);
            break;
          }
          case 'delete_session': {
            const s = sessionOf(db, userId, op.id);
            keepSession(s);
            months.add(monthOf(s.date));
            db.update(trainingSessions).set({ deletedAt: now, updatedAt: now }).where(eq(trainingSessions.id, s.id)).run();
            break;
          }
          case 'mark_session': {
            const s = sessionOf(db, userId, op.id);
            keepSession(s);
            months.add(monthOf(s.date));
            db.update(trainingSessions).set({ mark: op.mark, updatedAt: now }).where(eq(trainingSessions.id, s.id)).run();
            break;
          }
          case 'add_todo': {
            const tid = uid('t');
            const pos = (db.select({ m: sql<number>`coalesce(max(${todos.position}), -1)` }).from(todos).where(eq(todos.userId, userId)).get()?.m ?? -1) + 1;
            const bucket = op.bucket ?? (op.due && op.due > today ? 'later' : 'today');
            db.insert(todos)
              .values({ id: tid, userId, text: op.text, note: null, priority: op.priority ?? 0, color: null, groupId: op.groupId ?? null, due: bucket === 'later' ? (op.due ?? shiftDays(today, 1)) : null, bucket, position: pos, createdOn: today, doneOn: null, deletedOn: null, createdAt: now })
              .run();
            undo.created.todos.push(tid);
            break;
          }
          case 'update_todo': {
            const t = todoOf(db, userId, op.id);
            keepTodo(t);
            const set: Partial<TodoRow> = {};
            if (op.text) set.text = op.text;
            if (op.priority !== undefined) set.priority = op.priority;
            if (op.groupId !== undefined) set.groupId = op.groupId;
            if (op.done !== undefined) set.doneOn = op.done ? today : null;
            const bucket = op.bucket ?? (op.due ? (op.due > today ? 'later' : 'today') : t.bucket);
            if (op.bucket !== undefined || op.due !== undefined) {
              set.bucket = bucket;
              set.due = bucket === 'later' ? (op.due ?? t.due ?? shiftDays(today, 1)) : null;
            }
            db.update(todos).set(set).where(eq(todos.id, t.id)).run();
            break;
          }
          case 'delete_todo': {
            const t = todoOf(db, userId, op.id);
            keepTodo(t);
            db.update(todos).set({ deletedOn: today }).where(eq(todos.id, t.id)).run();
            break;
          }
          case 'set_goal': {
            const steps = JSON.stringify((op.steps ?? []).map((text, i) => ({ id: `s${Date.now().toString(36)}${i}`, text, done: false })));
            const had = db.select().from(goals).where(and(eq(goals.userId, userId), eq(goals.level, op.level), eq(goals.period, op.period))).get();
            if (had) {
              keepGoal(had);
              db.update(goals)
                .set({ text: op.text, original: null, why: null, updatedAt: now, deletedAt: null, ...(op.steps ? { steps } : {}), ...(had.deletedAt ? { status: 'open', closedAt: null, reflection: null } : {}) })
                .where(eq(goals.id, had.id))
                .run();
              logGoal(had, had.deletedAt ? 'set' : 'edited', op.text);
            } else {
              const gid = uid('goal');
              db.insert(goals).values({ id: gid, userId, level: op.level, period: op.period, text: op.text, original: null, why: null, status: 'open', reflection: null, steps, createdAt: now, updatedAt: now, closedAt: null, deletedAt: null }).run();
              undo.created.goals.push(gid);
              logGoal({ id: gid, level: op.level, period: op.period }, 'set', op.text);
            }
            break;
          }
          case 'review_goal': {
            const g = goalOf(db, userId, op.id);
            keepGoal(g);
            db.update(goals).set({ status: op.status, closedAt: op.status === 'open' ? null : now, updatedAt: now }).where(eq(goals.id, g.id)).run();
            logGoal(g, op.status === 'open' ? 'reopened' : op.status, g.reflection);
            break;
          }
        }
      }
      db.update(assistantActions).set({ status: 'applied', undo: JSON.stringify(undo), appliedAt: now }).where(eq(assistantActions.id, id)).run();
    });
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(409, `${e instanceof Error ? e.message : 'A change no longer applies.'} Ask again for a fresh proposal.`, 'stale_proposal');
  }
  return { proposal: proposalOf(actionOf(db, userId, id)), months: [...months].sort() };
};

/** Puts back every row an applied proposal touched, and removes what it added. */
export const undoAction = (db: DB, userId: string, id: string, today: string) => {
  const row = actionOf(db, userId, id);
  if (row.status !== 'applied' || !row.undo) throw new ApiError(409, 'Only an applied proposal can be undone.');
  const u = JSON.parse(row.undo) as UndoRecord;
  const now = nowISO();
  const months = new Set<string>();
  db.transaction(() => {
    for (const s of u.sessions) {
      const cur = db.select({ date: trainingSessions.date }).from(trainingSessions).where(eq(trainingSessions.id, s.id)).get();
      if (cur) months.add(monthOf(cur.date));
      months.add(monthOf(s.date));
      const { id: sid, userId: _u, ...rest } = s;
      db.update(trainingSessions).set({ ...rest, updatedAt: now }).where(and(eq(trainingSessions.userId, userId), eq(trainingSessions.id, sid))).run();
    }
    if (u.created.sessions.length) {
      for (const r of db.select({ date: trainingSessions.date }).from(trainingSessions).where(inArray(trainingSessions.id, u.created.sessions)).all()) months.add(monthOf(r.date));
      db.update(trainingSessions).set({ deletedAt: now, updatedAt: now }).where(and(eq(trainingSessions.userId, userId), inArray(trainingSessions.id, u.created.sessions))).run();
    }
    for (const t of u.todos) {
      const { id: tid, userId: _u, ...rest } = t;
      db.update(todos).set(rest).where(and(eq(todos.userId, userId), eq(todos.id, tid))).run();
    }
    if (u.created.todos.length) db.update(todos).set({ deletedOn: today }).where(and(eq(todos.userId, userId), inArray(todos.id, u.created.todos))).run();
    for (const g of u.goals) {
      const { id: gid, userId: _u, ...rest } = g;
      db.update(goals).set({ ...rest, updatedAt: now }).where(and(eq(goals.userId, userId), eq(goals.id, gid))).run();
      db.insert(goalEvents).values({ id: uid('ge'), userId, goalId: gid, level: g.level, period: g.period, kind: 'edited', text: g.text, at: now }).run();
    }
    if (u.created.goals.length) {
      for (const g of db.select().from(goals).where(inArray(goals.id, u.created.goals)).all()) db.insert(goalEvents).values({ id: uid('ge'), userId, goalId: g.id, level: g.level, period: g.period, kind: 'cleared', text: g.text, at: now }).run();
      db.update(goals).set({ deletedAt: now }).where(and(eq(goals.userId, userId), inArray(goals.id, u.created.goals))).run();
    }
    db.update(assistantActions).set({ status: 'undone' }).where(eq(assistantActions.id, id)).run();
  });
  return { proposal: proposalOf(actionOf(db, userId, id)), months: [...months].sort() };
};

export const dismissAction = (db: DB, userId: string, id: string) => {
  const row = actionOf(db, userId, id);
  if (row.status === 'proposed') db.update(assistantActions).set({ status: 'dismissed' }).where(eq(assistantActions.id, id)).run();
  return proposalOf(actionOf(db, userId, id));
};

export const recentActions = (db: DB, userId: string, limit = 50) =>
  db.select().from(assistantActions).where(eq(assistantActions.userId, userId)).orderBy(desc(assistantActions.createdAt)).limit(limit).all().map((r) => ({ ...proposalOf(r), ask: r.ask, createdAt: r.createdAt, appliedAt: r.appliedAt }));
