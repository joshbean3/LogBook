import { zAssistantAsk } from '@logbook/shared';
import { Hono } from 'hono';
import type { AuthEnv } from '../auth.js';
import type { DB } from '../db/index.js';
import { env } from '../env.js';
import { parseBody } from '../lib/util.js';
import { applyAction, ask, dismissAction, recentActions, undoAction } from '../services/assistant.js';

/**
 * The assistant on Today: ask (Claude answers, or proposes checked changes that are saved, not applied), then apply,
 * dismiss or undo a proposal. Every proposal stays in the log with what came of it.
 */
export const assistantRoutes = (db: DB) => {
  const r = new Hono<AuthEnv>();
  const uidOf = (c: { get: (k: 'user') => { id: string } }) => c.get('user').id;

  r.post('/assistant', async (c) => {
    const body = await parseBody(c.req.raw, zAssistantAsk);
    if (!env.claudeConfigured) return c.json({ text: 'The assistant needs a Claude key on the server (ANTHROPIC_API_KEY).', proposal: null, available: false });
    const out = await ask(db, uidOf(c), body.turns, body.date, c.get('today'));
    return c.json({ ...out, available: true });
  });
  r.post('/assistant/:id/apply', (c) => c.json(applyAction(db, uidOf(c), c.req.param('id'), c.get('today'))));
  r.post('/assistant/:id/undo', (c) => c.json(undoAction(db, uidOf(c), c.req.param('id'), c.get('today'))));
  r.post('/assistant/:id/dismiss', (c) => c.json(dismissAction(db, uidOf(c), c.req.param('id'))));
  r.get('/assistant/log', (c) => c.json(recentActions(db, uidOf(c))));
  return r;
};
