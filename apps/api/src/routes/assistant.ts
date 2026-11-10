import { zAssistantApply, zAssistantAsk } from '@logbook/shared';
import { Hono } from 'hono';
import type { AuthEnv } from '../auth.js';
import type { DB } from '../db/index.js';
import { ApiError, parseBody } from '../lib/util.js';
import { beginAi } from '../services/aiLimits.js';
import { applyAction, ask, dismissAction, recentActions, undoAction } from '../services/assistant.js';
import { cancelJob, jobState, runningJobOf, startJob, type JobContext } from '../services/assistantJobs.js';
import { claudeClient } from '../services/claude.js';
import { requireAiPermission } from '../services/consent.js';

/**
 * The assistant on Today: ask (Claude answers, or proposes checked changes that are saved, not applied), then apply,
 * dismiss or undo a proposal. Every proposal stays in the log with what came of it.
 */
export const assistantRoutes = (db: DB) => {
  const r = new Hono<AuthEnv>();
  const uidOf = (c: { get: (k: 'user') => { id: string } }) => c.get('user').id;

  /**
   * Ask. With `?async=1` the ask runs in the background and this answers `202 { jobId }` at once; the app then reads
   * `GET /assistant/jobs/:id` until it is done (assistantJobs.ts says why). Without it, the answer comes in this response.
   */
  r.post('/assistant', async (c) => {
    const body = await parseBody(c.req.raw, zAssistantAsk);
    // 503 `claude_not_configured` with a plain message when the server has no key
    claudeClient();
    const userId = uidOf(c);
    // 403 `consent_required` until the person has answered the permission step: nothing typed or attached is sent before
    requireAiPermission(db, userId, 'assistant');
    const today = c.get('today');
    const wantsJob = c.req.query('async') === '1';
    // one answer at a time: a second ask while one runs gets that job's id back with the 429, so the app can pick it up
    const runningId = wantsJob ? runningJobOf(userId) : null;
    if (runningId) {
      c.header('Retry-After', '5');
      return c.json({ error: 'The assistant is still answering your last message.', code: 'rate_limited', jobId: runningId }, 429);
    }
    // the short window, the day's budget and the cap on answers running at once (429 `rate_limited` or 503 `claude_busy`)
    const release = beginAi(userId, 'assistant');
    const run = async (ctx?: JobContext) => {
      try {
        return { ...(await ask(db, userId, body.turns, body.date, today, body.screen, ctx ?? {})), available: true as const };
      } finally {
        release();
      }
    };
    if (wantsJob) return c.json({ jobId: startJob(userId, run) }, 202);
    return c.json(await run());
  });
  r.get('/assistant/jobs/:id', (c) => {
    const state = jobState(uidOf(c), c.req.param('id'));
    if (!state) return c.json({ error: 'That answer is no longer here (the server may have restarted). Send it again.', code: 'job_gone' }, 404);
    return c.json(state);
  });
  /** Stop an answer partway (the Stop button): its request to Claude is aborted; the job then reads as stopped. */
  r.delete('/assistant/jobs/:id', (c) => c.json({ stopped: cancelJob(uidOf(c), c.req.param('id')) }));
  /** Apply. An optional body `{ skip: [indexes] }` leaves out the changes the owner removed; no body applies them all. */
  r.post('/assistant/:id/apply', async (c) => {
    const raw = await c.req.text();
    let json: unknown = {};
    if (raw.trim()) {
      try {
        json = JSON.parse(raw);
      } catch {
        throw new ApiError(400, 'Body must be JSON');
      }
    }
    const body = zAssistantApply.safeParse(json);
    if (!body.success) throw new ApiError(422, body.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; '), 'validation');
    return c.json(applyAction(db, uidOf(c), c.req.param('id'), c.get('today'), body.data.skip));
  });
  r.post('/assistant/:id/undo', (c) => c.json(undoAction(db, uidOf(c), c.req.param('id'), c.get('today'))));
  r.post('/assistant/:id/dismiss', (c) => c.json(dismissAction(db, uidOf(c), c.req.param('id'))));
  r.get('/assistant/log', (c) => c.json(recentActions(db, uidOf(c))));
  return r;
};
