import { shiftDays, today, type ExportV2 } from '@logbook/shared';
import type Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type DB } from '../db/index.js';
import { env } from '../env.js';
import { buildApp } from '../index.js';
import { clientToday } from '../lib/requests.js';
import { nextMonday } from './me.js';

/** The fix-round contracts (docs/platform.md §7–§12): template Undo, block delete/restore, export/import, idempotent writes, name, the athlete's date. */

type App = ReturnType<typeof buildApp>;
let db: DB;
let sqlite: Database.Database;
let app: App;

const call = async (method: string, url: string, body?: unknown, cookie?: string, headers: Record<string, string> = {}) => {
  const res = await app.request(url, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
};
const signUp = async (email: string) => {
  const res = await app.request('/api/auth/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'password123' }) });
  const cookie = (res.headers.get('set-cookie') ?? '').split(';')[0]!;
  const me = (await call('GET', '/api/me', undefined, cookie)).body as { id: string };
  return { cookie, id: me.id };
};
const live = (userId: string) =>
  sqlite.prepare('select id, date, kind, type, miles, mark, block_id as blockId from training_sessions where user_id = ? and deleted_at is null order by date, position, id').all(userId);
const blocksOf = (userId: string) => sqlite.prepare('select id, name, start, end, deleted_at as deletedAt from plan_blocks where user_id = ? order by start, id').all(userId);

beforeEach(() => {
  const o = openDatabase(':memory:');
  db = o.db;
  sqlite = o.sqlite;
  app = buildApp(db);
  env.allowSignup = true;
  env.allowSetup = true;
});

const T = today();
const START = nextMonday(T);
const tpl = (over: Record<string, unknown> = {}) => ({ goal: '10k', weeks: 4, startDate: START, runDays: ['mon', 'wed', 'fri', 'sun'], longRunDay: 'sun', weeklyMiles: 20, ...over });

describe('contract 1: POST /plans/template replace + Undo', () => {
  it('soft-deletes what it replaces, ends the overlapping block the day before, and Undo restores exactly', async () => {
    const { cookie, id } = await signUp('a@example.com');
    const first = await call('POST', '/api/plans/template', tpl({ weeks: 8 }), cookie);
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ removed: 0, replacedIds: [], endedBlocks: [] });
    // a kept session and a hand-added one inside the window of the next block
    const old = live(id) as Array<{ id: string; date: string }>;
    const keep = old.find((s) => s.date >= shiftDays(START, 14))!;
    await call('POST', `/api/sessions/${keep.id}/mark`, { mark: 'done' }, cookie);
    const mine = (await call('POST', '/api/sessions', { date: shiftDays(START, 16), kind: 'lift', type: 'Strength' }, cookie)).body.id as string;
    const before = { sessions: live(id), blocks: blocksOf(id) };

    const second = await call('POST', '/api/plans/template', tpl({ startDate: shiftDays(START, 14), weeks: 4, replace: true }), cookie);
    expect(second.status).toBe(201);
    const r = second.body as { block: { id: string }; removed: number; replacedIds: string[]; endedBlock: unknown; endedBlocks: unknown[] };
    expect(r.endedBlock).toEqual({ id: first.body.block.id, prevEnd: first.body.block.end });
    expect(r.endedBlocks).toEqual([r.endedBlock]);
    expect(r.removed).toBe(r.replacedIds.length);
    // the old block's planned sessions from the new start on, and the hand-added lift; never the done one
    expect(r.replacedIds).toContain(mine);
    expect(r.replacedIds).not.toContain(keep.id);
    const oldAfter = old.filter((s) => s.date >= shiftDays(START, 14) && s.id !== keep.id).map((s) => s.id);
    expect([...r.replacedIds].sort()).toEqual([...oldAfter, mine].sort());
    for (const rid of r.replacedIds) expect(sqlite.prepare('select deleted_at d from training_sessions where id = ?').get(rid)).toEqual({ d: expect.any(String) });
    expect(sqlite.prepare('select end from plan_blocks where id = ?').get(first.body.block.id)).toEqual({ end: shiftDays(START, 13) });
    const boot = (await call('GET', '/api/bootstrap', undefined, cookie)).body;
    expect(boot.blocks.map((b: { id: string }) => b.id)).toEqual([first.body.block.id, r.block.id]);

    const undo = await call('POST', '/api/plans/template/undo', { blockId: r.block.id, replacedIds: r.replacedIds, endedBlock: r.endedBlock }, cookie);
    expect(undo.status).toBe(200);
    expect(undo.body).toMatchObject({ ok: true, restored: r.replacedIds.length, blocks: [first.body.block.id] });
    expect(undo.body.months.length).toBeGreaterThan(0);
    expect({ sessions: live(id), blocks: blocksOf(id) }).toEqual(before);
  });

  it('deletes an overlapping block that had not started, and Undo brings it back', async () => {
    const { cookie, id } = await signUp('a@example.com');
    const first = (await call('POST', '/api/plans/template', tpl({ startDate: shiftDays(START, 7) }), cookie)).body;
    const before = { sessions: live(id), blocks: blocksOf(id) };
    const r = (await call('POST', '/api/plans/template', tpl({ replace: true }), cookie)).body;
    expect(r.endedBlock).toEqual({ id: first.block.id, deleted: true });
    expect(r.replacedIds).toHaveLength(first.block.sessionCount);
    const boot = (await call('GET', '/api/bootstrap', undefined, cookie)).body;
    expect(boot.blocks.map((b: { id: string }) => b.id)).toEqual([r.block.id]);
    // a month read never shows the deleted ones
    const months = await Promise.all(r.months.map((m: string) => call('GET', `/api/months/${m}`, undefined, cookie)));
    expect(months.flatMap((m) => m.body.sessions).every((s: { blockId: string }) => s.blockId === r.block.id)).toBe(true);
    await call('POST', '/api/plans/template/undo', { blockId: r.block.id, replacedIds: r.replacedIds, endedBlocks: r.endedBlocks }, cookie);
    expect({ sessions: live(id), blocks: blocksOf(id) }).toEqual(before);
  });

  it('Undo touches only the caller’s rows and validates', async () => {
    const a = await signUp('a@example.com');
    const b = await signUp('b@example.com');
    const r = (await call('POST', '/api/plans/template', tpl({ replace: true }), a.cookie)).body;
    const n = live(a.id).length;
    expect((await call('POST', '/api/plans/template/undo', { blockId: r.block.id, replacedIds: [] }, b.cookie)).body).toMatchObject({ removed: 0, restored: 0 });
    expect(live(a.id)).toHaveLength(n);
    expect((await call('POST', '/api/plans/template/undo', { replacedIds: [] }, a.cookie)).status).toBe(422);
    expect((await call('POST', '/api/plans/template/undo', { blockId: r.block.id, endedBlock: { id: 'x', prevEnd: 'soon' } }, a.cookie)).status).toBe(422);
  });
});

