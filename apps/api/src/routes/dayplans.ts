import { cleanBands, cleanPlan, cleanSlots, emptyBands, zDayPlanPut, type DayBands, type DayPlan, type DaySlot } from '@logbook/shared';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { AuthEnv } from '../auth.js';
import type { DB } from '../db/index.js';
import { dayPlans } from '../db/schema.js';
import { ApiError, nowISO, parseBody, uid } from '../lib/util.js';

type DayPlanRow = typeof dayPlans.$inferSelect;

const dateOf = (d: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new ApiError(400, 'That isn’t a date.', 'bad_date');
  return d;
};

export const bandsOf = (raw: string | null | undefined): DayBands => {
  try {
    return cleanBands({ ...emptyBands(), ...(JSON.parse(raw ?? '{}') as Partial<DayBands>) });
  } catch {
    return emptyBands();
  }
};

/** The stored slots; a row from before the column (or a broken value) reads as none. */
export const slotsOf = (raw: string | null | undefined): DaySlot[] => {
  try {
    const v = JSON.parse(raw ?? '[]') as unknown;
    return Array.isArray(v) ? cleanSlots(v.filter((s): s is DaySlot => !!s && typeof s === 'object' && typeof (s as DaySlot).ref === 'string' && Number.isFinite((s as DaySlot).start) && Number.isFinite((s as DaySlot).minutes))) : [];
  } catch {
    return [];
  }
};

/** A row as the app reads it: the bands and the slots cleaned together, so no ref is in both. */
export const planOf = (date: string, row: Pick<DayPlanRow, 'bands' | 'slots' | 'updatedAt'> | null | undefined): DayPlan => {
  if (!row) return { date, bands: emptyBands(), slots: [], updatedAt: null };
  const { bands, slots } = cleanPlan({ bands: bandsOf(row.bands), slots: slotsOf(row.slots) });
  return { date, bands, slots, updatedAt: row.updatedAt };
};

/**
 * A day's plan (docs/today-v6.md §5): the timeline's slots and the bands. Read it; put the bands, the slots or both after
 * a gesture (what is left out is kept, and a ref placed in a slot leaves the bands); delete it to clear the day. A day
 * never planned reads empty.
 */
export const dayPlanRoutes = (db: DB) => {
  const r = new Hono<AuthEnv>();
  const rowOf = (userId: string, date: string) => db.select().from(dayPlans).where(and(eq(dayPlans.userId, userId), eq(dayPlans.date, date))).get();

  r.get('/day-plans/:date', (c) => {
    const date = dateOf(c.req.param('date'));
    return c.json<DayPlan>(planOf(date, rowOf(c.get('user').id, date)));
  });

  r.put('/day-plans/:date', async (c) => {
    const userId = c.get('user').id;
    const date = dateOf(c.req.param('date'));
    const body = await parseBody(c.req.raw, zDayPlanPut);
    const had = rowOf(userId, date);
    const { bands, slots } = cleanPlan({ bands: body.bands ?? (had ? bandsOf(had.bands) : emptyBands()), slots: body.slots ?? (had ? slotsOf(had.slots) : []) });
    const at = nowISO();
    const set = { bands: JSON.stringify(bands), slots: JSON.stringify(slots), updatedAt: at };
    if (had) db.update(dayPlans).set(set).where(eq(dayPlans.id, had.id)).run();
    else db.insert(dayPlans).values({ id: uid('dp'), userId, date, ...set }).run();
    return c.json<DayPlan>({ date, bands, slots, updatedAt: at });
  });

  r.delete('/day-plans/:date', (c) => {
    const userId = c.get('user').id;
    const date = dateOf(c.req.param('date'));
    db.delete(dayPlans).where(and(eq(dayPlans.userId, userId), eq(dayPlans.date, date))).run();
    return c.json<DayPlan>({ date, bands: emptyBands(), slots: [], updatedAt: null });
  });

  return r;
};
