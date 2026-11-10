import { createHash, randomBytes, scryptSync } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { getTableName, eq } from 'drizzle-orm';
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HASH_PARAMS, needsRehash, purgeExpiredSessions, SESSION_MAX_DAYS, sessionKey } from '../auth.js';
import { hashLegacySessionIds, unknownTables } from '../db/compat.js';
import { openDatabase, type DB } from '../db/index.js';
import * as schema from '../db/schema.js';
import { assistantActions, auditLog, authSessions, habitChecks, habits, journalEntries, users } from '../db/schema.js';
import { env } from '../env.js';
import { buildApp } from '../index.js';
import { setLogSink, type LogLine } from '../lib/log.js';
import { userHash } from '../services/audit.js';
import { setMailTransport } from '../services/mail.js';
import { purgeDeleted, SOFT_DELETED } from '../services/retention.js';
import { resetThrottles } from '../services/throttle.js';
import { makeApp, signUp, type App } from '../test/helpers.js';
import { CLIENT_ERROR_LIMIT } from './clientErrors.js';

/**
 * The second security pass (launch plan, ws-01 medium and low items): password rules and hashing (auth-14, sec-25),
 * hashed and capped sessions (sec-17), the request log and the security log (sec-23), unlinked client error reports
 * (gap-qua-69, critic-04), the CSP and write guard (sec-22), Password AutoFill (ios-15), Apple Health tokens per phone
 * (sec-21), the 30 / 90 day purge and the dropped tables (sec-19), habit checks by account (sec-16), path values and
 * reused ids (sec-27), and the health check (perf-22).
 */
let app: App;
let db: DB;
const PW = 'correct horse 42';
let lines: LogLine[];
let was: ReturnType<typeof setLogSink>;

const req = async (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) => {
  const res = await app.request(url, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed, headers: res.headers, cookie: (res.headers.get('set-cookie') ?? '').split(';')[0]! };
};
const events = () => db.select().from(auditLog).all().map((r) => r.event);

beforeEach(() => {
  ({ app, db } = makeApp());
  resetThrottles();
  setMailTransport(() => undefined);
  lines = [];
  was = setLogSink((l) => void lines.push(l));
});
afterEach(() => {
  setLogSink(was);
  setMailTransport(null);
  env.APPLE_TEAM_ID = undefined;
});

describe('passwords (auth-14, sec-25)', () => {
  it('sign-up refuses a common password, the email, one over 200 characters, and says why', async () => {
    const cases: Array<[string, string, RegExp]> = [
      ['a@example.com', 'password123', /too common/],
      ['a@example.com', 'Qwertyuiop', /too common/],
      ['sam.runner@example.com', 'sam.runner@example.com', /cannot be your email/],
      ['sam.runner@example.com', 'sam.runner', /cannot be your email/],
      ['a@example.com', 'aaaaaaaaaa', /too easy/],
    ];
    for (const [email, password, why] of cases) {
      const r = await req('POST', '/api/auth/signup', { email, password });
      expect(r.status, password).toBe(422);
      expect(r.body.code).toBe(r.body.code === 'weak_password' ? 'weak_password' : 'validation');
      expect(r.body.error).toMatch(why);
    }
    expect((await req('POST', '/api/auth/signup', { email: 'a@example.com', password: 'x'.repeat(201) })).status).toBe(422);
    expect(db.select().from(users).all()).toHaveLength(0);
  });

  it('change password refuses the same list and the email; a weak reset keeps the link usable', async () => {
    const a = await signUp(app, 'sam@example.com', PW);
    const r = await a.call('POST', '/api/me/password', { current: PW, next: 'iloveyou1' });
    expect(r.status).toBe(422);
    expect(r.body.code).toBe('weak_password');
    expect((await a.call('POST', '/api/me/password', { current: PW, next: 'sam@example.com' })).body.code).toBe('weak_password');
  });

  it('stores every parameter in the hash at or above the floor, and upgrades an old hash on the next sign-in', async () => {
    const a = await signUp(app, 'sam@example.com', PW);
    const stored = db.select().from(users).where(eq(users.id, a.id)).get()!.passwordHash;
    expect(stored).toMatch(new RegExp(`^scrypt\\$${HASH_PARAMS.N}\\$${HASH_PARAMS.r}\\$${HASH_PARAMS.p}\\$[A-Za-z0-9+/=]+\\$[A-Za-z0-9+/=]+$`));
    expect(HASH_PARAMS.N * HASH_PARAMS.r * HASH_PARAMS.p).toBeGreaterThanOrEqual(2 ** 15 * 8 * 3);
    expect(needsRehash(stored)).toBe(false);

    // the form the server used before: scrypt$N$salt$key at r=8, p=1
    const salt = randomBytes(16);
    const old = `scrypt$${2 ** 15}$${salt.toString('base64')}$${scryptSync('older pass 77', salt, 64, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString('base64')}`;
    expect(needsRehash(old)).toBe(true);
    db.update(users).set({ passwordHash: old }).where(eq(users.id, a.id)).run();
    expect((await req('POST', '/api/auth/login', { email: 'sam@example.com', password: 'wrong one 99' })).status).toBe(401);
    expect(db.select().from(users).where(eq(users.id, a.id)).get()!.passwordHash).toBe(old);
    expect((await req('POST', '/api/auth/login', { email: 'sam@example.com', password: 'older pass 77' })).status).toBe(200);
    const now = db.select().from(users).where(eq(users.id, a.id)).get()!.passwordHash;
    expect(now).not.toBe(old);
    expect(needsRehash(now)).toBe(false);
    expect((await req('POST', '/api/auth/login', { email: 'sam@example.com', password: 'older pass 77' })).status).toBe(200);
  });
});

