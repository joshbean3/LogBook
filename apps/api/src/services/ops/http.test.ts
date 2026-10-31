import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type DB, type SqliteHandle } from '../../db/index.js';
import { jobRuns } from '../../db/schema.js';
import { env } from '../../env.js';
import { buildApp, IP_LIMITS } from '../../index.js';
import { setLogSink } from '../../lib/log.js';
import { resetRateLimits } from '../../lib/ratelimit.js';
import { resetMetrics } from './metrics.js';

type App = ReturnType<typeof buildApp>;
let db: DB;
let sqlite: SqliteHandle;
let app: App;
let lines: string[];
let restore: (l: string) => void;

beforeEach(() => {
  const o = openDatabase(':memory:');
  db = o.db;
  sqlite = o.sqlite;
  app = buildApp(db);
  env.allowSetup = true;
  env.METRICS_TOKEN = undefined;
  resetRateLimits();
  resetMetrics();
  lines = [];
  restore = setLogSink((l) => lines.push(l));
});
afterEach(() => setLogSink(restore));

const setup = async () => {
  const res = await app.request('/api/auth/setup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'josh@example.com', password: 'password123' }) });
  return (res.headers.get('set-cookie') ?? '').split(';')[0]!;
};

describe('health and readiness', () => {
  it('report the database, the WAL, uptime and the version', async () => {
    for (const p of ['/api/health', '/api/ready']) {
      const res = await app.request(p);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, db: 'ok', wal_bytes: 0, uptime_s: expect.any(Number), version: expect.stringMatching(/^\d+\.\d+\.\d+/) });
    }
  });

  it('answer 503 when the database cannot answer SELECT 1', async () => {
    sqlite.close();
    const res = await app.request('/api/health');
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ ok: false, db: 'error' });
  });

  it('answer 503 while shutting down', async () => {
    let closing = false;
    const a = buildApp(db, { shuttingDown: () => closing });
    expect((await a.request('/api/ready')).status).toBe(200);
    closing = true;
    expect((await a.request('/api/ready')).status).toBe(503);
    expect(await (await a.request('/api/ready')).json()).toMatchObject({ ok: false, db: 'closing' });
  });
});

