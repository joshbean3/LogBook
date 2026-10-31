import { buildTemplate, mondayOf, NEW_ACCOUNT_MORNING, normalizeMorningSettings, zCredentials, shiftDays, TemplateError, today as serverToday, weekdayOf, zDeleteAccount, zOnboarding, zTemplateInput, zTrainingPatch, zTrainingProfile, type ISODate, type TemplateInput } from '@logbook/shared';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { deleteCookie } from 'hono/cookie';
import { z } from 'zod';
import { COOKIE, verifyPassword, type AuthEnv } from '../auth.js';
import type { DB } from '../db/index.js';
import { habits, planBlocks, users } from '../db/schema.js';
import { toHabit } from '../lib/map.js';
import { ApiError, nowISO, parseBody, uid } from '../lib/util.js';
import { deleteAccount } from '../services/account.js';
import { revokeAll } from '../services/providers/index.js';
import { retireBlock, writeTemplate } from '../services/plans.js';
import { readTrainingProfile, writeTrainingProfile } from '../services/training.js';
import { checkThrottle, clearThrottle, failThrottle, ipOf, sendVerification } from './auth.js';
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
    const u = db.select({ id: users.id, email: users.email, name: users.name, onboardedAt: users.onboardedAt, timezone: users.timezone, profileNote: users.profileNote, emailVerifiedAt: users.emailVerifiedAt, passwordChangedAt: users.passwordChangedAt }).from(users).where(eq(users.id, id)).get();
    if (!u) throw new ApiError(404, 'Account not found');
    return { ...u, name: u.name ?? null, timezone: u.timezone ?? null, profileNote: u.profileNote ?? null, emailVerifiedAt: u.emailVerifiedAt ?? null, passwordChangedAt: u.passwordChangedAt ?? null, trainingProfile: readTrainingProfile(db, id) };
  };

  /** The account: id, email, `name` (null until given), `onboardedAt`, `emailVerifiedAt`, and the training answers (`trainingProfile`, null before any were given). */
  r.get('/me', (c) => c.json(meOf(c.get('user').id)));

  /**
   * Contract 6: `{ name }` sets the account's name (trimmed, up to 60); "" or null clears it. `{ profileNote }` is "About
   * you, for the assistant" (up to 1000). `{ email, password }` changes the address (the password confirms it; the new
   * address gets a verify link and `emailVerifiedAt` goes back to null). Any of them. Answers like `GET /me`.
   */
  const zMePatchFull = z
    .object({
      name: z.string().trim().max(60).nullable().optional(),
      profileNote: z.string().trim().max(1000).nullable().optional(),
      email: zCredentials.shape.email.optional(),
      password: z.string().min(1).max(200).optional(),
    })
    .refine((o) => o.name !== undefined || o.profileNote !== undefined || o.email !== undefined, { message: 'Nothing to change' });
  r.patch('/me', async (c) => {
    const userId = c.get('user').id;
    const body = await parseBody(c.req.raw, zMePatchFull);
    const set: Partial<typeof users.$inferInsert> = {};
    if (body.name !== undefined) set.name = body.name ? body.name : null;
    if (body.profileNote !== undefined) set.profileNote = body.profileNote ? body.profileNote : null;
    let reverify = false;
    if (body.email !== undefined) {
      const ip = ipOf(c.req.raw.headers);
      checkThrottle(ip);
      const row = db.select({ email: users.email, passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId)).get();
      if (!row) throw new ApiError(404, 'Account not found');
      if (!body.password || !(await verifyPassword(body.password, row.passwordHash))) {
        failThrottle(ip);
        throw new ApiError(403, 'That password doesn’t match.', 'bad_password');
      }
      clearThrottle(ip);
      if (body.email !== row.email) {
        if (db.select({ id: users.id }).from(users).where(eq(users.email, body.email)).get()) throw new ApiError(409, 'There is already an account with that email.', 'email_taken');
        set.email = body.email;
        set.emailVerifiedAt = null;
        reverify = true;
      }
    }
    if (Object.keys(set).length) db.update(users).set(set).where(eq(users.id, userId)).run();
    const verificationSent = reverify ? await sendVerification(db, userId, body.email!) : undefined;
    return c.json({ ...meOf(userId), ...(verificationSent === undefined ? {} : { verificationSent }) });
  });

  /**
   * Change the training answers (any of goal, raceDate, runDays, longRunDay, weeklyMiles; the rest keep their values). It
   * rewrites no plan: Settings rebuilds the plan with POST /plans/template and saves the answers here.
   */
  r.patch('/me/training', async (c) => {
    const userId = c.get('user').id;
    const patch = await parseBody(c.req.raw, zTrainingPatch);
    const cur = readTrainingProfile(db, userId);
    const next = zTrainingProfile.safeParse({ ...(cur ? { goal: cur.goal, raceDate: cur.raceDate, runDays: cur.runDays, longRunDay: cur.longRunDay, weeklyMiles: cur.weeklyMiles } : { raceDate: null }), ...patch });
    if (!next.success) throw new ApiError(422, `No training answers yet: send ${next.error.issues.map((i) => i.path.join('.')).join(', ')}`, 'validation');
    return c.json({ trainingProfile: writeTrainingProfile(db, userId, next.data) });
  });

  /**
   * First run, in one call: morning settings, starter habits, a training block, and `onboardedAt`.
   * Idempotent: habits are matched by name (case-insensitive) and never duplicated; the block written by an earlier
   * call is retired (its future planned sessions removed) before the new one is written; `onboardedAt` keeps its first value.
   */
  r.post('/me/onboarding', async (c) => {
    const userId = c.get('user').id;
    const body = await parseBody(c.req.raw, zOnboarding);
    const today = body.today ?? c.get('today') ?? serverToday();
    const startDate = body.start === 'tomorrow' ? shiftDays(today, 1) : nextMonday(today);
    const template = templateOr422({ goal: body.goal, startDate, runDays: body.runDays, longRunDay: body.longRunDay, weeklyMiles: body.weeklyMiles, raceDate: body.raceDate ?? null });

    // wake is the alarm; leave is the end of the timeline, so the shower is set to leave minus everything after it
    // a new account builds on the generic routine (contract 7), never on someone else's
    const current = readSetting<Record<string, unknown>>(db, userId, 'morning') ?? (NEW_ACCOUNT_MORNING as unknown as Record<string, unknown>);
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

      for (const b of db.select({ id: planBlocks.id }).from(planBlocks).where(and(eq(planBlocks.userId, userId), eq(planBlocks.source, ONBOARDING_SOURCE), isNull(planBlocks.deletedAt))).all()) retireBlock(db, userId, b.id, today);
      const applied = writeTemplate(db, userId, template, { replace: true, source: ONBOARDING_SOURCE, today });

      db.update(users).set({ onboardedAt: sql`coalesce(${users.onboardedAt}, ${nowISO()})` }).where(eq(users.id, userId)).run();
      // the answers themselves, so Settings shows what was said (not what can be read back out of the plan)
      writeTrainingProfile(db, userId, { goal: body.goal, raceDate: body.raceDate ?? null, runDays: body.runDays, longRunDay: body.longRunDay, weeklyMiles: body.weeklyMiles });
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
    // every integration is told first, best effort; then the rows go
    await revokeAll(db, userId);
    const removed = deleteAccount(db, userId);
    deleteCookie(c, COOKIE, { path: '/' });
    return c.json({ ok: true, removed });
  });

  return r;
};
