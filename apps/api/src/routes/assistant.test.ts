import { shiftDays, today } from '@logbook/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openDatabase, type DB } from '../db/index.js';
import { activities, assistantActions } from '../db/schema.js';
import { env } from '../env.js';
import { buildApp } from '../index.js';
import { labelOp, setAssistantClient, splitReplies } from '../services/assistant.js';

type App = ReturnType<typeof buildApp>;
let app: App;
let db: DB;
let cookie = '';
let userId = '';

const call = async (method: string, url: string, body?: unknown) => {
  const res = await app.request(url, { method, headers: { 'content-type': 'application/json', cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

beforeEach(async () => {
  db = openDatabase(':memory:').db;
  app = buildApp(db);
  env.allowSetup = true;
  const res = await app.request('/api/auth/setup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'josh@example.com', password: 'password123' }) });
  cookie = (res.headers.get('set-cookie') ?? '').split(';')[0]!;
  userId = (await call('GET', '/api/me')).body.id;
});

const propose = (ops: unknown[]) => {
  const id = `aa_test${Math.random().toString(36).slice(2, 7)}`;
  db.insert(assistantActions).values({ id, userId, ask: 'push the missed runs a week', summary: 'Move them a week later.', ops: JSON.stringify(ops), labels: JSON.stringify(ops.map(() => 'x')), undo: null, status: 'proposed', createdAt: new Date().toISOString(), appliedAt: null }).run();
  return id;
};

describe('assistant proposals', () => {
  it('applies a proposal in one go, and Undo puts every row back', async () => {
    const t = today();
    const a = (await call('POST', '/api/sessions', { date: t, kind: 'run', type: 'Easy', title: 'Easy 5', miles: 5 })).body;
    const b = (await call('POST', '/api/sessions', { date: shiftDays(t, 1), kind: 'run', type: 'Speed', title: 'Speed 5', miles: 5 })).body;
    const id = propose([
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
    const id = propose([
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
    const id = propose([{ op: 'add_todo', text: 'x' }]);
    expect((await call('POST', `/api/assistant/${id}/dismiss`)).body.status).toBe('dismissed');
    expect((await call('POST', `/api/assistant/${id}/apply`)).status).toBe(409);
  });
});

describe('asking without holding the line', () => {
  it('says an answer that is gone (expired, or the server restarted) is gone, so the app can say to send it again', async () => {
    const r = await call('GET', '/api/assistant/jobs/aj_nothere');
    expect(r.status).toBe(404);
    expect(r.body.code).toBe('job_gone');
  });

  it('still answers at once, job or not, when the server has no Claude key', async () => {
    const key = env.ANTHROPIC_API_KEY;
    const configured = env.claudeConfigured;
    env.claudeConfigured = false;
    try {
      const r = await call('POST', '/api/assistant?async=1', { date: '2026-11-02', turns: [{ role: 'user', text: 'hi' }] });
      expect(r.status).toBe(200);
      expect(r.body.available).toBe(false);
    } finally {
      env.claudeConfigured = configured;
      env.ANTHROPIC_API_KEY = key;
    }
  });
});

describe('applying only some of a proposal', () => {
  it('leaves out the changes the owner removed, says which, and Undo still puts back what ran', async () => {
    const t = today();
    const a = (await call('POST', '/api/sessions', { date: shiftDays(t, 1), kind: 'run', title: 'Easy 5', miles: 5 })).body;
    const id = propose([
      { op: 'move_session', id: a.id, to: shiftDays(t, 3) },
      { op: 'add_todo', text: 'Book a massage' },
      { op: 'add_todo', text: 'Buy gels' },
    ]);
    const r = await call('POST', `/api/assistant/${id}/apply`, { skip: [1, 1] });
    expect(r.status).toBe(200);
    expect(r.body.proposal).toMatchObject({ status: 'applied', skipped: [1] });
    const texts = (await call('GET', '/api/todos')).body.map((x: { text: string }) => x.text);
    expect(texts).toContain('Buy gels');
    expect(texts).not.toContain('Book a massage');
    const month = (await call('GET', `/api/months/${shiftDays(t, 3).slice(0, 7)}`)).body;
    expect(month.sessions.find((s: { id: string }) => s.id === a.id).date).toBe(shiftDays(t, 3));
    // the log keeps what was left out, through Undo
    const undone = await call('POST', `/api/assistant/${id}/undo`);
    expect(undone.body.proposal).toMatchObject({ status: 'undone', skipped: [1] });
    expect((await call('GET', '/api/todos')).body.find((x: { text: string }) => x.text === 'Buy gels').deletedOn).toBeTruthy();
  });

  it('runs the rest when the change that went stale is the one removed', async () => {
    const t = today();
    const id = propose([
      { op: 'move_session', id: 'p_gone', to: shiftDays(t, 9) },
      { op: 'add_todo', text: 'Stretch' },
    ]);
    expect((await call('POST', `/api/assistant/${id}/apply`)).status).toBe(409);
    const r = await call('POST', `/api/assistant/${id}/apply`, { skip: [0] });
    expect(r.status).toBe(200);
    expect((await call('GET', '/api/todos')).body.some((x: { text: string }) => x.text === 'Stretch')).toBe(true);
  });

  it('refuses a skip list that does not fit the proposal, changing nothing', async () => {
    const id = propose([
      { op: 'add_todo', text: 'a' },
      { op: 'add_todo', text: 'b' },
    ]);
    for (const body of [{ skip: [2] }, { skip: [-1] }, { skip: [0.5] }, { skip: 'all' }, { skip: [0, 1] }]) {
      const r = await call('POST', `/api/assistant/${id}/apply`, body);
      expect(r.status).toBe(422);
      expect(r.body.code).toBe('validation');
    }
    const bad = await app.request(`/api/assistant/${id}/apply`, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: '{nope' });
    expect(bad.status).toBe(400);
    expect((await call('GET', '/api/todos')).body).toEqual([]);
    // no body still applies the whole proposal, as before
    expect((await call('POST', `/api/assistant/${id}/apply`)).body.proposal.skipped).toBeUndefined();
  });
});

describe('suggested replies', () => {
  it('takes up to three short lines off the end of the answer, and none from a tag that does not parse', () => {
    expect(splitReplies('Two runs left.\n<replies>["Move Thursday to Friday", "What about lifts?"]</replies>')).toEqual({ text: 'Two runs left.', replies: ['Move Thursday to Friday', 'What about lifts?'] });
    expect(splitReplies('Ok. <replies>["a", "b", "c", "d"]</replies>').replies).toEqual(['a', 'b', 'c']);
    expect(splitReplies(`Ok. <replies>["a", "A", "", 4, "${'x'.repeat(81)}"]</replies>`).replies).toEqual(['a']);
    expect(splitReplies('Ok. <replies>not json</replies>')).toEqual({ text: 'Ok.', replies: [] });
    expect(splitReplies('Ok. <replies>{"a": 1}</replies>')).toEqual({ text: 'Ok.', replies: [] });
    expect(splitReplies('Cut off <replies>["Move it')).toEqual({ text: 'Cut off', replies: [] });
    expect(splitReplies('No tag at all.')).toEqual({ text: 'No tag at all.', replies: [] });
  });
});

describe('asking, with a fake Claude', () => {
  type Block = { type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: unknown };
  let configured = env.claudeConfigured;
  const fakeClaude = (...rounds: Block[][]) => {
    let n = 0;
    const stream = vi.fn((_: unknown) => ({
      finalMessage: async () => {
        const content = rounds[Math.min(n++, rounds.length - 1)]!;
        return { stop_reason: content.some((b) => b.type === 'tool_use') ? 'tool_use' : 'end_turn', content } as never;
      },
    }));
    setAssistantClient({ beta: { messages: { stream } } } as never);
    return stream;
  };
  /** Everything Claude was sent in the first call, as one string. */
  const sent = (stream: ReturnType<typeof fakeClaude>) => JSON.stringify(stream.mock.calls[0]![0]);
  beforeEach(() => {
    configured = env.claudeConfigured;
    env.claudeConfigured = true;
  });
  afterEach(() => {
    env.claudeConfigured = configured;
    setAssistantClient(null);
  });

  /** A fake that streams: it sends the events it is given, waiting for `go()` before each one after the first `at`. */
  const streamingClaude = (deltas: string[], at = 1) => {
    const gates: Array<() => void> = [];
    let aborted = false;
    const stream = vi.fn((_: unknown, opts?: { signal?: AbortSignal }) => {
      opts?.signal?.addEventListener('abort', () => (aborted = true));
      const events = async function* () {
        yield { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } };
        yield { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'Checking the week.' } };
        yield { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } };
        for (let i = 0; i < deltas.length; i++) {
          if (i >= at) await new Promise<void>((r) => gates.push(r));
          if (aborted) throw new Error('aborted');
          yield { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: deltas[i] } };
        }
      };
      const it = events();
      return {
        [Symbol.asyncIterator]: () => it,
        finalMessage: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: deltas.join('') }] }) as never,
      };
    });
    setAssistantClient({ beta: { messages: { stream } } } as never);
    return { go: () => gates.shift()?.(), pending: () => gates.length };
  };
  const settle = async () => {
    for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 30));
  };

  it('streams: the phone reads the words so far and the reasoning while it runs, the replies tag held back', async () => {
    const claude = streamingClaude(['You have ', 'two runs left.', '\n<replies>["Move it"]</replies>'], 2);
    const start = await call('POST', '/api/assistant?async=1', { date: today(), turns: [{ role: 'user', text: 'What is left?' }] });
    expect(start.status).toBe(202);
    await settle();
    const mid = await call('GET', `/api/assistant/jobs/${start.body.jobId}`);
    expect(mid.body.status).toBe('running');
    expect(mid.body.live).toMatchObject({ phase: 'writing', text: 'You have two runs left.', thoughts: 'Checking the week.' });
    claude.go();
    await settle();
    const done = await call('GET', `/api/assistant/jobs/${start.body.jobId}`);
    expect(done.body).toMatchObject({ status: 'done', reply: { text: 'You have two runs left.', replies: ['Move it'], thoughts: 'Checking the week.' } });
    expect(typeof done.body.reply.thoughtSeconds).toBe('number');
  });

  it('stops partway: the job reads stopped and Claude’s request is aborted', async () => {
    const claude = streamingClaude(['Half an ', 'answer'], 1);
    const start = await call('POST', '/api/assistant?async=1', { date: today(), turns: [{ role: 'user', text: 'Plan my month' }] });
    await settle();
    expect((await call('DELETE', `/api/assistant/jobs/${start.body.jobId}`)).body).toEqual({ stopped: true });
    claude.go();
    await settle();
    expect((await call('GET', `/api/assistant/jobs/${start.body.jobId}`)).body).toEqual({ status: 'error', error: { message: 'Stopped.', status: 499, code: 'stopped' } });
    expect((await call('DELETE', `/api/assistant/jobs/${start.body.jobId}`)).body).toEqual({ stopped: false });
  });

  it('answers with the suggested replies Claude wrote, without the tag', async () => {
    fakeClaude([{ type: 'text', text: 'You have two runs left this week.\n<replies>["Move Thursday to Friday", "Make Saturday shorter"]</replies>' }]);
    const r = await call('POST', '/api/assistant', { date: today(), turns: [{ role: 'user', text: 'What is left?' }] });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ text: 'You have two runs left this week.', proposal: null, available: true, replies: ['Move Thursday to Friday', 'Make Saturday shorter'] });
  });

  it('names a new conversation and says what it looked at on the way', async () => {
    fakeClaude(
      [{ type: 'tool_use', id: 'tu1', name: 'get_sessions', input: { from: '2026-11-02', to: '2026-11-08' } }],
      [{ type: 'text', text: 'Last week was 31 miles.\n<title>Last week’s miles.</title>\n<replies>["And this week?"]</replies>' }],
    );
    const r = await call('POST', '/api/assistant', { date: today(), turns: [{ role: 'user', text: 'How much did I run last week?' }] });
    expect(r.body).toMatchObject({ text: 'Last week was 31 miles.', title: 'Last week’s miles', steps: ['Read your plan, Nov 2 to Nov 8'], replies: ['And this week?'] });
  });

  it('gives no replies when the tag does not parse, and keeps the answer', async () => {
    fakeClaude([{ type: 'text', text: 'Done looking. <replies>[Move it, later]</replies>' }]);
    const r = await call('POST', '/api/assistant', { date: today(), turns: [{ role: 'user', text: 'hi' }] });
    expect(r.body.text).toBe('Done looking.');
    expect(r.body.replies).toEqual([]);
  });

  it('carries a reason per change, and replies, with a proposal', async () => {
    const t = today();
    const a = (await call('POST', '/api/sessions', { date: shiftDays(t, 1), kind: 'run', title: 'Long 10', miles: 10 })).body;
    fakeClaude([
      { type: 'text', text: 'Here you go. <replies>["Keep it on Sunday instead"]</replies>' },
      { type: 'tool_use', id: 'tu1', name: 'propose_changes', input: { summary: 'Move the long run a day later.', changes: [{ op: 'move_session', id: a.id, to: shiftDays(t, 2), why: 'rain on the day' }, { op: 'add_todo', text: 'Pack a rain jacket' }] } },
    ]);
    const r = await call('POST', '/api/assistant', { date: t, turns: [{ role: 'user', text: 'Move the long run a day' }] });
    expect(r.body.proposal.changes[0]).toMatchObject({ label: expect.stringMatching(/^Move Long 10/), reason: 'rain on the day' });
    expect(r.body.proposal.changes[1].reason).toBeUndefined();
    expect(r.body.replies).toEqual(['Keep it on Sunday instead']);
    // the reason stays with the proposal in the log
    expect((await call('GET', '/api/assistant/log')).body[0].changes[0].reason).toBe('rain on the day');
  });

  it('tells Claude the screen it was opened from, and nothing when the owner removed it', async () => {
    const withScreen = fakeClaude([{ type: 'text', text: 'Ok.' }]);
    await call('POST', '/api/assistant', { date: today(), screen: { tab: 'plan', week: '2026-11-09' }, turns: [{ role: 'user', text: 'What is on this week?' }] });
    expect(sent(withScreen)).toContain('SCREEN: He opened you from Plan, week of Nov 9 (2026-11-09 to 2026-11-15).');
    const without = fakeClaude([{ type: 'text', text: 'Ok.' }]);
    await call('POST', '/api/assistant', { date: today(), turns: [{ role: 'user', text: 'What is on this week?' }] });
    expect(sent(without)).not.toContain('SCREEN:');
    expect((await call('POST', '/api/assistant', { date: today(), screen: { tab: 'settings' }, turns: [{ role: 'user', text: 'x' }] })).status).toBe(422);
  });

  it('never sends Claude a synced activity (Strava data stays out of the model)', async () => {
    const t = today();
    await call('POST', '/api/sessions', { date: shiftDays(t, -1), kind: 'run', title: 'Easy 5', miles: 5 });
    db.insert(activities)
      .values({ id: '13000000099', userId, date: shiftDays(t, -1), time: '07:00', name: 'Rainy Riverside Loop', sportType: 'Run', kind: 'run', distanceM: 8851, movingSec: 2700, elapsedSec: 2760, elevM: 12, avgHr: 151, maxHr: 170, cadence: null, polyline: null, deletedAt: null, updatedAt: new Date().toISOString(), lapsJson: null, perfAt: null, perfFailed: 0 })
      .run();
    const stream = fakeClaude([{ type: 'text', text: 'Ok.' }]);
    await call('POST', '/api/assistant', { date: t, turns: [{ role: 'user', text: 'Did I run yesterday?' }] });
    const all = sent(stream);
    expect(all).toContain('Easy 5');
    expect(all).not.toContain('Rainy Riverside Loop');
    expect(all).not.toContain('5.5 mi');
    expect(all).not.toContain('logged');
  });
});
