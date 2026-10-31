import { buildMorning, morningDayFor, shiftDays, weekdayOf, type NotificationSettings, type Reminder, type ReminderInput } from '@logbook/shared';
import { and, asc, eq, lte, sql } from 'drizzle-orm';
import type { DB } from '../db/index.js';
import { goals, morningDays, notificationLog, reminders, users } from '../db/schema.js';
import { localParts, zonedMinutesToUtc, zonedToUtc } from '../lib/tz.js';
import { ApiError, nowISO, uid } from '../lib/util.js';
import { morningSettingsOf, readSetting, sessionsBetween, writeSetting } from '../routes/core.js';
import { hasPush, sendToSubscription, subscriptionsOf } from './push.js';

export const DEFAULT_TZ = 'UTC';
type ReminderRow = typeof reminders.$inferSelect;

export const timezoneOf = (db: DB, userId: string): string => db.select({ tz: users.timezone }).from(users).where(eq(users.id, userId)).get()?.tz ?? DEFAULT_TZ;

export interface QuietHours {
  start: string;
  end: string;
}
export const quietHoursOf = (db: DB, userId: string): QuietHours | null => {
  const raw = db.select({ q: users.quietHoursJson }).from(users).where(eq(users.id, userId)).get()?.q;
  if (!raw) return null;
  try {
    const q = JSON.parse(raw) as QuietHours;
    return q && typeof q.start === 'string' && typeof q.end === 'string' ? q : null;
  } catch {
    return null;
  }
};

const mins = (t: string) => {
  const [h, m] = t.split(':').map(Number) as [number, number];
  return h * 60 + m;
};

/**
 * Quiet hours shift a fire into the window's end: 23:30 with quiet 22:00–07:00 fires at 07:00 the next morning; 03:00
 * fires at 07:00 the same day. A window that does not cross midnight (13:00–14:00) works the same way. Pure.
 */
export const applyQuietHours = (at: Date, tz: string, quiet: QuietHours | null): Date => {
  if (!quiet) return at;
  const start = mins(quiet.start);
  const end = mins(quiet.end);
  if (start === end) return at;
  const p = localParts(at, tz);
  const t = p.minutes;
  const inside = start < end ? t >= start && t < end : t >= start || t < end;
  if (!inside) return at;
  const endDay = start < end || t < end ? p.date : shiftDays(p.date, 1);
  return zonedToUtc(endDay, quiet.end, tz);
};

// ---------- repeats ----------

const DAY_CODES: Record<string, string> = { mon: 'MO', tue: 'TU', wed: 'WE', thu: 'TH', fri: 'FR', sat: 'SA', sun: 'SU' };
const CODE_DAYS = Object.fromEntries(Object.entries(DAY_CODES).map(([k, v]) => [v, k])) as Record<string, string>;

/** `daily` → `FREQ=DAILY`; `weekly:mon,wed` → `FREQ=WEEKLY;BYDAY=MO,WE`. Already-formal input passes through. */
export const normalizeRrule = (r: string | null | undefined): string | null => {
  if (!r) return null;
  if (r === 'daily') return 'FREQ=DAILY';
  if (r.startsWith('weekly:')) return `FREQ=WEEKLY;BYDAY=${r.slice(7).split(',').map((d) => DAY_CODES[d] ?? d.toUpperCase()).join(',')}`;
  return r;
};

/** The next occurrence after `after` of a rule anchored on `fireAt`'s wall-clock time in `tz`; null for a one-off. */
export const nextOccurrence = (rrule: string | null, fireAt: Date, tz: string, after: Date = fireAt): Date | null => {
  const rule = normalizeRrule(rrule);
  if (!rule) return null;
  const anchor = localParts(fireAt, tz);
  const days = rule.startsWith('FREQ=WEEKLY') ? (rule.split('BYDAY=')[1] ?? '').split(',').map((c) => CODE_DAYS[c] ?? c.toLowerCase()) : null;
  let date = localParts(after, tz).date;
  for (let i = 0; i < 8; i++) {
    const cand = zonedToUtc(date, anchor.time, tz);
    if (cand > after && (!days || days.includes(weekdayOf(date)))) return cand;
    date = shiftDays(date, 1);
  }
  return null;
};

