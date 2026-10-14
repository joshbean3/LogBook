import { today, zTemplateRequest } from '@logbook/shared';
import { Hono } from 'hono';
import type { AuthEnv } from '../auth.js';
import type { DB } from '../db/index.js';
import { parseBody } from '../lib/util.js';
import { writeTemplate } from '../services/plans.js';
import { templateOr422 } from './me.js';

export const planRoutes = (db: DB) => {
  const r = new Hono<AuthEnv>();

  /**
   * Build a block from a template and write it: a plan block plus its sessions. With `replace: true`, future planned
   * (not done) sessions in the block's window go first. Answers like `POST /plans/apply`: `{ block, months }`, plus `removed`.
   */
  r.post('/plans/template', async (c) => {
    const userId = c.get('user').id;
    const { replace, ...input } = await parseBody(c.req.raw, zTemplateRequest);
    const template = templateOr422(input);
    const applied = db.transaction(() => writeTemplate(db, userId, template, { replace: !!replace, source: 'template', today: today() }));
    return c.json(applied, 201);
  });

  return r;
};