describe('contract 2: DELETE /blocks/:id keeps history, POST /blocks/:id/restore undoes it', () => {
  it('soft-deletes the block and its future planned sessions only; restore brings back exactly those', async () => {
    const { cookie, id } = await signUp('a@example.com');
    const r = (await call('POST', '/api/plans/template', tpl(), cookie)).body;
    const all = live(id) as Array<{ id: string; date: string }>;
    // history: two sessions moved into the past (one done, one missed), and future ones marked done, floor, sick and skip
    sqlite.prepare('update training_sessions set date = ?, mark = ? where id = ?').run(shiftDays(T, -3), 'done', all[0]!.id);
    sqlite.prepare('update training_sessions set date = ? where id = ?').run(shiftDays(T, -2), all[1]!.id);
    for (const [i, mark] of [[2, 'done'], [3, 'floor'], [4, 'sick'], [5, 'skip']] as const) await call('POST', `/api/sessions/${all[i]!.id}/mark`, { mark }, cookie);
    const before = { sessions: live(id), blocks: blocksOf(id) };

    const del = await call('DELETE', `/api/blocks/${r.block.id}`, undefined, cookie);
    expect(del.status).toBe(200);
    expect(del.body).toMatchObject({ ok: true, removed: all.length - 6, kept: 6 });
    const left = live(id) as Array<{ id: string; mark: string | null; blockId: string }>;
    expect(left.map((s) => s.id).sort()).toEqual(all.slice(0, 6).map((s) => s.id).sort());
    expect(left.every((s) => s.blockId === r.block.id)).toBe(true);
    // a reload: the block is gone from the bootstrap, the history is still in the months
    expect((await call('GET', '/api/bootstrap', undefined, cookie)).body.blocks).toEqual([]);
    const month = (await call('GET', `/api/months/${shiftDays(T, -3).slice(0, 7)}`, undefined, cookie)).body;
    expect(month.sessions.map((s: { id: string }) => s.id)).toContain(all[0]!.id);
    expect((await call('DELETE', `/api/blocks/${r.block.id}`, undefined, cookie)).status).toBe(404);

    const res = await call('POST', `/api/blocks/${r.block.id}/restore`, undefined, cookie);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ restored: all.length - 6, block: { id: r.block.id, sessionCount: all.length } });
    expect({ sessions: live(id), blocks: blocksOf(id) }).toEqual(before);
    expect((await call('GET', '/api/bootstrap', undefined, cookie)).body.blocks.map((b: { id: string }) => b.id)).toEqual([r.block.id]);
  });

  it('a session deleted on its own before the block delete stays deleted after the restore', async () => {
    const { cookie, id } = await signUp('a@example.com');
    const r = (await call('POST', '/api/plans/template', tpl(), cookie)).body;
    const first = (live(id) as Array<{ id: string }>)[0]!.id;
    await call('DELETE', `/api/sessions/${first}`, undefined, cookie);
    await call('DELETE', `/api/blocks/${r.block.id}`, undefined, cookie);
    await call('POST', `/api/blocks/${r.block.id}/restore`, undefined, cookie);
    expect((live(id) as Array<{ id: string }>).map((s) => s.id)).not.toContain(first);
    expect(live(id)).toHaveLength(r.block.sessionCount - 1);
  });
});