describe('request ids and logging', () => {
  it('echo a well-formed X-Request-Id and mint one otherwise', async () => {
    const r1 = await app.request('/api/health', { headers: { 'x-request-id': 'abc-123' } });
    expect(r1.headers.get('x-request-id')).toBe('abc-123');
    const r2 = await app.request('/api/health', { headers: { 'x-request-id': 'bad id with spaces' } });
    expect(r2.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
    const r3 = await app.request('/api/health');
    expect(r3.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('a 500 is reported with the request id and answered with it', async () => {
    const cookie = await setup();
    // a closed database makes every query throw something that is not an HTTPException
    sqlite.close();
    const res = await app.request('/api/me', { headers: { 'x-request-id': 'req-9', cookie } });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Something went wrong on the server.', code: 'internal', requestId: 'req-9' });
    const line = lines.find((l) => l.includes('not open'));
    expect(line).toBeTruthy();
    expect(line).toContain('req-9');
    expect(line).toContain('/api/me');
  });

  it('writes one line per API request with the user once signed in', async () => {
    const cookie = await setup();
    lines.length = 0;
    const prev = env.logLevel;
    const { setLogLevel } = await import('../../lib/log.js');
    setLogLevel('info');
    try {
      await app.request('/api/me', { headers: { cookie } });
    } finally {
      setLogLevel(prev);
    }
    const line = lines.find((l) => l.includes('/api/me'));
    expect(line).toBeTruthy();
    expect(line).toMatch(/status[=:]200|"status":200/);
    expect(line).toMatch(/userId/);
  });
});

describe('metrics', () => {
  it('exposes requests, jobs, tokens, users and the file sizes in the Prometheus text format', async () => {
    await setup();
    await app.request('/api/nope');
    db.insert(jobRuns).values({ id: 'j1', name: 'reminders', startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), ok: 1 }).run();
    db.insert(jobRuns).values({ id: 'j2', name: 'reminders', startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), ok: 0, error: 'x' }).run();
    db.run(sql`INSERT INTO llm_usage (id, user_id, kind, model, input_tokens, output_tokens, cached_tokens, ms, at) VALUES ('l1', 'u', 'assistant', 'm', 100, 20, 5, 10, ${new Date().toISOString()})`);
    const res = await app.request('/api/metrics');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/plain/);
    const text = await res.text();
    expect(text).toMatch(/^# TYPE http_requests_total counter$/m);
    expect(text).toMatch(/^http_requests_total\{class="2xx"\} [1-9]\d*$/m);
    expect(text).toMatch(/^http_requests_total\{class="4xx"\} 1$/m);
    expect(text).toMatch(/^http_request_duration_seconds_bucket\{le="\+Inf"\} \d+$/m);
    expect(text).toMatch(/^logbook_job_runs_total\{name="reminders",ok="true"\} 1$/m);
    expect(text).toMatch(/^logbook_job_runs_total\{name="reminders",ok="false"\} 1$/m);
    expect(text).toMatch(/^logbook_llm_tokens_24h\{kind="input"\} 100$/m);
    expect(text).toMatch(/^logbook_llm_tokens_24h\{kind="output"\} 20$/m);
    expect(text).toMatch(/^logbook_active_users_24h 1$/m);
    expect(text).toMatch(/^logbook_users_total 1$/m);
    expect(text).toMatch(/^logbook_db_file_bytes 0$/m);
    expect(text).toMatch(/^logbook_db_wal_bytes 0$/m);
  });

  it('needs the bearer token when METRICS_TOKEN is set', async () => {
    env.METRICS_TOKEN = 'sekrit';
    expect((await app.request('/api/metrics')).status).toBe(401);
    expect((await app.request('/api/metrics', { headers: { authorization: 'Bearer nope' } })).status).toBe(401);
    expect((await app.request('/api/metrics', { headers: { authorization: 'Bearer sekrit' } })).status).toBe(200);
  });
});

describe('per-address limits', () => {
  it('close /api/auth/* writes to an address after 20 a minute; reads, health and other addresses stay open', async () => {
    const a = buildApp(db, { ipLimits: true });
    const headers = { 'fly-client-ip': '203.0.113.9', 'content-type': 'application/json' };
    // logout is the one auth write with no throttle of its own (login closes after six failures)
    const attempt = () => a.request('/api/auth/logout', { method: 'POST', headers });
    let last = 0;
    for (let i = 0; i < IP_LIMITS.auth.limit; i++) last = (await attempt()).status;
    expect(last).not.toBe(429);
    const over = await attempt();
    expect(over.status).toBe(429);
    expect(over.headers.get('retry-after')).toMatch(/^\d+$/);
    expect(((await over.json()) as { code: string }).code).toBe('rate_limited');
    // a cold open's status check never counts, nor does the health check; another address is fine
    expect((await a.request('/api/auth/status', { headers })).status).toBe(200);
    expect((await a.request('/api/health', { headers })).status).toBe(200);
    expect((await a.request('/api/auth/logout', { method: 'POST', headers: { ...headers, 'fly-client-ip': '203.0.113.10' } })).status).not.toBe(429);
  });

  it('the global ceiling counts every API call from an address', async () => {
    const a = buildApp(db, { ipLimits: true });
    const headers = { 'x-forwarded-for': '198.51.100.7, 10.0.0.1' };
    let status = 0;
    // a signed-out /api/me is a 401: counted all the same
    for (let i = 0; i < IP_LIMITS.all.limit; i++) status = (await a.request('/api/me', { headers })).status;
    expect(status).toBe(401);
    expect((await a.request('/api/me', { headers })).status).toBe(429);
  }, 20_000);
});
