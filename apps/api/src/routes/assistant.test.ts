import { shiftDays, today } from '@logbook/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type DB } from '../db/index.js';
import { assistantActions } from '../db/schema.js';
import { env } from '../env.js';
import { buildApp } from '../index.js';
import { labelOp } from '../services/assistant.js';

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