describe('contract 3: GET /export → POST /import', () => {
  const fill = async (cookie: string, userId: string) => {
    await call('POST', '/api/me/onboarding', { goal: 'half', runDays: ['tue', 'thu', 'sat', 'sun'], longRunDay: 'sun', weeklyMiles: 18, wake: '6:30', leave: 510, pace: '8:30', habits: ['Stretch', 'Read'] }, cookie);
    await call('PATCH', '/api/me', { name: 'Josh' }, cookie);
    const habits = (await call('GET', '/api/habits', undefined, cookie)).body as Array<{ id: string }>;
    await call('PUT', `/api/habits/${habits[0]!.id}/days/${T}`, { done: true, note: 'felt good' }, cookie);
    await call('PUT', `/api/habits/${habits[1]!.id}/days/${shiftDays(T, -1)}`, { done: true }, cookie);
    const s = (await call('POST', '/api/sessions', { date: shiftDays(T, -1), kind: 'run', type: 'Easy', miles: 4 }, cookie)).body;
    await call('POST', `/api/sessions/${s.id}/mark`, { mark: 'done' }, cookie);
    await call('POST', '/api/lifts', { date: T, exercise: 'Squat', weight: 225, reps: 5 }, cookie);
    await call('POST', '/api/todos', { text: 'Buy shoes', date: T }, cookie);
    const gone = (await call('POST', '/api/todos', { text: 'Old one', date: T }, cookie)).body;
    await call('PATCH', `/api/todos/${gone.id}`, { deletedOn: T }, cookie);
    const e = (await call('POST', '/api/journal', { date: T, text: 'Legs heavy, then not.' }, cookie)).body;
    await call('PATCH', `/api/journal/${e.id}`, { fav: true }, cookie);
    await call('POST', '/api/quotes', { text: 'Keep going, gently.', author: 'Me' }, cookie);
    await call('PUT', `/api/morning/days/${T}`, { mode: 'run', type: 'Easy', miles: 4, minutes: 40, wake: 400 }, cookie);
    sqlite
      .prepare("insert into activities (id, user_id, date, time, name, sport_type, kind, distance_m, moving_sec, elapsed_sec, elev_m, laps_json, polyline, updated_at) values (?, ?, ?, '07:30', 'Morning Run', 'Run', 'run', 6437.4, 2160, 2200, 12, '[[1609.3,540,140]]', 'abc', ?)")
      .run(`act-${userId}`, userId, shiftDays(T, -1), new Date().toISOString());
    sqlite.prepare("insert into coach_reads (user_id, date, key, text, created_at) values (?, ?, ?, 'Even pacing.', ?)").run(userId, shiftDays(T, -1), s.id, new Date().toISOString());
    sqlite
      .prepare("insert into links (id, user_id, url, title, site_name, tags_json, added_at, source) values (?, ?, 'https://example.com/a', 'A read', 'example.com', '[\"run\"]', ?, 'me')")
      .run(`lnk-${userId}`, userId, new Date().toISOString());
  };
  const sizes = (x: ExportV2) => ({
    settings: Object.keys(x.settings).sort(),
    habits: x.habits.length,
    checks: x.checks.length,
    blocks: x.blocks.length,
    sessions: x.sessions.length,
    activities: x.activities.length,
    lifts: x.lifts.length,
    todos: x.todos.length,
    journal: x.journal.length,
    quotesOwn: x.quotes.own.length,
    quotePrefs: x.quotes.prefs.length,
    links: x.links.length,
    morningDays: Object.keys(x.morningDays).length,
    coach: x.coach.length,
    trainingProfile: !!x.trainingProfile,
    name: x.user.name,
  });

  it('round-trips a full account into a fresh one with identical counts, and a second import adds nothing', async () => {
    const a = await signUp('a@example.com');
    await fill(a.cookie, a.id);
    const out = await call('GET', '/api/export', undefined, a.cookie);
    expect(out.status).toBe(200);
    expect(out.headers.get('content-disposition')).toMatch(/attachment; filename="logbook-export-/);
    const file = out.body as ExportV2;
    expect(file).toMatchObject({ version: 2, user: { email: 'a@example.com', name: 'Josh' } });
    for (const [k, v] of Object.entries(sizes(file))) if (typeof v === 'number') expect(v, k).toBeGreaterThan(0);

    const b = await signUp('b@example.com');
    const imp = await call('POST', '/api/import', file, b.cookie);
    expect(imp.status).toBe(200);
    expect(imp.body).toMatchObject({ ok: true, version: 2 });
    const back = (await call('GET', '/api/export', undefined, b.cookie)).body as ExportV2;
    expect(sizes(back)).toEqual(sizes(file));
    // references follow renamed ids: sessions keep their block, checks their habit, the coach read its session, the favourite its quote
    const blockIds = new Set(back.blocks.map((x) => x.id));
    expect(back.sessions.filter((s) => s.blockId).every((s) => blockIds.has(s.blockId!))).toBe(true);
    const habitIds = new Set(back.habits.map((h) => h.id));
    expect(back.checks.every((c) => habitIds.has(c.habitId))).toBe(true);
    expect(back.coach.every((c) => back.sessions.some((s) => s.id === c.key))).toBe(true);
    expect(back.quotes.prefs.every((p) => back.quotes.own.some((q) => q.id === p.quoteId))).toBe(true);
    expect(back.activities[0]).toMatchObject({ distanceM: 6437.4, elapsedSec: 2200, laps: [[1609.3, 540, 140]], polyline: 'abc' });
    // the source account is untouched
    expect(sizes((await call('GET', '/api/export', undefined, a.cookie)).body)).toEqual(sizes(file));

    // idempotent by id: again into b, and into a itself, nothing new
    expect((await call('POST', '/api/import', file, b.cookie)).body.imported).toEqual({});
    expect(sizes((await call('GET', '/api/export', undefined, b.cookie)).body)).toEqual(sizes(file));
    expect((await call('POST', '/api/import', file, a.cookie)).body.imported).toEqual({});
  });

  it('still takes the original artifact format, and refuses a broken v2 file', async () => {
    const { cookie } = await signUp('a@example.com');
    const v1 = { habits: { items: [{ id: 'h1', name: 'Stretch', created: '2026-09-01' }] }, todos: { items: { t1: { text: 'Call', created: '2026-09-02' } } } };
    const r = await call('POST', '/api/import', v1, cookie);
    expect(r.body).toMatchObject({ ok: true, version: 1, imported: { habits: 1, todos: 1 } });
    expect((await call('POST', '/api/import', { version: 2, sessions: [{ id: 'x', date: 'nope', kind: 'run' }] }, cookie)).status).toBe(422);
  });
});

describe('one editor: a morning day is its alarm (spec §4.3)', () => {
  const D = shiftDays(T, 3);
  const row = (userId: string, date: string) => sqlite.prepare('select mode, type, miles, minutes, wake from morning_days where user_id = ? and date = ?').get(userId, date);
  const monthDays = async (cookie: string, date: string) => (await call('GET', `/api/months/${date.slice(0, 7)}`, undefined, cookie)).body.morningDays as Record<string, unknown>;

  it('PUT { wake } on a day with no row inserts it with neutral fillers in the NOT NULL columns', async () => {
    const { cookie, id } = await signUp('a@example.com');
    const r = await call('PUT', `/api/morning/days/${D}`, { wake: 450 }, cookie);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ wake: 450 });
    // no session that day: mode 'run'; the rest are fillers
    expect(row(id, D)).toEqual({ mode: 'run', type: '', miles: 0, minutes: 0, wake: 450 });
    // a day with a lift: the filler mode is the session's
    const L = shiftDays(T, 4);
    await call('POST', '/api/sessions', { date: L, kind: 'lift', type: 'Strength' }, cookie);
    expect((await call('PUT', `/api/morning/days/${L}`, { wake: 420 }, cookie)).status).toBe(200);
    expect(row(id, L)).toEqual({ mode: 'gym', type: '', miles: 0, minutes: 0, wake: 420 });
  });

  it('PUT with the legacy fields stores and answers { wake } only; a second PUT changes only wake; the month says { wake }', async () => {
    const { cookie, id } = await signUp('a@example.com');
    const legacy = await call('PUT', `/api/morning/days/${D}`, { mode: 'rest', type: 'Rest', miles: 9, minutes: 90, wake: 430 }, cookie);
    expect(legacy.status).toBe(200);
    expect(legacy.body).toEqual({ wake: 430 });
    expect(row(id, D)).toEqual({ mode: 'run', type: '', miles: 0, minutes: 0, wake: 430 });
    // a row the old day editor wrote: a second PUT leaves its legacy columns as they are and moves the wake
    const O = shiftDays(T, 5);
    sqlite.prepare("insert into morning_days (user_id, date, mode, type, miles, minutes, wake) values (?, ?, 'rest', 'Rest', 6, 50, 440)").run(id, O);
    const again = await call('PUT', `/api/morning/days/${O}`, { wake: 455, mode: 'gym', miles: 3 }, cookie);
    expect(again.body).toEqual({ wake: 455 });
    expect(row(id, O)).toEqual({ mode: 'rest', type: 'Rest', miles: 6, minutes: 50, wake: 455 });
    expect((await call('PUT', `/api/morning/days/${D}`, { wake: 445 }, cookie)).body).toEqual({ wake: 445 });
    expect(row(id, D)).toEqual({ mode: 'run', type: '', miles: 0, minutes: 0, wake: 445 });
    // the month payload: { wake } and nothing else, for the new row and the legacy one alike
    const m = { ...(await monthDays(cookie, D)), ...(await monthDays(cookie, O)) };
    expect(m[D]).toEqual({ wake: 445 });
    expect(m[O]).toEqual({ wake: 455 });
    // still refused: no wake, or a wake off the clock
    expect((await call('PUT', `/api/morning/days/${D}`, { mode: 'run' }, cookie)).status).toBe(422);
    expect((await call('PUT', `/api/morning/days/${D}`, { wake: 1500 }, cookie)).status).toBe(422);
    // DELETE still clears the day
    expect((await call('DELETE', `/api/morning/days/${D}`, undefined, cookie)).status).toBe(200);
    expect(row(id, D)).toBeUndefined();
  });

  it('the exporter round-trips legacy rows (the same wakes in a fresh account) and takes an old file with all five fields', async () => {
    const a = await signUp('a@example.com');
    const O = shiftDays(T, 5);
    sqlite.prepare("insert into morning_days (user_id, date, mode, type, miles, minutes, wake) values (?, ?, 'rest', 'Rest', 6, 50, 440)").run(a.id, O);
    await call('PUT', `/api/morning/days/${D}`, { wake: 450 }, a.cookie);
    const file = (await call('GET', '/api/export', undefined, a.cookie)).body as ExportV2;
    // the export keeps the stored columns (a backup), legacy and filler alike
    expect(file.morningDays[O]).toEqual({ mode: 'rest', type: 'Rest', miles: 6, minutes: 50, wake: 440 });
    expect(file.morningDays[D]).toEqual({ mode: 'run', type: '', miles: 0, minutes: 0, wake: 450 });
    const b = await signUp('b@example.com');
    const imp = await call('POST', '/api/import', file, b.cookie);
    expect(imp.status).toBe(200);
    expect(imp.body.imported.morningDays).toBe(2);
    const wakes = async (cookie: string) => Object.fromEntries(Object.entries({ ...(await monthDays(cookie, D)), ...(await monthDays(cookie, O)) }).map(([k, v]) => [k, v]));
    expect(await wakes(b.cookie)).toEqual({ [D]: { wake: 450 }, [O]: { wake: 440 } });
    expect(await wakes(b.cookie)).toEqual(await wakes(a.cookie));

    // an old export file (written before the change) whose morning days carry all five fields, and one with { wake } alone
    const c = await signUp('c@example.com');
    const old = { version: 2, morningDays: { [D]: { mode: 'gym', type: 'Strength', miles: 5, minutes: 45, wake: 415 }, [O]: { wake: 425 } } };
    const r = await call('POST', '/api/import', old, c.cookie);
    expect(r.status).toBe(200);
    expect(r.body.imported.morningDays).toBe(2);
    expect(row(c.id, D)).toEqual({ mode: 'gym', type: 'Strength', miles: 5, minutes: 45, wake: 415 });
    expect(row(c.id, O)).toEqual({ mode: 'run', type: '', miles: 0, minutes: 0, wake: 425 });
    expect(await wakes(c.cookie)).toEqual({ [D]: { wake: 415 }, [O]: { wake: 425 } });
    // a morning day with no wake is a broken file
    expect((await call('POST', '/api/import', { version: 2, morningDays: { [D]: { mode: 'run', type: 'Easy', miles: 4, minutes: 40 } } }, c.cookie)).status).toBe(422);
  });
});