// ---------- the owner's reminders ----------

export const toReminder = (r: ReminderRow, tz: string): Reminder => {
  const at = new Date(r.fireAtUtc);
  const p = Number.isFinite(at.getTime()) ? localParts(at, tz) : null;
  return { id: r.id, title: r.title, body: r.body, route: r.route, fireAtUtc: r.fireAtUtc, local: p ? { date: p.date, time: p.time } : null, rrule: r.rrule, source: r.source as Reminder['source'], status: r.status as Reminder['status'], createdAt: r.createdAt };
};

export const listReminders = (db: DB, userId: string): Reminder[] => {
  const tz = timezoneOf(db, userId);
  return db
    .select()
    .from(reminders)
    .where(and(eq(reminders.userId, userId), eq(reminders.status, 'pending')))
    .orderBy(asc(reminders.fireAtUtc))
    .all()
    .map((r) => toReminder(r, tz));
};

export interface CreateReminderOpts {
  source?: 'user' | 'agent' | 'system';
  assistantActionId?: string | null;
  dedupeKey?: string | null;
  /** Skip the quiet-hours shift (system reminders choose their own times). */
  raw?: boolean;
}

/** The instant a reminder input asks for: `at` as given, or `date` + `time` in the account's zone; then quiet hours. */
export const fireTimeOf = (input: Pick<ReminderInput, 'at' | 'date' | 'time'>, tz: string, quiet: QuietHours | null, opts: { raw?: boolean } = {}): Date => {
  const at = input.at ? new Date(input.at) : zonedToUtc(input.date!, input.time!, tz);
  if (!Number.isFinite(at.getTime())) throw new ApiError(422, 'That isn’t a time.', 'validation');
  return opts.raw ? at : applyQuietHours(at, tz, quiet);
};

export const createReminder = (db: DB, userId: string, input: ReminderInput, opts: CreateReminderOpts = {}): Reminder => {
  const tz = timezoneOf(db, userId);
  const at = fireTimeOf(input, tz, quietHoursOf(db, userId), { raw: opts.raw });
  if (at.getTime() < Date.now() - 60_000) throw new ApiError(422, 'That time has passed.', 'past');
  const id = uid('rm');
  const rrule = normalizeRrule(input.rrule);
  const row = { id, userId, title: input.title, body: input.body ?? null, route: input.route ?? null, fireAtUtc: at.toISOString(), rrule, source: opts.source ?? 'user', assistantActionId: opts.assistantActionId ?? null, dedupeKey: opts.dedupeKey ?? null, status: 'pending', createdAt: nowISO() };
  if (opts.dedupeKey) {
    const res = db.insert(reminders).values(row).onConflictDoNothing({ target: [reminders.userId, reminders.dedupeKey] }).run();
    if (!res.changes) {
      const had = db.select().from(reminders).where(and(eq(reminders.userId, userId), eq(reminders.dedupeKey, opts.dedupeKey))).get()!;
      return toReminder(had, tz);
    }
  } else db.insert(reminders).values(row).run();
  return toReminder(db.select().from(reminders).where(eq(reminders.id, id)).get()!, tz);
};

export const reminderOf = (db: DB, userId: string, id: string): ReminderRow => {
  const row = db.select().from(reminders).where(and(eq(reminders.userId, userId), eq(reminders.id, id))).get();
  if (!row) throw new ApiError(404, 'Reminder not found', 'not_found');
  return row;
};

export const cancelReminder = (db: DB, userId: string, id: string): Reminder => {
  const row = reminderOf(db, userId, id);
  if (row.status === 'pending') db.update(reminders).set({ status: 'cancelled' }).where(eq(reminders.id, id)).run();
  return toReminder(db.select().from(reminders).where(eq(reminders.id, id)).get()!, timezoneOf(db, userId));
};

/** Undo for `set_reminder`: the row goes (it was never seen). Undo for `cancel_reminder`: pending again. */
export const restoreReminder = (db: DB, userId: string, id: string, status: 'pending' | 'cancelled') => db.update(reminders).set({ status }).where(and(eq(reminders.userId, userId), eq(reminders.id, id))).run();

// ---------- settings ----------

