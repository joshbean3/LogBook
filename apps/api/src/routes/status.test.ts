import { shiftDays, today } from '@logbook/shared';
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
  const res = await app.request('/api/auth/setup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'josh@example.com', password: 'password123' }) });
  cookie = (res.headers.get('set-cookie') ?? '').split(';')[0]!;
});

describe('training status', () => {
  it('sets a status from today through an end day, shows it on /me and the bootstrap, and clears with training', async () => {
    const until = shiftDays(T, 2);
    const put = await call('PUT', '/api/me/status', { kind: 'sick', until });
    expect(put.status).toBe(200);
    expect(put.body.status).toEqual({ kind: 'sick', from: T, until });
    expect((await call('GET', '/api/me')).body.status).toEqual({ kind: 'sick', from: T, until });
    expect((await call('GET', '/api/bootstrap')).body.user.status).toEqual({ kind: 'sick', from: T, until });
    const clear = await call('PUT', '/api/me/status', { kind: 'training', until: null });
    expect(clear.body.status).toBeNull();
    expect((await call('GET', '/api/me')).body.status).toBeNull();
  });

  it('refuses an end day that has passed and an unknown kind', async () => {
    expect((await call('PUT', '/api/me/status', { kind: 'rest', until: shiftDays(T, -1) })).status).toBe(422);
    expect((await call('PUT', '/api/me/status', { kind: 'vacation', until: null })).status).toBe(422);
  });
});

describe('day timeline', () => {
  it('lists the day’s habit taps, marked sessions, learnings and entries, and nothing from other days', async () => {
    await call('POST', '/api/me/onboarding', { goal: 'half', runDays: ['mon', 'wed', 'fri', 'sat'], longRunDay: 'sat', weeklyMiles: 25, wake: 390, leave: 510, habits: ['Meditate', 'Stretch'], start: 'tomorrow', today: T });
    const hs = (await call('GET', '/api/habits')).body as Array<{ id: string; name: string }>;
    await call('PUT', `/api/habits/${hs[0]!.id}/days/${T}`, { done: true });
    await call('PUT', `/api/habits/${hs[1]!.id}/days/${shiftDays(T, -1)}`, { done: true });
    const s = await call('POST', '/api/sessions', { date: T, kind: 'run', type: 'easy', title: 'Easy 5', miles: 5 });
    await call('POST', `/api/sessions/${s.body.id}/mark`, { mark: 'done' });
    await call('POST', '/api/learnings', { text: 'Strides are pickups, not sprints.' });
    const tl = await call('GET', `/api/day/${T}/timeline`);
    expect(tl.status).toBe(200);
    const kinds = tl.body.items.map((i: { kind: string; title: string }) => `${i.kind}:${i.title}`).sort();
    expect(kinds).toEqual(['habit:Meditate', 'learned:Strides are pickups, not sprints.', 'run:Easy 5'].sort());
    expect(tl.body.items.find((i: { kind: string }) => i.kind === 'run').sub).toBe('Done · 5 mi');
    expect((await call('GET', '/api/day/nope/timeline')).status).toBe(400);
  });
});

describe('Strava data stays out of AI', () => {
  it('the run note is refused with the reason, since every synced run comes from Strava', async () => {
    const r = await call('POST', '/api/coach/read', { date: T, sessionId: null });
    expect(r.status).toBe(422);
    expect(r.body.code).toBe('strava_terms');
  });
});

describe('the privacy choice reaches the assistant', () => {
  it('with training data off, the assistant context carries none of it; on, it does', async () => {
    const { contextFor } = await import('../services/assistant.js');
    const { writeConsent } = await import('../services/consent.js');
    const db = openDatabase(':memory:').db;
    app = buildApp(db);
    const res = await app.request('/api/auth/setup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'pv@example.com', password: 'password123' }) });
    cookie = (res.headers.get('set-cookie') ?? '').split(';')[0]!;
    const { mondayOf } = await import('@logbook/shared');
    const goal = await call('PUT', `/api/goals/week/${mondayOf(T)}`, { text: 'Run four times' });
    const me = (await call('GET', '/api/me')).body.id as string;
    const on = contextFor(db, me, T, T);
    expect(goal.status).toBeLessThan(300);
    expect(on).toContain('Run four times');
    expect(on).toContain('PLAN BLOCKS');
    writeConsent(db, me, { training: false });
    const off = contextFor(db, me, T, T);
    expect(off).toContain('turned off reading their training data');
    expect(off).not.toContain('PLAN BLOCKS');
    expect(off).not.toContain('Run four times');
  });
});