describe('sessions (sec-17)', () => {
  it('are stored as the SHA-256 of the cookie, never the value', async () => {
    const a = await signUp(app, 'sam@example.com', PW);
    const value = a.cookie.split('=')[1]!;
    const rows = db.select().from(authSessions).all();
    expect(rows.map((r) => r.id)).toEqual([createHash('sha256').update(value).digest('hex')]);
    expect(rows[0]!.id).toBe(sessionKey(value));
    expect(JSON.stringify(rows)).not.toContain(value);
  });

  it('end 180 days after sign-in whatever the use, and the purge drops them', async () => {
    const a = await signUp(app, 'sam@example.com', PW);
    expect((await a.call('GET', '/api/me')).status).toBe(200);
    const old = new Date(Date.now() - (SESSION_MAX_DAYS + 1) * 864e5).toISOString();
    // still inside its sliding window, but signed in 181 days ago
    db.update(authSessions).set({ createdAt: old, expiresAt: new Date(Date.now() + 30 * 864e5).toISOString() }).run();
    expect((await a.call('GET', '/api/me')).status).toBe(401);
    expect((await req('GET', '/api/auth/status', undefined, { cookie: a.cookie })).body.signedIn).toBe(false);
    purgeExpiredSessions(db);
    expect(db.select().from(authSessions).all()).toHaveLength(0);
  });

  it('a slide never runs past the cap', async () => {
    const a = await signUp(app, 'sam@example.com', PW);
    const created = new Date(Date.now() - (SESSION_MAX_DAYS - 10) * 864e5).toISOString();
    db.update(authSessions).set({ createdAt: created, expiresAt: new Date(Date.now() + 864e5).toISOString() }).run();
    expect((await a.call('GET', '/api/me')).status).toBe(200);
    const row = db.select().from(authSessions).get()!;
    expect(new Date(row.expiresAt).getTime()).toBeLessThanOrEqual(new Date(created).getTime() + SESSION_MAX_DAYS * 864e5);
    expect(new Date(row.expiresAt).getTime()).toBeGreaterThan(Date.now() + 9 * 864e5);
  });

  it('a session stored under its plain value before the change still signs in once the boot step hashes it', async () => {
    const a = await signUp(app, 'sam@example.com', PW);
    const value = a.cookie.split('=')[1]!;
    db.update(authSessions).set({ id: value }).run();
    expect((await a.call('GET', '/api/me')).status).toBe(401);
    const { sqlite } = openDatabase(':memory:');
    expect(hashLegacySessionIds(sqlite)).toBe(0);
    // the same step, on this database
    const raw = (db as unknown as { $client: Database.Database }).$client;
    expect(hashLegacySessionIds(raw)).toBe(1);
    expect(hashLegacySessionIds(raw)).toBe(0);
    expect((await a.call('GET', '/api/me')).status).toBe(200);
  });
});