describe('contract 4: Idempotency-Key', () => {
  it('a replayed POST lands once and answers the first response', async () => {
    const { cookie, id } = await signUp('a@example.com');
    const h = { 'idempotency-key': 'k-123' };
    const first = await call('POST', '/api/todos', { text: 'Replay me', date: T }, cookie, h);
    const again = await call('POST', '/api/todos', { text: 'Replay me', date: T }, cookie, h);
    expect(first.status).toBe(201);
    expect(again.status).toBe(201);
    expect(again.body).toEqual(first.body);
    expect(again.headers.get('idempotent-replay')).toBe('true');
    expect(sqlite.prepare("select count(*) n from todos where user_id = ? and text = 'Replay me'").get(id)).toEqual({ n: 1 });
  });

  it('twins sent at the same moment land once; other keys, other users and requests without a key are untouched', async () => {
    const a = await signUp('a@example.com');
    const b = await signUp('b@example.com');
    const send = (cookie: string, key?: string) => call('POST', '/api/todos', { text: 'Twin', date: T }, cookie, key ? { 'idempotency-key': key } : {});
    const [x, y] = await Promise.all([send(a.cookie, 'same'), send(a.cookie, 'same')]);
    expect(x.body.id).toBe(y.body.id);
    await send(a.cookie, 'other');
    await send(b.cookie, 'same');
    await send(a.cookie);
    await send(a.cookie);
    const n = (u: string) => (sqlite.prepare("select count(*) n from todos where user_id = ? and text = 'Twin'").get(u) as { n: number }).n;
    expect(n(a.id)).toBe(4);
    expect(n(b.id)).toBe(1);
  });

  it('dedupes DELETE, PATCH and PUT too, and a key expires after 24 hours', async () => {
    const { cookie, id } = await signUp('a@example.com');
    const s = (await call('POST', '/api/sessions', { date: T, kind: 'run', type: 'Easy', miles: 4 }, cookie)).body;
    const d1 = await call('DELETE', `/api/sessions/${s.id}`, undefined, cookie, { 'idempotency-key': 'del-1' });
    await call('POST', `/api/sessions/${s.id}/restore`, {}, cookie);
    const d2 = await call('DELETE', `/api/sessions/${s.id}`, undefined, cookie, { 'idempotency-key': 'del-1' });
    expect(d2.body).toEqual(d1.body);
    // the replay did not delete it again
    expect(sqlite.prepare('select deleted_at d from training_sessions where id = ?').get(s.id)).toEqual({ d: null });
    sqlite.prepare("update idempotency_keys set created_at = '2000-01-01T00:00:00.000Z' where user_id = ?").run(id);
    await call('DELETE', `/api/sessions/${s.id}`, undefined, cookie, { 'idempotency-key': 'del-1' });
    expect(sqlite.prepare('select deleted_at d from training_sessions where id = ?').get(s.id)).toEqual({ d: expect.any(String) });
  });
});

