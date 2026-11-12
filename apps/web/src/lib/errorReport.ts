import pkg from '../../package.json';

/**
 * Crash reports (Contract 7): a render error, a window error or an unhandled rejection sends one small report to
 * POST /api/client-errors { message, stack, route, appVersion, ua }, at most 8 KB, no session needed. Nothing the person
 * wrote goes in it: the route keeps its shape but loses its query and any id-like part, and anything shaped like an email
 * address is masked. One report per distinct failure, and at most a handful per launch, so a loop cannot flood the server.
 */
export interface ClientErrorReport {
  message: string;
  stack: string;
  route: string;
  appVersion: string;
  ua: string;
}

const MAX_BYTES = 8 * 1024;
const MAX_PER_LAUNCH = 10;
const seen = new Set<string>();
let sent = 0;

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
/**
 * Text in quotes inside an error is data as often as not: a JSON parser quotes the text it choked on, a validator the
 * value it refused, the engine the key it could not read. All of it is masked, whatever it holds, so nothing a person
 * typed can ride out in a report. One kind is kept, because it is the report's most useful word and comes from the code:
 * a plain name (letters, digits, `_`, `$`, at most 24) right after the engine's own "reading", "setting", "execute", "on",
 * "property" or "method".
 */
const QUOTED = /(^|[\s(\[:,=])(["'`\u201c\u2018])([^\n]{1,400}?)(["'`\u201d\u2019])(?=$|[\s)\].,:;!?])/g;
const NAME = /^[A-Za-z_$][\w$]{0,23}$/;
const AFTER = /(?:reading|setting|execute|on|property|method)\s$/;
const scrub = (s: string) =>
  s.replace(EMAIL, '[email]').replace(QUOTED, (all: string, lead: string, open: string, inner: string, close: string, at: number, whole: string) => (NAME.test(inner) && AFTER.test(whole.slice(Math.max(0, at - 12), at + lead.length)) ? all : `${lead}${open}…${close}`));

/** The route's shape: /today/2026-11-10/morning stays (a date is not personal), a long id becomes :id, the query goes. */
export const routeShape = (path: string): string =>
  path
    .split(/[?#]/)[0]!
    .split('/')
    .map((seg) => (/^[0-9a-f-]{16,}$/i.test(seg) || /^[A-Za-z0-9_-]{20,}$/.test(seg) ? ':id' : seg))
    .join('/');

const appVersion = () => `${pkg.version} (${typeof __BUILD_COMMIT__ === 'string' ? __BUILD_COMMIT__ : 'dev'})`;

/** The body for an error, trimmed to fit 8 KB. */
export const reportOf = (error: unknown, extra = '', path = typeof location !== 'undefined' ? location.pathname : ''): ClientErrorReport => {
  const e = error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Non-error thrown');
  const r: ClientErrorReport = {
    message: scrub(`${e.name && e.name !== 'Error' ? `${e.name}: ` : ''}${e.message}`).slice(0, 500),
    stack: scrub([e.stack ?? '', extra].filter(Boolean).join('\n')).slice(0, 5000),
    route: routeShape(path),
    appVersion: appVersion(),
    ua: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 300) : '',
  };
  while (new TextEncoder().encode(JSON.stringify(r)).length > MAX_BYTES && r.stack.length > 0) r.stack = r.stack.slice(0, Math.floor(r.stack.length / 2));
  return r;
};

/** Errors that are noise, not failures: the browser's own resize warning, a deliberate stop. */
const IGNORED = /ResizeObserver loop|AbortError|The user aborted/i;

type Sender = (body: ClientErrorReport) => Promise<unknown>;
let sender: Sender | null = null;
/** main.tsx says how to send (api/client.ts), so this file stays free of the network layer. */
export const setErrorSender = (fn: Sender) => {
  sender = fn;
};

/** Send one report for this failure, unless it was sent already this launch. Never throws, never reports itself. */
export const reportError = (error: unknown, extra = ''): boolean => {
  try {
    const r = reportOf(error, extra);
    if (IGNORED.test(r.message)) return false;
    const key = `${r.message}|${r.stack.split('\n').slice(0, 2).join('|')}`;
    if (seen.has(key) || sent >= MAX_PER_LAUNCH || !sender) return false;
    seen.add(key);
    sent++;
    void sender(r).catch(() => undefined);
    return true;
  } catch {
    return false;
  }
};

/** window error and unhandled rejection listeners (main.tsx). */
export const startErrorReports = () => {
  window.addEventListener('error', (ev) => {
    // a resource that failed to load (an image) is not a script error
    if (!(ev instanceof ErrorEvent)) return;
    reportError(ev.error ?? new Error(ev.message || 'Script error'), ev.filename ? `at ${ev.filename}:${ev.lineno}:${ev.colno}` : '');
  });
  window.addEventListener('unhandledrejection', (ev) => reportError(ev.reason));
};

/** Tests only. */
export const resetErrorReports = () => {
  seen.clear();
  sent = 0;
};
