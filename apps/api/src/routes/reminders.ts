import { zNotificationSettingsPatch, zPushSubscribe, zPushUnsubscribe, zReminderInput } from '@logbook/shared';
import { Hono } from 'hono';
import type { AuthEnv } from '../auth.js';
import type { DB } from '../db/index.js';
import { env } from '../env.js';
import { parseBody } from '../lib/util.js';
import { hasPush, subscribe, unsubscribe } from '../services/push.js';
import { cancelReminder, createReminder, listReminders, notificationSettingsOf, patchNotificationSettings } from '../services/reminders.js';

/**
 * Reminders and push: the owner's pending reminders (`GET/POST/DELETE /reminders`), this device's push subscription
 * (`POST/DELETE /push/subscribe`, the VAPID public key to subscribe with), and the two system reminders plus quiet
 * hours (`GET/PATCH /notifications/settings`).
 */
export const reminderRoutes = (db: DB) => {
  const r = new Hono<AuthEnv>();
  const uidOf = (c: { get: (k: 'user') => { id: string } }) => c.get('user').id;

  r.get('/reminders', (c) => c.json(listReminders(db, uidOf(c))));
  r.post('/reminders', async (c) => c.json(createReminder(db, uidOf(c), await parseBody(c.req.raw, zReminderInput)), 201));
  r.delete('/reminders/:id', (c) => c.json(cancelReminder(db, uidOf(c), c.req.param('id'))));

  r.get('/push/vapid-public-key', (c) => c.json({ key: env.VAPID_PUBLIC_KEY ?? null, configured: env.vapidConfigured }));
  r.post('/push/subscribe', async (c) => {
    const body = await parseBody(c.req.raw, zPushSubscribe);
    const sub = subscribe(db, uidOf(c), { kind: body.kind, endpointOrToken: body.endpoint, p256dh: body.keys?.p256dh ?? null, auth: body.keys?.auth ?? null, userAgent: body.userAgent ?? c.req.header('user-agent')?.slice(0, 200) ?? null });
    return c.json({ id: sub.id, kind: sub.kind, createdAt: sub.createdAt, pushEnabled: true }, 201);
  });
  r.delete('/push/subscribe', async (c) => {
    const { endpoint } = await parseBody(c.req.raw, zPushUnsubscribe);
    unsubscribe(db, uidOf(c), endpoint);
    return c.json({ ok: true, pushEnabled: hasPush(db, uidOf(c)) });
  });

  r.get('/notifications/settings', (c) => c.json(notificationSettingsOf(db, uidOf(c))));
  r.patch('/notifications/settings', async (c) => c.json(patchNotificationSettings(db, uidOf(c), await parseBody(c.req.raw, zNotificationSettingsPatch))));

  return r;
};
