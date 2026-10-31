import { zAssistantAsk, type AssistantReply } from '@logbook/shared';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { AuthEnv } from '../auth.js';
import type { DB } from '../db/index.js';
import { env } from '../env.js';
import { rateLimit } from '../lib/ratelimit.js';
import { parseBody } from '../lib/util.js';
import { applyAction, ask, dismissAction, liveThread, newThread, recentActions, threadView, undoAction } from '../services/assistant.js';

/** 30 asks an hour per account. */
export const ASSISTANT_LIMIT = { limit: 30, windowMs: 3600_000 };

/**
 * The assistant (docs/system.md §7): one live thread per account on the server. `POST /assistant` asks (streamed as
 * SSE when the client accepts `text/event-stream`: `text` deltas, then one `done` with the reply); then apply, dismiss
 * or undo a proposal. `GET /assistant/thread` is the conversation; `POST /assistant/new` starts another.
 */
export const assistantRoutes = (db: DB) => {
  const r = new Hono<AuthEnv>();
  const uidOf = (c: { get: (k: 'user') => { id: string } }) => c.get('user').id;

  r.get('/assistant/thread', (c) => c.json(threadView(db, uidOf(c), liveThread(db, uidOf(c)))));
  r.post('/assistant/new', (c) => c.json(threadView(db, uidOf(c), newThread(db, uidOf(c)))));

  r.post('/assistant', rateLimit('assistant', ASSISTANT_LIMIT.limit, ASSISTANT_LIMIT.windowMs, 'The assistant takes 30 asks an hour.'), async (c) => {
    const body = await parseBody(c.req.raw, zAssistantAsk);
    const text = body.text ?? [...(body.turns ?? [])].reverse().find((t) => t.role === 'user')?.text ?? '';
    const userId = uidOf(c);
    const wantsStream = /text\/event-stream/.test(c.req.header('accept') ?? '');
    if (!env.claudeConfigured) {
      const off: AssistantReply = { text: 'The assistant needs a Claude key on the server (ANTHROPIC_API_KEY).', proposal: null, available: false };
      return c.json(off);
    }
    const input = { text, date: body.date, today: c.get('today'), context: body.context };
    if (!wantsStream) {
      const out = await ask(db, userId, input);
      return c.json({ ...out, available: true } satisfies AssistantReply);
    }
    return streamSSE(c, async (stream) => {
      try {
        const out = await ask(db, userId, input, { onText: (delta) => void stream.writeSSE({ event: 'text', data: JSON.stringify(delta) }) });
        await stream.writeSSE({ event: 'done', data: JSON.stringify({ ...out, available: true } satisfies AssistantReply) });
      } catch (e) {
        await stream.writeSSE({ event: 'error', data: JSON.stringify({ error: e instanceof Error ? e.message : 'The assistant hit a problem.' }) });
      }
    });
  });

  r.post('/assistant/:id/apply', (c) => c.json(applyAction(db, uidOf(c), c.req.param('id'), c.get('today'))));
  r.post('/assistant/:id/undo', (c) => c.json(undoAction(db, uidOf(c), c.req.param('id'), c.get('today'))));
  r.post('/assistant/:id/dismiss', (c) => c.json(dismissAction(db, uidOf(c), c.req.param('id'))));
  r.get('/assistant/log', (c) => c.json(recentActions(db, uidOf(c))));
  return r;
};