interface StoredNotificationPrefs {
  goalUnset?: boolean;
  tomorrow?: boolean;
}
export const notificationSettingsOf = (db: DB, userId: string): NotificationSettings => {
  const s = readSetting<StoredNotificationPrefs>(db, userId, 'notifications') ?? {};
  return { goalUnset: s.goalUnset ?? true, tomorrow: s.tomorrow ?? true, quietHours: quietHoursOf(db, userId), timezone: db.select({ tz: users.timezone }).from(users).where(eq(users.id, userId)).get()?.tz ?? null };
};

export const patchNotificationSettings = (db: DB, userId: string, patch: { goalUnset?: boolean; tomorrow?: boolean; quietHours?: QuietHours | null }): NotificationSettings => {
  const cur = readSetting<StoredNotificationPrefs>(db, userId, 'notifications') ?? {};
  if (patch.goalUnset !== undefined || patch.tomorrow !== undefined) writeSetting(db, userId, 'notifications', { ...cur, ...(patch.goalUnset !== undefined ? { goalUnset: patch.goalUnset } : {}), ...(patch.tomorrow !== undefined ? { tomorrow: patch.tomorrow } : {}) });
  if (patch.quietHours !== undefined) db.update(users).set({ quietHoursJson: patch.quietHours ? JSON.stringify(patch.quietHours) : null }).where(eq(users.id, userId)).run();
  return notificationSettingsOf(db, userId);
};

// ---------- the scheduler ----------

/** Fifteen minutes after the alarm: awake, not yet out the door. */
export const GOAL_AFTER_WAKE = 15;
export const TOMORROW_AT = '21:00';

const hm = (m: number) => {
  const h = Math.floor(m / 60) % 24;
  const mm = Math.round(m) % 60;
  return `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${String(mm).padStart(2, '0')}`;
};

/**
 * The two system reminders, per user with push on: "Today's goal is unset" at wake + 15 while it is, and "Tomorrow:
 * Easy 5, out the door 6:50" at 21:00 when a session is planned tomorrow. Keyed (`dedupe_key`) so a tick never doubles
 * them; a goal set in the meantime cancels its own. Looks a day ahead, so a reminder is on the books before it is due.
 */
export const generateSystemReminders = (db: DB, now: Date = new Date()): number => {
  let made = 0;
  for (const u of db.select({ id: users.id, tz: users.timezone }).from(users).all()) {
    if (!hasPush(db, u.id)) continue;
    const prefs = notificationSettingsOf(db, u.id);
    const tz = u.tz ?? DEFAULT_TZ;
    const today = localParts(now, tz).date;
    const settings = morningSettingsOf(db, u.id);
    for (const date of [today, shiftDays(today, 1)]) {
      const sessions = sessionsBetween(db, u.id, date, date);
      const override = db.select({ wake: morningDays.wake }).from(morningDays).where(and(eq(morningDays.userId, u.id), eq(morningDays.date, date))).get();
      const day = morningDayFor(sessions, override ? { wake: override.wake } : null, settings);
      if (prefs.goalUnset) {
        const key = `goal-unset:${date}`;
        const has = db.select({ id: goals.id }).from(goals).where(and(eq(goals.userId, u.id), eq(goals.level, 'day'), eq(goals.period, date), sql`${goals.deletedAt} is null`)).get();
        const pending = db.select({ id: reminders.id }).from(reminders).where(and(eq(reminders.userId, u.id), eq(reminders.dedupeKey, key), eq(reminders.status, 'pending'))).get();
        if (has && pending) db.update(reminders).set({ status: 'cancelled' }).where(eq(reminders.id, pending.id)).run();
        else if (!has && !pending) {
          const at = zonedMinutesToUtc(date, day.wake + GOAL_AFTER_WAKE, tz);
          if (at > now && !db.select({ id: reminders.id }).from(reminders).where(and(eq(reminders.userId, u.id), eq(reminders.dedupeKey, key))).get()) {
            db.insert(reminders).values({ id: uid('rm'), userId: u.id, title: 'Today’s goal is unset', body: 'One thing that would make today a win.', route: '/goals', fireAtUtc: at.toISOString(), rrule: null, source: 'system', assistantActionId: null, dedupeKey: key, status: 'pending', createdAt: nowISO() }).run();
            made++;
          }
        }
      }
      if (prefs.tomorrow && date !== today) {
        const key = `tomorrow:${date}`;
        const planned = sessions.filter((s) => s.kind !== 'rest' && !s.mark);
        const pending = db.select({ id: reminders.id }).from(reminders).where(and(eq(reminders.userId, u.id), eq(reminders.dedupeKey, key), eq(reminders.status, 'pending'))).get();
        if (!planned.length && pending) db.update(reminders).set({ status: 'cancelled' }).where(eq(reminders.id, pending.id)).run();
        else if (planned.length && !pending && !db.select({ id: reminders.id }).from(reminders).where(and(eq(reminders.userId, u.id), eq(reminders.dedupeKey, key))).get()) {
          const at = zonedToUtc(today, TOMORROW_AT, tz);
          if (at > now) {
            const tl = buildMorning(day, settings);
            const out = tl.blocks.find((b) => b.key === 'run' || b.key === 'gym')?.start ?? day.wake;
            const first = planned[0]!;
            const what = first.title || [first.type, first.miles ? `${first.miles}` : null].filter(Boolean).join(' ') || first.kind;
            db.insert(reminders).values({ id: uid('rm'), userId: u.id, title: `Tomorrow: ${what}, out the door ${hm(out)}`, body: null, route: `/today`, fireAtUtc: at.toISOString(), rrule: null, source: 'system', assistantActionId: null, dedupeKey: key, status: 'pending', createdAt: nowISO() }).run();
            made++;
          }
        }
      }
    }
  }
  return made;
};

