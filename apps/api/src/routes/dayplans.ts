import { cleanBands, emptyBands, zDayPlanPut, type DayBands, type DayPlan } from '@logbook/shared';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { AuthEnv } from '../auth.js';
import type { DB } from '../db/index.js';
import { dayPlans } from '../db/schema.js';
import { ApiError, nowISO, parseBody, uid } from '../lib/util.js';

const dateOf = (d: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new ApiError(400, 'That isn’t a date.', 'bad_date');
  return d;
};

const bandsOf = (raw: string): DayBands => {
  try {
    return cleanBands({ ...emptyBands(), ...(JSON.parse(raw) as Partial<DayBands>) });
  } catch {
    return emptyBands();
  }
};

/** A day's plan (morning, afternoon, evening): read it, or put the whole of it after a drag. A day never planned reads empty. */
export const dayPlanRoutes = (db: DB) => {
  const r = new Hono<AuthEnv>();
  const rowOf = (userId: string, date: string) => db.select().from(dayPlans).where(and(eq(dayPlans.userId, userId), eq(dayPlans.date, date))).get();

  r.get('/day-plans/:date', (c) => {
    const date = dateOf(c.req.param('date'));
    const row = rowOf(c.get('user').id, date);
    return c.json<DayPlan>({ date, bands: row ? bandsOf(row.bands) : emptyBands(), updatedAt: row?.updatedAt ?? null });
  });

  r.put('/day-plans/:date', async (c) => {
    const userId = c.get('user').id;
    const date = dateOf(c.req.param('date'));
    const bands = cleanBands((await parseBody(c.req.raw, zDayPlanPut)).bands);
    const at = nowISO();
    const json = JSON.stringify(bands);
    const had = rowOf(userId, date);
    if (had) db.update(dayPlans).set({ bands: json, updatedAt: at }).where(eq(dayPlans.id, had.id)).run();
    else db.insert(dayPlans).values({ id: uid('dp'), userId, date, bands: json, updatedAt: at }).run();
    return c.json<DayPlan>({ date, bands, updatedAt: at });
  });

  return r;
};