describe('contract 6: the account name', () => {
  it('PATCH /me sets and clears it; GET /me, /auth/me, the bootstrap and sign-in carry it', async () => {
    const { cookie } = await signUp('a@example.com');
    expect((await call('GET', '/api/me', undefined, cookie)).body.name).toBeNull();
    const r = await call('PATCH', '/api/me', { name: '  Josh  ' }, cookie);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ email: 'a@example.com', name: 'Josh' });
    expect((await call('GET', '/api/me', undefined, cookie)).body.name).toBe('Josh');
    expect((await call('GET', '/api/auth/me', undefined, cookie)).body.name).toBe('Josh');
    expect((await call('GET', '/api/bootstrap', undefined, cookie)).body.user.name).toBe('Josh');
    expect((await call('POST', '/api/auth/login', { email: 'a@example.com', password: 'password123' })).body.name).toBe('Josh');
    expect((await call('PATCH', '/api/me', { name: '' }, cookie)).body.name).toBeNull();
    expect((await call('PATCH', '/api/me', { name: 'x'.repeat(61) }, cookie)).status).toBe(422);
    expect((await call('PATCH', '/api/me', { name: 'x' })).status).toBe(401);
  });
});

describe('contract 7: a new account’s morning', () => {
  it('is "Get ready 30 · Final prep 10" with no smoothie; the owner’s stored routine is untouched', async () => {
    const { cookie } = await signUp('a@example.com');
    const st = (await call('GET', '/api/morning/settings', undefined, cookie)).body;
    expect(st.after).toMatchObject({ shower: 0, ready: 30, smoothie: 0, prep: 10 });
    // no routine block is named after the door or the leave: a morning has one of each
    expect(st.after.names).toBeUndefined();
    expect((await call('GET', '/api/bootstrap', undefined, cookie)).body.morningSettings.after.smoothie).toBe(0);
    // a patch builds on it, not on the old defaults
    const p = (await call('PATCH', '/api/morning/settings', { wake: 400 }, cookie)).body;
    expect(p).toMatchObject({ wake: 400, after: { smoothie: 0, ready: 30 } });
  });
});

