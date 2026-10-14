import { shiftDays, today, weekdayOf, type Habit, type PlanBlock } from '@logbook/shared';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type DB } from '../db/index.js';
import { env } from '../env.js';
import { buildApp } from '../index.js';
import { userTableNames } from '../services/account.js';
import { nextMonday } from './me.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = path.join(here, '..', '..', 'drizzle');

type App = ReturnType<typeof buildApp>;
let db: DB;
let sqlite: Database.Database;
let app: App;

const call = async (method: string, url: string, body?: unknown, cookie?: string) => {
  const res = await app.request(url, { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, setCookie: res.headers.get('set-cookie') };
};
const cookieOf = (setCookie: string | null) => (setCookie ?? '').split(';')[0]!;
const signUp = async (email: string, password = 'password123', route = '/api/auth/signup') => {
  const r = await call('POST', route, { email, password });
  return { ...r, cookie: cookieOf(r.setCookie) };
};

const ONBOARD = { goal: 'half', runDays: ['tue', 'thu', 'sat', 'sun'], longRunDay: 'sun', weeklyMiles: 18, wake: '6:30', leave: 510, pace: '8:30', habits: ['Stretch', 'Read 15 min', 'stretch '], today: '2026-10-14' };

beforeEach(() => {
  const o = openDatabase(':memory:');
  db = o.db;
  sqlite = o.sqlite;
  app = buildApp(db);
  env.allowSignup = false;
  env.allowSetup = true;
});

describe('sign-up', () => {
  it('the first account comes through setup; more need ALLOW_SIGNUP', async () => {
    expect((await call('GET', '/api/auth/status')).body).toEqual({ hasAccount: false, setupOpen: true, signupOpen: true });
    const owner = await signUp('owner@example.com', 'password123', '/api/auth/setup');
    expect(owner.status).toBe(201);
    expect(owner.body).toMatchObject({ email: 'owner@example.com', onboardedAt: null });

    expect((await call('GET', '/api/auth/status')).body).toEqual({ hasAccount: true, setupOpen: false, signupOpen: false });
    expect((await signUp('second@example.com')).status).toBe(403);
    expect((await signUp('second@example.com', 'password123', '/api/auth/setup')).status).toBe(403);

    env.allowSignup = true;
    expect((await call('GET', '/api/auth/status')).body.signupOpen).toBe(true);
    const second = await signUp('second@example.com');
    expect(second.status).toBe(201);
    expect(second.cookie).toMatch(/^logbook_session=/);
    // email case and spaces are normalized, and taken addresses are refused
    expect((await signUp('  OWNER@example.com ')).status).toBe(409);
  });

  it('with setup closed, ALLOW_SIGNUP alone still opens the first account', async () => {
    env.allowSetup = false;
    expect((await signUp('a@example.com')).status).toBe(403);
    env.allowSignup = true;
    expect((await signUp('a@example.com')).status).toBe(201);
  });

  it('GET /me, /auth/me and /bootstrap carry onboardedAt', async () => {
    const { cookie } = await signUp('a@example.com', 'password123', '/api/auth/setup');
    expect((await call('GET', '/api/me', undefined, cookie)).body).toMatchObject({ email: 'a@example.com', onboardedAt: null });
    expect((await call('GET', '/api/auth/me', undefined, cookie)).body).toMatchObject({ onboardedAt: null });
    expect((await call('GET', '/api/bootstrap', undefined, cookie)).body.user).toMatchObject({ onboardedAt: null });
    expect((await call('GET', '/api/me')).status).toBe(401);
  });
});

describe('POST /me/onboarding', () => {
  it('writes the morning, the habits and a block from next Monday, and marks the account onboarded', async () => {
    const { cookie } = await signUp('a@example.com', 'password123', '/api/auth/setup');
    const r = await call('POST', '/api/me/onboarding', ONBOARD, cookie);
    expect(r.status).toBe(200);
    expect(r.body.user.onboardedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // wake 6:30; leave 8:30 minus shower 15, ready 15, smoothie 5, prep 15 = shower at 7:40; pace 8:30
    expect(r.body.morningSettings).toMatchObject({ wake: 390, run: { pace: 510 }, after: { showerMode: 'fixed', showerAt: 460 } });
    expect(r.body.habits.map((h: Habit) => h.name)).toEqual(['Stretch', 'Read 15 min']);
    expect(r.body.block).toMatchObject({ name: 'Half marathon · 12 weeks', start: '2026-10-19', source: 'onboarding' });
    expect(r.body.firstDay).toBe('2026-10-20');
    const boot = (await call('GET', '/api/bootstrap', undefined, cookie)).body;
    expect(boot.user.onboardedAt).toBe(r.body.user.onboardedAt);
    expect(boot.morningSettings.wake).toBe(390);
    expect(boot.blocks).toHaveLength(1);
    const oct = (await call('GET', '/api/months/2026-10', undefined, cookie)).body;
    expect(oct.sessions.map((s: { date: string }) => s.date)).toEqual(['2026-10-20', '2026-10-22', '2026-10-24', '2026-10-25', '2026-10-27', '2026-10-29', '2026-10-31']);
    expect(oct.sessions[0]).toMatchObject({ kind: 'run', type: 'Easy', title: null, blockId: r.body.block.id });
  });

  it('is idempotent: a second call duplicates no habits, sessions or blocks, and keeps onboardedAt', async () => {
    const { cookie } = await signUp('a@example.com', 'password123', '/api/auth/setup');
    const first = await call('POST', '/api/me/onboarding', ONBOARD, cookie);
    const count = () => sqlite.prepare('select count(*) n from training_sessions').get() as { n: number };
    const n1 = count().n;
    const second = await call('POST', '/api/me/onboarding', ONBOARD, cookie);
    expect(second.status).toBe(200);
    expect(second.body.habits).toHaveLength(2);
    expect(count().n).toBe(n1);
    expect((sqlite.prepare('select count(*) n from plan_blocks').get() as { n: number }).n).toBe(1);
    expect(second.body.user.onboardedAt).toBe(first.body.user.onboardedAt);
  });

  it('starts tomorrow when asked, and builds to a race', async () => {
    const { cookie } = await signUp('a@example.com', 'password123', '/api/auth/setup');
    const r = await call('POST', '/api/me/onboarding', { ...ONBOARD, start: 'tomorrow', raceDate: '2027-01-17', habits: [] }, cookie);
    expect(r.status).toBe(200);
    expect(r.body.block).toMatchObject({ start: '2026-10-15', end: '2027-01-17', name: 'Half marathon · Jan 17' });
    expect(r.body.firstDay).toBe('2026-10-15');
  });

  it('refuses bad answers with 422 and writes nothing', async () => {
    const { cookie } = await signUp('a@example.com', 'password123', '/api/auth/setup');
    expect((await call('POST', '/api/me/onboarding', { ...ONBOARD, leave: '6:00' }, cookie)).status).toBe(422);
    expect((await call('POST', '/api/me/onboarding', { ...ONBOARD, runDays: ['someday'] }, cookie)).status).toBe(422);
    const far = await call('POST', '/api/me/onboarding', { ...ONBOARD, raceDate: '2028-01-01' }, cookie);
    expect(far.status).toBe(422);
    expect(far.body.code).toBe('bad_template');
    expect((await call('GET', '/api/me', undefined, cookie)).body.onboardedAt).toBeNull();
    expect((sqlite.prepare('select count(*) n from habits').get() as { n: number }).n).toBe(0);
  });
});

describe('POST /plans/template', () => {
  const start = nextMonday(today());
  const input = { goal: '10k', weeks: 4, startDate: start, runDays: ['mon', 'wed', 'fri', 'sun'], longRunDay: 'sun', weeklyMiles: 20 };

  it('creates the block and its sessions and answers like /plans/apply', async () => {
    const { cookie } = await signUp('a@example.com', 'password123', '/api/auth/setup');
    const r = await call('POST', '/api/plans/template', input, cookie);
    expect(r.status).toBe(201);
    expect(r.body.block).toMatchObject({ name: '10K · 4 weeks', start, end: shiftDays(start, 27), source: 'template', sessionCount: 16 });
    expect(r.body.months.length).toBeGreaterThanOrEqual(1);
    expect(r.body.removed).toBe(0);
    const rows = sqlite.prepare('select date, kind, type, miles, block_id from training_sessions order by date').all() as Array<{ date: string; type: string; miles: number; block_id: string }>;
    expect(rows).toHaveLength(16);
    expect(rows.every((x) => x.block_id === r.body.block.id)).toBe(true);
    expect(new Set(rows.map((x) => weekdayOf(x.date)))).toEqual(new Set(['mon', 'wed', 'fri', 'sun']));
    const blocks = (await call('GET', '/api/bootstrap', undefined, cookie)).body.blocks as PlanBlock[];
    expect(blocks.map((b) => b.id)).toEqual([r.body.block.id]);
  });

  it('replace: true clears future planned sessions in the window, keeps done ones, the past and anything outside', async () => {
    const { cookie } = await signUp('a@example.com', 'password123', '/api/auth/setup');
    const add = async (date: string, extra: Record<string, unknown> = {}) => (await call('POST', '/api/sessions', { date, kind: 'run', type: 'Easy', miles: 4, ...extra }, cookie)).body.id as string;
    const planned = await add(shiftDays(start, 2));
    const done = await add(shiftDays(start, 3));
    await call('POST', `/api/sessions/${done}/mark`, { mark: 'done' }, cookie);
    const outside = await add(shiftDays(start, 40));
    const past = await add(shiftDays(today(), -3));
    const r = await call('POST', '/api/plans/template', { ...input, replace: true }, cookie);
    expect(r.body.removed).toBe(1);
    const ids = (sqlite.prepare('select id from training_sessions').all() as Array<{ id: string }>).map((x) => x.id);
    expect(ids).not.toContain(planned);
    expect(ids).toEqual(expect.arrayContaining([done, outside, past]));
    // without replace nothing goes: the template lands next to what is there
    const again = await call('POST', '/api/plans/template', input, cookie);
    expect(again.body.removed).toBe(0);
  });

  it('validates', async () => {
    const { cookie } = await signUp('a@example.com', 'password123', '/api/auth/setup');
    expect((await call('POST', '/api/plans/template', { ...input, goal: 'ultra' }, cookie)).status).toBe(422);
    expect((await call('POST', '/api/plans/template', { ...input, weeklyMiles: 1 }, cookie)).status).toBe(422);
    expect((await call('POST', '/api/plans/template', { ...input, replace: 'yes' }, cookie)).status).toBe(422);
    expect((await call('POST', '/api/plans/template', input)).status).toBe(401);
  });
});

/** One row in every table that has a user_id, for `userId`, filling required columns with placeholders. */
const seedEverything = (userId: string) => {
  const tables = (sqlite.prepare("select name from sqlite_master where type = 'table' and name not like '\\_\\_%' escape '\\' and name not like 'sqlite%'").all() as Array<{ name: string }>).map((t) => t.name);
  for (const t of tables) {
    const cols = sqlite.prepare(`pragma table_info(\`${t}\`)`).all() as Array<{ name: string; type: string; notnull: number; dflt_value: unknown; pk: number }>;
    if (!cols.some((c) => c.name === 'user_id')) continue;
    const vals: Record<string, unknown> = {};
    for (const c of cols) {
      if (c.name === 'user_id') vals[c.name] = userId;
      else if (c.pk || c.notnull) vals[c.name] = /int|real/i.test(c.type) ? Math.floor(Math.random() * 1e9) : `${t}-${c.name}-${userId}-${Math.random()}`;
    }
    const keys = Object.keys(vals);
    sqlite.prepare(`insert into \`${t}\` (${keys.map((k) => `\`${k}\``).join(',')}) values (${keys.map(() => '?').join(',')})`).run(...keys.map((k) => vals[k]));
  }
  return tables;
};
const rowsFor = (userId: string) => {
  const out: Record<string, number> = {};
  for (const t of userTableNames()) out[t] = (sqlite.prepare(`select count(*) n from \`${t}\` where user_id = ?`).get(userId) as { n: number }).n;
  return out;
};

