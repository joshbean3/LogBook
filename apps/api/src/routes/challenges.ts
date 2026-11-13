import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthEnv } from '../auth.js';
import type { DB } from '../db/index.js';
import { ApiError, parseBody } from '../lib/util.js';
import { withAiLimit } from '../services/aiLimits.js';
import { ownSlot, pickChallenge, pickContext, pickMenu, readPickRecord, rulePick } from '../services/challengePick.js';
import { claudeClient } from '../services/claude.js';
import { requireAiPermission } from '../services/consent.js';

/** The slot's key and nothing else: the phone sends no facts and no numbers. Anything more in the body is refused. */
export const zChallengePick = z.strictObject({ slot: z.string().regex(/^challenge:[dw]:\d{4}-\d{2}-\d{2}$/) });
export const PICK_NEEDS_TRAINING = 'Turn on ‘Let the assistant read my training data’ in Settings, Privacy, to have the assistant pick.';

export const challengeRoutes = (db: DB) => {
  const r = new Hono<AuthEnv>();

  /**
   * "Ask the assistant to pick": `{ slot }` in, `{ item, target, floor?, why?, by }` out. `by: 'assistant'` carries the
   * one-line reason; `by: 'rule'` is the rule's own pick with no reason (the menu held one item, the call failed, or the
   * answer did not pass the checks), so the person has a challenge either way.
   *
   * The gates, in order, each before anything is read or sent: 503 `claude_not_configured` without a key; 403
   * `consent_required` for an account that never answered the permission step; 403 `training_off` unless its training
   * switch is on (to-dos, goals and sessions are what that switch covers); 422 for a body that is not exactly `{ slot }`;
   * 404 `no_challenge` for a slot that is not this account's this week, or that has nothing to offer now (a paused day,
   * challenges off, another day's slot); 429 `rate_limited`. The limit is taken only when a request is about to be sent.
   */
  r.post('/challenges/pick', async (c) => {
    const user = c.get('user');
    claudeClient();
    const consent = requireAiPermission(db, user.id, 'challenge');
    if (consent.training !== true) throw new ApiError(403, PICK_NEEDS_TRAINING, 'training_off');
    const body = await parseBody(c.req.raw, zChallengePick);
    const today = c.get('today');
    const slot = ownSlot(user.id, body.slot, today);
    if (!slot) throw new ApiError(404, 'There is no challenge to pick for.', 'no_challenge');
    const record = readPickRecord(db, user.id, today, user.onboardedAt);
    const menu = pickMenu(record, slot);
    if (!menu.length) throw new ApiError(404, 'There is no challenge to pick for.', 'no_challenge');
    // one item is no choice: nothing is sent
    if (menu.length === 1) return c.json(rulePick(slot, menu));
    const answer = await withAiLimit(user.id, 'challenge', () => pickChallenge(user.id, { slot, menu, context: pickContext(record), today }));
    return c.json(answer);
  });

  return r;
};
