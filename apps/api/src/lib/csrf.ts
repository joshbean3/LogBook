import type { Context, MiddlewareHandler } from 'hono';
import { env } from '../env.js';
import { ApiError } from './util.js';

/**
 * Cross-site request forgery: the session cookie is `SameSite=Lax`, which already keeps a cross-site POST from carrying
 * it in every current browser; this is the second lock. A mutating request (POST, PUT, PATCH, DELETE) under /api must
 * show where it came from: an `Origin` (or `Referer`) on `APP_URL`'s origin, the native app's origin
 * (`capacitor://localhost`, `http://localhost` on Android), or `localhost` on any port outside production; or the custom
 * header `X-Requested-With: logbook`, which the web client and the native app send on every request and which no
 * cross-site form or simple request can add. Anything else is a 403 `bad_origin`.
 *
 * A request with neither header is not a browser's (browsers send Origin on every POST): curl, a script, the tests. In
 * production it is refused too (add the header); in dev and test it passes, so the API stays usable from a terminal.
 *
 * Provider webhooks and OAuth callbacks never go through this: they are mounted outside `requireAuth` and check their
 * own signatures and tokens.
 */
export const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
export const REQUESTED_WITH_HEADER = 'x-requested-with';
export const REQUESTED_WITH_VALUE = 'logbook';
/** Origins the native shells report (iOS WKWebView, Android WebView). */
const NATIVE_ORIGINS = new Set(['capacitor://localhost', 'ionic://localhost', 'http://localhost', 'https://localhost']);

/** The origin of a URL. For a scheme the URL standard calls non-special (`capacitor://localhost`), `.origin` is "null", so it is built from the parts. */
const originOf = (s: string): string | null => {
  try {
    const u = new URL(s);
    return u.origin === 'null' ? (u.host ? `${u.protocol}//${u.host}` : null) : u.origin;
  } catch {
    return null;
  }
};

/** Is this origin one of ours? */
export const originAllowed = (origin: string): boolean => {
  const o = originOf(origin);
  if (!o || o === 'null') return false;
  if (o === originOf(env.APP_URL) || NATIVE_ORIGINS.has(o)) return true;
  if (env.isProd) return false;
  const host = new URL(o).hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
};

/** The reason a mutating request is refused, or null when it may go on. */
export const csrfProblem = (c: Context): string | null => {
  if (!MUTATING.has(c.req.method)) return null;
  if (c.req.header(REQUESTED_WITH_HEADER)?.trim().toLowerCase() === REQUESTED_WITH_VALUE) return null;
  const origin = c.req.header('origin');
  if (origin) return originAllowed(origin) ? null : `origin ${origin}`;
  const referer = c.req.header('referer');
  if (referer) return originAllowed(referer) ? null : `referer ${originOf(referer) ?? referer}`;
  return env.isProd ? 'no origin' : null;
};

export const CSRF_MESSAGE = 'That request didn’t come from Logbook. Reload the app and try again.';

/** Throws the 403 for a request that fails `csrfProblem`. */
export const assertSameOrigin = (c: Context) => {
  const why = csrfProblem(c);
  if (why) throw new ApiError(403, CSRF_MESSAGE, 'bad_origin');
};

/** The same check as middleware, for routes that take no session (sign in, sign up, forgot, reset). */
export const csrf: MiddlewareHandler = async (c, next) => {
  assertSameOrigin(c);
  await next();
};
