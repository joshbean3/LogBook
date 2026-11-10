import { buildTemplate, HEALTH_UNITS, mondayOf, NEW_ACCOUNT_MORNING, normalizeMorningSettings, passwordProblem, shiftDays, today as serverToday, type ISODate } from '@logbook/shared';
import { and, eq, lt } from 'drizzle-orm';
import { hashPassword } from '../auth.js';
import { writeSetting } from '../routes/core.js';
import { deleteAccount } from '../services/account.js';
import { SAMPLE_HEALTH_BUNDLE } from '../services/appleHealth.js';
import { writeTemplate } from '../services/plans.js';
import { writeTrainingProfile } from '../services/training.js';
import type { DB } from './index.js';
import { goals, habitChecks, habits, healthSamples, journalEntries, learnings, sleepSegments, todos, trainingSessions, users } from './schema.js';

/**
 * The App Review demo account (finding gap-sub-48, critic-09): an onboarded account with six weeks of a half marathon
 * plan (three behind, the rest ahead), marks on the past sessions, four habits with six weeks of checks, goals, journal
 * lines, a few to-dos and learnings, and six weeks of sample sleep, heart rate variability and resting heart rate, so
 * a reviewer on a phone with no Watch sees full Today, Plan, Progress and Journal screens.
 *
 * - The email and password come from REVIEW_EMAIL and REVIEW_PASSWORD; nothing secret is in the repository.
 * - Safe to run again: the account is removed (every row it owns) and built afresh, with dates from today.
 * - Consent is never written, so the reviewer meets the AI permission step like anyone else.
 * - The health readings carry the source `SAMPLE_HEALTH_BUNDLE`: an Apple Health reconcile from a real phone never
 *   removes them, and the review notes say they are sample data.
 *
 * Run: `pnpm --filter @logbook/api seed:review` locally, or `node dist/ops.js seed-review` on the server (both read
 * REVIEW_EMAIL and REVIEW_PASSWORD).
 */
export const REVIEW_NAME = 'Alex';
const ZONE = 'America/New_York';

/** A small seeded random, so every run writes the same shape of data. */
const random = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

/** The UTC instant of a wall-clock time in New York on a day (good to the hour across daylight saving). */
const nyAt = (date: ISODate, hh: number, mm = 0): Date => {
  const guess = new Date(`${date}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00Z`);
  const local = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, hour: 'numeric', hourCycle: 'h23' }).format(guess);
  const offset = (Number(local) - hh + 24) % 24; // hours New York is ahead of UTC at that moment (negative as 19 to 20)
  return new Date(guess.getTime() - (offset > 12 ? offset - 24 : offset) * 3600_000);
};

export interface ReviewSeedResult {
  userId: string;
  email: string;
  sessions: number;
  marked: number;
  checks: number;
  healthDays: number;
}

