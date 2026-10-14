import { buildTemplate, mondayOf, normalizeMorningSettings, shiftDays, TemplateError, today as serverToday, weekdayOf, zDeleteAccount, zOnboarding, zTemplateInput, type ISODate, type TemplateInput } from '@logbook/shared';
import { and, asc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { deleteCookie } from 'hono/cookie';
import { COOKIE, verifyPassword, type AuthEnv } from '../auth.js';
import type { DB } from '../db/index.js';
import { habits, planBlocks, users } from '../db/schema.js';
import { toHabit } from '../lib/map.js';
import { ApiError, nowISO, parseBody, uid } from '../lib/util.js';
import { deleteAccount } from '../services/account.js';
import { retireBlock, writeTemplate } from '../services/plans.js';
import { checkThrottle, clearThrottle, failThrottle, ipOf } from './auth.js';
import { deepMerge, readSetting, writeSetting } from './core.js';

/** The block source that marks the plan onboarding wrote, so a second call replaces it instead of adding another. */
export const ONBOARDING_SOURCE = 'onboarding';

/** The Monday after `d` (a week later when `d` is itself a Monday). */
export const nextMonday = (d: ISODate): ISODate => (weekdayOf(d) === 'mon' ? shiftDays(d, 7) : shiftDays(mondayOf(d), 7));

/** Build a template or answer 422 with the reason. */
export const templateOr422 = (input: TemplateInput) => {
  const ok = zTemplateInput.safeParse(input);
  if (!ok.success) throw new ApiError(422, ok.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; '), 'validation');
  try {
    return buildTemplate(ok.data);
  } catch (e) {
    if (e instanceof TemplateError) throw new ApiError(422, e.message, 'bad_template');
    throw e;
  }
};

export const meRoutes = (db: DB) => {
  const r = new Hono<AuthEnv>();

  const meOf = (id: string) => {
    const u = db.select({ id: users.id, email: users.email, onboardedAt: users.onboardedAt }).from(users).where(eq(users.id, id)).get();
    if (!u) throw new ApiError(404, 'Account not found');
    return u;
  };

  r.get('/me', (c) => c.json(meOf(c.get('user').id)));

  /**
   * First run, in one call: morning settings, starter habits, a training block, and `onboardedAt`.
   * Idempotent: habits are matched by name (case-insensitive) and never duplicated; the block written by an earlier
   * call is retired (its future planned sessions removed) before the new one is written; `onboardedAt` keeps its first value.
   */
  r.post('/me/onboarding', async (c) => {
    const userId = c.get('user').id;
    const body = await parseBody(c.req.raw, zOnboarding);
    const today = body.today ?? serverToday();
    const startDate = body.start === 'tomorrow' ? shiftDays(today, 1) : nextMonday(today);
    const template = templateOr422({ goal: body.goal, startDate, runDays: body.runDays, longRunDay: body.longRunDay, weeklyMiles: body.weeklyMiles, raceDate: body.raceDate ?? null });

    // wake is the alarm; leave is the end of the timeline, so the shower is set to leave minus everything after it
    const current = readSetting<Record<string, unknown>>(db, userId, 'morning') ?? {};
    const A = normalizeMorningSettings(current).after;
    const afterShower = A.shower + A.ready + (A.smoothie || 0) + A.prep;
    const showerAt = Math.max(body.wake, body.leave - afterShower);
    const morning = normalizeMorningSettings(deepMerge(current, { wake: body.wake, ...(body.pace ? { run: { pace: body.pace } } : {}), after: { showerMode: 'fixed', showerAt } }));

    const result = db.transaction(() => {
      writeSetting(db, userId, 'morning', morning);

      const have = db.select().from(habits).where(eq(habits.userId, userId)).all();
      const live = new Set(have.filter((h) => !h.archivedOn).map((h) => h.name.trim().toLowerCase()));
      let pos = (db.select({ m: sql<number>`coalesce(max(${habits.position}), -1)` }).from(habits).where(eq(habits.userId, userId)).get()?.m ?? -1) + 1;
      for (const name of body.habits) {
        const key = name.toLowerCase();
        if (live.has(key)) continue;
        live.add(key);
        const archived = have.find((h) => h.archivedOn && h.name.trim().toLowerCase() === key);
        if (archived) db.update(habits).set({ archivedOn: null, position: pos++ }).where(eq(habits.id, archived.id)).run();
        else db.insert(habits).values({ id: uid('h'), userId, name, position: pos++, createdOn: today, archivedOn: null }).run();
      }

      for (const b of db.select({ id: planBlocks.id }).from(planBlocks).where(and(eq(planBlocks.userId, userId), eq(planBlocks.source, ONBOARDING_SOURCE))).all()) retireBlock(db, userId, b.id, today);
      const applied = writeTemplate(db, userId, template, { replace: true, source: ONBOARDING_SOURCE, today });

      db.update(users).set({ onboardedAt: sql`coalesce(${users.onboardedAt}, ${nowISO()})` }).where(eq(users.id, userId)).run();
      return applied;
    });

    const list = db.select().from(habits).where(eq(habits.userId, userId)).orderBy(asc(habits.position), asc(habits.createdOn)).all().map(toHabit);
    return c.json({ user: meOf(userId), morningSettings: morning, habits: list, block: result.block, months: result.months, firstDay: template.sessions[0]?.date ?? null });
  });

  /** Delete the account and everything it owns. Needs the password; signs out every device. */
  r.delete('/me', async (c) => {
    const ip = ipOf(c.req.raw.headers);
    checkThrottle(ip);
    const userId = c.get('user').id;
    const { password } = await parseBody(c.req.raw, zDeleteAccount);
    const row = db.select().from(users).where(eq(users.id, userId)).get();
    if (!row || !(await verifyPassword(password, row.passwordHash))) {
      failThrottle(ip);
      // 403, not 401: the session is fine, the password is wrong (a 401 would sign the app out)
      throw new ApiError(403, 'That password doesn’t match.', 'bad_password');
    }
    clearThrottle(ip);
    const removed = deleteAccount(db, userId);
    deleteCookie(c, COOKIE, { path: '/' });
    return c.json({ ok: true, removed });
  });

  return r;
};