describe('the athlete’s date (X-Local-Date)', () => {
  const ahead = shiftDays(T, 1);
  const H = { 'x-local-date': ahead };

  it('believes a client date within two days of the server, else uses the server’s', () => {
    expect(clientToday(ahead, T)).toBe(ahead);
    expect(clientToday(shiftDays(T, -1), T)).toBe(shiftDays(T, -1));
    expect(clientToday(shiftDays(T, 2), T)).toBe(shiftDays(T, 2));
    expect(clientToday(shiftDays(T, 9), T)).toBe(T);
    expect(clientToday('2026-13-40', T)).toBe(T);
    expect(clientToday(undefined, T)).toBe(T);
  });

  it('writes dated a day ahead of the server are taken and filed on the client’s day', async () => {
    const { cookie } = await signUp('a@example.com');
    // dated writes: a session, a habit check, a journal entry, a to-do, a lift, a morning day, all on the client's today
    const s = await call('POST', '/api/sessions', { date: ahead, kind: 'run', type: 'Easy', miles: 4 }, cookie, H);
    expect(s.status).toBe(201);
    expect((await call('POST', `/api/sessions/${s.body.id}/mark`, { mark: 'done' }, cookie, H)).body).toMatchObject({ date: ahead, mark: 'done' });
    const habits = (await call('POST', '/api/habits', { name: 'Stretch' }, cookie, H)).body;
    expect(habits[0].createdOn).toBe(ahead);
    expect((await call('PUT', `/api/habits/${habits[0].id}/days/${ahead}`, { done: true }, cookie, H)).body).toMatchObject({ date: ahead, done: true });
    expect((await call('POST', '/api/journal', { date: ahead, text: 'Tomorrow, for the server.' }, cookie, H)).body.date).toBe(ahead);
    expect((await call('POST', '/api/lifts', { date: ahead, exercise: 'Squat', weight: 100, reps: 5 }, cookie, H)).status).toBe(201);
    expect((await call('PUT', `/api/morning/days/${ahead}`, { mode: 'run', type: 'Easy', miles: 4, minutes: 40, wake: 400 }, cookie, H)).status).toBe(200);
    const todo = (await call('POST', '/api/todos', { text: 'Later thing', date: ahead }, cookie, H)).body;
    expect(todo).toMatchObject({ createdOn: ahead, bucket: 'today' });
    // moved to Later with no date: tomorrow is the client's tomorrow, not the server's (which is the client's today)
    expect((await call('PATCH', `/api/todos/${todo.id}`, { bucket: 'later' }, cookie, H)).body.due).toBe(shiftDays(ahead, 1));
    // reading the month back shows every one of them on that day
    const m = (await call('GET', `/api/months/${ahead.slice(0, 7)}`, undefined, cookie, H)).body;
    expect(m.sessions.map((x: { date: string }) => x.date)).toContain(ahead);
    expect(m.checks.map((x: { date: string }) => x.date)).toContain(ahead);
    expect(m.journal.map((x: { date: string }) => x.date)).toContain(ahead);
    expect(Object.keys(m.morningDays)).toContain(ahead);
    // the daily pick is for the client's day
    expect((await call('GET', '/api/journal/daily', undefined, cookie, H)).body.date).toBe(ahead);
  });

  it('a plan rebuild never removes the client’s yesterday (the server’s today)', async () => {
    const { cookie, id } = await signUp('a@example.com');
    const y = (await call('POST', '/api/sessions', { date: T, kind: 'run', type: 'Easy', miles: 3 }, cookie)).body.id as string;
    const t = (await call('POST', '/api/sessions', { date: ahead, kind: 'run', type: 'Easy', miles: 3 }, cookie)).body.id as string;
    const r = (await call('POST', '/api/plans/template', { ...tpl(), startDate: T, replace: true }, cookie, H)).body;
    expect(r.replacedIds).toEqual([t]);
    expect((live(id) as Array<{ id: string }>).map((s) => s.id)).toContain(y);
  });
});
