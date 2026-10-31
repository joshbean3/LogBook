import { shiftDays, today } from '@logbook/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type DB } from '../db/index.js';
import { activities, providerConnections } from '../db/schema.js';
import { env } from '../env.js';
import { buildApp } from '../index.js';
import { resetRateLimits } from '../lib/ratelimit.js';
import { DRAFT_LIMIT } from './ai.js';

type App = ReturnType<typeof buildApp>;
let app: App;
let db: DB;
let cookie = '';
let userId = '';

const call = async (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) => {
  const res = await app.request(url, { method, headers: { 'content-type': 'application/json', cookie, ...headers }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

beforeEach(async () => {
  db = openDatabase(':memory:').db;
  app = buildApp(db);
  env.allowSetup = true;
  resetRateLimits();
  const res = await app.request('/api/auth/setup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'josh@example.com', password: 'password123' }) });
  cookie = (res.headers.get('set-cookie') ?? '').split(';')[0]!;
  userId = (await call('GET', '/api/me')).body.id;
});

describe('multi-tenant basics', () => {
  it('refuses a body over 1 MB with a 413 (25 MB on the plan draft route)', async () => {
    const big = JSON.stringify({ text: 'x'.repeat(1024 * 1024 + 10), date: today() });
    const r = await call('POST', '/api/journal/entries', big);
    expect(r.status).toBe(413);
    expect(r.body.code).toBe('too_big');
    // the draft route takes it (and then refuses it for what it is, not its size)
    const d = await call('POST', '/api/plans/draft', big);
    expect(d.status).not.toBe(413);
  });

  it('limits plan drafts to ten a day', async () => {
    for (let i = 0; i < DRAFT_LIMIT.limit; i++) {
      const r = await call('POST', '/api/plans/draft', { mode: 'text', text: 'short', start: today() });
      expect(r.status).toBe(422);
    }
    const over = await call('POST', '/api/plans/draft', { mode: 'text', text: 'short', start: today() });
    expect(over.status).toBe(429);
    expect(over.body.error).toMatch(/10 a day/);
  });

  it('the bootstrap carries the time zone, the note, the connections, push and the features', async () => {
    const b = (await call('GET', '/api/bootstrap', undefined, { 'x-timezone': 'Europe/Paris' })).body;
    expect(b.user).toMatchObject({ timezone: 'Europe/Paris', profileNote: null });
    expect(b.strava).toMatchObject({ connected: false, configured: expect.any(Boolean) });
    expect(b.connections.map((c: { provider: string }) => c.provider)).toEqual(['strava', 'coros']);
    expect(b.pushEnabled).toBe(false);
    expect(b.features).toEqual({ claude: expect.any(Boolean), strava: expect.any(Boolean), coros: false, notifications: false });
    const me = await call('PATCH', '/api/me', { profileNote: 'Runs before work. Banker, long days.' });
    expect(me.body.profileNote).toBe('Runs before work. Banker, long days.');
    expect((await call('GET', '/api/bootstrap')).body.user.profileNote).toBe('Runs before work. Banker, long days.');
    expect((await call('PATCH', '/api/me', { name: 'Josh' })).body).toMatchObject({ name: 'Josh', profileNote: 'Runs before work. Banker, long days.' });
    expect((await call('PATCH', '/api/me', {})).status).toBe(422);
  });

  it('the export carries the new tables', async () => {
    const t = today();
    await call('PUT', `/api/day-plans/${t}`, { bands: { morning: ['todo:x'], afternoon: [], evening: [] } });
    await call('POST', '/api/reminders', { title: 'Stretch', at: new Date(Date.now() + 3600_000).toISOString() });
    await call('POST', '/api/assistant/new');
    const e = (await call('GET', '/api/export')).body;
    expect(e.dayPlans).toEqual([expect.objectContaining({ date: t, bands: { morning: ['todo:x'], afternoon: [], evening: [] } })]);
    expect(e.reminders).toEqual([expect.objectContaining({ title: 'Stretch' })]);
    expect(e.memories).toEqual([]);
    expect(e.assistantThreads).toEqual([expect.objectContaining({ messages: [] })]);
    expect(e).toHaveProperty('timezone');
    expect(e).toHaveProperty('profileNote');
  });
});

describe('POST /plans/apply with replace (writeTemplate semantics)', () => {
  it('keeps a Strava-completed, unmarked run, never touches the past, and answers replacedIds the undo route takes back', async () => {
    const t = today();
    const add = async (date: string, extra: Record<string, unknown> = {}) => (await call('POST', '/api/sessions', { date, kind: 'run', type: 'Easy', miles: 4, ...extra })).body.id as string;
    const ran = await add(t); // today's run, unmarked, but Strava has it
    db.insert(providerConnections).values({ userId, provider: 'strava', externalAthleteId: '1', athleteName: 'A', accessToken: 't', refreshToken: 'r', expiresAt: 0, scope: null, cursor: null, lastSyncAt: null, lastError: null, status: 'ok', connectedAt: 'x' }).run();
    db.insert(activities).values({ id: 'a1', userId, provider: 'strava', externalId: 'a1', date: t, time: '06:30', name: 'Morning Run', sportType: 'Run', kind: 'run', distanceM: 6600, movingSec: 2000, elapsedSec: 2000, elevM: 0, updatedAt: 'x' }).run();
    const planned = await add(shiftDays(t, 2));
    const past = await add(shiftDays(t, -2));
    const draft = { name: 'Next block', summary: '', notes: [], start: shiftDays(t, -3), end: shiftDays(t, 10), sessions: [{ date: shiftDays(t, 3), kind: 'run', type: 'Tempo', title: 'Tempo 5', details: '', miles: 5, minutes: null }] };
    const r = await call('POST', '/api/plans/apply', { draft, mode: 'replace' });
    expect(r.status).toBe(201);
    expect(r.body.replacedIds).toEqual([planned]);
    expect(r.body.removed).toBe(1);
    expect(r.body.endedBlocks).toEqual([]);
    const liveOn = async (d: string) => (await call('GET', `/api/months/${d.slice(0, 7)}`)).body.sessions.filter((s: { date: string }) => s.date === d).map((s: { id: string }) => s.id);
    expect(await liveOn(t)).toContain(ran);
    expect(await liveOn(shiftDays(t, -2))).toContain(past);
    expect(await liveOn(shiftDays(t, 2))).toEqual([]);
    // Undo through the template flow puts the planned one back and drops the block
    const u = await call('POST', '/api/plans/template/undo', { blockId: r.body.block.id, replacedIds: r.body.replacedIds, endedBlocks: r.body.endedBlocks });
    expect(u.status).toBe(200);
    expect(u.body.restored).toBe(1);
    expect(await liveOn(shiftDays(t, 2))).toEqual([planned]);
    expect(await liveOn(shiftDays(t, 3))).toEqual([]);
    expect((await call('GET', '/api/bootstrap')).body.blocks).toEqual([]);
  });
});
