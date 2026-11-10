import { mondayOf, shiftDays, today } from '@logbook/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../db/index.js';
import { env } from '../env.js';
import { ApiError } from '../lib/util.js';
import { fakeClaude, grantAll, makeApp, signUp, type Account, type App } from '../test/helpers.js';
import { AI_LIMITS, AI_MAX_RUNNING, beginAi, logUser, resetAiLimits, setUsageSink } from './aiLimits.js';
import { CLAUDE_TIMEOUT_MS, setClaudeClient } from './claude.js';

const T = today();
const caught = (fn: () => unknown): ApiError => {
  try {
    fn();
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('did not throw');
};

describe('beginAi', () => {
  beforeEach(() => resetAiLimits());

  it('lets one call run at a time per user and flow, and frees the place when it ends', () => {
    const release = beginAi('u1', 'assistant');
    const e = caught(() => beginAi('u1', 'assistant'));
    expect(e).toMatchObject({ status: 429, code: 'rate_limited' });
    expect(e.headers?.['Retry-After']).toBe('5');
    // another flow, and another person, are not held up
    beginAi('u1', 'goal')();
    beginAi('u2', 'assistant')();
    release();
    release(); // releasing twice frees nothing extra
    beginAi('u1', 'assistant')();
  });

  it('allows 5 plan drafts in 10 minutes, then says when to come back', () => {
    const t0 = Date.parse('2026-11-10T12:00:00Z');
    for (let i = 0; i < 5; i++) beginAi('u1', 'plan', t0 + i * 1000)();
    const e = caught(() => beginAi('u1', 'plan', t0 + 60_000));
    expect(e).toMatchObject({ status: 429, code: 'rate_limited', message: 'That is a lot in a short time. Try again in a few minutes.' });
    expect(Number(e.headers?.['Retry-After'])).toBe(9 * 60);
    // the window slides
    beginAi('u1', 'plan', t0 + 10 * 60_000 + 1)();
  });

  it('holds each flow to its own daily budget per user, and starts again the next day', () => {
    const t0 = Date.parse('2026-11-10T00:00:10Z');
    for (const flow of ['assistant', 'plan', 'goal'] as const) {
      const lim = AI_LIMITS[flow];
      // spaced so the short window never trips
      const step = lim.windowMs / lim.window + 1;
      for (let i = 0; i < lim.perDay; i++) beginAi('u1', flow, t0 + i * step)();
      const at = t0 + lim.perDay * step;
      const e = caught(() => beginAi('u1', flow, at));
      expect(e).toMatchObject({ status: 429, code: 'rate_limited' });
      expect(e.message).toMatch(/^You have used today's .+\. They come back tomorrow\.$/);
      expect(Number(e.headers?.['Retry-After'])).toBeGreaterThan(60);
      // someone else still has theirs
      beginAi('u2', flow, at)();
      beginAi('u1', flow, Date.parse('2026-11-11T00:00:01Z'))();
    }
    expect(AI_LIMITS.plan).toMatchObject({ window: 5, windowMs: 600_000 });
  });

  it('caps the calls running at once across every user with 503 claude_busy', () => {
    const releases = Array.from({ length: AI_MAX_RUNNING }, (_, i) => beginAi(`u${i}`, 'assistant'));
    const e = caught(() => beginAi('late', 'assistant'));
    expect(e).toMatchObject({ status: 503, code: 'claude_busy', message: 'The assistant is busy. Try again in a minute.' });
    expect(e.headers?.['Retry-After']).toBe('60');
    releases[0]!();
    beginAi('late', 'assistant')();
    releases.forEach((r) => r());
  });
});

describe('the limits on the routes', () => {
  let app: App;
  let db: DB;
  let me: Account;
  let claude: ReturnType<typeof fakeClaude>;
  beforeEach(async () => {
    ({ app, db } = makeApp());
    me = await signUp(app, 'limits@example.com');
    grantAll(db, me.id);
    claude = fakeClaude();
  });
  afterEach(() => {
    claude.restore();
    setUsageSink(null);
  });

  it('a second ask while one runs gets 429 with the running job id; when it ends the next one goes through', async () => {
    let finish!: () => void;
    const gate = new Promise<void>((r) => (finish = r));
    setClaudeClient({
      beta: {
        messages: {
          stream: () => ({
            finalMessage: async () => {
              await gate;
              return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Done.' }], usage: { input_tokens: 1, output_tokens: 1 } };
            },
          }),
        },
      },
    });
    const body = { date: T, turns: [{ role: 'user', text: 'Plan my month' }] };
    const first = await me.call('POST', '/api/assistant?async=1', body);
    expect(first.status).toBe(202);
    const second = await me.call('POST', '/api/assistant?async=1', body);
    expect(second.status).toBe(429);
    expect(second.body).toEqual({ error: 'The assistant is still answering your last message.', code: 'rate_limited', jobId: first.body.jobId });
    expect(second.headers.get('retry-after')).toBe('5');
    // without ?async the same rule holds
    const third = await me.call('POST', '/api/assistant', body);
    expect(third.status).toBe(429);
    expect(third.body.code).toBe('rate_limited');
    finish();
    for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 10));
    expect((await me.call('GET', `/api/assistant/jobs/${first.body.jobId}`)).body.status).toBe('done');
    expect((await me.call('POST', '/api/assistant?async=1', body)).status).toBe(202);
  });

  it('a stopped answer frees its place', async () => {
    setClaudeClient({
      beta: {
        messages: {
          stream: (_: unknown, opts?: { signal?: AbortSignal }) => ({
            finalMessage: () => new Promise((_res, rej) => opts?.signal?.addEventListener('abort', () => rej(new Error('aborted')))),
          }),
        },
      },
    });
    const body = { date: T, turns: [{ role: 'user', text: 'Plan my month' }] };
    const first = await me.call('POST', '/api/assistant?async=1', body);
    expect((await me.call('DELETE', `/api/assistant/jobs/${first.body.jobId}`)).body).toEqual({ stopped: true });
    await new Promise((r) => setTimeout(r, 20));
    expect((await me.call('POST', '/api/assistant?async=1', body)).status).toBe(202);
  });

  it('/plans/draft allows 5 drafts in 10 minutes, then answers 429 with a plain message and Retry-After', async () => {
    const draft = () => me.call('POST', '/api/plans/draft', { mode: 'describe', start: T, instructions: 'A gentle 10K plan over eight weeks' });
    for (let i = 0; i < 5; i++) expect((await draft()).status).toBe(200);
    const sixth = await draft();
    expect(sixth.status).toBe(429);
    expect(sixth.body).toEqual({ error: 'That is a lot in a short time. Try again in a few minutes.', code: 'rate_limited' });
    expect(Number(sixth.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(claude.calls).toHaveLength(5);
    // a request that fails validation spends nothing
    resetAiLimits();
    for (let i = 0; i < 8; i++) expect((await me.call('POST', '/api/plans/draft', { mode: 'describe', start: T, instructions: 'x' })).status).toBe(422);
    expect((await draft()).status).toBe(200);
  });

  it('/goals/refine and /assistant have their own per-user limits', async () => {
    const refine = () => me.call('POST', '/api/goals/refine', { level: 'week', period: mondayOf(T), text: 'run more' });
    for (let i = 0; i < AI_LIMITS.goal.window; i++) expect((await refine()).status).toBe(200);
    const over = await refine();
    expect(over.status).toBe(429);
    expect(over.body.code).toBe('rate_limited');
    // the goal limit says nothing about the assistant or the plan builder
    const ask = () => me.call('POST', '/api/assistant', { date: T, turns: [{ role: 'user', text: 'hello' }] });
    for (let i = 0; i < AI_LIMITS.assistant.window; i++) expect((await ask()).status).toBe(200);
    expect((await ask()).status).toBe(429);
    expect((await me.call('POST', '/api/plans/draft', { mode: 'describe', start: shiftDays(T, 1), instructions: 'A gentle 10K plan over eight weeks' })).status).toBe(200);
    // and nothing about another person
    const other = await signUp(app, 'other@example.com');
    grantAll(db, other.id);
    expect((await other.call('POST', '/api/goals/refine', { level: 'week', period: mondayOf(T), text: 'run more' })).status).toBe(200);
  });

  it('logs token use per user for every flow, with a hashed user and no prompt text', async () => {
    const lines: string[] = [];
    setUsageSink((l) => lines.push(l));
    await me.call('POST', '/api/assistant', { date: T, turns: [{ role: 'user', text: 'a private question' }] });
    await me.call('POST', '/api/plans/draft', { mode: 'describe', start: T, instructions: 'A gentle 10K plan over eight weeks' });
    await me.call('POST', '/api/goals/refine', { level: 'week', period: mondayOf(T), text: 'run more' });
    const parsed = lines.map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(parsed.map((p) => p.flow)).toEqual(['assistant', 'plan', 'goal']);
    for (const p of parsed) expect(p).toMatchObject({ evt: 'ai_usage', user: logUser(me.id), in: 120, out: 30 });
    const all = lines.join('\n');
    expect(all).not.toContain(me.id);
    expect(all).not.toContain('limits@example.com');
    expect(all).not.toContain('private question');
  });

  it('the Claude client waits at most 120 seconds', () => {
    expect(CLAUDE_TIMEOUT_MS).toBe(120_000);
    expect(env.claudeConfigured).toBe(true);
  });
});