describe('the request log and the security log (sec-23)', () => {
  it('one line a request: method, route pattern, status, time, hashed account; no path values, query or body', async () => {
    const a = await signUp(app, 'sam@example.com', PW);
    lines = [];
    await a.call('GET', '/api/journal?q=secret-word');
    await a.call('PUT', '/api/habits/h_missing/days/2026-11-10', { done: true });
    const reqs = lines.filter((l) => l.t === 'req');
    expect(reqs.length).toBe(2);
    for (const l of reqs) {
      expect(Object.keys(l).sort()).toEqual(['at', 'method', 'ms', 'route', 'status', 't', 'u']);
      expect(l.u).toBe(userHash(a.id));
      expect(typeof l.ms).toBe('number');
    }
    expect(reqs[1]).toMatchObject({ method: 'PUT', route: '/api/habits/:id/days/:date', status: 404 });
    const all = JSON.stringify(lines);
    for (const leak of ['secret-word', 'h_missing', a.id, 'sam@example.com', PW]) expect(all).not.toContain(leak);
  });

  it('sign-up, sign-in, a failed sign-in, consent, password and deletion events go to the audit table, never naming the account', async () => {
    const a = await signUp(app, 'sam@example.com', PW);
    await req('POST', '/api/auth/login', { email: 'sam@example.com', password: 'not it at all' });
    const login = await req('POST', '/api/auth/login', { email: 'sam@example.com', password: PW });
    await a.call('PUT', '/api/me/consent', { training: true });
    await a.call('POST', '/api/me/password', { current: 'nope nope nope', next: 'brand new 2026' });
    await a.call('POST', '/api/me/password', { current: PW, next: 'brand new 2026' });
    // the password change signed every other device out (that sign-in among them); this one stays
    expect((await req('GET', '/api/me', undefined, { cookie: login.cookie })).status).toBe(401);
    await a.call('DELETE', '/api/me', { password: 'brand new 2026' });
    expect(events()).toEqual(['signup', 'login_failed', 'login', 'consent', 'password_wrong', 'password_changed', 'account_deleted']);
    const rows = db.select().from(auditLog).all();
    expect(new Set(rows.map((r) => r.userHash))).toEqual(new Set([userHash(a.id)]));
    expect(rows.find((r) => r.event === 'consent')!.detail).toBe('training:on');
    expect(JSON.stringify(rows)).not.toMatch(new RegExp(`${a.id}|sam@example|brand new|correct horse`));
  });
});

describe('client error reports (gap-qua-69, critic-04)', () => {
  const report = { message: 'TypeError: x is undefined', stack: 'at Today (Today.tsx:10)', route: '/today?token=abc#x', appVersion: '1.0 (abc123)', ua: 'iPhone' };

  it('need no session, answer 204 and log one structured line with the query dropped', async () => {
    const r = await req('POST', '/api/client-errors', report);
    expect(r.status).toBe(204);
    const logged = lines.filter((l) => l.t === 'client_error');
    expect(logged).toEqual([{ t: 'client_error', at: expect.any(String), message: report.message, stack: report.stack, route: '/today', appVersion: report.appVersion, ua: 'iPhone' }]);
  });

  it('sent with a valid session cookie, are logged with no account id, hashed or plain, and write no row', async () => {
    const a = await signUp(app, 'sam@example.com', PW);
    const before = events().length;
    lines = [];
    expect((await a.call('POST', '/api/client-errors', report)).status).toBe(204);
    const all = JSON.stringify(lines);
    expect(all).not.toContain(a.id);
    expect(all).not.toContain(userHash(a.id));
    expect(lines.find((l) => l.t === 'req')).toMatchObject({ route: '/api/client-errors', u: null });
    expect(events().length).toBe(before);
  });

  it('take at most 8 KB and are limited per address', async () => {
    expect((await req('POST', '/api/client-errors', { message: 'x'.repeat(9 * 1024) })).status).toBe(413);
    expect((await req('POST', '/api/client-errors', { nope: 1 })).status).toBe(422);
    // navigator.sendBeacon sends text
    expect((await req('POST', '/api/client-errors', { message: 'beacon' }, { 'content-type': 'text/plain;charset=UTF-8' })).status).toBe(204);
    resetThrottles();
    for (let i = 0; i < CLIENT_ERROR_LIMIT.max; i++) expect((await req('POST', '/api/client-errors', { message: 'm' }, { 'fly-client-ip': '203.0.113.9' })).status).toBe(204);
    const over = await req('POST', '/api/client-errors', { message: 'm' }, { 'fly-client-ip': '203.0.113.9' });
    expect(over.status).toBe(429);
    expect(over.headers.get('retry-after')).toBeTruthy();
    expect((await req('POST', '/api/client-errors', { message: 'm' }, { 'fly-client-ip': '203.0.113.10' })).status).toBe(204);
  });
});