describe('DELETE /me', () => {
  it('knows every table with a user_id', () => {
    const tables = (sqlite.prepare("select name from sqlite_master where type = 'table'").all() as Array<{ name: string }>).map((t) => t.name);
    const owned = tables.filter((t) => t !== 'users' && (sqlite.prepare(`pragma table_info(\`${t}\`)`).all() as Array<{ name: string }>).some((c) => c.name === 'user_id'));
    expect([...userTableNames()].sort()).toEqual(owned.sort());
  });

  it('needs the password, then deletes the account, every row it owns and the cookie', async () => {
    env.allowSignup = true;
    const a = await signUp('a@example.com');
    const b = await signUp('b@example.com');
    const aId = (await call('GET', '/api/me', undefined, a.cookie)).body.id as string;
    const bId = (await call('GET', '/api/me', undefined, b.cookie)).body.id as string;
    await call('POST', '/api/me/onboarding', ONBOARD, a.cookie);
    await call('POST', '/api/me/onboarding', ONBOARD, b.cookie);
    seedEverything(aId);
    seedEverything(bId);
    const before = rowsFor(aId);
    for (const [t, n] of Object.entries(before)) expect(n, t).toBeGreaterThan(0);

    const wrong = await call('DELETE', '/api/me', { password: 'not-the-password' }, a.cookie);
    expect(wrong.status).toBe(403);
    expect(wrong.body.code).toBe('bad_password');
    expect(rowsFor(aId)).toEqual(before);
    expect((await call('DELETE', '/api/me', {}, a.cookie)).status).toBe(422);

    const ok = await call('DELETE', '/api/me', { password: 'password123' }, a.cookie);
    expect(ok.status).toBe(200);
    expect(ok.body.ok).toBe(true);
    expect(ok.setCookie).toMatch(/logbook_session=;/);
    expect(ok.setCookie).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
    for (const [t, n] of Object.entries(rowsFor(aId))) expect(n, t).toBe(0);
    expect(sqlite.prepare('select count(*) n from users where id = ?').get(aId)).toEqual({ n: 0 });
    // the other account is untouched, and the old cookie is dead
    for (const [t, n] of Object.entries(rowsFor(bId))) expect(n, t).toBeGreaterThan(0);
    expect((await call('GET', '/api/me', undefined, a.cookie)).status).toBe(401);
    expect((await call('GET', '/api/me', undefined, b.cookie)).status).toBe(200);
    // the address is free again
    expect((await signUp('a@example.com')).status).toBe(201);
  });
});