/**
 * Claim every pending reminder due by `now` in one UPDATE … RETURNING (the single-writer claim: a second process or a
 * second tick sees nothing), send each to the owner's devices, log it, and book the next occurrence of a repeat.
 */
export const fireDueReminders = async (db: DB, now: Date = new Date()): Promise<{ sent: number; failed: number }> => {
  const claimed = db
    .update(reminders)
    .set({ status: 'sent' })
    .where(and(eq(reminders.status, 'pending'), lte(reminders.fireAtUtc, now.toISOString())))
    .returning()
    .all();
  let sent = 0;
  let failed = 0;
  for (const r of claimed) {
    const subs = subscriptionsOf(db, r.userId);
    if (!subs.length) db.insert(notificationLog).values({ id: uid('nl'), userId: r.userId, reminderId: r.id, subscriptionId: null, status: 'no_device', error: null, at: nowISO() }).run();
    for (const s of subs) {
      const out = await sendToSubscription(db, s, { id: r.id, title: r.title, body: r.body, route: r.route });
      db.insert(notificationLog).values({ id: uid('nl'), userId: r.userId, reminderId: r.id, subscriptionId: s.id, status: out.ok ? 'sent' : out.gone ? 'gone' : 'failed', error: out.error ?? null, at: nowISO() }).run();
      if (out.ok) sent++;
      else failed++;
    }
    const tz = timezoneOf(db, r.userId);
    const next = nextOccurrence(r.rrule, new Date(r.fireAtUtc), tz, now);
    if (next) db.insert(reminders).values({ id: uid('rm'), userId: r.userId, title: r.title, body: r.body, route: r.route, fireAtUtc: applyQuietHours(next, tz, quietHoursOf(db, r.userId)).toISOString(), rrule: r.rrule, source: r.source, assistantActionId: r.assistantActionId, dedupeKey: null, status: 'pending', createdAt: nowISO() }).run();
  }
  return { sent, failed };
};

/** One tick of the 60-second loop: book the system reminders, then fire what is due. Never throws. */
export const schedulerTick = async (db: DB, now: Date = new Date()) => {
  try {
    generateSystemReminders(db, now);
    return await fireDueReminders(db, now);
  } catch (e) {
    console.warn('reminder scheduler:', e instanceof Error ? e.message : e);
    return { sent: 0, failed: 0 };
  }
};

export const startScheduler = (db: DB, everyMs = 60_000) => {
  const timer = setInterval(() => void schedulerTick(db), everyMs);
  timer.unref();
  setTimeout(() => void schedulerTick(db), 5000).unref();
  return timer;
};