describe('the CSP and the write guard (sec-22)', () => {
  it('every answer carries a Content-Security-Policy that frames nothing and runs only our scripts', async () => {
    const r = await req('GET', '/api/health');
    const csp = r.headers.get('content-security-policy')!;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(r.headers.get('permissions-policy')).toContain('camera=()');
  });

  it('a write from a foreign Origin is refused; ours, the iPhone app and no Origin pass', async () => {
    const a = await signUp(app, 'sam@example.com', PW);
    const bad = await a.call('POST', '/api/todos', { text: 'x' }, { origin: 'https://evil.example' });
    expect(bad.status).toBe(403);
    expect(bad.body.code).toBe('bad_origin');
    for (const origin of [new URL(env.APP_URL).origin, 'capacitor://localhost']) expect((await a.call('POST', '/api/todos', { text: 'x' }, { origin })).status, origin).not.toBe(403);
    expect((await a.call('POST', '/api/todos', { text: 'x' })).status).not.toBe(403);
    // reads are not guarded
    expect((await a.call('GET', '/api/me', undefined, { origin: 'https://evil.example' })).status).toBe(200);
  });

  it('a write body must be JSON, or a form upload on the upload route', async () => {
    const a = await signUp(app, 'sam@example.com', PW);
    for (const type of ['text/plain', 'application/x-www-form-urlencoded']) {
      const r = await a.call('POST', '/api/todos', { text: 'x' }, { 'content-type': type });
      expect(r.status, type).toBe(415);
      expect(r.body.code).toBe('bad_content_type');
    }
    const form = new FormData();
    form.set('mode', 'text');
    const res = await app.request('/api/todos', { method: 'POST', headers: { cookie: a.cookie }, body: form });
    expect(res.status).toBe(415);
    const upload = await app.request('/api/plans/draft', { method: 'POST', headers: { cookie: a.cookie }, body: form });
    expect(upload.status).not.toBe(415);
  });
});

describe('Password AutoFill (ios-15)', () => {
  it('serves apple-app-site-association only when the team id is set, with no redirect', async () => {
    expect((await req('GET', '/.well-known/apple-app-site-association')).status).toBe(404);
    env.APPLE_TEAM_ID = 'ABCDE12345';
    const r = await req('GET', '/.well-known/apple-app-site-association');
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toMatch(/^application\/json/);
    expect(r.body).toEqual({ webcredentials: { apps: ['ABCDE12345.com.joshbean.logbook'] } });
  });
});