export const seedReviewAccount = async (db: DB, opts: { email: string; password: string; today?: ISODate }): Promise<ReviewSeedResult> => {
  const email = opts.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('REVIEW_EMAIL is not an email address.');
  const weak = passwordProblem(opts.password, email);
  if (weak) throw new Error(`REVIEW_PASSWORD: ${weak}`);
  const today = opts.today ?? serverToday();
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(opts.password);

  const had = db.select({ id: users.id }).from(users).where(eq(users.email, email)).get();
  if (had) deleteAccount(db, had.id);
  const userId = `u_review_${Math.random().toString(36).slice(2, 10)}`;
  const rnd = random(20261110);

  let marked = 0;
  let checks = 0;
  const result = db.transaction(() => {
    db.insert(users).values({ id: userId, email, passwordHash, name: REVIEW_NAME, createdAt: now, onboardedAt: now, emailVerifiedAt: now }).run();
    writeSetting(db, userId, 'morning', normalizeMorningSettings({ ...NEW_ACCOUNT_MORNING, wake: 390 } as unknown as Record<string, unknown>));
    writeSetting(db, userId, 'trainWhen', { when: 'morning', offWork: null });

    // the plan: a 12-week half marathon block that began three Mondays ago
    const profile = { goal: 'half' as const, raceDate: null, runDays: ['tue', 'thu', 'sat', 'sun'] as Array<'tue' | 'thu' | 'sat' | 'sun'>, longRunDay: 'sun' as const, weeklyMiles: 18 };
    const start = shiftDays(mondayOf(today), -21);
    const template = buildTemplate({ ...profile, weeks: 12, startDate: start });
    writeTemplate(db, userId, template, { source: 'template', today });
    writeTrainingProfile(db, userId, profile);
    // the past is marked: mostly done, one floor day, one skipped
    const past = db.select().from(trainingSessions).where(and(eq(trainingSessions.userId, userId), lt(trainingSessions.date, today))).all();
    past.forEach((s, i) => {
      const mark = i === 3 ? 'floor' : i === 7 ? 'skip' : 'done';
      db.update(trainingSessions).set({ mark, effort: mark === 'done' ? 4 + Math.floor(rnd() * 4) : null, updatedAt: now }).where(eq(trainingSessions.id, s.id)).run();
      marked++;
    });

    // habits, checked most days for six weeks
    const names = ['Stretch 10 min', 'Read 15 min', 'Lights out by 10:30', 'No phone in bed'];
    names.forEach((name, position) => db.insert(habits).values({ id: `h_review_${position}`, userId, name, position, createdOn: shiftDays(today, -42), archivedOn: null }).run());
    for (let d = 42; d >= 1; d--) {
      const date = shiftDays(today, -d);
      names.forEach((_, i) => {
        if (rnd() < 0.78) {
          db.insert(habitChecks).values({ userId, habitId: `h_review_${i}`, date, done: true, note: null, updatedAt: nyAt(date, 21, 30).toISOString() }).run();
          checks++;
        }
      });
    }

    // goals: the year, this month, last week (done) and this week (with steps)
    const goal = (id: string, level: string, period: string, text: string, status = 'open', steps: Array<{ id: string; text: string; done: boolean }> = []) =>
      db.insert(goals).values({ id, userId, level, period, text, original: null, why: null, status, reflection: null, steps: JSON.stringify(steps), createdAt: now, updatedAt: now, closedAt: status === 'open' ? null : now, deletedAt: null }).run();
    goal('g_review_year', 'year', today.slice(0, 4), 'Run my first half marathon in under 2 hours.');
    goal('g_review_month', 'month', today.slice(0, 7), 'Run four times every week this month.');
    goal('g_review_last', 'week', shiftDays(mondayOf(today), -7), 'Finish every planned run, long run included.', 'done');
    goal('g_review_week', 'week', mondayOf(today), 'Get the 10 mile long run done on Sunday.', 'open', [
      { id: 's1', text: 'Lay out gear Saturday night', done: false },
      { id: 's2', text: 'Eat a real dinner Saturday', done: false },
    ]);

    // journal lines and learnings over the six weeks
    const lines = [
      [40, 'First week of the plan. The easy runs feel almost too easy, which I think is the point.'],
      [33, 'Long run in the rain. Slow, but I finished it and felt good after.'],
      [27, 'Skipped Thursday. Work ran late. Moved on instead of making it up.'],
      [20, 'Slept badly and the tempo felt heavy. Earlier nights this week.'],
      [14, 'Best long run yet. Kept the pace steady the whole way.'],
      [9, 'Reading before bed is working. Phone stays in the kitchen.'],
      [5, 'Legs tired after Sunday. A floor day on Tuesday was the right call.'],
      [2, 'Halfway through the block. Race day feels real now.'],
    ] as const;
    for (const [ago, text] of lines) {
      const date = shiftDays(today, -ago);
      db.insert(journalEntries).values({ id: `j_review_${ago}`, userId, date, text, fav: ago === 14, createdAt: nyAt(date, 21).toISOString(), editedAt: null, deletedAt: null }).run();
    }
    for (const [ago, text] of [
      [30, 'Easy pace should feel like I could talk the whole time.'],
      [16, 'A gel at mile 6 keeps the last miles from falling apart.'],
      [6, 'Strides after an easy run make the next tempo feel smoother.'],
    ] as const) {
      const date = shiftDays(today, -ago);
      db.insert(learnings).values({ id: `l_review_${ago}`, userId, date, text, createdAt: nyAt(date, 20).toISOString(), editedAt: null, deletedAt: null }).run();
    }

    // a few to-dos for today
    ['Book a massage after the long run', 'Buy new running socks', 'Plan meals for the week'].forEach((text, i) =>
      db.insert(todos).values({ id: `t_review_${i}`, userId, text, note: null, priority: i === 0 ? 3 : 0, color: null, groupId: null, due: null, bucket: 'today', position: i, createdOn: today, doneOn: null, deletedOn: null, createdAt: now }).run(),
    );

    // six weeks of sample sleep, HRV and resting heart rate (a night belongs to the morning it ends on)
    let healthDays = 0;
    for (let d = 42; d >= 1; d--) {
      const morning = shiftDays(today, -d + 1);
      const night = shiftDays(morning, -1);
      const asleepMin = 400 + Math.round(rnd() * 70);
      const bed = nyAt(night, 22, 40 + Math.round(rnd() * 15));
      const wake = new Date(bed.getTime() + asleepMin * 60_000);
      // four stages through the night: core, deep, core, rem
      const parts: Array<[string, number]> = [['core', 0.35], ['deep', 0.2], ['core', 0.25], ['rem', 0.2]];
      let at = bed.getTime();
      parts.forEach(([stage, share], i) => {
        const end = i === parts.length - 1 ? wake.getTime() : at + Math.round(asleepMin * share) * 60_000;
        db.insert(sleepSegments).values({ userId, uuid: `sample-sleep-${night}-${i}`, startAt: new Date(at).toISOString(), endAt: new Date(end).toISOString(), stage, sourceBundle: SAMPLE_HEALTH_BUNDLE, sourceName: '', productType: null, tz: ZONE, deletedAt: null, updatedAt: now }).run();
        at = end;
      });
      const sample = (type: 'hrv' | 'resting_hr', value: number, hh: number) => {
        const t = nyAt(morning, hh).toISOString();
        db.insert(healthSamples).values({ userId, uuid: `sample-${type}-${morning}`, type, startAt: t, endAt: t, value, unit: HEALTH_UNITS[type], sourceBundle: SAMPLE_HEALTH_BUNDLE, sourceName: '', productType: null, userEntered: false, tz: ZONE, deletedAt: null, updatedAt: now }).run();
      };
      sample('hrv', Math.round(48 + rnd() * 18), 6);
      sample('resting_hr', Math.round(52 + rnd() * 6), 7);
      healthDays++;
    }
    return { healthDays };
  });

  const sessions = db.select({ id: trainingSessions.id }).from(trainingSessions).where(eq(trainingSessions.userId, userId)).all().length;
  return { userId, email, sessions, marked, checks, healthDays: result.healthDays };
};
