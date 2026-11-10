import { today } from '@logbook/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../db/index.js';
import { env } from '../env.js';
import { buildApp } from '../index.js';

let app: ReturnType<typeof buildApp>;
let cookie = '';
const T = today();
const call = async (method: string, url: string, body?: unknown) => {
  const res = await app.request(url, { method, headers: { 'content-type': 'application/json', cookie, 'x-local-date': T }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

beforeEach(async () => {
  app = buildApp(openDatabase(':memory:').db);
  env.allowSetup = true;
  const res = await app.request('/api/auth/setup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'josh@example.com', password: 'correct horse 42' }) });
  cookie = (res.headers.get('set-cookie') ?? '').split(';')[0]!;
});

describe('session effort', () => {
  it('stores 1 to 10 on a session, clears with null, and refuses anything else', async () => {
    const s = await call('POST', '/api/sessions', { date: T, kind: 'run', type: 'easy', title: 'Easy 5', miles: 5 });
    expect(s.body.effort).toBeNull();
    const set = await call('POST', `/api/sessions/${s.body.id}/effort`, { effort: 6 });
    expect(set.status).toBe(200);
    expect(set.body.effort).toBe(6);
    const month = await call('GET', `/api/months/${T.slice(0, 7)}`);
    expect(month.body.sessions.find((x: { id: string }) => x.id === s.body.id).effort).toBe(6);
    for (const bad of [0, 11, 5.5, '6']) expect((await call('POST', `/api/sessions/${s.body.id}/effort`, { effort: bad })).status).toBe(422);
    expect((await call('POST', `/api/sessions/${s.body.id}/effort`, { effort: null })).body.effort).toBeNull();
    expect((await call('POST', '/api/sessions/nope/effort', { effort: 3 })).status).toBe(404);
  });

  it('says "Effort 6" on the run’s line in the day’s timeline, and keeps the line’s time when the effort changes later', async () => {
    const s = await call('POST', '/api/sessions', { date: T, kind: 'run', type: 'easy', title: 'Easy 5', miles: 5 });
    await call('POST', `/api/sessions/${s.body.id}/mark`, { mark: 'done' });
    const before = (await call('GET', `/api/day/${T}/timeline`)).body.items.find((i: { kind: string }) => i.kind === 'run');
    await call('POST', `/api/sessions/${s.body.id}/effort`, { effort: 6 });
    const after = (await call('GET', `/api/day/${T}/timeline`)).body.items.find((i: { kind: string }) => i.kind === 'run');
    expect(after.sub).toBe('Done · 5 mi · Effort 6');
    expect(after.at).toBe(before.at);
  });

  it('goes into the export and comes back on a restore', async () => {
    const s = await call('POST', '/api/sessions', { date: T, kind: 'lift', type: 'Strength', title: 'Lift', minutes: 40 });
    await call('POST', `/api/sessions/${s.body.id}/effort`, { effort: 8 });
    const ex = await call('GET', '/api/export');
    expect(ex.status).toBe(200);
    expect(ex.body.sessions.find((x: { id: string }) => x.id === s.body.id).effort).toBe(8);
  });
});
