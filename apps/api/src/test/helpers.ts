import { openDatabase, type DB } from '../db/index.js';
import { env } from '../env.js';
import { buildApp } from '../index.js';
import { resetAiLimits } from '../services/aiLimits.js';
import { setClaudeClient } from '../services/claude.js';
import { writeConsent } from '../services/consent.js';

/**
 * Shared test kit: an app on an in-memory database, a signed-up account, and one recording fake for every Claude call
 * site (the assistant, the plan builder, the goal review, Remember when, the daily pick).
 */
export type App = ReturnType<typeof buildApp>;

export const makeApp = () => {
  const db = openDatabase(':memory:').db;
  env.allowSetup = true;
  env.allowSignup = true;
  resetAiLimits();
  return { db, app: buildApp(db) };
};

export interface Account {
  id: string;
  email: string;
  cookie: string;
  call: (method: string, url: string, body?: unknown, headers?: Record<string, string>) => Promise<{ status: number; body: any; headers: Headers }>;
}

/** Sign up a new account and get a `call` that carries its session. The account has answered no permission step. */
export const signUp = async (app: App, email: string, password = 'correct horse 42'): Promise<Account> => {
  const res = await app.request('/api/auth/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  if (res.status !== 201) throw new Error(`sign-up failed: ${res.status} ${await res.text()}`);
  const cookie = (res.headers.get('set-cookie') ?? '').split(';')[0]!;
  const id = ((await res.json()) as { id: string }).id;
  const call: Account['call'] = async (method, url, body, headers = {}) => {
    const r = await app.request(url, { method, headers: { 'content-type': 'application/json', cookie, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await r.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    return { status: r.status, body: parsed, headers: r.headers };
  };
  return { id, email, cookie, call };
};

/** Say yes to every AI switch, as the permission step and Settings, Privacy would. */
export const grantAll = (db: DB, userId: string) => writeConsent(db, userId, { training: true, recall: true, reads: true });

export interface ClaudeCall {
  /** Which SDK method was called. */
  api: 'beta.messages.stream' | 'messages.stream' | 'messages.create';
  params: Record<string, any>;
}

export interface FakeClaudeOptions {
  /** One assistant round per call; the last repeats. A round is the content blocks of that answer. */
  assistant?: Array<Array<Record<string, unknown>>>;
  plan?: unknown;
  goal?: unknown;
  recall?: string;
  pick?: unknown;
  /** Throw this from every call instead of answering. */
  fail?: unknown;
  /** Runs as each request arrives, before it is answered (to change something mid-answer). */
  onCall?: (index: number) => void;
}

const USAGE = { input_tokens: 120, output_tokens: 30, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };

/**
 * Put a recording fake in place of the Claude client. Every request any call site makes lands in `calls` with its full
 * body, and gets a plausible answer for its kind. `restore()` puts things back.
 */
export const fakeClaude = (o: FakeClaudeOptions = {}) => {
  const calls: ClaudeCall[] = [];
  const was = { configured: env.claudeConfigured, model: env.ANTHROPIC_MODEL, key: env.ANTHROPIC_API_KEY };
  let round = 0;
  const text = (v: unknown) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: typeof v === 'string' ? v : JSON.stringify(v) }], usage: USAGE });
  const fail = () => {
    if (o.fail) throw o.fail;
  };
  /** A request is kept as it was when it was sent (the assistant goes on adding to its own messages array). */
  const record = (api: ClaudeCall['api'], params: Record<string, any>) => {
    calls.push({ api, params: JSON.parse(JSON.stringify(params)) as Record<string, any> });
    o.onCall?.(calls.length - 1);
  };
  const plan = o.plan ?? { name: 'Test plan', summary: 'A short plan.', start: '2026-12-07', end: '2026-12-07', notes: [], sessions: [{ date: '2026-12-07', kind: 'run', type: 'Easy', title: 'Easy 4', details: '', miles: 4, minutes: null }] };
  const goal = o.goal ?? { goal: 'Run four times this week, each at least 30 minutes.', why: 'Added a count.', changed: true, steps: ['Put the runs on the calendar'] };
  const pick = o.pick ?? { url: 'https://example.org/essays/the-long-run', title: 'The long run', why: 'Close to what you saved.', tags: ['running'] };
  const client = {
    beta: {
      messages: {
        stream: (params: Record<string, any>) => {
          record('beta.messages.stream', params);
          return {
            finalMessage: async () => {
              fail();
              const rounds = o.assistant ?? [[{ type: 'text', text: 'Here you go.' }]];
              const content = rounds[Math.min(round++, rounds.length - 1)]!;
              return { stop_reason: content.some((b) => b.type === 'tool_use') ? 'tool_use' : 'end_turn', content, usage: USAGE };
            },
          };
        },
      },
    },
    messages: {
      stream: (params: Record<string, any>) => {
        record('messages.stream', params);
        const isPick = Array.isArray(params.tools) && params.tools.some((t: { name?: string }) => t.name === 'web_search');
        return {
          finalMessage: async () => {
            fail();
            return text(isPick ? pick : plan);
          },
        };
      },
      create: async (params: Record<string, any>) => {
        record('messages.create', params);
        fail();
        return text(params.output_config?.format ? goal : (o.recall ?? 'You wrote about it. Do not forget that.'));
      },
    },
  };
  setClaudeClient(client);
  env.claudeConfigured = true;
  env.ANTHROPIC_MODEL = 'test-model';
  return {
    calls,
    /** Everything sent so far, as one string to search. */
    sent: () => JSON.stringify(calls.map((c) => c.params)),
    /** The system text of a call, flattened. */
    systemOf: (c: ClaudeCall): string => (typeof c.params.system === 'string' ? c.params.system : Array.isArray(c.params.system) ? c.params.system.map((b: { text?: string }) => b.text ?? '').join('\n') : ''),
    restore: () => {
      setClaudeClient(null);
      env.claudeConfigured = was.configured;
      env.ANTHROPIC_MODEL = was.model;
      env.ANTHROPIC_API_KEY = was.key;
    },
  };
};
