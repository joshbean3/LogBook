import { daysBetween, isISODate, today as serverToday, type ISODate } from '@logbook/shared';
import { and, eq, lt } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import type { AuthEnv } from '../auth.js';
import type { DB } from '../db/index.js';
import { idempotencyKeys } from '../db/schema.js';
import { nowISO } from './util.js';

// ---------- the athlete's date ----------

/** The header the web client sends on every request: its local date, `YYYY-MM-DD`. */
export const LOCAL_DATE_HEADER = 'x-local-date';
/** The client's IANA time zone, sent beside the date; stored on the account when it changes. */
export const TIMEZONE_HEADER = 'x-timezone';
/** How far the client's date may sit from the server's and still be believed (time zones span ±14 h, so ±1 day; 2 for slack). */
export const LOCAL_DATE_SLACK_DAYS = 2;

/**
 * "Today" for this request: the client's local date (`X-Local-Date`) when it is a real date within two days of the server's,
 * else the server's. Every server default that means "today" (a habit's start, a to-do moved to Later, the template's
 * replace window, the journal's daily pick) uses this, so an athlete east of the server is never filed a day behind.
 */
export const clientToday = (header: string | null | undefined, server: ISODate = serverToday()): ISODate => {
  const h = header?.trim();
  if (!h || !isISODate(h)) return server;
  return Math.abs(daysBetween(server, h)) <= LOCAL_DATE_SLACK_DAYS ? h : server;
};

// ---------- idempotent writes ----------

export const IDEMPOTENCY_HEADER = 'idempotency-key';
/** How long a key's first answer is kept and replayed. */
export const IDEMPOTENCY_TTL_MS = 24 * 3600_000;
const WRITES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
/** Requests with a key that are being answered right now, so a twin that arrives meanwhile waits for the first answer. */
const inflight = new Map<string, Promise<void>>();

/**
 * Contract 4. A write (POST/PUT/PATCH/DELETE) that carries `Idempotency-Key` is answered once per user and key: the first
 * answer (status and body; anything under 500) is stored, and any later request with the same key, method and path within
 * 24 hours gets that same answer back (with `Idempotent-Replay: true`) without running again. A twin sent while the first
 * is still being answered waits for it. Without the header nothing changes.
 */
export const idempotency =
  (db: DB): MiddlewareHandler<AuthEnv> =>
  async (c, next) => {
    if (!WRITES.has(c.req.method)) return next();
    const key = c.req.header(IDEMPOTENCY_HEADER)?.trim();
    if (!key || key.length > 200) return next();
    const userId = c.get('user').id;
    const method = c.req.method;
    const path = new URL(c.req.url).pathname;
    const since = new Date(Date.now() - IDEMPOTENCY_TTL_MS).toISOString();
    const lookup = () => {
      const row = db.select().from(idempotencyKeys).where(and(eq(idempotencyKeys.userId, userId), eq(idempotencyKeys.key, key))).get();
      return row && row.createdAt >= since && row.method === method && row.path === path ? row : null;
    };
    const replay = (row: { status: number; body: string }) =>
      new Response(row.body || null, { status: row.status, headers: { 'content-type': 'application/json; charset=UTF-8', 'idempotent-replay': 'true' } });

    const flight = `${userId}\u0000${key}`;
    const twin = inflight.get(flight);
    if (twin) await twin;
    const hit = lookup();
    if (hit) return replay(hit);

    let done!: () => void;
    inflight.set(
      flight,
      new Promise<void>((r) => (done = r)),
    );
    try {
      await next();
      const res = c.res;
      if (res && res.status < 500) {
        const body = res.status === 204 ? '' : await res.clone().text();
        db.delete(idempotencyKeys).where(lt(idempotencyKeys.createdAt, since)).run();
        db.insert(idempotencyKeys)
          .values({ userId, key, method, path, status: res.status, body, createdAt: nowISO() })
          .onConflictDoUpdate({ target: [idempotencyKeys.userId, idempotencyKeys.key], set: { method, path, status: res.status, body, createdAt: nowISO() } })
          .run();
      }
    } finally {
      inflight.delete(flight);
      done();
    }
  };