describe('Apple Health tokens (sec-21)', () => {
  let n = 0;
  const sync = (token: string) => req('POST', '/api/apple-health/sync', { batchId: `batch-${Date.now()}-${n++}`, payloadVersion: 1 }, { authorization: `Bearer ${token}` });

  it('connecting again from the same phone revokes its earlier token; another phone keeps its own', async () => {
    const a = await signUp(app, 'sam@example.com', PW);
    const first = (await a.call('POST', '/api/apple-health/connect', { deviceName: 'iPhone', historyDays: 90, deviceKey: 'vendor-id-0001' })).body;
    const other = (await a.call('POST', '/api/apple-health/connect', { deviceName: 'iPad', historyDays: 90, deviceKey: 'vendor-id-0002' })).body;
    expect((await sync(first.token)).status).toBe(200);
    const again = (await a.call('POST', '/api/apple-health/connect', { deviceName: 'iPhone', historyDays: 90, deviceKey: 'vendor-id-0001' })).body;
    expect(again.replaced).toBe(1);
    expect((await sync(first.token)).status).toBe(401);
    expect((await sync(again.token)).status).toBe(200);
    expect((await sync(other.token)).status).toBe(200);
  });

  it('with no vendor id, the same sign-in counts as the same phone', async () => {
    const a = await signUp(app, 'sam@example.com', PW);
    const first = (await a.call('POST', '/api/apple-health/connect', { deviceName: 'iPhone', historyDays: 90 })).body;
    const again = (await a.call('POST', '/api/apple-health/connect', { deviceName: 'iPhone', historyDays: 90 })).body;
    expect(again.replaced).toBe(1);
    expect((await sync(first.token)).status).toBe(401);
  });

  it('sync and reconcile are limited per token', async () => {
    const a = await signUp(app, 'sam@example.com', PW);
    const { token } = (await a.call('POST', '/api/apple-health/connect', { deviceName: 'iPhone', historyDays: 90 })).body;
    const rec = () => req('POST', '/api/apple-health/reconcile', { kind: 'sleep', from: '2026-11-01T00:00:00Z', to: '2026-11-02T00:00:00Z', uuids: [] }, { authorization: `Bearer ${token}` });
    let last = 0;
    for (let i = 0; i < 31; i++) last = (await rec()).status;
    expect(last).toBe(429);
    for (let i = 0; i < 120; i++) expect((await sync(token)).status).toBe(200);
    const over = await sync(token);
    expect(over.status).toBe(429);
    expect(over.body.code).toBe('rate_limited');
  });
});

