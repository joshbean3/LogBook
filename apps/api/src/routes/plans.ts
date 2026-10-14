import { zTemplateRequest, zTemplateUndo, type EndedBlockRef } from '@logbook/shared';
import { Hono } from 'hono';
import type { AuthEnv } from '../auth.js';
import type { DB } from '../db/index.js';
import { parseBody } from '../lib/util.js';
import { undoTemplate, writeTemplate } from '../services/plans.js';
import { templateOr422 } from './me.js';

export const planRoutes = (db: DB) => {
  const r = new Hono<AuthEnv>();

  /**
   * Build a block from a template and write it: a plan block plus its sessions. With `replace: true`, future planned
   * (not done) sessions in the block's window are soft-deleted first and an overlapping block is ended the day before (or
   * deleted if it had not started). Answers `{ block, months, removed, replacedIds, endedBlock?, endedBlocks }` (201);
   * keep it for `POST /plans/template/undo`.
   */
  r.post('/plans/template', async (c) => {
    const userId = c.get('user').id;
    const { replace, ...input } = await parseBody(c.req.raw, zTemplateRequest);
    const template = templateOr422(input);
    const applied = db.transaction(() => writeTemplate(db, userId, template, { replace: !!replace, source: 'template', today: c.get('today') }));
    return c.json(applied, 201);
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
    const out = db.transaction(() => undoTemplate(db, userId, { blockId: body.blockId, replacedIds: body.replacedIds, endedBlocks: ended }));
    return c.json(out);
  });

  return r;
};
