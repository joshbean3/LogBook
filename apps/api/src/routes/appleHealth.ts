import { zDate, zHealthBatchEnvelope, zHealthConnect, zHealthReconcile, type HealthDaily } from '@logbook/shared';
import { z } from 'zod';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { sessionOf, type AuthEnv } from '../auth.js';
import type { DB } from '../db/index.js';
import { clientToday, LOCAL_DATE_HEADER } from '../lib/requests.js';
import { ApiError, parseBody, parseQuery } from '../lib/util.js';
import { logConsent } from '../services/consent.js';
import { writeSetting } from './core.js';
import { connectHealth, deviceOf, disconnectHealth, healthDaily, healthStatus, reconcileHealth, storeBatch } from '../services/appleHealth.js';
import { tooMany, windowHit } from '../services/throttle.js';

/**
 * Apple Health routes under /api/apple-health (docs/health/apple-health.md §3.5). `/api/health` is Fly's health check,
 * so these live apart.
 *
 * Two kinds of caller: the phone's sync engine, with its device token (it may run with no web view, so it never borrows
 * the web session), and the app's screens, with the signed-in session.
 */

const MAX_BATCH_BYTES = 2 * 1024 * 1024;
const zSleepGoal = z.object({ sleepGoalMin: z.number().int().min(240).max(720) });
const bearer = (h: string | undefined) => (h?.startsWith('Bearer ') ? h.slice(7).trim() : null);
/**
 * Per device token, a minute: far above what the sync engine sends (a first import of a year is a few dozen batches),
 * low enough that a stolen or runaway token cannot flood the server. Past it: 429 `rate_limited` with Retry-After.
 */
export const HEALTH_SYNC_LIMITS = { sync: 120, reconcile: 30, windowMs: 60_000 } as const;

/**
 * The phone's routes: sync and reconcile, by device token. Mounted before the session-guarded routes. Both take sleep,
 * heart rate variability and resting heart rate and refuse anything else with 422: a sample of another type, a day sum
 * or a workout in a batch (`health_type`), or a reconcile for another kind.
 */
export const appleHealthDeviceRoutes = (db: DB) => {
  const r = new Hono();
  const userOf = (h: string | undefined, kind: 'sync' | 'reconcile') => {
    const d = deviceOf(db, bearer(h));
    if (!d) throw new ApiError(401, 'This device is no longer connected to Apple Health in Logbook. Connect again in Settings.', 'health_device');
    const wait = windowHit(`health:${kind}:${d.deviceId}`, HEALTH_SYNC_LIMITS[kind], HEALTH_SYNC_LIMITS.windowMs);
    if (wait) throw tooMany(wait, 'Too many uploads at once. The phone will try again shortly.');
    return d.userId;
  };

  r.post(
    '/sync',
    bodyLimit({ maxSize: MAX_BATCH_BYTES, onError: (c) => c.json({ error: 'That upload is too big. Send it in smaller batches.', code: 'too_big' }, 413) }),
    async (c) => {
      const userId = userOf(c.req.header('authorization'), 'sync');
      const b = await parseBody(c.req.raw, zHealthBatchEnvelope);
      return c.json(storeBatch(db, userId, b));
    },
  );

  r.post('/reconcile', async (c) => {
    const userId = userOf(c.req.header('authorization'), 'reconcile');
    return c.json(reconcileHealth(db, userId, await parseBody(c.req.raw, zHealthReconcile)));
  });

  return r;
};

/** The app's routes: connect, status, disconnect, by the signed-in session. */
export const appleHealthRoutes = (db: DB) => {
  const r = new Hono<AuthEnv>();

  /** Connect this phone: a device token for its sync engine. Agreeing to connect is recorded in the consent log. */
  r.post('/apple-health/connect', async (c) => {
    const input = await parseBody(c.req.raw, zHealthConnect);
    const userId = c.get('user').id;
    const out = connectHealth(db, userId, input, clientToday(c.req.header(LOCAL_DATE_HEADER)), sessionOf(db, c)?.id);
    logConsent(db, userId, [{ kind: 'apple_health', value: true }]);
    return c.json(out, 201);
  });

  /**
   * Contract 4: `GET /apple-health/daily?from=YYYY-MM-DD&to=YYYY-MM-DD` answers `{ days: [{ date, sleepMin, hrvMs,
   * restingHr }] }`, one row per day in order, each value a number or null, at most 400 days a call. An optional `tz`
   * (the phone's IANA zone, e.g. America/Denver) places readings that carry no zone of their own.
   */
  r.get('/apple-health/daily', (c) => {
    const q = parseQuery(c.req.query(), z.object({ from: zDate, to: zDate, tz: z.string().max(60).optional() }));
    const out: HealthDaily = { days: healthDaily(db, c.get('user').id, q.from, q.to, q.tz) };
    return c.json(out);
  });

  r.get('/apple-health/status', (c) => c.json(healthStatus(db, c.get('user').id)));

  /** The sleep goal, asked during connect and changed in Settings › Apple Health. */
  r.put('/apple-health/sleep-goal', async (c) => {
    const { sleepGoalMin } = await parseBody(c.req.raw, zSleepGoal);
    writeSetting(db, c.get('user').id, 'sleepGoalMin', sleepGoalMin);
    return c.json({ sleepGoalMin });
  });

  r.delete('/apple-health', (c) => {
    const userId = c.get('user').id;
    const was = healthStatus(db, userId).connected;
    disconnectHealth(db, userId);
    if (was) logConsent(db, userId, [{ kind: 'apple_health', value: false }]);
    return c.json({ ok: true });
  });

  return r;
};
