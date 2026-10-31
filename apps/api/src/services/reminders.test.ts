import { shiftDays } from '@logbook/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type DB } from '../db/index.js';
import { goals, notificationLog, pushSubscriptions, reminders, users } from '../db/schema.js';
import { env } from '../env.js';
import { buildApp } from '../index.js';
import { localParts, zonedToUtc } from '../lib/tz.js';
import { setPushTransport, type SendOutcome } from './push.js';
import { applyQuietHours, fireDueReminders, generateSystemReminders, nextOccurrence, normalizeRrule, schedulerTick } from './reminders.js';
import { eq } from 'drizzle-orm';

type App = ReturnType<typeof buildApp>;
let app: App;
let db: DB;
let cookie = '';
let userId = '';
const TZ = 'America/New_York';

const call = async (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) => {
  const res = await app.request(url, { method, headers: { 'content-type': 'application/json', cookie, 'x-timezone': TZ, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

beforeEach(async () => {
  db = openDatabase(':memory:').db;
  app = buildApp(db);
  env.allowSetup = true;
  const res = await app.request('/api/auth/setup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'josh@example.com', password: 'password123' }) });
  cookie = (res.headers.get('set-cookie') ?? '').split(';')[0]!;
  userId = (await call('GET', '/api/me')).body.id;
});
afterEach(() => setPushTransport(null));

describe('time zones', () => {
  it('turns a local wall clock into an instant and back, across DST', () => {
    expect(zonedToUtc('2026-07-04', '09:00', TZ).toISOString()).toBe('2026-07-04T13:00:00.000Z');
    expect(zonedToUtc('2026-01-04', '09:00', TZ).toISOString()).toBe('2026-01-04T14:00:00.000Z');
    expect(localParts(new Date('2026-07-04T13:00:00Z'), TZ)).toMatchObject({ date: '2026-07-04', time: '09:00', weekday: 'sat', minutes: 540 });
    expect(zonedToUtc('2026-03-08', '02:30', TZ).toISOString()).toBe('2026-03-08T07:30:00.000Z'); // the skipped half hour lands after the jump
  });

  it('the client’s X-Timezone is kept on the account when it changes', async () => {
    expect((await call('GET', '/api/me')).body.timezone).toBe(TZ);
    await call('GET', '/api/me', undefined, { 'x-timezone': 'Europe/London' });
    expect((await call('GET', '/api/bootstrap', undefined, { 'x-timezone': 'Not/AZone' })).body.user.timezone).toBe('Europe/London');
  });
});

describe('rules', () => {
  it('quiet hours move a fire to the end of the window', () => {
    const q = { start: '22:00', end: '07:00' };
    expect(applyQuietHours(zonedToUtc('2026-10-20', '23:30', TZ), TZ, q)).toEqual(zonedToUtc('2026-10-21', '07:00', TZ));
    expect(applyQuietHours(zonedToUtc('2026-10-21', '03:00', TZ), TZ, q)).toEqual(zonedToUtc('2026-10-21', '07:00', TZ));
    expect(applyQuietHours(zonedToUtc('2026-10-21', '12:00', TZ), TZ, q)).toEqual(zonedToUtc('2026-10-21', '12:00', TZ));
    expect(applyQuietHours(zonedToUtc('2026-10-21', '13:30', TZ), TZ, { start: '13:00', end: '14:00' })).toEqual(zonedToUtc('2026-10-21', '14:00', TZ));
    expect(applyQuietHours(zonedToUtc('2026-10-21', '13:30', TZ), TZ, null)).toEqual(zonedToUtc('2026-10-21', '13:30', TZ));
  });

  it('repeats daily or weekly on days, at the same wall clock', () => {
    expect(normalizeRrule('daily')).toBe('FREQ=DAILY');
    expect(normalizeRrule('weekly:mon,wed')).toBe('FREQ=WEEKLY;BYDAY=MO,WE');
    const at = zonedToUtc('2026-10-20', '07:00', TZ); // a Tuesday
    expect(nextOccurrence(null, at, TZ)).toBeNull();
    expect(nextOccurrence('daily', at, TZ)).toEqual(zonedToUtc('2026-10-21', '07:00', TZ));
    expect(nextOccurrence('weekly:mon,wed', at, TZ)).toEqual(zonedToUtc('2026-10-21', '07:00', TZ));
    expect(nextOccurrence('FREQ=WEEKLY;BYDAY=MO', at, TZ)).toEqual(zonedToUtc('2026-10-26', '07:00', TZ));
    // across the DST end (Nov 1): still 07:00 on the clock
    expect(nextOccurrence('daily', zonedToUtc('2026-10-31', '07:00', TZ), TZ)).toEqual(zonedToUtc('2026-11-01', '07:00', TZ));
  });
});

describe('routes', () => {
  it('creates, lists and cancels reminders in the owner’s zone, with quiet hours', async () => {
    const far = shiftDays(new Date().toISOString().slice(0, 10), 3);
    const r = await call('POST', '/api/reminders', { title: 'Call the bank', date: far, time: '09:30', route: '/today' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ title: 'Call the bank', local: { date: far, time: '09:30' }, source: 'user', status: 'pending', rrule: null });
    expect(r.body.fireAtUtc).toBe(zonedToUtc(far, '09:30', TZ).toISOString());
    await call('PATCH', '/api/notifications/settings', { quietHours: { start: '22:00', end: '07:00' }, tomorrow: false });
    expect((await call('GET', '/api/notifications/settings')).body).toEqual({ goalUnset: true, tomorrow: false, quietHours: { start: '22:00', end: '07:00' }, timezone: TZ });
    const late = await call('POST', '/api/reminders', { title: 'Late', at: zonedToUtc(far, '23:15', TZ).toISOString(), rrule: 'weekly:mon' });
    expect(late.body.local).toEqual({ date: shiftDays(far, 1), time: '07:00' });
    expect(late.body.rrule).toBe('FREQ=WEEKLY;BYDAY=MO');
    expect((await call('GET', '/api/reminders')).body.map((x: { title: string }) => x.title)).toEqual(['Call the bank', 'Late']);
    expect((await call('DELETE', `/api/reminders/${r.body.id}`)).body.status).toBe('cancelled');
    expect((await call('GET', '/api/reminders')).body).toHaveLength(1);
    expect((await call('POST', '/api/reminders', { title: 'Gone', at: '2020-01-01T00:00:00Z' })).status).toBe(422);
    expect((await call('POST', '/api/reminders', { title: 'Bad', date: far, time: '9am' })).status).toBe(422);
  });

  it('subscribes this device to push and says so on the bootstrap', async () => {
    expect((await call('GET', '/api/bootstrap')).body.pushEnabled).toBe(false);
    expect((await call('GET', '/api/push/vapid-public-key')).body).toEqual({ key: null, configured: false });
    const sub = await call('POST', '/api/push/subscribe', { kind: 'webpush', endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } });
    expect(sub.status).toBe(201);
    expect(sub.body.pushEnabled).toBe(true);
    // the same endpoint again updates, never doubles
    await call('POST', '/api/push/subscribe', { kind: 'webpush', endpoint: 'https://push.example/abc', keys: { p256dh: 'p2', auth: 'a2' } });
    expect(db.select().from(pushSubscriptions).all()).toHaveLength(1);
    expect((await call('GET', '/api/bootstrap')).body.pushEnabled).toBe(true);
    expect((await call('DELETE', '/api/push/subscribe', { endpoint: 'https://push.example/abc' })).body.pushEnabled).toBe(false);
  });
});

describe('the scheduler', () => {
  const sent: Array<{ to: string; title: string }> = [];
  const transport = (outcome: (to: string) => SendOutcome) => ({
    webpush: async (s: { endpointOrToken: string }, p: { title: string }) => {
      sent.push({ to: s.endpointOrToken, title: p.title });
      return outcome(s.endpointOrToken);
    },
    apns: async (s: { endpointOrToken: string }, p: { title: string }) => {
      sent.push({ to: s.endpointOrToken, title: p.title });
      return { ok: true };
    },
  });

  it('claims due reminders once, sends to every device, prunes gone ones and books the next repeat', async () => {
    sent.length = 0;
    setPushTransport(transport((to) => (to.includes('dead') ? { ok: false, gone: true, error: '410' } : { ok: true })) as never);
    await call('POST', '/api/push/subscribe', { kind: 'webpush', endpoint: 'https://push.example/live', keys: { p256dh: 'p', auth: 'a' } });
    await call('POST', '/api/push/subscribe', { kind: 'webpush', endpoint: 'https://push.example/dead', keys: { p256dh: 'p', auth: 'a' } });
    await call('POST', '/api/push/subscribe', { kind: 'apns', endpoint: 'apns-token-1' });
    const now = new Date();
    const at = new Date(now.getTime() - 30_000).toISOString();
    const r = await call('POST', '/api/reminders', { title: 'Stretch', at, rrule: 'daily' });
    expect(r.status).toBe(201);
    const later = await call('POST', '/api/reminders', { title: 'Not yet', at: new Date(now.getTime() + 3600_000).toISOString() });

    const out = await fireDueReminders(db, now);
    expect(out).toEqual({ sent: 2, failed: 1 });
    expect(sent.map((s) => s.to).sort()).toEqual(['apns-token-1', 'https://push.example/dead', 'https://push.example/live']);
    expect(db.select().from(pushSubscriptions).all().map((s) => s.endpointOrToken).sort()).toEqual(['apns-token-1', 'https://push.example/live']);
    expect(db.select().from(notificationLog).all().map((l) => l.status).sort()).toEqual(['gone', 'sent', 'sent']);
    const rows = db.select().from(reminders).where(eq(reminders.userId, userId)).all();
    expect(rows.find((x) => x.id === r.body.id)!.status).toBe('sent');
    expect(rows.find((x) => x.id === later.body.id)!.status).toBe('pending');
    const next = rows.find((x) => x.title === 'Stretch' && x.status === 'pending')!;
    expect(next).toBeTruthy();
    expect(new Date(next.fireAtUtc).getTime()).toBeGreaterThan(now.getTime());
    // a second tick finds nothing due: the claim was the single writer
    sent.length = 0;
    expect(await fireDueReminders(db, now)).toEqual({ sent: 0, failed: 0 });
    expect(sent).toEqual([]);
  });

  it('books the two system reminders once each, for accounts with push on, and withdraws them when they no longer apply', async () => {
    setPushTransport(transport(() => ({ ok: true })) as never);
    // a wake at 6:30 and a run planned tomorrow
    await call('PATCH', '/api/morning/settings', { wake: 390 });
    const now = zonedToUtc('2026-10-20', '08:00', TZ); // a Tuesday morning in New York
    db.update(users).set({ timezone: TZ }).where(eq(users.id, userId)).run();
    await call('POST', '/api/sessions', { date: '2026-10-21', kind: 'run', type: 'Easy', title: 'Easy 5', miles: 5 });
    // nobody subscribed: nothing is booked
    expect(generateSystemReminders(db, now)).toBe(0);
    await call('POST', '/api/push/subscribe', { kind: 'webpush', endpoint: 'https://push.example/a', keys: { p256dh: 'p', auth: 'a' } });
    expect(generateSystemReminders(db, now)).toBe(2);
    expect(generateSystemReminders(db, now)).toBe(0);
    const rows = db.select().from(reminders).where(eq(reminders.userId, userId)).all();
    // today's goal reminder at 6:45 has passed; tomorrow's is booked, and tonight's "tomorrow" line names the run and the door
    expect(rows.map((x) => x.dedupeKey).sort()).toEqual(['goal-unset:2026-10-21', 'tomorrow:2026-10-21']);
    const goal = rows.find((x) => x.dedupeKey === 'goal-unset:2026-10-21')!;
    expect(goal.fireAtUtc).toBe(zonedToUtc('2026-10-21', '06:45', TZ).toISOString());
    expect(goal.source).toBe('system');
    const tmrw = rows.find((x) => x.dedupeKey === 'tomorrow:2026-10-21')!;
    expect(tmrw.fireAtUtc).toBe(zonedToUtc('2026-10-20', '21:00', TZ).toISOString());
    expect(tmrw.title).toMatch(/^Tomorrow: Easy 5, out the door \d{1,2}:\d{2}/);
    // the goal gets set: its reminder is withdrawn, and never rebooked
    db.insert(goals).values({ id: 'g1', userId, level: 'day', period: '2026-10-21', text: 'Run easy.', original: null, why: null, status: 'open', reflection: null, steps: '[]', createdAt: now.toISOString(), updatedAt: now.toISOString(), closedAt: null, deletedAt: null }).run();
    expect(generateSystemReminders(db, now)).toBe(0);
    expect(db.select().from(reminders).where(eq(reminders.id, goal.id)).get()!.status).toBe('cancelled');
    expect(generateSystemReminders(db, now)).toBe(0);
    // the switch off stops the evening line; a tick is quiet about it all
    await call('PATCH', '/api/notifications/settings', { tomorrow: false });
    expect(await schedulerTick(db, now)).toEqual({ sent: 0, failed: 0 });
  });
});
