import { TEMPLATE_ASSISTED_SOURCE, TEMPLATE_SOURCE, zPlanAssistRequest, zTemplateRequest, zTemplateUndo, type EndedBlockRef, type PlanAssistResult } from '@logbook/shared';
import { Hono } from 'hono';
import type { AuthEnv } from '../auth.js';
import type { DB } from '../db/index.js';
import { parseBody } from '../lib/util.js';
import { withAiLimit } from '../services/aiLimits.js';
import { claudeClient } from '../services/claude.js';
import { requireAiPermission } from '../services/consent.js';
import { shapePlan } from '../services/planAssist.js';
import { undoTemplate, writeTemplate } from '../services/plans.js';
import { templateOr422 } from './me.js';

export const planRoutes = (db: DB) => {
  const r = new Hono<AuthEnv>();

  /**
   * Build a block from a template and write it: a plan block plus its sessions. With `replace: true`, future planned
   * (not done) sessions in the block's window are soft-deleted first and an overlapping block is ended the day before (or
   * deleted if it had not started). Answers `{ block, months, removed, replacedIds, endedBlock?, endedBlocks }` (201);
   * keep it for `POST /plans/template/undo`. With `assisted: true` (the assistant shaped the builder's answers), the
   * block's `source` is `template-assisted` instead of `template`.
   */
  r.post('/plans/template', async (c) => {
    const userId = c.get('user').id;
    const { replace, assisted, ...input } = await parseBody(c.req.raw, zTemplateRequest);
    const template = templateOr422(input);
    const applied = db.transaction(() => writeTemplate(db, userId, template, { replace: !!replace, source: assisted ? TEMPLATE_ASSISTED_SOURCE : TEMPLATE_SOURCE, today: c.get('today') }));
    return c.json(applied, 201);
  });

  /**
   * The builder's assistant: `{ kind: 'shape', words, settings? }` in, `{ kind, patch, dropped, cannot, note }` out. The
   * person's words become a change to the builder's settings (`patch`, applied by the app with `applyPlanPatch`); nothing
   * is written. `dropped` lists values changed to fit the builder's limits or left out, each with a reason; `cannot` the
   * kinds of things asked for that the builder has no setting for. `kind` is a closed list a later mode joins.
   *
   * 503 `claude_not_configured` without a key; 403 `consent_required` until the person has answered the permission step
   * (their words are theirs to send only after a yes or a no); 429 `rate_limited`; 422 `refused`; 502 `invalid_answer`.
   * With the training switch off the settings are not passed on: only the words go.
   */
  r.post('/plans/template/assist', async (c) => {
    const userId = c.get('user').id;
    claudeClient();
    const consent = requireAiPermission(db, userId, 'shape');
    const body = await parseBody(c.req.raw, zPlanAssistRequest);
    const settings = consent.training ? (body.settings ?? null) : null;
    const out = await withAiLimit(userId, 'shape', () => shapePlan(userId, { words: body.words, settings, today: c.get('today'), signal: c.req.raw.signal }));
    const answer: PlanAssistResult = { kind: body.kind, ...out };
    return c.json(answer);
  });

  /**
   * Undo a template write: `{ blockId, replacedIds, endedBlock? }` (or `endedBlocks`) exactly as `POST /plans/template`
   * answered. The new block and its sessions go, the replaced sessions come back, ended blocks get their old end (or come
   * back from deleted). Answers `{ ok, removed, restored, blocks, months }`: refetch `months` and the bootstrap.
   */
  r.post('/plans/template/undo', async (c) => {
    const userId = c.get('user').id;
    const body = await parseBody(c.req.raw, zTemplateUndo);
    const ended: EndedBlockRef[] = [...(body.endedBlocks ?? [])];
    if (body.endedBlock && !ended.some((e) => e.id === body.endedBlock!.id)) ended.unshift(body.endedBlock);
    const out = db.transaction(() => undoTemplate(db, userId, { blockId: body.blockId, replacedIds: body.replacedIds, endedBlocks: ended, addedIds: body.addedIds }));
    return c.json(out);
  });

  return r;
};
