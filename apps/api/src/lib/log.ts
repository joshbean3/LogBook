import { AsyncLocalStorage } from 'node:async_hooks';
import { env } from '../env.js';

/**
 * The structured logger: one JSON object per line on stdout (`{"level","time","msg",...fields}`), or a short
 * human line when LOG_FORMAT=pretty (the default outside production). A request's id and user id ride along on every
 * line written while that request is being served (`withLogContext`, set by the request middleware), so one
 * `grep requestId` finds everything a request did. Fields that are Errors are written as name, message and stack.
 */
export type Level = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
export type Fields = Record<string, unknown>;

export interface LogContext {
  requestId?: string;
  userId?: string;
  [k: string]: unknown;
}
const als = new AsyncLocalStorage<LogContext>();
/** Run `fn` with `ctx` on every log line it writes (sync or async). The object is live: set `userId` on it later. */
export const withLogContext = <T>(ctx: LogContext, fn: () => T): T => als.run(ctx, fn);
export const logContext = (): LogContext | undefined => als.getStore();

let minLevel = ORDER[env.logLevel];
export const setLogLevel = (l: Level) => {
  minLevel = ORDER[l];
};

let sink: (line: string) => void = (line) => {
  process.stdout.write(line + '\n');
};
/** Tests: capture lines instead of writing them. Returns the previous sink. */
export const setLogSink = (s: (line: string) => void) => {
  const prev = sink;
  sink = s;
  return prev;
};

export const serializeError = (e: unknown): Record<string, unknown> | unknown => {
  if (!(e instanceof Error)) return e;
  const out: Record<string, unknown> = { name: e.name, message: e.message };
  const code = (e as { code?: unknown }).code;
  if (code !== undefined) out.code = code;
  const status = (e as { status?: unknown }).status;
  if (status !== undefined) out.status = status;
  if (e.stack) out.stack = e.stack;
  if (e.cause !== undefined) out.cause = serializeError(e.cause);
  return out;
};

const clean = (fields: Fields): Fields => {
  const out: Fields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    out[k] = v instanceof Error ? serializeError(v) : v;
  }
  return out;
};

const pretty = (rec: Record<string, unknown>): string => {
  const { level, time, msg, ...rest } = rec;
  const t = String(time).slice(11, 23);
  const parts: string[] = [];
  let stack: string | undefined;
  for (const [k, v] of Object.entries(rest)) {
    if (v && typeof v === 'object' && 'stack' in (v as object) && typeof (v as { stack?: unknown }).stack === 'string') {
      stack = (v as { stack: string }).stack;
      continue;
    }
    parts.push(`${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`);
  }
  return `${t} ${String(level).toUpperCase().padEnd(5)} ${String(msg)}${parts.length ? ' ' + parts.join(' ') : ''}${stack ? '\n' + stack : ''}`;
};

const emit = (level: Level, msg: string, fields: Fields, bound: Fields) => {
  if (ORDER[level] < minLevel) return;
  const ctx = als.getStore();
  const rec: Record<string, unknown> = { level, time: new Date().toISOString(), msg };
  if (ctx?.requestId) rec.requestId = ctx.requestId;
  if (ctx?.userId) rec.userId = ctx.userId;
  Object.assign(rec, bound, clean(fields));
  try {
    sink(env.logFormat === 'pretty' ? pretty(rec) : JSON.stringify(rec));
  } catch {
    // a field that cannot be serialized (a cycle) must not take the process down
    sink(JSON.stringify({ level, time: rec.time, msg, logError: 'unserializable fields' }));
  }
};

export interface Logger {
  debug: (msg: string, fields?: Fields) => void;
  info: (msg: string, fields?: Fields) => void;
  warn: (msg: string, fields?: Fields) => void;
  error: (msg: string, fields?: Fields) => void;
  /** A logger that writes `fields` on every line. */
  child: (fields: Fields) => Logger;
}

const make = (bound: Fields): Logger => ({
  debug: (msg, fields = {}) => emit('debug', msg, fields, bound),
  info: (msg, fields = {}) => emit('info', msg, fields, bound),
  warn: (msg, fields = {}) => emit('warn', msg, fields, bound),
  error: (msg, fields = {}) => emit('error', msg, fields, bound),
  child: (fields) => make({ ...bound, ...clean(fields) }),
});

export const log: Logger = make({});
