import { shiftDays, today } from '@logbook/shared';
import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type DB } from '../db/index.js';
import { env } from '../env.js';
import { buildApp } from '../index.js';

let app: ReturnType<typeof buildApp>;
let db: DB;
let cookie = '';
const T = today();
const call = async (method: string, url: string, body?: unknown) => {
  const res = await app.request(url, { method, headers: { 'content-type': 'application/json', cookie, 'x-local-date': T }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

beforeEach(async () => {
  db = openDatabase(':memory:').db;
  app = buildApp(db);
  env.allowSetup = true;
  const res = await app.request('/api/auth/setup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'josh@example.com', password: 'password123' }) });
  cookie = (res.headers.get('set-cookie') ?? '').split(';')[0]!;
});

describe('day tags', () => {
  it('starts with the four, marks a day yes or no, and clears a mark', async () => {
    const d = await call('GET', `/api/journal/tags/${T}`);
    expect(d.body.tags.map((t: { id: string }) => t.id)).toEqual(['alcohol', 'late-screens', 'reading', 'stretching']);
    expect(d.body.values).toEqual({});
    expect((await call('PUT', `/api/journal/tags/${T}`, { tag: 'alcohol', value: false })).body.values).toEqual({ alcohol: false });
    expect((await call('PUT', `/api/journal/tags/${T}`, { tag: 'reading', value: true })).body.values).toEqual({ alcohol: false, reading: true });
    expect((await call('PUT', `/api/journal/tags/${T}`, { tag: 'alcohol', value: null })).body.values).toEqual({ reading: true });
  });

  it('refuses a day to come and a tag that is not on the list', async () => {
    expect((await call('PUT', `/api/journal/tags/${shiftDays(T, 1)}`, { tag: 'alcohol', value: true })).status).toBe(422);
    expect((await call('PUT', `/api/journal/tags/${T}`, { tag: 'coffee', value: true })).status).toBe(404);
    expect((await call('GET', '/api/journal/tags/not-a-day')).status).toBe(400);
  });

  it('adds and removes tags; a removed tag keeps its marks', async () => {
    const add = await call('POST', '/api/journal/tags', { label: 'Coffee after 2pm' });
    expect(add.body.tags.at(-1)).toEqual({ id: 'coffee-after-2pm', label: 'Coffee after 2pm' });
    // the same name twice is one tag
    expect((await call('POST', '/api/journal/tags', { label: 'coffee after 2PM' })).body.tags).toHaveLength(5);
    await call('PUT', `/api/journal/tags/${T}`, { tag: 'coffee-after-2pm', value: true });
    expect((await call('DELETE', '/api/journal/tags/coffee-after-2pm')).body.tags).toHaveLength(4);
    await call('POST', '/api/journal/tags', { label: 'Coffee after 2pm' });
    expect((await call('GET', `/api/journal/tags/${T}`)).body.values).toEqual({ 'coffee-after-2pm': true });
  });

  it('counts each tag and shows no effect while runs have no effort', async () => {
    for (let i = 1; i <= 6; i++) await call('PUT', `/api/journal/tags/${shiftDays(T, -i)}`, { tag: 'alcohol', value: i % 2 === 0 });
    const s = await call('GET', '/api/journal/tags/stats');
    expect(s.body.effort).toBe(false);
    expect(s.body.min).toBe(5);
    expect(s.body.tags[0]).toMatchObject({ id: 'alcohol', yes: 3, no: 3, ratedYes: 0, ratedNo: 0, effect: null });
  });

  it('shows the effect on the next day’s run once runs carry effort and there are five of each', async () => {
    db.run(sql`alter table training_sessions add column effort integer`);
    const me = (await call('GET', '/api/me')).body.id as string;
    for (let i = 0; i < 10; i++) {
      const day = shiftDays(T, -2 * (i + 1));
      await call('PUT', `/api/journal/tags/${day}`, { tag: 'alcohol', value: i < 5 });
      db.run(sql`insert into training_sessions (id, user_id, date, position, kind, created_at, updated_at, effort) values (${`s${i}`}, ${me}, ${shiftDays(day, 1)}, 0, 'run', ${T}, ${T}, ${i < 5 ? 7 : 5})`);
    }
    const s = await call('GET', '/api/journal/tags/stats');
    expect(s.body.effort).toBe(true);
    expect(s.body.tags[0]).toMatchObject({ yes: 5, no: 5, ratedYes: 5, ratedNo: 5, effect: { yes: 7, no: 5 } });
  });

  it('goes with the account export', async () => {
    await call('PUT', `/api/journal/tags/${T}`, { tag: 'reading', value: true });
    expect((await call('GET', '/api/export')).body.dayTags).toEqual([{ date: T, tag: 'reading', value: true }]);
  });
});
