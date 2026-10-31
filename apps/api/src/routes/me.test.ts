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

const DEFAULTS = { window: { start: 360, end: 1380 }, workHours: { start: 540, end: 1080 } };

describe('GET/PATCH /me/day', () => {
  it('reads the defaults, keeps a patch of either range, and the bootstrap carries it', async () => {
    expect((await call('GET', '/api/me/day')).body).toEqual(DEFAULTS);
    expect((await call('GET', '/api/bootstrap')).body.daySettings).toEqual(DEFAULTS);
    const p = await call('PATCH', '/api/me/day', { window: { start: 300, end: 1320 } });
    expect(p.status).toBe(200);
    expect(p.body).toEqual({ window: { start: 300, end: 1320 }, workHours: DEFAULTS.workHours });
    expect((await call('PATCH', '/api/me/day', { workHours: { start: 480, end: 1020 } })).body).toEqual({ window: { start: 300, end: 1320 }, workHours: { start: 480, end: 1020 } });
    expect((await call('GET', '/api/me/day')).body).toEqual({ window: { start: 300, end: 1320 }, workHours: { start: 480, end: 1020 } });
    expect((await call('GET', '/api/bootstrap')).body.daySettings).toEqual({ window: { start: 300, end: 1320 }, workHours: { start: 480, end: 1020 } });
  });

  it('refuses a range outside the day, a start at or after its end, or nothing to change', async () => {
    expect((await call('PATCH', '/api/me/day', { window: { start: 360, end: 1440 } })).status).toBe(422);
    expect((await call('PATCH', '/api/me/day', { window: { start: 600, end: 600 } })).status).toBe(422);
    expect((await call('PATCH', '/api/me/day', { workHours: { start: 1080, end: 540 } })).status).toBe(422);
    expect((await call('PATCH', '/api/me/day', { window: { start: 7.5, end: 600 } })).status).toBe(422);
    expect((await call('PATCH', '/api/me/day', {})).status).toBe(422);
    expect((await call('GET', '/api/me/day')).body).toEqual(DEFAULTS);
  });
});