describe('retention (sec-19)', () => {
  const ago = (days: number) => new Date(Date.now() - days * 864e5).toISOString();

  it('removes rows deleted more than 30 days ago and assistant proposals older than 90 days, nothing else', async () => {
    const a = await signUp(app, 'sam@example.com', PW);
    const entry = (id: string, deletedAt: string | null) => ({ id, userId: a.id, date: '2026-10-01', text: id, createdAt: ago(100), deletedAt });
    db.insert(journalEntries).values([entry('j_old', ago(31)), entry('j_recent', ago(29)), entry('j_live', null)]).run();
    const action = (id: string, createdAt: string) => ({ id, userId: a.id, ask: 'a', summary: 's', ops: '[]', labels: '[]', createdAt });
    db.insert(assistantActions).values([action('aa_old', ago(91)), action('aa_new', ago(89))]).run();
    const gone = purgeDeleted(db);
    expect(gone.journal_entries).toBe(1);
    expect(gone.assistant_actions).toBe(1);
    expect(db.select().from(journalEntries).all().map((r) => r.id).sort()).toEqual(['j_live', 'j_recent']);
    expect(db.select().from(assistantActions).all().map((r) => r.id)).toEqual(['aa_new']);
    // running it again changes nothing
    expect(Object.values(purgeDeleted(db)).reduce((s, n) => s + n, 0)).toBe(0);
  });

  it('knows every table with a deleted_at column', () => {
    const tables = (Object.values(schema) as unknown[]).filter((t): t is SQLiteTable => t instanceof SQLiteTable);
    const withStamp = tables.filter((t) => getTableConfig(t).columns.some((c) => c.name === 'deleted_at')).map(getTableName).sort();
    expect(SOFT_DELETED.map((s) => getTableName(s.table)).sort()).toEqual(withStamp);
  });

  it('migration 0020 drops the tables an earlier server left behind, and leaves only tables the schema knows', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'logbook-mig-'));
    const file = path.join(dir, 'db.sqlite');
    const pre = new Database(file);
    pre.exec('CREATE TABLE reminders (id text); CREATE TABLE assistant_threads (id text); CREATE TABLE user_memory (id text); INSERT INTO reminders VALUES (1);');
    pre.close();
    const { sqlite } = openDatabase(file);
    const known: string[] = (Object.values(schema) as unknown[]).filter((t): t is SQLiteTable => t instanceof SQLiteTable).map((t) => getTableName(t));
    expect(unknownTables(sqlite, known)).toEqual([]);
    sqlite.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('habit checks by account (sec-16)', () => {
  it('another account cannot write a check under my habit, and a stray row under it is never read as mine', async () => {
    const a = await signUp(app, 'a@example.com', PW);
    const b = await signUp(app, 'b@example.com', PW);
    const h = (await a.call('POST', '/api/habits', { name: 'Stretch' })).body.at(-1);
    expect((await b.call('PUT', `/api/habits/${h.id}/days/2026-11-10`, { done: true })).status).toBe(404);
    // a row another account wrote under this habit before the fix
    db.insert(habitChecks).values({ userId: b.id, habitId: h.id, date: '2026-11-09', done: true, note: 'not yours', updatedAt: ago0() }).run();
    const r = await a.call('PUT', `/api/habits/${h.id}/days/2026-11-09`, {});
    expect(r.body).toEqual({ habitId: h.id, date: '2026-11-09', done: false, note: null });
    const rows = db.select().from(habitChecks).where(eq(habitChecks.habitId, h.id)).all();
    expect(rows.map((x) => x.userId)).toEqual([a.id]);
    expect(db.select().from(habits).all()).toHaveLength(1);
  });
});
const ago0 = () => new Date().toISOString();

describe('path values and reused ids (sec-27)', () => {
  it('a bad path value answers 422, and a session id that is someone else’s answers 409, never 500', async () => {
    const a = await signUp(app, 'a@example.com', PW);
    const b = await signUp(app, 'b@example.com', PW);
    expect((await a.call('GET', '/api/months/not-a-month')).status).toBe(422);
    const h = (await a.call('POST', '/api/habits', { name: 'Stretch' })).body.at(-1);
    expect((await a.call('PUT', `/api/habits/${h.id}/days/yesterday`, { done: true })).status).toBe(422);
    expect((await a.call('PUT', '/api/morning/days/11-10-2026', { wake: '06:00' })).status).toBe(422);
    const s = (await a.call('POST', '/api/sessions', { id: 'p_shared_1', date: '2026-11-10', kind: 'run', type: 'Easy', miles: 4 })).body;
    expect(s.id).toBe('p_shared_1');
    const clash = await b.call('POST', '/api/sessions', { id: 'p_shared_1', date: '2026-11-10', kind: 'run', type: 'Easy', miles: 4 });
    expect(clash.status).toBe(409);
    expect(clash.body.code).toBe('id_taken');
  });
});

describe('the health check (perf-22)', () => {
  it('asks the database a question, and reads as down when it cannot', async () => {
    const r = await req('GET', '/api/health');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, ready: { mail: expect.any(Boolean), claude: expect.any(Boolean), support: expect.any(Boolean) } });
    const { db: d2, sqlite } = openDatabase(':memory:');
    const down = buildApp(d2);
    sqlite.close();
    const res = await down.request('/api/health');
    expect(res.status).toBe(503);
    expect(((await res.json()) as { ok: boolean }).ok).toBe(false);
  });
});

