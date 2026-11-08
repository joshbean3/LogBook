import { shiftDays, today } from '@logbook/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../db/index.js';
import { env } from '../env.js';
import { buildApp } from '../index.js';
import { echoesOf, streakOf } from './learned.js';

let app: ReturnType<typeof buildApp>;
let cookie = '';
const T = today();
const call = async (method: string, url: string, body?: unknown, day = T) => {
  const res = await app.request(url, { method, headers: { 'content-type': 'application/json', cookie, 'x-local-date': day }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

beforeEach(async () => {
  app = buildApp(openDatabase(':memory:').db);
  env.allowSetup = true;
  const res = await app.request('/api/auth/setup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'josh@example.com', password: 'password123' }) });
  cookie = (res.headers.get('set-cookie') ?? '').split(';')[0]!;
});

describe('what I learned', () => {
  it('creates on the request’s day, trims, and lists newest first', async () => {
    const a = await call('POST', '/api/learnings', { text: '  Lactate is fuel, not waste.  ' });
    expect(a.status).toBe(201);
    expect(a.body).toMatchObject({ date: T, text: 'Lactate is fuel, not waste.', editedAt: null });
    expect(a.body.id).toMatch(/^l_/);
    await call('POST', '/api/learnings', { date: shiftDays(T, -3), text: 'Older' });
    const b = await call('POST', '/api/learnings', { date: T, text: 'Second today' });
    const list = await call('GET', '/api/learnings');
    expect(list.status).toBe(200);
    expect(list.body.learnings.map((x: { text: string }) => x.text)).toEqual(['Second today', 'Lactate is fuel, not waste.', 'Older']);
    expect(list.body.next).toBeNull();
    expect(list.body.learnings[0].id).toBe(b.body.id);
  });

  it('pages with a cursor, never repeating or dropping a row', async () => {
    for (let i = 0; i < 7; i++) await call('POST', '/api/learnings', { date: shiftDays(T, -Math.floor(i / 2)), text: `n${i}` });
    const seen: string[] = [];
    let before: string | null = null;
    let pages = 0;
    do {
      const r: { body: { learnings: Array<{ text: string }>; next: string | null } } = await call('GET', `/api/learnings?limit=3${before ? `&before=${encodeURIComponent(before)}` : ''}`);
      seen.push(...r.body.learnings.map((x) => x.text));
      before = r.body.next;
      pages++;
    } while (before && pages < 10);
    expect(pages).toBe(3);
    expect(seen).toEqual(['n1', 'n0', 'n3', 'n2', 'n5', 'n4', 'n6']);
    expect((await call('GET', '/api/learnings?before=nonsense')).status).toBe(400);
  });

  it('keeps an archive by month, and filters by month and words', async () => {
    await call('POST', '/api/learnings', { date: '2026-09-03', text: 'Zone 2 is conversational' });
    await call('POST', '/api/learnings', { date: '2026-09-20', text: 'Cadence near 180' });
    await call('POST', '/api/learnings', { date: '2026-09-20', text: '100% of effort is 80% pace' });
    await call('POST', '/api/learnings', { date: '2025-12-31', text: 'Sleep debt is real' });
    const gone = await call('POST', '/api/learnings', { date: '2025-11-02', text: 'Deleted one' });
    await call('DELETE', `/api/learnings/${gone.body.id}`);
    const m = await call('GET', '/api/learnings/months');
    expect(m.status).toBe(200);
    expect(m.body.months).toEqual([
      { month: '2026-09', count: 3, days: 2, latest: '100% of effort is 80% pace' },
      { month: '2025-12', count: 1, days: 1, latest: 'Sleep debt is real' },
    ]);
    const sep = await call('GET', '/api/learnings?month=2026-09');
    expect(sep.body.learnings.map((x: { text: string }) => x.text)).toEqual(['100% of effort is 80% pace', 'Cadence near 180', 'Zone 2 is conversational']);
    // any case; a % is a character, not a wildcard
    expect((await call('GET', '/api/learnings?q=ZONE')).body.learnings.map((x: { text: string }) => x.text)).toEqual(['Zone 2 is conversational']);
    expect((await call('GET', `/api/learnings?q=${encodeURIComponent('%')}`)).body.learnings).toHaveLength(1);
    expect((await call('GET', '/api/learnings?month=2026-13')).status).toBe(422);
  });

  it('edits, deletes softly and restores', async () => {
    const a = await call('POST', '/api/learnings', { text: 'First draft' });
    const p = await call('PATCH', `/api/learnings/${a.body.id}`, { text: ' Better words ' });
    expect(p.status).toBe(200);
    expect(p.body.text).toBe('Better words');
    expect(p.body.editedAt).toBeTruthy();
    expect((await call('DELETE', `/api/learnings/${a.body.id}`)).status).toBe(200);
    expect((await call('GET', '/api/learnings')).body.learnings).toEqual([]);
    expect((await call('GET', '/api/learnings/stats')).body).toEqual({ days: 0, streak: 0, total: 0 });
    // a deleted learning cannot be edited or deleted again
    expect((await call('PATCH', `/api/learnings/${a.body.id}`, { text: 'x' })).status).toBe(404);
    expect((await call('DELETE', `/api/learnings/${a.body.id}`)).status).toBe(404);
    const r = await call('POST', `/api/learnings/${a.body.id}/restore`);
    expect(r.status).toBe(200);
    expect(r.body.text).toBe('Better words');
    expect((await call('GET', '/api/learnings')).body.learnings).toHaveLength(1);
    expect((await call('PATCH', '/api/learnings/l_missing', { text: 'x' })).status).toBe(404);
    expect((await call('POST', '/api/learnings/l_missing/restore')).status).toBe(404);
  });

  it('keeps each account to its own', async () => {
    const a = await call('POST', '/api/learnings', { text: 'Mine' });
    const res = await app.request('/api/auth/logout', { method: 'POST', headers: { cookie } });
    expect(res.status).toBeLessThan(500);
    const was = env.allowSignup;
    env.allowSignup = true;
    const s = await app.request('/api/auth/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'other@example.com', password: 'password123' }) });
    env.allowSignup = was;
    cookie = (s.headers.get('set-cookie') ?? '').split(';')[0]!;
    expect((await call('GET', '/api/learnings')).body.learnings).toEqual([]);
    expect((await call('PATCH', `/api/learnings/${a.body.id}`, { text: 'Theirs' })).status).toBe(404);
    expect((await call('DELETE', `/api/learnings/${a.body.id}`)).status).toBe(404);
  });

  it('counts days, the streak ending today or yesterday, and the total', async () => {
    expect((await call('GET', '/api/learnings/stats')).body).toEqual({ days: 0, streak: 0, total: 0 });
    for (const d of [-1, -2, -3, -5]) await call('POST', '/api/learnings', { date: shiftDays(T, d), text: `day ${d}` });
    await call('POST', '/api/learnings', { date: shiftDays(T, -1), text: 'another yesterday' });
    // today not written yet: the run that ends yesterday still counts
    expect((await call('GET', '/api/learnings/stats')).body).toEqual({ days: 4, streak: 3, total: 5 });
    await call('POST', '/api/learnings', { text: 'today' });
    expect((await call('GET', '/api/learnings/stats')).body).toEqual({ days: 5, streak: 4, total: 6 });
    // seen from tomorrow (the athlete's day, X-Local-Date): today is yesterday, the streak holds
    expect((await call('GET', '/api/learnings/stats', undefined, shiftDays(T, 1))).body.streak).toBe(4);
    // two days on, with nothing written in between: it is broken
    expect((await call('GET', '/api/learnings/stats', undefined, shiftDays(T, 2))).body.streak).toBe(0);
  });

  it('refuses empty, too long, a bad day and a day still to come', async () => {
    expect((await call('POST', '/api/learnings', { text: '   ' })).status).toBe(422);
    expect((await call('POST', '/api/learnings', { text: 'x'.repeat(1001) })).status).toBe(422);
    expect((await call('POST', '/api/learnings', { text: 'x'.repeat(1000) })).status).toBe(201);
    expect((await call('POST', '/api/learnings', { date: '2026-13-40', text: 'x' })).status).toBe(422);
    expect((await call('POST', '/api/learnings', { date: shiftDays(T, 1), text: 'x' })).status).toBe(422);
    expect((await call('POST', '/api/learnings', {})).status).toBe(422);
    const a = await call('POST', '/api/learnings', { text: 'ok' });
    expect((await call('PATCH', `/api/learnings/${a.body.id}`, { text: '' })).status).toBe(422);
    expect((await call('GET', '/api/learnings?limit=0')).status).toBe(422);
  });

  it('rides along in the export and comes back on import', async () => {
    await call('POST', '/api/learnings', { date: shiftDays(T, -2), text: 'Exported' });
    const gone = await call('POST', '/api/learnings', { text: 'Deleted' });
    await call('DELETE', `/api/learnings/${gone.body.id}`);
    const ex = await call('GET', '/api/export');
    expect(ex.body.learnings).toHaveLength(1);
    expect(ex.body.learnings[0]).toMatchObject({ date: shiftDays(T, -2), text: 'Exported' });
    // into the same account: nothing new
    expect((await call('POST', '/api/import', ex.body)).body.imported.learnings ?? 0).toBe(0);
    // into a fresh account
    app = buildApp(openDatabase(':memory:').db);
    const res = await app.request('/api/auth/setup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'josh@example.com', password: 'password123' }) });
    cookie = (res.headers.get('set-cookie') ?? '').split(';')[0]!;
    expect((await call('POST', '/api/import', ex.body)).body.imported.learnings).toBe(1);
    expect((await call('GET', '/api/learnings')).body.learnings.map((x: { text: string }) => x.text)).toEqual(['Exported']);
  });
});

describe('from your archive', () => {
  const L = (id: string, date: string) => ({ id, date, text: id, createdAt: `${date}T08:00:00.000Z`, editedAt: null });
  const t = '2026-11-08';

  it('finds the nearest to a year and a month ago, and a random one older than a week', () => {
    const rows = [L('y-far', '2025-11-01'), L('y', '2025-11-10'), L('m', '2026-10-07'), L('m2', '2026-10-12'), L('old', '2026-02-02'), L('new', '2026-11-05')];
    const e = echoesOf(rows, t);
    expect(e.yearAgo?.id).toBe('y');
    expect(e.monthAgo?.id).toBe('m');
    expect(['y-far', 'm2', 'old']).toContain(e.random?.id);
    // the same one all day
    expect(echoesOf([...rows].reverse(), t).random?.id).toBe(e.random?.id);
  });

  it('is empty with nothing old enough, and a month back clamps to the month’s end', () => {
    expect(echoesOf([L('new', '2026-11-05')], t)).toEqual({ yearAgo: null, monthAgo: null, random: null });
    expect(echoesOf([L('feb', '2026-02-28')], '2026-03-31').monthAgo?.id).toBe('feb');
  });

  it('serves them from GET /learnings/echoes', async () => {
    await call('POST', '/api/learnings', { date: shiftDays(T, -30), text: 'A month back' });
    await call('POST', '/api/learnings', { date: T, text: 'Today is not an echo' });
    const r = await call('GET', '/api/learnings/echoes');
    expect(r.status).toBe(200);
    expect(r.body.random?.text ?? r.body.monthAgo?.text).toBe('A month back');
    expect(JSON.stringify(r.body)).not.toContain('Today is not an echo');
  });
});

describe('streakOf', () => {
  it('ends today or yesterday, and ignores days still to come', () => {
    const t = '2026-11-04';
    expect(streakOf([], t)).toBe(0);
    expect(streakOf(['2026-11-04', '2026-11-03', '2026-11-01'], t)).toBe(2);
    expect(streakOf(['2026-11-03', '2026-11-02'], t)).toBe(2);
    expect(streakOf(['2026-11-02'], t)).toBe(0);
    expect(streakOf(['2026-11-05', '2026-11-04'], t)).toBe(1);
    // across a month's end
    expect(streakOf(['2026-11-01', '2026-10-31', '2026-10-30'], '2026-11-02')).toBe(3);
  });
});
