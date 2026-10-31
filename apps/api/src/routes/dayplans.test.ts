import { beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../db/index.js';
import { env } from '../env.js';
import { buildApp } from '../index.js';

let app: ReturnType<typeof buildApp>;
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

describe('day plans', () => {
  it('reads empty, keeps the order it is given, and holds each reference once', async () => {
    expect((await call('GET', '/api/day-plans/2026-10-31')).body).toMatchObject({ date: '2026-10-31', bands: { morning: [], afternoon: [], evening: [] }, updatedAt: null });
    const put = await call('PUT', '/api/day-plans/2026-10-31', { bands: { morning: ['todo:t_b', 'step:g_1:s1', 'todo:t_a'], afternoon: ['todo:t_b'], evening: [] } });
    expect(put.status).toBe(200);
    expect(put.body.bands).toEqual({ morning: ['todo:t_b', 'step:g_1:s1', 'todo:t_a'], afternoon: [], evening: [] });
    await call('PUT', '/api/day-plans/2026-10-31', { bands: { morning: ['todo:t_a'], afternoon: [], evening: ['todo:t_b'] } });
    expect((await call('GET', '/api/day-plans/2026-10-31')).body.bands).toEqual({ morning: ['todo:t_a'], afternoon: [], evening: ['todo:t_b'] });
    expect((await call('GET', '/api/day-plans/2026-11-01')).body.bands.evening).toEqual([]);
  });

  it('refuses a bad date or a bad reference', async () => {
    expect((await call('GET', '/api/day-plans/tomorrow')).status).toBe(400);
    expect((await call('PUT', '/api/day-plans/2026-10-31', { bands: { morning: ['<script>'], afternoon: [], evening: [] } })).status).toBe(422);
  });
});