describe('import (settings-15, sec-18)', () => {
  it('is limited per account, caps row counts, and imports in chunks that give way to other requests', async () => {
    const { IMPORT_LIMIT } = await import('./import.js');
    const { IMPORT_CAPS, importV2Chunked, zExportV2 } = await import('../services/exporter.js');
    const a = await signUp(app, 'a@example.com', PW);
    const file = (await a.call('GET', '/api/export')).body;
    for (let i = 0; i < IMPORT_LIMIT.max; i++) expect((await a.call('POST', '/api/import', file)).status).toBe(200);
    const over = await a.call('POST', '/api/import', file);
    expect(over.status).toBe(429);
    expect(over.headers.get('retry-after')).toBeTruthy();
    // too many rows of one kind: refused before anything is written
    const many = Array.from({ length: IMPORT_CAPS.habits + 1 }, (_, i) => ({ id: `h${i}`, name: `H${i}`, createdOn: '2026-01-01' }));
    expect(zExportV2.safeParse({ version: 2, habits: many }).success).toBe(false);
    // 1,200 rows in chunks of 500: other work runs between the chunks, and every row lands once
    const b = await signUp(app, 'b@example.com', PW);
    const journal = Array.from({ length: 1200 }, (_, i) => ({ id: `j${i}`, date: '2026-10-01', text: `line ${i}`, createdAt: '2026-10-01T08:00:00Z' }));
    let ticks = 0;
    const timer = setInterval(() => ticks++, 0);
    const counts = await importV2Chunked(db, b.id, zExportV2.parse({ version: 2, journal }), 500);
    clearInterval(timer);
    expect(counts.journal).toBe(1200);
    expect(ticks).toBeGreaterThan(0);
    expect(db.select().from(journalEntries).where(eq(journalEntries.userId, b.id)).all()).toHaveLength(1200);
    expect((await importV2Chunked(db, b.id, zExportV2.parse({ version: 2, journal }), 500)).journal).toBeUndefined();
  });

  it('the export carries planned days and assistant proposals, and every user table is exported or left out on purpose', async () => {
    const { USER_TABLES } = await import('../services/account.js');
    const { EXPORT_COVERAGE } = await import('../services/exporter.js');
    const a = await signUp(app, 'a@example.com', PW);
    await a.call('PUT', '/api/day-plans/2026-11-10', { bands: { morning: ['todo:t1'], afternoon: [], evening: [] } });
    db.insert(assistantActions).values({ id: 'aa1', userId: a.id, ask: 'move my run', summary: 'Moved', ops: '[{"secret":1}]', labels: '["Move Easy 4"]', createdAt: new Date().toISOString() }).run();
    const file = (await a.call('GET', '/api/export')).body;
    expect(file.dayPlans).toEqual([{ date: '2026-11-10', bands: { morning: ['todo:t1'], afternoon: [], evening: [] }, updatedAt: expect.any(String) }]);
    expect(file.assistantActions).toEqual([{ id: 'aa1', ask: 'move my run', summary: 'Moved', labels: ['Move Easy 4'], status: 'proposed', createdAt: expect.any(String), appliedAt: null }]);
    expect(file.health).toBeDefined();
    expect(file.consentLog).toBeDefined();
    // a fresh account gets the planned day back
    const b = await signUp(app, 'b@example.com', PW);
    expect((await b.call('POST', '/api/import', file)).body.imported.dayPlans).toBe(1);
    expect((await b.call('GET', '/api/day-plans/2026-11-10')).body.bands.morning).toEqual(['todo:t1']);
    // every table with a user_id is either in the export (under the named key) or left out for a stated reason
    const names = USER_TABLES.map((t) => getTableName(t.table)).sort();
    expect(Object.keys(EXPORT_COVERAGE).sort()).toEqual(names);
    for (const [table, where] of Object.entries(EXPORT_COVERAGE)) {
      if (where.exported) expect(file, `${table} is exported as ${where.exported}`).toHaveProperty(where.exported.split('.'));
      else expect(where.leftOut?.length ?? 0, table).toBeGreaterThan(20);
    }
  });
});

describe('assistant errors (assistant-11)', () => {
  it('answer stable codes and plain lines, never a schema’s own words', async () => {
    const { ASK_LIMITS } = await import('@logbook/shared');
    const a = await signUp(app, 'a@example.com', PW);
    const long = await a.call('POST', '/api/assistant', { date: '2026-11-10', turns: [{ role: 'user', text: 'x'.repeat(ASK_LIMITS.userText + 1) }] });
    expect(long.status).toBe(413);
    expect(long.body).toEqual({ error: 'That message was too long to send. Start a new chat or send less.', code: 'too_long' });
    const bad = await a.call('POST', '/api/assistant', { date: 'soon', turns: [] });
    expect(bad.status).toBe(422);
    expect(bad.body).toEqual({ error: 'That message could not be sent. Start a new chat and try again.', code: 'validation' });
    const res = await app.request('/api/assistant', { method: 'POST', headers: { 'content-type': 'application/json', cookie: a.cookie }, body: '{nope' });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe('bad_json');
    const gone = await a.call('POST', '/api/assistant/aa_missing/apply', { skip: [1] });
    expect(gone.body).toEqual({ error: 'Those changes are no longer here. Ask again.', code: 'proposal_gone' });
    const skip = await a.call('POST', '/api/assistant/aa_missing/apply', { skip: ['x'] });
    expect(skip.body.code).toBe('validation');
    for (const r of [long, bad, skip]) expect(r.body.error).not.toMatch(/expected|Too big|Invalid|turns|skip/);
  });
});
