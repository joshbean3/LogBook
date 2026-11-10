import Anthropic from '@anthropic-ai/sdk';
import { mondayOf, shiftDays, today } from '@logbook/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DB } from '../db/index.js';
import { fakeClaude, grantAll, makeApp, signUp, type Account, type App } from '../test/helpers.js';

/** One mapping from the SDK's errors to what the app is told, for every caller (Contract 9). */
const T = today();
let app: App;
let db: DB;
let me: Account;
let claude: ReturnType<typeof fakeClaude> | null = null;
const apiError = (status: number, type: string) => Anthropic.APIError.generate(status, { type: 'error', error: { type, message: 'x' } }, 'x', new Headers());
const failWith = (e: unknown) => {
  claude?.restore();
  claude = fakeClaude({ fail: e });
};
const callers = () => [
  () => me.call('POST', '/api/assistant', { date: T, turns: [{ role: 'user', text: 'hello' }] }),
  () => me.call('POST', '/api/plans/draft', { mode: 'describe', start: T, instructions: 'A gentle 10K plan over eight weeks' }),
  () => me.call('POST', '/api/goals/refine', { level: 'week', period: mondayOf(T), text: 'run more' }),
];

beforeEach(async () => {
  ({ app, db } = makeApp());
  me = await signUp(app, 'errors@example.com');
  grantAll(db, me.id);
});
afterEach(() => claude?.restore());

describe('a failed Claude call', () => {
  it('rate limit or overload answers 503 claude_busy with the plain line and Retry-After, from every caller', async () => {
    for (const e of [apiError(429, 'rate_limit_error'), apiError(529, 'overloaded_error'), apiError(500, 'api_error'), new Anthropic.APIConnectionError({ message: 'socket hang up' })]) {
      failWith(e);
      for (const call of callers()) {
        const r = await call();
        expect(r.status).toBe(503);
        expect(r.body).toEqual({ error: 'The assistant is busy right now. Try again in a minute.', code: 'claude_busy' });
        expect(r.headers.get('retry-after')).toBe('60');
      }
    }
  });

  it('a timeout answers 504', async () => {
    failWith(new Anthropic.APIConnectionTimeoutError());
    for (const call of callers()) {
      const r = await call();
      expect(r.status).toBe(504);
      expect(r.body).toEqual({ error: 'The assistant took too long to answer. Try again.', code: 'claude_timeout' });
    }
  });

  it('a file Claude cannot read answers 422 "That file could not be read."', async () => {
    failWith(apiError(400, 'invalid_request_error'));
    const form = new FormData();
    form.set('mode', 'file');
    form.set('start', T);
    form.set('file', new Blob(['%PDF-1.4 damaged inside'], { type: 'application/pdf' }), 'plan.pdf');
    const draft = await app.request('/api/plans/draft', { method: 'POST', headers: { cookie: me.cookie }, body: form });
    expect(draft.status).toBe(422);
    expect(await draft.json()).toEqual({ error: 'I couldn’t read that file. Try a photo of the page, or a PDF without a password.', code: 'bad_file' });
    const ask = await me.call('POST', '/api/assistant', { date: T, turns: [{ role: 'user', text: 'Put this in', attachments: [{ name: 'plan.pdf', mediaType: 'application/pdf', data: 'JVBERi0=' }] }] });
    expect(ask.status).toBe(422);
    expect(ask.body).toEqual({ error: 'I couldn’t read that file. Try a photo of the page, or a PDF without a password.', code: 'bad_file' });
  });

  it('never leaks the SDK message, and a failed call gives its place back', async () => {
    failWith(new Error('ECONNRESET at internal/secret/path.ts'));
    const r = await me.call('POST', '/api/plans/draft', { mode: 'describe', start: T, instructions: 'A gentle 10K plan over eight weeks' });
    expect(r.status).toBe(500);
    expect(r.body).toEqual({ error: 'Something went wrong on the server.', code: 'internal' });
    // not stuck "still running": the next one is judged on its own
    failWith(null);
    expect((await me.call('POST', '/api/plans/draft', { mode: 'describe', start: T, instructions: 'A gentle 10K plan over eight weeks' })).status).toBe(200);
  });
});

describe('the plan builder’s date', () => {
  it('is the person’s own (X-Local-Date), not the server’s', async () => {
    claude = fakeClaude();
    const tomorrow = shiftDays(T, 1);
    const r = await me.call('POST', '/api/plans/draft', { mode: 'describe', start: tomorrow, instructions: 'A gentle 10K plan over eight weeks' }, { 'x-local-date': tomorrow });
    expect(r.status).toBe(200);
    const sent = claude.sent();
    expect(sent).toContain(`(${tomorrow})`);
    expect(sent).not.toContain(`(${T})`);
  });
});
