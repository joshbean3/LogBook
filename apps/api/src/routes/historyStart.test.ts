import { shiftDays, today } from '@logbook/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type DB } from '../db/index.js';
import { activities } from '../db/schema.js';
import { env } from '../env.js';
import { buildApp } from '../index.js';

let app: ReturnType<typeof buildApp>;
let db: DB;
let cookie = '';
const T = today();
const call = async (method: string, url: string, body?: unknown, as = cookie) => {
  const res = await app.request(url, { method, headers: { 'content-type': 'application/json', cookie: as, 'x-local-date': T }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};
const me = async () => (await call('GET', '/api/bootstrap')).body.user.id as string;
const activity = (userId: string, date: string, kind = 'run', deletedAt: string | null = null) =>
  db.insert(activities).values({ id: `a-${date}-${kind}`, userId, date, time: null, name: 'Run', sportType: 'Run', kind, distanceM: 5000, movingSec: 1500, elapsedSec: 1500, elevM: 0, deletedAt, updatedAt: new Date().toISOString() }).run();

beforeEach(async () => {
  db = openDatabase(':memory:').db;
  app = buildApp(db);
  env.allowSetup = true;
  const res = await app.request('/api/auth/setup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'josh@example.com', password: 'correct horse 42' }) });
  cookie = (res.headers.get('set-cookie') ?? '').split(';')[0]!;
});

describe('where run history starts', () => {
  it('is null with no runs, planned or done', async () => {
    await call('POST', '/api/sessions', { date: T, kind: 'lift', title: 'Lift', minutes: 40 });
    expect((await call('GET', '/api/activities/start')).body).toEqual({ first: null });
  });

  it('is the earliest run session or run activity, whichever comes first', async () => {
    await call('POST', '/api/sessions', { date: shiftDays(T, -30), kind: 'run', type: 'easy', miles: 4 });
    expect((await call('GET', '/api/activities/start')).body.first).toBe(shiftDays(T, -30));
    const uid = await me();
    activity(uid, shiftDays(T, -400));
    // a ride or a deleted run does not start the history
    activity(uid, shiftDays(T, -900), 'ride');
    activity(uid, shiftDays(T, -800), 'run', new Date().toISOString());
    expect((await call('GET', '/api/activities/start')).body.first).toBe(shiftDays(T, -400));
  });

  it('leaves out a deleted session, and never reads another account', async () => {
    const s = await call('POST', '/api/sessions', { date: shiftDays(T, -10), kind: 'run', type: 'easy', miles: 4 });
    await call('DELETE', `/api/sessions/${s.body.id}`);
    expect((await call('GET', '/api/activities/start')).body.first).toBeNull();
    activity(await me(), shiftDays(T, -5));
    const was = env.allowSignup;
    env.allowSignup = true;
    const other = await app.request('/api/auth/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'sam@example.com', password: 'correct horse 43' }) });
    env.allowSignup = was;
    const otherCookie = (other.headers.get('set-cookie') ?? '').split(';')[0]!;
    expect(other.status).toBeLessThan(300);
    expect((await call('GET', '/api/activities/start', undefined, otherCookie)).body).toEqual({ first: null });
  });

  it('needs a signed-in account', async () => {
    expect((await call('GET', '/api/activities/start', undefined, '')).status).toBe(401);
  });
});
