import { z } from 'zod';
import { Hono } from 'hono';
import { logLine } from '../lib/log.js';
import { ApiError, parseBody } from '../lib/util.js';
import { clientIp, tooMany, windowHit } from '../services/throttle.js';

/**
 * Contract 7: `POST /api/client-errors { message, stack, route, appVersion, ua }`, at most 8 KB, answers 204.
 *
 * These are unlinked diagnostics (the privacy label says crash data, not linked to the person), so this route is
 * mounted before anything that reads the session, never looks at the cookie, writes nothing to the database, and its
 * log lines carry no account id, hashed or plain, and no address. One structured line per report.
 */
export const CLIENT_ERROR_LIMIT = { max: 20, windowMs: 10 * 60_000 } as const;
const cut = (max: number) => z.string().transform((s) => s.slice(0, max));
export const zClientError = z.object({
  message: cut(500),
  stack: cut(4000).optional(),
  /** The screen's path. A query string is dropped: it can carry a search word or a token. */
  route: cut(200)
    .transform((r) => r.split(/[?#]/)[0]!)
    .optional(),
  appVersion: cut(40).optional(),
  ua: cut(300).optional(),
});

export const clientErrorRoutes = () => {
  const r = new Hono();
  r.post('/', async (c) => {
    const wait = windowHit(`client-errors:${clientIp(c)}`, CLIENT_ERROR_LIMIT.max, CLIENT_ERROR_LIMIT.windowMs);
    if (wait) throw tooMany(wait, 'Too many reports. Try again later.');
    const body = await parseBody(c.req.raw, zClientError).catch(() => {
      throw new ApiError(422, 'That report could not be read.', 'validation');
    });
    logLine({ t: 'client_error', at: new Date().toISOString(), message: body.message, stack: body.stack ?? null, route: body.route ?? null, appVersion: body.appVersion ?? null, ua: body.ua ?? null });
    return c.body(null, 204);
  });
  return r;
};
