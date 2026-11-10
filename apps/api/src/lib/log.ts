import type { Context, MiddlewareHandler } from 'hono';
import { env } from '../env.js';
import { userHash } from '../services/audit.js';

/**
 * Structured logs: one JSON object a line on stdout (Fly keeps and ships them).
 *
 * A request line is `{ t: 'req', at, method, route, status, ms, u }`. `route` is the pattern that matched
 * (`/api/sessions/:id`), never the path that was asked for, so no id, token or search word reaches the log. `u` is the
 * keyed hash of the account id (services/audit.ts), or null for a request with no session. No body, no query string,
 * no address, no user agent.
 */
export type LogLine = Record<string, string | number | boolean | null>;
type Sink = (line: LogLine) => void;
const toStdout: Sink = (line) => console.log(JSON.stringify(line));
/** Tests are quiet unless they ask to see the lines. */
let sink: Sink | null = env.NODE_ENV === 'test' ? null : toStdout;
/** Send log lines somewhere else (tests), or `null` for nowhere. Returns the previous sink. */
export const setLogSink = (next: Sink | null): Sink | null => {
  const was = sink;
  sink = next;
  return was;
};
export const logLine = (line: LogLine) => {
  try {
    sink?.(line);
  } catch {
    /* a log line never breaks a request */
  }
};

/** Routes whose lines must never carry an account, whatever cookie came with the request (critic-04: client error reports are unlinked diagnostics). */
export const UNLINKED_ROUTES = new Set(['/api/client-errors']);

const routeOf = (c: Context): string => {
  // the pattern of the deepest handler that ran; a path nothing matched is logged as such, never as typed
  const pattern = c.req.routePath;
  if (!pattern || pattern === '*' || pattern === '/*') return c.req.path.startsWith('/api/') ? '/api/*' : 'static';
  return pattern.includes('*') && !c.req.path.startsWith('/api/') ? 'static' : pattern;
};

export const requestLog = (): MiddlewareHandler => async (c, next) => {
  const start = performance.now();
  try {
    await next();
  } finally {
    const route = routeOf(c);
    // health checks arrive every few seconds and say nothing
    if (route !== '/api/health') {
      const user = UNLINKED_ROUTES.has(route) ? undefined : (c.get('user' as never) as { id?: string } | undefined);
      logLine({ t: 'req', at: new Date().toISOString(), method: c.req.method, route, status: c.res?.status ?? 500, ms: Math.round(performance.now() - start), u: user?.id ? userHash(user.id) : null });
    }
  }
};

/** An error nobody caught, as one line: its name and message, and the stack outside production logs only when short. */
export const logError = (where: string, err: unknown) => {
  const e = err instanceof Error ? err : new Error(String(err));
  logLine({ t: 'error', at: new Date().toISOString(), where, name: e.name, message: e.message.slice(0, 500), stack: (e.stack ?? '').split('\n').slice(0, 12).join('\n').slice(0, 2000) });
};
