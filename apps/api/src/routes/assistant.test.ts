import { mondayOf, shiftDays, today } from '@logbook/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type DB } from '../db/index.js';
import { assistantActions, assistantMessages, llmUsage, userMemory } from '../db/schema.js';
import { env } from '../env.js';
import { buildApp } from '../index.js';
import { resetRateLimits } from '../lib/ratelimit.js';
import { effortFor, labelOp, setAssistantClient, type AssistantClient } from '../services/assistant.js';
import { compact, liveThread, messagesOf, windowOf, WINDOW } from '../services/assistant/threads.js';
import { ASSISTANT_LIMIT } from './assistant.js';

type App = ReturnType<typeof buildApp>;
let app: App;
let db: DB;
let cookie = '';
let userId = '';

const call = async (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) => {
  const res = await app.request(url, { method, headers: { 'content-type': 'application/json', cookie, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
};

// ---------- a scripted Anthropic client: each call pops the next message and streams its text ----------
type Block = { type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: unknown };
interface Scripted {
  content: Block[];
  stop_reason?: string;
}
const scripted = (turns: Scripted[]) => {
  const calls: Array<Record<string, unknown>> = [];
  let i = 0;
  const client = {
    beta: {
      messages: {
        stream(params: Record<string, unknown>) {
          calls.push(JSON.parse(JSON.stringify(params)) as Record<string, unknown>);
          const t = turns[i++] ?? { content: [{ type: 'text', text: 'Done.' }] };
          const message = { id: `msg_${i}`, type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', content: t.content, stop_reason: t.stop_reason ?? (t.content.some((b) => b.type === 'tool_use') ? 'tool_use' : 'end_turn'), stop_sequence: null, usage: { input_tokens: 120, output_tokens: 30, cache_read_input_tokens: 100, cache_creation_input_tokens: 0 } };
          return {
            async *[Symbol.asyncIterator]() {
              for (const b of t.content) {
                if (b.type !== 'text') continue;
                for (const piece of b.text.match(/.{1,6}/g) ?? []) yield { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: piece } };
              }
            },
            finalMessage: async () => message,
          };
        },
      },
    },
  } as unknown as AssistantClient;
  return { client, calls };
};
const propose = (summary: string, changes: unknown[], text = ''): Scripted => ({ content: [...(text ? [{ type: 'text', text } as Block] : []), { type: 'tool_use', id: `tu_${Math.random().toString(36).slice(2, 8)}`, name: 'propose_changes', input: { summary, changes } }] });

beforeEach(async () => {
  db = openDatabase(':memory:').db;
  app = buildApp(db);
  env.allowSetup = true;
  env.claudeConfigured = true;
  resetRateLimits();
  const res = await app.request('/api/auth/setup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'josh@example.com', password: 'password123' }) });
  cookie = (res.headers.get('set-cookie') ?? '').split(';')[0]!;
  userId = (await call('GET', '/api/me')).body.id;
});
afterEach(() => {
  setAssistantClient(null);
  env.claudeConfigured = false;
});

const seedProposal = (ops: unknown[]) => {
  const id = `aa_test${Math.random().toString(36).slice(2, 7)}`;
  db.insert(assistantActions).values({ id, userId, ask: 'push the missed runs a week', summary: 'Move them a week later.', ops: JSON.stringify(ops), labels: JSON.stringify(ops.map(() => 'x')), undo: null, status: 'proposed', createdAt: new Date().toISOString(), appliedAt: null }).run();
  return id;
};

describe('assistant proposals', () => {
  it('applies a proposal in one go, and Undo puts every row back', async () => {
    const t = today();
    const a = (await call('POST', '/api/sessions', { date: t, kind: 'run', type: 'Easy', title: 'Easy 5', miles: 5 })).body;
    const b = (await call('POST', '/api/sessions', { date: shiftDays(t, 1), kind: 'run', type: 'Speed', title: 'Speed 5', miles: 5 })).body;
    const id = seedProposal([
      { op: 'move_session', id: a.id, to: shiftDays(t, 7) },
      { op: 'move_session', id: b.id, to: shiftDays(t, 8) },
      { op: 'add_todo', text: 'Book a massage', priority: 3 },
      { op: 'set_goal', level: 'day', period: t, text: 'Get the two runs back on the calendar.', steps: ['Check next week', 'Move them'] },
    ]);
    const applied = await call('POST', `/api/assistant/${id}/apply`);
    expect(applied.status).toBe(200);
    expect(applied.body.proposal.status).toBe('applied');
    expect(applied.body.months.length).toBeGreaterThan(0);

    const month = async (d: string) => (await call('GET', `/api/months/${d.slice(0, 7)}`)).body;
    const moved = (await month(shiftDays(t, 7))).sessions.find((s: { id: string }) => s.id === a.id);
    expect(moved.date).toBe(shiftDays(t, 7));
    expect((await call('GET', '/api/todos')).body.some((x: { text: string; priority: number }) => x.text === 'Book a massage' && x.priority === 3)).toBe(true);
    const goal = (await call('GET', '/api/goals')).body[0];
    expect(goal.steps).toHaveLength(2);

    // applying twice is refused
    expect((await call('POST', `/api/assistant/${id}/apply`)).status).toBe(409);

    const undone = await call('POST', `/api/assistant/${id}/undo`);
    expect(undone.body.proposal.status).toBe('undone');
    const back = (await month(t)).sessions.find((s: { id: string }) => s.id === a.id);
    expect(back.date).toBe(t);
    expect((await call('GET', '/api/todos')).body.find((x: { text: string }) => x.text === 'Book a massage').deletedOn).toBeTruthy();
    expect((await call('GET', '/api/goals')).body).toEqual([]);

    const log = (await call('GET', '/api/assistant/log')).body;
    expect(log[0]).toMatchObject({ id, status: 'undone', ask: 'push the missed runs a week' });
  });

  it('refuses a stale proposal whole, changing nothing', async () => {
    const t = today();
    const a = (await call('POST', '/api/sessions', { date: shiftDays(t, 2), kind: 'run', title: 'Easy 4', miles: 4 })).body;
    const id = seedProposal([
      { op: 'move_session', id: a.id, to: shiftDays(t, 9) },
      { op: 'move_session', id: 'p_gone', to: shiftDays(t, 9) },
    ]);
    const r = await call('POST', `/api/assistant/${id}/apply`);
    expect(r.status).toBe(409);
    const still = (await call('GET', `/api/months/${shiftDays(t, 2).slice(0, 7)}`)).body.sessions.find((s: { id: string }) => s.id === a.id);
    expect(still.date).toBe(shiftDays(t, 2));
  });

  it('labels changes in words and will not move a session into the past', async () => {
    const t = today();
    const a = (await call('POST', '/api/sessions', { date: t, kind: 'run', title: 'Long 10', miles: 10 })).body;
    expect(labelOp(db, userId, { op: 'move_session', id: a.id, to: shiftDays(t, 7) }, t)).toMatch(/^Move Long 10 from .+ to .+/);
    expect(() => labelOp(db, userId, { op: 'move_session', id: a.id, to: shiftDays(t, -1) }, t)).toThrow(/past/);
    expect(() => labelOp(db, userId, { op: 'set_goal', level: 'week', period: '2026-10-27', text: 'x' }, t)).toThrow();
  });

  it('dismissing keeps the proposal in the log, closed', async () => {
    const id = seedProposal([{ op: 'add_todo', text: 'x' }]);
    expect((await call('POST', `/api/assistant/${id}/dismiss`)).body.status).toBe('dismissed');
    expect((await call('POST', `/api/assistant/${id}/apply`)).status).toBe(409);
  });

  it('v2 ops: habits, the day plan, the alarm, reminders and a plan template apply and undo', async () => {
    const t = today();
    const habit = (await call('POST', '/api/habits', { name: 'Stretch' })).body[0];
    const todo = (await call('POST', '/api/todos', { text: 'Call the bank', date: t })).body;
    const at = new Date(Date.now() + 3600_000).toISOString();
    const mon = shiftDays(t, 7 - ((new Date(t).getUTCDay() + 6) % 7));
    const id = seedProposal([
      { op: 'check_habit', habitId: habit.id, date: t, done: true },
      { op: 'add_habit', name: 'Read' },
      { op: 'plan_day', date: t, bands: { morning: [`todo:${todo.id}`], afternoon: [], evening: [] } },
      { op: 'set_alarm', date: t, wake: '06:30' },
      { op: 'set_reminder', title: 'Pack the kit', at },
      { op: 'apply_plan_template', goal: '10k', startDate: mon, runDays: ['mon', 'wed', 'sat'], longRunDay: 'sat', weeklyMiles: 15, weeks: 2, replace: false },
    ]);
    for (const [i, op] of (JSON.parse(db.select().from(assistantActions).where(undefined).get()!.ops) as Array<{ op: string }>).entries()) expect(labelOp(db, userId, op as never, t), `label ${i}`).toBeTruthy();
    expect(labelOp(db, userId, { op: 'set_alarm', date: t, wake: 390 }, t)).toMatch(/alarm to 6:30 am/);
    expect(() => labelOp(db, userId, { op: 'set_alarm', date: shiftDays(t, -1), wake: 390 }, t)).toThrow(/past/);
    expect(() => labelOp(db, userId, { op: 'add_habit', name: 'stretch' }, t)).toThrow(/already/);

    const applied = await call('POST', `/api/assistant/${id}/apply`);
    expect(applied.status).toBe(200);
    const month = (await call('GET', `/api/months/${t.slice(0, 7)}`)).body;
    expect(month.checks).toEqual([expect.objectContaining({ habitId: habit.id, date: t, done: true })]);
    expect(month.morningDays[t]).toEqual({ wake: 390 });
    expect((await call('GET', '/api/habits')).body.map((h: { name: string }) => h.name)).toEqual(['Stretch', 'Read']);
    expect((await call('GET', `/api/day-plans/${t}`)).body.bands.morning).toEqual([`todo:${todo.id}`]);
    expect((await call('GET', '/api/reminders')).body).toEqual([expect.objectContaining({ title: 'Pack the kit', source: 'agent', status: 'pending' })]);
    const blocks = (await call('GET', '/api/bootstrap')).body.blocks;
    expect(blocks).toEqual([expect.objectContaining({ name: '10K · 2 weeks', source: 'assistant' })]);

    const undone = await call('POST', `/api/assistant/${id}/undo`);
    expect(undone.status).toBe(200);
    const after = (await call('GET', `/api/months/${t.slice(0, 7)}`)).body;
    expect(after.checks).toEqual([]);
    expect(after.morningDays[t]).toBeUndefined();
    expect((await call('GET', '/api/habits')).body.map((h: { name: string }) => h.name)).toEqual(['Stretch']);
    expect((await call('GET', `/api/day-plans/${t}`)).body.bands.morning).toEqual([]);
    expect((await call('GET', '/api/reminders')).body).toEqual([]);
    expect((await call('GET', '/api/bootstrap')).body.blocks).toEqual([]);
  });
});

describe('POST /assistant with a scripted Claude', () => {
  it('keeps the thread on the server, streams the text, proposes checked changes and logs usage', async () => {
    const t = today();
    const a = (await call('POST', '/api/sessions', { date: shiftDays(t, -2), kind: 'run', type: 'Easy', title: 'Easy 5', miles: 5 })).body;
    const { client, calls } = scripted([
      { content: [{ type: 'text', text: 'You have one missed run this week, Easy 5 on the day before yesterday.' }] },
      { content: [{ type: 'tool_use', id: 'tu_1', name: 'get_sessions', input: { from: shiftDays(t, -30), to: shiftDays(t, -1) } }] },
      propose('Move the missed run to next week.', [{ op: 'move_session', id: a.id, to: shiftDays(t, 5) }], 'Here is what I would change.'),
    ]);
    setAssistantClient(client);

    const first = await call('POST', '/api/assistant', { date: t, text: 'What did I miss this week?', context: { tab: 'plan', date: t } });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ text: expect.stringContaining('one missed run'), proposal: null, available: true });
    expect(first.body.threadId).toBeTruthy();
    // the context block names the page and the owner's habits, morning and activities
    const ctx = (calls[0]!.messages as Array<{ role: string; content: Array<{ text: string }> }>).at(-1)!.content[0]!.text;
    expect(ctx).toMatch(/on the Plan tab looking at the week of/);
    expect(ctx).toMatch(/HABITS/);
    expect(ctx).toMatch(/MORNING: alarm/);
    expect(ctx).toMatch(/ACTIVITIES, last 14 days/);
    expect(ctx).toMatch(/THE DAY .*: window 6:00–23:00, work 9:00–18:00, morning wake \d+:\d\d/);
    expect(ctx).toMatch(/to place \(ref, what/);
    expect(calls[0]!.output_config).toEqual({ effort: 'low' });

    // streamed: text events, then done with the reply
    const res = await app.request('/api/assistant', { method: 'POST', headers: { 'content-type': 'application/json', cookie, accept: 'text/event-stream' }, body: JSON.stringify({ date: t, text: 'Push it to next week', context: { tab: 'plan', date: t } }) });
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/);
    const raw = await res.text();
    const events = raw
      .split('\n\n')
      .filter(Boolean)
      .map((chunk) => {
        const ev = /event: (\w+)/.exec(chunk)?.[1];
        const data = chunk
          .split('\n')
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).trim())
          .join('');
        return { ev, data: JSON.parse(data) };
      });
    expect(events.filter((e) => e.ev === 'text').map((e) => e.data).join('')).toBe('Here is what I would change.');
    const done = events.find((e) => e.ev === 'done')!.data;
    expect(done.proposal).toMatchObject({ status: 'proposed', summary: 'Move the missed run to next week.' });
    expect(done.proposal.changes[0].label).toMatch(/^Move Easy 5 from/);
    expect(calls[2]!.output_config).toEqual({ effort: 'medium' });
    // the tool loop: the second call answered get_sessions with the session lines
    const toolTurn = (calls[2]!.messages as Array<{ role: string; content: Array<{ type: string; content?: string }> }>).at(-1)!;
    expect(toolTurn.content[0]).toMatchObject({ type: 'tool_result', content: expect.stringContaining(a.id) });

    // the thread, as the client loads it: four spoken turns, the proposal on the last
    const thread = (await call('GET', '/api/assistant/thread')).body;
    expect(thread.id).toBe(first.body.threadId);
    expect(thread.turns.map((x: { role: string }) => x.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
    expect(thread.turns[3].proposal).toMatchObject({ id: done.proposal.id, status: 'proposed' });
    expect(thread.turns[3].text).toBe('Here is what I would change.');
    // the stored messages keep the tool_use and its tool_result blocks
    const stored = messagesOf(db, thread.id).map((m) => JSON.parse(m.contentJson) as unknown);
    expect(JSON.stringify(stored)).toMatch(/"type":"tool_use"/);
    expect(JSON.stringify(stored)).toMatch(/"type":"tool_result"/);
    // usage per model call
    expect(db.select().from(llmUsage).all()).toHaveLength(3);
    expect(db.select().from(llmUsage).all()[0]).toMatchObject({ userId, kind: 'assistant', inputTokens: 120, outputTokens: 30, cachedTokens: 100 });

    // a new thread starts empty and becomes the live one
    const fresh = (await call('POST', '/api/assistant/new')).body;
    expect(fresh.turns).toEqual([]);
    expect((await call('GET', '/api/assistant/thread')).body.id).toBe(fresh.id);
  });

  it('applies one small change at once with Undo, and the legacy turns body still works', async () => {
    const t = today();
    const habit = (await call('POST', '/api/habits', { name: 'Stretch' })).body[0];
    const { client } = scripted([propose('Check off Stretch.', [{ op: 'check_habit', habitId: habit.id, date: t, done: true }])]);
    setAssistantClient(client);
    const r = await call('POST', '/api/assistant', { date: t, turns: [{ role: 'user', text: 'check stretch' }] });
    expect(r.status).toBe(200);
    expect(r.body.proposal.status).toBe('applied');
    expect(r.body.months).toEqual([t.slice(0, 7)]);
    expect((await call('GET', `/api/months/${t.slice(0, 7)}`)).body.checks[0]).toMatchObject({ habitId: habit.id, done: true });
    const undone = await call('POST', `/api/assistant/${r.body.proposal.id}/undo`);
    expect(undone.body.proposal.status).toBe('undone');
    expect((await call('GET', `/api/months/${t.slice(0, 7)}`)).body.checks).toEqual([]);
  });

  it('a proposal with two changes, or a rename, waits for Apply', async () => {
    const t = today();
    const todo = (await call('POST', '/api/todos', { text: 'Call the bank', date: t })).body;
    const { client } = scripted([propose('Rename it.', [{ op: 'update_todo', id: todo.id, text: 'Call the bank today' }])]);
    setAssistantClient(client);
    expect((await call('POST', '/api/assistant', { date: t, text: 'rename it' })).body.proposal.status).toBe('proposed');
  });

  it('remembers what it is told, and the next turn sees it in the cached memory block', async () => {
    const t = today();
    const { client, calls } = scripted([
      { content: [{ type: 'tool_use', id: 'tu_m', name: 'remember', input: { text: 'Runs before work, out the door by 6:50.' } }] },
      { content: [{ type: 'text', text: 'Noted.' }] },
      { content: [{ type: 'text', text: 'Early, as you said.' }] },
    ]);
    setAssistantClient(client);
    expect((await call('POST', '/api/assistant', { date: t, text: 'Remember that I run before work' })).body.text).toBe('Noted.');
    expect(db.select().from(userMemory).all()).toEqual([expect.objectContaining({ userId, text: 'Runs before work, out the door by 6:50.' })]);
    await call('POST', '/api/assistant', { date: t, text: 'When do I run?' });
    const system = calls[2]!.system as Array<{ text: string; cache_control?: unknown }>;
    expect(system[1]!.text).toMatch(/MEMORIES[\s\S]*Runs before work/);
    expect(system[1]!.cache_control).toEqual({ type: 'ephemeral' });
    expect(system[0]!.text).not.toMatch(/\bHe asks\b/);
  });

  it('turns the tool loop into a reply when a change does not check out', async () => {
    const t = today();
    const { client, calls } = scripted([propose('Move it.', [{ op: 'move_session', id: 'p_nope', to: shiftDays(t, 3) }]), { content: [{ type: 'text', text: 'I could not find that session.' }] }]);
    setAssistantClient(client);
    const r = await call('POST', '/api/assistant', { date: t, text: 'move my run' });
    expect(r.body).toMatchObject({ text: 'I could not find that session.', proposal: null });
    const err = (calls[1]!.messages as Array<{ content: Array<{ is_error?: boolean; content?: string }> }>).at(-1)!.content[0]!;
    expect(err.is_error).toBe(true);
    expect(err.content).toMatch(/No session with id p_nope/);
  });

  it('plans the day: slots for two to-dos and a step, said in words, applied as slots, and undone whole', async () => {
    const t = today();
    const bank = (await call('POST', '/api/todos', { text: 'Call the bank', date: t, priority: 3 })).body;
    const brief = (await call('POST', '/api/todos', { text: 'Write the brief', date: t })).body;
    const goal = (await call('PUT', `/api/goals/day/${t}`, { text: 'Ship the report.', steps: [{ id: 's_draft', text: 'Draft it', done: false }, { id: 's_send', text: 'Send it', done: false }] })).body;
    const step = goal.steps[0];
    // a plan already on the board: the bands hold the bank call, and a block is on the timeline
    await call('PUT', `/api/day-plans/${t}`, { bands: { morning: [`todo:${bank.id}`], afternoon: [], evening: [] }, slots: [{ ref: `todo:${brief.id}`, start: 900, minutes: 30 }] });

    const { client, calls } = scripted([
      propose('A deep-work morning, the call after lunch.', [
        {
          op: 'plan_day',
          date: t,
          slots: [
            { ref: `step:${goal.id}:${step.id}`, start: 540, minutes: 45 },
            { ref: `todo:${bank.id}`, start: 780, minutes: 30 },
            { ref: `todo:${brief.id}`, start: 600, minutes: 30 },
          ],
        },
      ]),
    ]);
    setAssistantClient(client);
    const r = await call('POST', '/api/assistant', { date: t, text: 'Plan my day', context: { tab: 'today', date: t } });
    expect(r.status).toBe(200);
    // the context carried the timeline: what is placed, and what waits in the tray
    const ctx = (calls[0]!.messages as Array<{ content: Array<{ text: string }> }>).at(-1)!.content[0]!.text;
    expect(ctx).toMatch(new RegExp(`placed \\(ref, what, when\\):\\n- todo:${brief.id} “Write the brief” 15:00–15:30 30 min`));
    expect(ctx).toMatch(new RegExp(`- todo:${bank.id} “Call the bank” P1 \\(in the morning band\\)`));
    expect(ctx).toMatch(new RegExp(`- step:${goal.id}:${step.id} “Draft it” \\(goal “Ship the report.”\\)`));
    // always a proposal, never applied at once, and each placement in words
    expect(r.body.proposal.status).toBe('proposed');
    expect(r.body.proposal.changes[0].label).toBe('Place “Draft it” at 9:00 am for 45 min, “Write the brief” at 10:00 am for 30 min, “Call the bank” at 1:00 pm for 30 min');
    expect((await call('GET', `/api/day-plans/${t}`)).body.slots).toEqual([{ ref: `todo:${brief.id}`, start: 900, minutes: 30 }]);

    const applied = await call('POST', `/api/assistant/${r.body.proposal.id}/apply`);
    expect(applied.status).toBe(200);
    expect(applied.body.dates).toEqual([t]);
    const plan = (await call('GET', `/api/day-plans/${t}`)).body;
    expect(plan.slots).toEqual([
      { ref: `step:${goal.id}:${step.id}`, start: 540, minutes: 45 },
      { ref: `todo:${brief.id}`, start: 600, minutes: 30 },
      { ref: `todo:${bank.id}`, start: 780, minutes: 30 },
    ]);
    // a placed ref leaves the bands
    expect(plan.bands).toEqual({ morning: [], afternoon: [], evening: [] });

    const undone = await call('POST', `/api/assistant/${r.body.proposal.id}/undo`);
    expect(undone.body.proposal.status).toBe('undone');
    expect(undone.body.dates).toEqual([t]);
    expect((await call('GET', `/api/day-plans/${t}`)).body).toMatchObject({ bands: { morning: [`todo:${bank.id}`], afternoon: [], evening: [] }, slots: [{ ref: `todo:${brief.id}`, start: 900, minutes: 30 }] });
  });

  it('refuses a slot whose ref is not live that day, with a reason the model can act on', async () => {
    const t = today();
    const later = (await call('POST', '/api/todos', { text: 'Renew the passport', date: t, bucket: 'later', due: shiftDays(t, 3) })).body;
    const goal = (await call('PUT', `/api/goals/day/${t}`, { text: 'Ship it.', steps: [{ id: 's_draft', text: 'Draft', done: false }] })).body;
    const { client, calls } = scripted([
      propose('Plan it.', [{ op: 'plan_day', date: t, slots: [{ ref: `todo:${later.id}`, start: 540, minutes: 30 }] }]),
      propose('Plan it.', [{ op: 'plan_day', date: t, slots: [{ ref: `step:${goal.id}:nope`, start: 540, minutes: 45 }] }]),
      propose('Plan it.', [{ op: 'plan_day', date: t, slots: [{ ref: `todo:${later.id}`, start: 542, minutes: 30 }] }]),
      { content: [{ type: 'text', text: 'That one is for another day.' }] },
    ]);
    setAssistantClient(client);
    const r = await call('POST', '/api/assistant', { date: t, text: 'plan my day' });
    expect(r.body).toMatchObject({ text: 'That one is for another day.', proposal: null });
    const errOf = (i: number) => (calls[i]!.messages as Array<{ content: Array<{ is_error?: boolean; content?: string }> }>).at(-1)!.content[0]!;
    expect(errOf(1).is_error).toBe(true);
    expect(errOf(1).content).toMatch(new RegExp(`“Renew the passport” \\(todo:${later.id}\\) is not on ${t}’s list: it is for ${shiftDays(t, 3)}`));
    expect(errOf(2).content).toMatch(/has no step nope. Its steps are: s_draft “Draft”/);
    expect(errOf(3).content).toMatch(/slots.0.start: a multiple of 5/);
    // a session on another day, or a goal for another period, is refused the same way
    const s = (await call('POST', '/api/sessions', { date: shiftDays(t, 1), kind: 'run', title: 'Easy 4', miles: 4 })).body;
    expect(() => labelOp(db, userId, { op: 'plan_day', date: t, slots: [{ ref: `session:${s.id}`, start: 400, minutes: 50 }] }, t)).toThrow(new RegExp(`is on ${shiftDays(t, 1)}, not ${t}`));
    const week = (await call('PUT', `/api/goals/week/${mondayOf(t)}`, { text: 'Run 20.', steps: [{ id: 's_long', text: 'Long run', done: false }] })).body;
    expect(() => labelOp(db, userId, { op: 'plan_day', date: shiftDays(t, 10), slots: [{ ref: `step:${week.id}:${week.steps[0].id}`, start: 400, minutes: 50 }] }, t)).toThrow(/is the week goal for/);
    expect(labelOp(db, userId, { op: 'plan_day', date: t, slots: [{ ref: `step:${week.id}:${week.steps[0].id}`, start: 400, minutes: 50 }] }, t)).toBe('Place “Long run” at 6:40 am for 50 min');
  });

  it('limits an account to 30 asks an hour', async () => {
    const t = today();
    setAssistantClient(scripted(Array.from({ length: 40 }, () => ({ content: [{ type: 'text', text: 'ok' }] as Block[] }))).client);
    for (let i = 0; i < ASSISTANT_LIMIT.limit; i++) expect((await call('POST', '/api/assistant', { date: t, text: `q${i}` })).status).toBe(200);
    const over = await call('POST', '/api/assistant', { date: t, text: 'one more' });
    expect(over.status).toBe(429);
    expect(over.body.error).toMatch(/30 asks an hour/);
    expect(over.headers.get('retry-after')).toBeTruthy();
  });

  it('says so without a key', async () => {
    env.claudeConfigured = false;
    const r = await call('POST', '/api/assistant', { date: today(), text: 'hi' });
    expect(r.body).toMatchObject({ available: false, proposal: null });
  });
});

describe('thread windows and compaction', () => {
  it('keeps the last ~30 messages for the model, cut at a user turn, and folds the rest into a summary', () => {
    const thread = liveThread(db, userId);
    for (let i = 0; i < 25; i++) {
      db.insert(assistantMessages).values({ id: `m${String(i).padStart(3, '0')}a`, threadId: thread.id, userId, role: 'user', contentJson: JSON.stringify(`question ${i}`), actionId: null, createdAt: `2026-10-01T00:${String(i).padStart(2, '0')}:00.000Z` }).run();
      db.insert(assistantMessages).values({ id: `m${String(i).padStart(3, '0')}b`, threadId: thread.id, userId, role: 'assistant', contentJson: JSON.stringify([{ type: 'text', text: `answer ${i}` }, { type: 'tool_use', id: `t${i}`, name: 'get_goals', input: {} }]), actionId: null, createdAt: `2026-10-01T00:${String(i).padStart(2, '0')}:10.000Z` }).run();
      db.insert(assistantMessages).values({ id: `m${String(i).padStart(3, '0')}c`, threadId: thread.id, userId, role: 'user', contentJson: JSON.stringify([{ type: 'tool_result', tool_use_id: `t${i}`, content: 'none' }]), actionId: null, createdAt: `2026-10-01T00:${String(i).padStart(2, '0')}:20.000Z` }).run();
    }
    const { messages, summary } = windowOf(db, thread);
    expect(messages.length).toBeLessThanOrEqual(WINDOW + 2);
    expect(messages.length).toBeGreaterThanOrEqual(WINDOW);
    expect(messages[0]!.role).toBe('user');
    expect(typeof messages[0]!.content).toBe('string'); // a spoken turn, never an orphaned tool_result
    expect(summary).toMatch(/^Owner: question 0\nAssistant: answer 0/);
    expect(summary).not.toMatch(/none/); // tool results are left out
    expect(messagesOf(db, thread.id)).toHaveLength(messages.length);
    // a second window on the same thread changes nothing more
    const again = windowOf(db, thread);
    expect(again.summary).toBe(summary);
  });

  it('compaction is deterministic and bounded', () => {
    const older = Array.from({ length: 200 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', contentJson: JSON.stringify([{ type: 'text', text: `line ${i} ${'x'.repeat(50)}` }]), actionId: null }));
    const s = compact('earlier', older);
    expect(s.length).toBeLessThanOrEqual(2401);
    expect(s.startsWith('…')).toBe(true);
    expect(s).toMatch(/line 199/);
    expect(compact(null, older.slice(0, 2))).toBe(`Owner: line 0 ${'x'.repeat(50)}\nAssistant: line 1 ${'x'.repeat(50)}`);
  });

  it('picks the effort from the words', () => {
    expect(effortFor('How is my week looking?')).toBe('low');
    expect(effortFor('Push my missed runs to next week')).toBe('medium');
    expect(effortFor('check stretch')).toBe('medium');
  });
});
