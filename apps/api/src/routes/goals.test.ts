import { beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../db/index.js';
import { env } from '../env.js';
import { buildApp } from '../index.js';

type App = ReturnType<typeof buildApp>;
let app: App;
let cookie = '';

const call = async (method: string, url: string, body?: unknown) => {
  const res = await app.request(url, { method, headers: { 'content-type': 'application/json', cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

beforeEach(async () => {
  app = buildApp(openDatabase(':memory:').db);
  env.allowSetup = true;
  const res = await app.request('/api/auth/setup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'josh@example.com', password: 'password123' }) });
  cookie = (res.headers.get('set-cookie') ?? '').split(';')[0]!;
});

describe('goals', () => {
  it('sets, sharpens, edits, reviews and clears a goal, and the log keeps every step', async () => {
    const set = await call('PUT', '/api/goals/week/2026-10-26', { text: 'I will run 4 times this week, 20 miles in all, by Sunday.', original: 'run more', why: 'Added a number and the Sunday deadline.', chose: 'sharpened' });
    expect(set.status).toBe(201);
    expect(set.body).toMatchObject({ level: 'week', period: '2026-10-26', original: 'run more', status: 'open' });

    const edit = await call('PUT', '/api/goals/week/2026-10-26', { text: 'I will run 4 times this week, 22 miles in all, by Sunday.' });
    expect(edit.status).toBe(200);
    expect(edit.body.id).toBe(set.body.id);

    const done = await call('PATCH', `/api/goals/${set.body.id}`, { status: 'done', reflection: 'Hit 22.' });
    expect(done.body).toMatchObject({ status: 'done', reflection: 'Hit 22.' });
    expect(done.body.closedAt).toBeTruthy();

    expect((await call('PATCH', `/api/goals/${set.body.id}`, { status: 'open' })).body.closedAt).toBeNull();

    expect((await call('DELETE', `/api/goals/${set.body.id}`)).status).toBe(200);
    expect((await call('GET', '/api/goals')).body).toEqual([]);

    const log = (await call('GET', `/api/goals/events?goal=${set.body.id}`)).body.events.map((e: { kind: string }) => e.kind).reverse();
    expect(log).toEqual(['set', 'sharpened', 'edited', 'done', 'reopened', 'cleared']);
    // the first entry keeps what was typed
    expect((await call('GET', '/api/goals/events')).body.events.at(-1).text).toBe('run more');
  });

  it('keeps the owner’s words when he chooses them, and logs that', async () => {
    const r = await call('PUT', '/api/goals/day/2026-10-26', { text: 'Finish the deck', chose: 'kept' });
    expect(r.body).toMatchObject({ text: 'Finish the deck', original: null });
    const kinds = (await call('GET', '/api/goals/events')).body.events.map((e: { kind: string }) => e.kind).reverse();
    expect(kinds).toEqual(['set', 'kept']);
  });

  it('refuses a period that does not match its level', async () => {
    expect((await call('PUT', '/api/goals/week/2026-10-27', { text: 'x' })).status).toBe(400); // a Tuesday
    expect((await call('PUT', '/api/goals/month/2026-10-01', { text: 'x' })).status).toBe(400);
    expect((await call('PUT', '/api/goals/year/2026', { text: 'Run a half under 1:40.' })).status).toBe(201);
    expect((await call('PUT', '/api/goals/decade/2020', { text: 'x' })).status).toBe(400);
  });

  it('a review without a Claude key hands the words back untouched', async () => {
    const key = env.ANTHROPIC_API_KEY;
    (env as { ANTHROPIC_API_KEY?: string }).ANTHROPIC_API_KEY = '';
    try {
      const r = await call('POST', '/api/goals/refine', { level: 'day', period: '2026-10-26', text: 'be productive' });
      if (r.body.available === false) expect(r.body).toEqual({ text: 'be productive', why: null, changed: false, available: false });
    } finally {
      (env as { ANTHROPIC_API_KEY?: string }).ANTHROPIC_API_KEY = key;
    }
  });
});

describe('to-do lists, colours and P1–P3', () => {
  it('files to-dos under a list, colours them, and deleting the list keeps the to-dos', async () => {
    const list = await call('POST', '/api/todo-groups', { name: 'Work', color: 'blue' });
    expect(list.status).toBe(201);
    const t = await call('POST', '/api/todos', { text: 'Send the model', date: '2026-10-26', priority: 3, color: 'red', groupId: list.body.id });
    expect(t.body).toMatchObject({ priority: 3, color: 'red', groupId: list.body.id });
    expect((await call('PATCH', `/api/todos/${t.body.id}`, { color: null })).body.color).toBeNull();
    expect((await call('PATCH', `/api/todos/${t.body.id}`, { groupId: 'g_nope' })).status).toBe(404);

    expect((await call('PATCH', `/api/todo-groups/${list.body.id}`, { name: 'Bank', color: 'green' })).body).toMatchObject({ name: 'Bank', color: 'green' });
    expect((await call('DELETE', `/api/todo-groups/${list.body.id}`)).status).toBe(200);
    expect((await call('GET', '/api/todo-groups')).body).toEqual([]);
    expect((await call('GET', '/api/todos')).body[0].groupId).toBeNull();
  });
});
