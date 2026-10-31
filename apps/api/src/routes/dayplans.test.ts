import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type DB } from '../db/index.js';
import { env } from '../env.js';
import { buildApp } from '../index.js';

let app: ReturnType<typeof buildApp>;
let db: DB;
let cookie = '';
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
});

describe('day plans', () => {
  it('reads empty, keeps the order it is given, and holds each reference once', async () => {
    expect((await call('GET', '/api/day-plans/2026-10-31')).body).toMatchObject({ date: '2026-10-31', bands: { morning: [], afternoon: [], evening: [] }, slots: [], updatedAt: null });
    const put = await call('PUT', '/api/day-plans/2026-10-31', { bands: { morning: ['todo:t_b', 'step:g_1:s1', 'todo:t_a'], afternoon: ['todo:t_b'], evening: [] } });
    expect(put.status).toBe(200);
    expect(put.body.bands).toEqual({ morning: ['todo:t_b', 'step:g_1:s1', 'todo:t_a'], afternoon: [], evening: [] });
    expect(put.body.slots).toEqual([]);
    await call('PUT', '/api/day-plans/2026-10-31', { bands: { morning: ['todo:t_a'], afternoon: [], evening: ['todo:t_b'] } });
    expect((await call('GET', '/api/day-plans/2026-10-31')).body.bands).toEqual({ morning: ['todo:t_a'], afternoon: [], evening: ['todo:t_b'] });
    expect((await call('GET', '/api/day-plans/2026-11-01')).body.bands.evening).toEqual([]);
  });

  it('slots round-trip sorted by start, and a slot takes its ref out of the bands', async () => {
    const put = await call('PUT', '/api/day-plans/2026-10-31', {
      bands: { morning: ['todo:t_a', 'todo:t_b'], afternoon: ['step:g_1:s1'], evening: [] },
      slots: [
        { ref: 'step:g_1:s1', start: 600, minutes: 45 },
        { ref: 'todo:t_a', start: 540, minutes: 30 },
        { ref: 'session:p_1', start: 410, minutes: 50 },
      ],
    });
    expect(put.status).toBe(200);
    expect(put.body.slots).toEqual([
      { ref: 'session:p_1', start: 410, minutes: 50 },
      { ref: 'todo:t_a', start: 540, minutes: 30 },
      { ref: 'step:g_1:s1', start: 600, minutes: 45 },
    ]);
    expect(put.body.bands).toEqual({ morning: ['todo:t_b'], afternoon: [], evening: [] });
    expect((await call('GET', '/api/day-plans/2026-10-31')).body).toMatchObject({ slots: put.body.slots, bands: put.body.bands });

    // slots alone keep the bands; bands alone keep the slots (and still lose what is placed)
    const only = await call('PUT', '/api/day-plans/2026-10-31', { slots: [{ ref: 'todo:t_a', start: 900, minutes: 30 }] });
    expect(only.body).toMatchObject({ slots: [{ ref: 'todo:t_a', start: 900, minutes: 30 }], bands: { morning: ['todo:t_b'], afternoon: [], evening: [] } });
    const bands = await call('PUT', '/api/day-plans/2026-10-31', { bands: { morning: ['todo:t_a', 'todo:t_c'], afternoon: [], evening: [] } });
    expect(bands.body).toMatchObject({ slots: [{ ref: 'todo:t_a', start: 900, minutes: 30 }], bands: { morning: ['todo:t_c'], afternoon: [], evening: [] } });

    // delete clears the day
    expect((await call('DELETE', '/api/day-plans/2026-10-31')).body).toEqual({ date: '2026-10-31', bands: { morning: [], afternoon: [], evening: [] }, slots: [], updatedAt: null });
    expect((await call('GET', '/api/day-plans/2026-10-31')).body.slots).toEqual([]);
  });

  it('a row written before the slots column reads with none', async () => {
    db.run(sql`insert into day_plans (id, user_id, date, bands, updated_at) select 'dp_old', id, '2026-10-30', '{"morning":["todo:t_a"],"afternoon":[],"evening":[]}', '2026-10-30T06:00:00.000Z' from users`);
    expect((await call('GET', '/api/day-plans/2026-10-30')).body).toEqual({ date: '2026-10-30', bands: { morning: ['todo:t_a'], afternoon: [], evening: [] }, slots: [], updatedAt: '2026-10-30T06:00:00.000Z' });
    db.run(sql`update day_plans set slots = 'not json' where id = 'dp_old'`);
    expect((await call('GET', '/api/day-plans/2026-10-30')).body.slots).toEqual([]);
  });

  it('refuses a bad date, a bad reference, a slot off the grid, or a body with neither', async () => {
    expect((await call('GET', '/api/day-plans/tomorrow')).status).toBe(400);
    expect((await call('PUT', '/api/day-plans/2026-10-31', { bands: { morning: ['<script>'], afternoon: [], evening: [] } })).status).toBe(422);
    expect((await call('PUT', '/api/day-plans/2026-10-31', { slots: [{ ref: 'todo:t_a', start: 542, minutes: 30 }] })).status).toBe(422);
    expect((await call('PUT', '/api/day-plans/2026-10-31', { slots: [{ ref: 'todo:t_a', start: 540, minutes: 2 }] })).status).toBe(422);
    expect((await call('PUT', '/api/day-plans/2026-10-31', {})).status).toBe(422);
  });
});
