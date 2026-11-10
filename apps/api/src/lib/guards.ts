import type { MiddlewareHandler } from 'hono';
import { env } from '../env.js';
import { ApiError } from './util.js';

const WRITES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
/** Routes whose body may have any type. */
const ANY_TYPE = ['/api/client-errors'];

/** The origins the iPhone app's web view can have (Capacitor), on top of the server's own. */
export const APP_ORIGINS = ['capacitor://localhost', 'ionic://localhost'];
const isLocal = (origin: string) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);

/**
 * Whether a write may come from this `Origin`. No header at all is fine: the phone's native HTTP client, the Apple
 * Health sync engine and Strava's webhook send none, and a browser always sends one on a cross-site write. With a
 * header, it must be this server (APP_URL, or the host the request was sent to), the app's web view, or an origin
 * listed in ALLOWED_ORIGINS. Outside production any localhost port is fine (the dev server proxies from its own).
 */
export const originAllowed = (origin: string | undefined, host: string | undefined, e: { appOrigin: string; extra: string[]; isProd: boolean }): boolean => {
  if (!origin) return true;
  if (origin === e.appOrigin || APP_ORIGINS.includes(origin) || e.extra.includes(origin)) return true;
  if (!e.isProd && isLocal(origin)) return true;
  try {
    return !!host && new URL(origin).host === host;
  } catch {
    return false;
  }
};

/**
 * Two checks on every state-changing request under /api, on top of the SameSite cookie:
 * - a foreign `Origin` is refused (403 `bad_origin`);
 * - a body must be JSON, or a form upload on the routes that take a file (415 `bad_content_type`). A plain-text or
 *   url-encoded body is what a cross-site form can send without asking, so it is never read.
 */
export const writeGuard = (uploads: string[]): MiddlewareHandler => {
  const appOrigin = new URL(env.APP_URL).origin;
  return async (c, next) => {
    if (!WRITES.has(c.req.method)) return next();
    if (!originAllowed(c.req.header('origin'), c.req.header('host'), { appOrigin, extra: env.allowedOrigins, isProd: env.isProd })) throw new ApiError(403, 'That request came from somewhere Logbook does not know.', 'bad_origin');
    // a body with no type at all is refused too; a write with no body (sign out, resend) needs no type. A client error
    // report may come as text (navigator.sendBeacon): it needs no session, so there is nothing to forge.
    if (ANY_TYPE.includes(c.req.path)) return next();
    const type = (c.req.header('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
    const length = Number(c.req.header('content-length') ?? '0');
    const hasBody = length > 0 || !!c.req.header('transfer-encoding');
    if (type || hasBody) {
      const ok = type === 'application/json' || (type === 'multipart/form-data' && uploads.includes(c.req.path));
      if (!ok) throw new ApiError(415, 'Send JSON.', 'bad_content_type');
    }
    return next();
  };
};

/**
 * The Content-Security-Policy for everything this server sends (the web app, the legal pages, the small verification
 * page). Scripts, styles, fonts and requests come from this origin only; images also from data:, blob: and https
 * (covers, map tiles); styles may be inline (the app sets style attributes); nothing may frame the app.
 */
export const CSP = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
  fontSrc: ["'self'", 'data:'],
  connectSrc: ["'self'"],
  workerSrc: ["'self'"],
  manifestSrc: ["'self'"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
};

/** Features the app never uses, switched off for the page and anything it embeds. */
export const PERMISSIONS_POLICY = { camera: [], microphone: [], geolocation: [], payment: [], usb: [] };
