import { buildTemplate, mergeRewards, mondayOf, parseRewards, passwordProblem, tidy, zRewards, type Rewards, NEW_ACCOUNT_MORNING, normalizeMorningSettings, zMePatch, zPrefs, shiftDays, TemplateError, today as serverToday, weekdayOf, zChangePassword, zDeleteAccount, zOnboarding, zTemplateInput, zTrainingPatch, zTrainingProfile, zTrainingStatusInput, zConsentInput, zIntroSeen, type TrainWhenSetting, type TrainingStatus, type ISODate, type TemplateInput } from '@logbook/shared';
import { admitRewards, REWARDS_KEY, REWARDS_MAX_BYTES } from '../services/rewardsAdmit.js';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { deleteCookie } from 'hono/cookie';
import { COOKIE, dropSessions, hashPassword, sessionOf, verifyPassword, type AuthEnv } from '../auth.js';
import type { DB } from '../db/index.js';
import { habits, planBlocks, users } from '../db/schema.js';
import { toHabit } from '../lib/map.js';
import { ApiError, nowISO, parseBody, parseWithPassword, uid } from '../lib/util.js';
import { deleteAccount } from '../services/account.js';
import { audit } from '../services/audit.js';
import { disconnect } from '../services/strava.js';
import { retireBlock, writeTemplate } from '../services/plans.js';
import { readTrainingProfile, writeTrainingProfile } from '../services/training.js';
import { enrollIntros, markIntroSeen, readConsent, readIntros, writeConsent } from '../services/consent.js';
import { passwordChangedMail, sendMail } from '../services/mail.js';
import { checkThrottle, clearEmail, clearThrottle, failThrottle, hitLimit, tooMany } from '../services/throttle.js';
import { sendVerification } from './auth.js';
import { deepMerge, readSetting, writeSetting } from './core.js';

/** The block source that marks the plan onboarding wrote, so a second call replaces it instead of adding another. */
export const ONBOARDING_SOURCE = 'onboarding';
/** User setting: when the person usually trains and when work ends (onboarding; the bootstrap carries it). */
export const TRAIN_WHEN_KEY = 'trainWhen';
/** User setting: what the person has switched on (`zPrefs`; the bootstrap carries it, null before one is saved). */
export const PREFS_KEY = 'prefs';

