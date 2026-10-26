import { Capacitor } from '@capacitor/core';
import { mondayOf, periodOf, shiftDays, type Aim, type ISODate } from '@logbook/shared';

/**
 * Goal reminders on the phone: a local notification on each of the next 7 mornings whose day has no goal yet ("Set
 * today's goal"), folded with the week's on a Monday whose week has none. Rescheduled whenever the goals change or the app
 * opens, so a goal set early cancels its own reminder. Web has no notifications: the dot on the Goals tab is the reminder.
 */
const KEY = 'logbook.goalReminders';
const FIRST_ID = 7000;
const DAYS = 7;
/** Fifteen minutes after the alarm: awake, not yet out the door. */
const AFTER_WAKE = 15;

export const remindersSupported = () => Capacitor.isNativePlatform();
export const remindersOn = () => {
  try {
    return localStorage.getItem(KEY) !== '0' && localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
};

const notifications = () => import('@capacitor/local-notifications').then((m) => m.LocalNotifications);

/** Ask once; true when the phone allows it. */
export const enableReminders = async (): Promise<boolean> => {
  if (!remindersSupported()) return false;
  const ln = await notifications();
  const p = await ln.requestPermissions();
  const ok = p.display === 'granted';
  try {
    localStorage.setItem(KEY, ok ? '1' : '0');
  } catch {
    /* private mode: the toggle reads off next time */
  }
  return ok;
};

export const disableReminders = async () => {
  try {
    localStorage.setItem(KEY, '0');
  } catch {
    /* nothing to keep */
  }
  if (!remindersSupported()) return;
  const ln = await notifications();
  await ln.cancel({ notifications: Array.from({ length: DAYS }, (_, i) => ({ id: FIRST_ID + i })) });
};

/** The reminders owed over the next week, from the goals as they stand: pure, so it is tested without a phone. */
export const plannedReminders = (goals: readonly Aim[] | undefined, today: ISODate, now: Date, wake: number) => {
  const has = (level: Aim['level'], period: string) => !!goals?.some((g) => g.level === level && g.period === period);
  const out: Array<{ id: number; at: Date; title: string; body: string }> = [];
  for (let i = 0; i < DAYS; i++) {
    const d = shiftDays(today, i);
    const [y, m, day] = d.split('-').map(Number) as [number, number, number];
    const at = new Date(y, m - 1, day, 0, wake + AFTER_WAKE);
    if (at <= now) continue;
    const needDay = !has('day', d);
    const needWeek = d === mondayOf(d) && !has('week', periodOf('week', d));
    if (!needDay && !needWeek) continue;
    out.push({
      id: FIRST_ID + i,
      at,
      title: needDay && needWeek ? 'Set today’s and this week’s goals' : needWeek ? 'Set this week’s goal' : 'Set today’s goal',
      body: needWeek ? 'A week with one clear target beats a week of good intentions.' : 'One thing that would make today a win.',
    });
  }
  return out;
};

/** Replace what is scheduled with what is owed. A no-op on the web or with reminders off. */
export const scheduleReminders = async (goals: readonly Aim[] | undefined, today: ISODate, wake: number) => {
  if (!remindersSupported() || !remindersOn()) return;
  const ln = await notifications();
  await ln.cancel({ notifications: Array.from({ length: DAYS }, (_, i) => ({ id: FIRST_ID + i })) });
  const due = plannedReminders(goals, today, new Date(), wake);
  if (due.length) await ln.schedule({ notifications: due.map((n) => ({ id: n.id, title: n.title, body: n.body, schedule: { at: n.at, allowWhileIdle: true }, extra: { route: '/goals' } })) });
};

/** A tap on a reminder opens Goals. Returns the unsubscribe. */
export const onReminderTap = (go: (path: string) => void): (() => void) => {
  if (!remindersSupported()) return () => undefined;
  let off: (() => void) | null = null;
  let dead = false;
  void notifications().then((ln) =>
    ln
      .addListener('localNotificationActionPerformed', (e) => go(typeof e.notification.extra?.route === 'string' ? e.notification.extra.route : '/goals'))
      .then((h) => {
        if (dead) void h.remove();
        else off = () => void h.remove();
      }),
  );
  return () => {
    dead = true;
    off?.();
  };
};
