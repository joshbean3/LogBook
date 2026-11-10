import { beforeEach, describe, expect, it } from 'vitest';
import { BODY_LIMIT, BODY_LIMITS } from '../index.js';
import { makeApp, signUp, type Account, type App } from '../test/helpers.js';

/** Every body is capped before it is read (finding sec-08): 256 KB, more only where a file or a batch travels. */
let app: App;
let me: Account;
const MB = 1024 * 1024;
const send = (path: string, bytes: number, headers: Record<string, string> = {}, declare = true) => {
  const body = `{"pad":"${'x'.repeat(Math.max(0, bytes - 10))}"}`;
  return app.request(path, { method: 'POST', headers: { 'content-type': 'application/json', cookie: me.cookie, ...(declare ? { 'content-length': String(body.length) } : {}), ...headers }, body });
};

beforeEach(async () => {
  ({ app } = makeApp());
  me = await signUp(app, 'limit@example.com');
});

describe('request body limits', () => {
  it('a 300 KB JSON body to an ordinary route answers 413 before parsing, signed in or not', async () => {
    for (const path of ['/api/auth/login', '/api/auth/signup', '/api/auth/forgot', '/api/journal', '/api/todos', '/api/plans/apply', '/api/goals/refine', '/api/reads']) {
      const res = await send(path, 300 * 1024);
      expect(res.status, path).toBe(413);
      expect(await res.json()).toEqual({ error: 'That is too big to send.', code: 'too_big' });
    }
    // a body with no declared length is cut off the same way
    expect((await send('/api/journal', 300 * 1024, {}, false)).status).toBe(413);
    // 200 KB gets through to the route (which then judges it on its merits)
    expect((await send('/api/journal', 200 * 1024)).status).toBe(422);
    expect(BODY_LIMIT).toBe(256 * 1024);
  });

  it('the routes that carry files and batches have their own limits', () => {
    expect(Object.fromEntries(BODY_LIMITS.map((l) => [l.path, l.bytes / MB]))).toEqual({ '/api/assistant': 28, '/api/plans/draft': 26, '/api/import': 20, '/api/apple-health/reconcile': 3, '/api/apple-health/sync': 2 });
  });

  it('each of them takes a body over 256 KB and refuses one over its own limit', async () => {
    for (const { path, bytes } of BODY_LIMITS) {
      const under = await send(path, 300 * 1024);
      expect(under.status, `${path} at 300 KB`).not.toBe(413);
      const over = await send(path, bytes + 4096);
      expect(over.status, `${path} over its limit`).toBe(413);
      expect(((await over.json()) as { code: string }).code).toBe('too_big');
    }
  }, 30_000);
});