// the Orbs store's key, its size cap and what is admitted from a phone live with the services (the import uses them too)
export { admitRewards, REWARDS_KEY, REWARDS_MAX_BYTES } from '../services/rewardsAdmit.js';

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
    const u = db.select({ id: users.id, email: users.email, name: users.name, onboardedAt: users.onboardedAt, emailVerifiedAt: users.emailVerifiedAt }).from(users).where(eq(users.id, id)).get();
    if (!u) throw new ApiError(404, 'Account not found');
    return { ...u, name: u.name ?? null, emailVerifiedAt: u.emailVerifiedAt ?? null, trainingProfile: readTrainingProfile(db, id), status: readSetting<TrainingStatus>(db, id, 'status') };
  };

  /** The account: id, email, `name` (null until given), `onboardedAt`, and the training answers (`trainingProfile`, null before any were given). */
  r.get('/me', (c) => c.json(meOf(c.get('user').id)));

  /** Contract 6: `{ name }` sets the account's name (trimmed, up to 60); "" or null clears it. Answers like `GET /me`. */
  r.patch('/me', async (c) => {
    const userId = c.get('user').id;
    const { name } = await parseBody(c.req.raw, zMePatch);
    db.update(users).set({ name: name ? name : null }).where(eq(users.id, userId)).run();
    return c.json(meOf(userId));
  });

  /** What is switched on (Fitness, Today's sections): the whole record each time. Answers `{ prefs }`; the bootstrap carries it. */
  r.put('/me/prefs', async (c) => {
    const userId = c.get('user').id;
    const prefs = await parseBody(c.req.raw, zPrefs);
    writeSetting(db, userId, PREFS_KEY, prefs);
    return c.json({ prefs });
  });

  /**
   * The Orbs store: the phone sends its whole copy, the server merges it into the account's with the same shared
   * `mergeRewards` the phones use (commutative, associative, idempotent, so any order and any number of sends agree) and
   * answers `{ rewards }`, the merged store. Checked against `zRewards` (which caps every map), only for the signed-in
   * account, never over `REWARDS_MAX_BYTES`. What is admitted from the body is `admitRewards`' to say.
   */
  r.put('/me/rewards', async (c) => {
    const userId = c.get('user').id;
    const body = (await parseBody(c.req.raw, zRewards)) as Rewards;
    if (body.userId !== userId) throw new ApiError(403, 'That is another account’s record.', 'wrong_account');
    const sent = admitRewards(body, serverToday());
    const rewards = db.transaction(() => {
      const kept = parseRewards(readSetting<unknown>(db, userId, REWARDS_KEY), userId);
      const next = tidy(kept ? mergeRewards(kept, sent) : sent);
      if (JSON.stringify(next).length > REWARDS_MAX_BYTES) throw new ApiError(413, 'That is too big to save.', 'too_big');
      writeSetting(db, userId, REWARDS_KEY, next);
      return next;
    });
    return c.json({ rewards });
  });

  /**
   * How the athlete is training now: `{ kind, until }`, from the request's day through `until` (inclusive; null for until
   * changed). "training" clears it. Answers `{ status }` (null when cleared).
   */
  r.put('/me/status', async (c) => {
    const userId = c.get('user').id;
    const body = await parseBody(c.req.raw, zTrainingStatusInput);
    const today = c.get('today');
    if (body.until !== null && body.until < today) throw new ApiError(422, 'That day has already passed', 'validation');
    const status: TrainingStatus | null = body.kind === 'training' ? null : { kind: body.kind, from: today, until: body.until };
    writeSetting(db, userId, 'status', status);
    return c.json({ status });
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
    // goal null ("No running plan for now"): no block, no training answers; the rest is saved the same way
    const plan = body.goal && body.runDays && body.longRunDay && body.weeklyMiles !== undefined ? { goal: body.goal, raceDate: body.raceDate ?? null, runDays: body.runDays, longRunDay: body.longRunDay, weeklyMiles: body.weeklyMiles } : null;
    const template = plan ? templateOr422({ ...plan, startDate }) : null;

    // the routine the person set up (minutes and names), on top of what is stored or the generic routine (contract 7);
    // then wake is the alarm and leave the end of the timeline, so the shower is set to leave minus everything after it
    const stored = readSetting<Record<string, unknown>>(db, userId, 'morning') ?? (NEW_ACCOUNT_MORNING as unknown as Record<string, unknown>);
    const current = body.routine ? (normalizeMorningSettings(deepMerge(stored, body.routine)) as unknown as Record<string, unknown>) : stored;
    const A = normalizeMorningSettings(current).after;
    const afterShower = A.shower + A.ready + (A.smoothie || 0) + A.prep;
    const showerAt = Math.max(body.wake, body.leave - afterShower);
    const morning = normalizeMorningSettings(deepMerge(current, { wake: body.wake, ...(body.pace ? { run: { pace: body.pace } } : {}), after: { showerMode: 'fixed', showerAt } }));
    const trainWhen: TrainWhenSetting | null = body.trainWhen ? { when: body.trainWhen, offWork: body.offWork ?? null } : null;

    const result = db.transaction(() => {
      writeSetting(db, userId, 'morning', morning);
      if (body.name) db.update(users).set({ name: body.name }).where(eq(users.id, userId)).run();
      if (trainWhen) writeSetting(db, userId, TRAIN_WHEN_KEY, trainWhen);

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

      let applied: ReturnType<typeof writeTemplate> | null = null;
      if (plan && template) {
        for (const b of db.select({ id: planBlocks.id }).from(planBlocks).where(and(eq(planBlocks.userId, userId), eq(planBlocks.source, ONBOARDING_SOURCE), isNull(planBlocks.deletedAt))).all()) retireBlock(db, userId, b.id, today);
        applied = writeTemplate(db, userId, template, { replace: true, source: ONBOARDING_SOURCE, today });
        // the answers themselves, so Settings shows what was said (not what can be read back out of the plan)
        writeTrainingProfile(db, userId, plan);
      }

      db.update(users).set({ onboardedAt: sql`coalesce(${users.onboardedAt}, ${nowISO()})` }).where(eq(users.id, userId)).run();
      return applied;
    });

    const list = db.select().from(habits).where(eq(habits.userId, userId)).orderBy(asc(habits.position), asc(habits.createdOn)).all().map(toHabit);
    return c.json({
      user: meOf(userId),
      morningSettings: morning,
      habits: list,
      trainWhen: readSetting<TrainWhenSetting>(db, userId, TRAIN_WHEN_KEY),
      block: result?.block ?? null,
      months: result?.months ?? [],
      firstDay: template?.sessions[0]?.date ?? null,
    });
  });

  /** Delete the account and everything it owns. Needs the password; signs out every device. */
  r.delete('/me', async (c) => {
    const userId = c.get('user').id;
    // its own bucket, by account: wrong passwords here never lock anyone's sign-in, and an address cannot dodge it
    const bucket = `delete:${userId}`;
    checkThrottle(bucket);
    const { password } = await parseBody(c.req.raw, zDeleteAccount);
    const row = db.select().from(users).where(eq(users.id, userId)).get();
    if (!row || !(await verifyPassword(password, row.passwordHash))) {
      failThrottle(bucket);
      audit(db, 'password_wrong', userId, 'delete account');
      // 403, not 401: the session is fine, the password is wrong (a 401 would sign the app out)
      throw new ApiError(403, 'That password doesn’t match.', 'bad_password');
    }
    clearThrottle(bucket);
    // Strava first, while the token still exists: end Logbook's grant there and delete what came from it. A Strava
    // outage never blocks the deletion (the deauthorize is tried once more a minute later).
    const strava = await disconnect(db, userId).catch(() => null);
    // then every row the account owns: its sessions (every device is signed out) and its Apple Health device tokens
    // (a phone still holding one gets 401 and stops syncing) among them
    const removed = deleteAccount(db, userId);
    // the log keeps that an account was deleted, under the same keyed hash its earlier rows carry; nothing names it
    audit(db, 'account_deleted', userId);
    deleteCookie(c, COOKIE, { path: '/' });
    return c.json({ ok: true, removed, strava: strava?.connected ? { deauthorized: strava.deauthorized } : null });
  });

  /**
   * Change the password: `{ current, next }`. Needs the current password (403 `wrong_password` otherwise; the session is
   * fine, so not a 401). Every other device is signed out; this one stays. A note goes to the account's address.
   */
  r.post('/me/password', async (c) => {
    const userId = c.get('user').id;
    const bucket = `password:${userId}`;
    checkThrottle(bucket);
    const { current, next } = await parseWithPassword(c.req.raw, zChangePassword, 'next');
    const row = db.select().from(users).where(eq(users.id, userId)).get();
    if (!row || !(await verifyPassword(current, row.passwordHash))) {
      failThrottle(bucket);
      audit(db, 'password_wrong', userId, 'change password');
      throw new ApiError(403, 'That is not your current password.', 'wrong_password');
    }
    clearThrottle(bucket);
    const weak = passwordProblem(next, row.email);
    if (weak) throw new ApiError(422, weak, 'weak_password');
    const hash = await hashPassword(next);
    const keep = sessionOf(db, c)?.id;
    const signedOut = db.transaction(() => {
      db.update(users).set({ passwordHash: hash }).where(eq(users.id, userId)).run();
      return dropSessions(db, userId, keep);
    });
    clearEmail(db, row.email);
    audit(db, 'password_changed', userId);
    void sendMail(passwordChangedMail(row.email));
    return c.json({ ok: true, signedOut });
  });

  /** Send the "confirm your email" link again (three an hour). Answers whether the address is already confirmed. */
  r.post('/me/verify-email', (c) => {
    const user = c.get('user');
    const row = db.select({ at: users.emailVerifiedAt }).from(users).where(eq(users.id, user.id)).get();
    if (row?.at) return c.json({ ok: true, verified: true });
    const bucket = `verify:${user.id}`;
    const wait = hitLimit(db, bucket, 3, 3600_000);
    if (wait) throw tooMany(wait, 'That was sent a few times already. Check your inbox, or try again in an hour.');
    void sendVerification(db, { id: user.id, email: user.email });
    return c.json({ ok: true, verified: false });
  });

  /** What the assistant may read (`{ training, health, at }`), as chosen on the privacy page or in Settings › Privacy. */
  r.get('/me/consent', (c) => c.json({ consent: readConsent(db, c.get('user').id) }));
  r.put('/me/consent', async (c) => {
    const body = await parseBody(c.req.raw, zConsentInput);
    return c.json({ consent: writeConsent(db, c.get('user').id, body) });
  });

  /** The one-time feature intros: `{ seen }` (null when the account is not enrolled). First run enrolls; a shown sheet marks its key. */
  r.get('/me/intros', (c) => c.json(readIntros(db, c.get('user').id)));
  r.post('/me/intros/enroll', (c) => c.json(enrollIntros(db, c.get('user').id)));
  r.post('/me/intros/seen', async (c) => {
    const { key } = await parseBody(c.req.raw, zIntroSeen);
    return c.json(markIntroSeen(db, c.get('user').id, key));
  });

  return r;
};