describe('migration 0006', () => {
  it('marks accounts that existed before it as onboarded, and leaves new ones null', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'logbook-mig-'));
    try {
      // the migrations as they were before 0006
      fs.mkdirSync(path.join(tmp, 'meta'));
      const journal = JSON.parse(fs.readFileSync(path.join(MIGRATIONS, 'meta', '_journal.json'), 'utf8'));
      const last = journal.entries.find((e: { idx: number }) => e.idx === 6);
      expect(last).toMatchObject({ idx: 6, tag: '0006_onboarding' });
      expect(last.when).toBeGreaterThan(journal.entries[5].when);
      journal.entries = journal.entries.filter((e: { idx: number }) => e.idx <= 5);
      fs.writeFileSync(path.join(tmp, 'meta', '_journal.json'), JSON.stringify(journal));
      for (const e of journal.entries) fs.copyFileSync(path.join(MIGRATIONS, `${e.tag}.sql`), path.join(tmp, `${e.tag}.sql`));

      const raw = new Database(':memory:');
      const old = drizzle(raw);
      migrate(old, { migrationsFolder: tmp });
      raw.prepare("insert into users (id, email, password_hash, created_at) values ('u1', 'josh@example.com', 'x', '2026-01-01T00:00:00Z')").run();
      migrate(old, { migrationsFolder: MIGRATIONS });
      const owner = raw.prepare("select onboarded_at from users where id = 'u1'").get() as { onboarded_at: string | null };
      expect(owner.onboarded_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      raw.prepare("insert into users (id, email, password_hash, created_at) values ('u2', 'new@example.com', 'x', '2026-10-14T00:00:00Z')").run();
      expect(raw.prepare("select onboarded_at from users where id = 'u2'").get()).toEqual({ onboarded_at: null });
      raw.close();
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('migration 0007', () => {
  it('adds users.training_profile after 0006, null for every account that exists', () => {
    const journal = JSON.parse(fs.readFileSync(path.join(MIGRATIONS, 'meta', '_journal.json'), 'utf8'));
    const e6 = journal.entries.find((e: { idx: number }) => e.idx === 6);
    const e7 = journal.entries.find((e: { idx: number }) => e.idx === 7);
    expect(e7).toMatchObject({ idx: 7, tag: '0007_training_profile' });
    expect(e7.when).toBeGreaterThan(e6.when);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'logbook-mig7-'));
    try {
      fs.mkdirSync(path.join(tmp, 'meta'));
      const before = { ...journal, entries: journal.entries.filter((e: { idx: number }) => e.idx <= 6) };
      fs.writeFileSync(path.join(tmp, 'meta', '_journal.json'), JSON.stringify(before));
      for (const e of before.entries) fs.copyFileSync(path.join(MIGRATIONS, `${e.tag}.sql`), path.join(tmp, `${e.tag}.sql`));
      const raw = new Database(':memory:');
      const old = drizzle(raw);
      migrate(old, { migrationsFolder: tmp });
      raw.prepare("insert into users (id, email, password_hash, created_at) values ('u1', 'josh@example.com', 'x', '2026-01-01T00:00:00Z')").run();
      migrate(old, { migrationsFolder: MIGRATIONS });
      expect(raw.prepare("select training_profile from users where id = 'u1'").get()).toEqual({ training_profile: null });
      raw.close();
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('the training profile', () => {
  it('onboarding stores the answers; GET /me and the bootstrap carry them', async () => {
    const { cookie } = await signUp('a@example.com', 'password123', '/api/auth/setup');
    expect((await call('GET', '/api/me', undefined, cookie)).body.trainingProfile).toBeNull();
    expect((await call('GET', '/api/bootstrap', undefined, cookie)).body.user.trainingProfile).toBeNull();
    await call('POST', '/api/me/onboarding', { ...ONBOARD, raceDate: '2027-01-17' }, cookie);
    const me = (await call('GET', '/api/me', undefined, cookie)).body;
    expect(me.trainingProfile).toMatchObject({ goal: 'half', raceDate: '2027-01-17', runDays: ['tue', 'thu', 'sat', 'sun'], longRunDay: 'sun', weeklyMiles: 18 });
    expect(me.trainingProfile.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect((await call('GET', '/api/bootstrap', undefined, cookie)).body.user.trainingProfile).toEqual(me.trainingProfile);
  });

  it('PATCH /me/training changes some answers and keeps the rest', async () => {
    const { cookie } = await signUp('a@example.com', 'password123', '/api/auth/setup');
    await call('POST', '/api/me/onboarding', ONBOARD, cookie);
    const r = await call('PATCH', '/api/me/training', { weeklyMiles: 24, runDays: ['mon', 'wed', 'sat'], longRunDay: 'sat' }, cookie);
    expect(r.status).toBe(200);
    expect(r.body.trainingProfile).toMatchObject({ goal: 'half', raceDate: null, runDays: ['mon', 'wed', 'sat'], longRunDay: 'sat', weeklyMiles: 24 });
    // a long-run day off the run days joins them; "just running" has no race day
    const g = await call('PATCH', '/api/me/training', { goal: 'base', raceDate: '2027-03-01', longRunDay: 'sun' }, cookie);
    expect(g.body.trainingProfile).toMatchObject({ goal: 'base', raceDate: null, runDays: ['mon', 'wed', 'sat', 'sun'], longRunDay: 'sun' });
    expect((await call('GET', '/api/me', undefined, cookie)).body.trainingProfile).toMatchObject({ goal: 'base', weeklyMiles: 24 });
  });

  it('validates, needs all five answers the first time, and needs a session', async () => {
    const { cookie } = await signUp('a@example.com', 'password123', '/api/auth/setup');
    expect((await call('PATCH', '/api/me/training', { weeklyMiles: 20 }, cookie)).status).toBe(422);
    expect((await call('PATCH', '/api/me/training', {}, cookie)).status).toBe(422);
    expect((await call('PATCH', '/api/me/training', { goal: 'ultra' }, cookie)).status).toBe(422);
    const full = { goal: '10k', raceDate: null, runDays: ['tue', 'sat'], longRunDay: 'sat', weeklyMiles: 15 };
    expect((await call('PATCH', '/api/me/training', full, cookie)).status).toBe(200);
    expect((await call('PATCH', '/api/me/training', { weeklyMiles: 15 })).status).toBe(401);
  });
});

describe('PATCH /morning/settings after.order', () => {
  it('stores the back-home order and the timeline follows it', async () => {
    const { cookie } = await signUp('a@example.com', 'password123', '/api/auth/setup');
    expect((await call('GET', '/api/morning/settings', undefined, cookie)).body.after.order).toEqual(['shower', 'ready', 'smoothie', 'prep']);
    const r = await call('PATCH', '/api/morning/settings', { after: { order: ['prep', 'shower', 'ready', 'smoothie'] } }, cookie);
    expect(r.status).toBe(200);
    expect(r.body.after).toMatchObject({ order: ['prep', 'shower', 'ready', 'smoothie'], shower: 15 });
    // a later patch of another field keeps it; the array is replaced, never merged
    await call('PATCH', '/api/morning/settings', { after: { shower: 20 } }, cookie);
    expect((await call('GET', '/api/bootstrap', undefined, cookie)).body.morningSettings.after).toMatchObject({ shower: 20, order: ['prep', 'shower', 'ready', 'smoothie'] });
    await call('PATCH', '/api/morning/settings', { after: { order: ['smoothie', 'ready', 'shower', 'prep'] } }, cookie);
    expect((await call('GET', '/api/morning/settings', undefined, cookie)).body.after.order).toEqual(['smoothie', 'ready', 'shower', 'prep']);
    expect((await call('PATCH', '/api/morning/settings', { after: { order: ['prep', 'prep', 'ready', 'smoothie'] } }, cookie)).status).toBe(422);
  });
});
