import { sql } from 'drizzle-orm';
import { dbFileBytes, walBytes, type DB } from '../../db/index.js';
import { appVersion, uptimeSeconds } from './version.js';

/**
 * Prometheus exposition (text format 0.0.4), written by hand: the request counters and histogram live in this
 * process; job runs, LLM tokens and active users come from the database, so they cover the worker too.
 */

/** Seconds. The last bucket is +Inf. */
export const DURATION_BUCKETS = [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

interface State {
  byClass: Map<string, number>;
  bucketCounts: number[];
  durationSum: number;
  durationCount: number;
}
const fresh = (): State => ({ byClass: new Map(), bucketCounts: DURATION_BUCKETS.map(() => 0), durationSum: 0, durationCount: 0 });
let state = fresh();

export const resetMetrics = () => {
  state = fresh();
};

export const observeRequest = (status: number, ms: number) => {
  const cls = `${Math.floor(status / 100)}xx`;
  state.byClass.set(cls, (state.byClass.get(cls) ?? 0) + 1);
  const s = ms / 1000;
  for (let i = 0; i < DURATION_BUCKETS.length; i++) if (s <= DURATION_BUCKETS[i]!) state.bucketCounts[i]!++;
  state.durationSum += s;
  state.durationCount++;
};

const esc = (v: string) => v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
const labels = (l: Record<string, string | number>) =>
  Object.keys(l).length ? `{${Object.entries(l).map(([k, v]) => `${k}="${esc(String(v))}"`).join(',')}}` : '';
const fmt = (n: number) => (Number.isFinite(n) ? String(n) : n > 0 ? '+Inf' : '-Inf');

/** Sessions slide their expiry forward once a day of use (auth.ts, 60 days), so one that expires later than now + 59 days was used in the last day. */
const SESSION_DAYS = 60;

export const renderMetrics = (db: DB, dbPath: string, now = Date.now()): string => {
  const out: string[] = [];
  const metric = (name: string, type: 'counter' | 'gauge' | 'histogram', help: string, rows: [Record<string, string | number>, number][]) => {
    out.push(`# HELP ${name} ${help}`, `# TYPE ${name} ${type}`);
    for (const [l, v] of rows) out.push(`${name}${labels(l)} ${fmt(v)}`);
  };

  metric('logbook_build_info', 'The running version.', [[{ version: appVersion() }, 1]]);
  metric('process_uptime_seconds', 'Seconds since this process started.', [[{}, uptimeSeconds(now)]]);
  metric('process_resident_memory_bytes', 'Resident set size.', [[{}, process.memoryUsage().rss]]);

  metric(
    'http_requests_total',
    'API requests served by this process, by status class.',
    ['2xx', '3xx', '4xx', '5xx'].map((cls) => [{ class: cls }, state.byClass.get(cls) ?? 0]),
  );
  out.push('# HELP http_request_duration_seconds API request duration in this process.', '# TYPE http_request_duration_seconds histogram');
  DURATION_BUCKETS.forEach((le, i) => out.push(`http_request_duration_seconds_bucket{le="${le}"} ${state.bucketCounts[i]}`));
  out.push(`http_request_duration_seconds_bucket{le="+Inf"} ${state.durationCount}`, `http_request_duration_seconds_sum ${state.durationSum}`, `http_request_duration_seconds_count ${state.durationCount}`);

  const jobs = db.all<{ name: string; ok: number | null; n: number }>(sql`SELECT name, ok, count(*) AS n FROM job_runs GROUP BY name, ok ORDER BY name, ok`);
  metric(
    'logbook_job_runs_total',
    'Job runs recorded in the last 14 days, by job and outcome (ok, failed, running).',
    jobs.map((j) => [{ name: j.name, ok: j.ok === null ? 'running' : j.ok ? 'true' : 'false' }, j.n]),
  );
  const lastOk = db.all<{ name: string; at: string }>(sql`SELECT name, max(finished_at) AS at FROM job_runs WHERE ok = 1 GROUP BY name`);
  metric(
    'logbook_job_last_success_timestamp_seconds',
    'When each job last finished without an error.',
    lastOk.map((j) => [{ name: j.name }, Math.round(new Date(j.at).getTime() / 1000)]),
  );

  const dayAgo = new Date(now - 24 * 3600_000).toISOString();
  const llm = db.get<{ input: number; output: number; cached: number; calls: number }>(
    sql`SELECT coalesce(sum(input_tokens), 0) AS input, coalesce(sum(output_tokens), 0) AS output, coalesce(sum(cached_tokens), 0) AS cached, count(*) AS calls FROM llm_usage WHERE at >= ${dayAgo}`,
  );
  metric('logbook_llm_tokens_24h', 'Claude tokens in the last 24 hours, by kind.', [
    [{ kind: 'input' }, llm?.input ?? 0],
    [{ kind: 'output' }, llm?.output ?? 0],
    [{ kind: 'cached' }, llm?.cached ?? 0],
  ]);
  metric('logbook_llm_calls_24h', 'Claude calls in the last 24 hours.', [[{}, llm?.calls ?? 0]]);

  const activeSince = new Date(now + (SESSION_DAYS - 1) * 864e5).toISOString();
  const active = db.get<{ n: number }>(sql`SELECT count(DISTINCT user_id) AS n FROM auth_sessions WHERE expires_at > ${activeSince}`);
  metric('logbook_active_users_24h', 'Accounts with a session used in the last 24 hours.', [[{}, active?.n ?? 0]]);
  const users = db.get<{ n: number }>(sql`SELECT count(*) AS n FROM users`);
  metric('logbook_users_total', 'Accounts.', [[{}, users?.n ?? 0]]);

  metric('logbook_db_file_bytes', 'Size of the SQLite file.', [[{}, dbFileBytes(dbPath)]]);
  metric('logbook_db_wal_bytes', 'Size of the SQLite write-ahead log.', [[{}, walBytes(dbPath)]]);
  return out.join('\n') + '\n';
};
