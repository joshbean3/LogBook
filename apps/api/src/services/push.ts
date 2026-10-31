import { and, eq } from 'drizzle-orm';
import type { DB } from '../db/index.js';
import { pushSubscriptions } from '../db/schema.js';
import { env } from '../env.js';
import { nowISO, uid } from '../lib/util.js';

export type SubscriptionRow = typeof pushSubscriptions.$inferSelect;

export interface PushPayload {
  id: string;
  title: string;
  body: string | null;
  route: string | null;
}

export interface SendOutcome {
  ok: boolean;
  /** The device is gone (404/410): the subscription was pruned. */
  gone?: boolean;
  error?: string;
}

/** What the send step uses, swappable in tests. */
export interface PushTransport {
  webpush(sub: SubscriptionRow, payload: PushPayload): Promise<SendOutcome>;
  apns(sub: SubscriptionRow, payload: PushPayload): Promise<SendOutcome>;
}

let webPushLib: typeof import('web-push') | null = null;
const webPush = async () => {
  if (!webPushLib) {
    webPushLib = (await import('web-push')).default;
    webPushLib.setVapidDetails(env.VAPID_SUBJECT ?? `mailto:admin@${new URL(env.APP_URL).hostname}`, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
  }
  return webPushLib;
};

/**
 * APNs is not sent yet: the HTTP/2 sender (a .p8 key, a JWT, a request per token to api.push.apple.com) is a
 * configuration task to come. Tokens are stored (`kind: 'apns'`) so the switch works on the phone; the native app
 * meanwhile schedules its own local notifications. TODO: implement with `http2` once APNS_KEY_ID / APNS_TEAM_ID /
 * APNS_KEY / APNS_BUNDLE_ID exist.
 */
export const sendApns = async (sub: SubscriptionRow, payload: PushPayload): Promise<SendOutcome> => {
  console.log(`[push] apns stub: would send "${payload.title}" to ${sub.endpointOrToken.slice(0, 12)}…`);
  return { ok: true };
};

export const realTransport: PushTransport = {
  async webpush(sub, payload) {
    if (!env.vapidConfigured) {
      console.log(`[push] VAPID keys unset: would send "${payload.title}" to ${sub.endpointOrToken.slice(0, 40)}…`);
      return { ok: true };
    }
    try {
      const lib = await webPush();
      await lib.sendNotification({ endpoint: sub.endpointOrToken, keys: { p256dh: sub.p256dh ?? '', auth: sub.auth ?? '' } }, JSON.stringify(payload), { TTL: 3600 });
      return { ok: true };
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      return { ok: false, gone: status === 404 || status === 410, error: e instanceof Error ? e.message : String(e) };
    }
  },
  apns: sendApns,
};

let transport: PushTransport = realTransport;
export const setPushTransport = (t: PushTransport | null) => {
  transport = t ?? realTransport;
};

export const subscriptionsOf = (db: DB, userId: string) => db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId)).all();
export const hasPush = (db: DB, userId: string) => subscriptionsOf(db, userId).length > 0;

export const subscribe = (db: DB, userId: string, input: { kind: 'webpush' | 'apns'; endpointOrToken: string; p256dh?: string | null; auth?: string | null; userAgent?: string | null }) => {
  const had = db.select().from(pushSubscriptions).where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpointOrToken, input.endpointOrToken))).get();
  if (had) {
    db.update(pushSubscriptions).set({ kind: input.kind, p256dh: input.p256dh ?? null, auth: input.auth ?? null, userAgent: input.userAgent ?? null, failedAt: null }).where(eq(pushSubscriptions.id, had.id)).run();
    return db.select().from(pushSubscriptions).where(eq(pushSubscriptions.id, had.id)).get()!;
  }
  const id = uid('ps');
  db.insert(pushSubscriptions).values({ id, userId, kind: input.kind, endpointOrToken: input.endpointOrToken, p256dh: input.p256dh ?? null, auth: input.auth ?? null, userAgent: input.userAgent ?? null, createdAt: nowISO(), lastOkAt: null, failedAt: null }).run();
  return db.select().from(pushSubscriptions).where(eq(pushSubscriptions.id, id)).get()!;
};

export const unsubscribe = (db: DB, userId: string, endpointOrToken: string) => db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpointOrToken, endpointOrToken))).run().changes;

/** Send to one device; a 404/410 prunes it. */
export const sendToSubscription = async (db: DB, sub: SubscriptionRow, payload: PushPayload): Promise<SendOutcome> => {
  const out = sub.kind === 'apns' ? await transport.apns(sub, payload) : await transport.webpush(sub, payload);
  if (out.gone) db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id)).run();
  else db.update(pushSubscriptions).set(out.ok ? { lastOkAt: nowISO(), failedAt: null } : { failedAt: nowISO() }).where(eq(pushSubscriptions.id, sub.id)).run();
  return out;
};
