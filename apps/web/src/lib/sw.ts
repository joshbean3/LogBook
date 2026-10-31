import { registerSW } from 'virtual:pwa-register';
import { fetchVapidKey, subscribePush, unsubscribePush } from '@/api/queries';
import { isNative } from './native';

let started = false;
/**
 * The service worker, registered once the first screen is up. Its install precaches the whole build (95 files), and on a
 * cold open that used to run in parallel with the page's own chunks and months over the same connection; now it waits
 * for an idle moment after the first content frame (App calls this when the bootstrap is on screen; main.tsx has a late
 * fallback for the signed-out paths). The native shell reads the bundle from disk and registers nothing.
 */
export const startServiceWorker = () => {
  if (started || isNative || !('serviceWorker' in navigator)) return;
  started = true;
  const go = () => registerSW({ immediate: true });
  if ('requestIdleCallback' in window) (window as Window & { requestIdleCallback: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback(go, { timeout: 4000 });
  else setTimeout(go, 1500);
};

// ---------- push on this device ----------

/** Whether this browser can take Web Push at all (iOS Safari only once installed to the home screen). */
export const webPushSupported = () => !isNative && typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const urlBase64ToUint8Array = (b64: string) => {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

const readyWorker = async () => {
  if (!('serviceWorker' in navigator)) return null;
  startServiceWorker();
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
};

/** The subscription this browser holds, if any. */
export const currentWebPush = async (): Promise<PushSubscription | null> => {
  if (!webPushSupported()) return null;
  const reg = await readyWorker();
  return (await reg?.pushManager.getSubscription()) ?? null;
};

export type PushOutcome = 'on' | 'denied' | 'unsupported' | 'server_off' | 'failed';

/**
 * Turn push on here: ask the browser, subscribe with the server's VAPID key, and tell the server. On the phone (the
 * native app) `@capacitor/push-notifications` registers an APNs token when the plugin is installed; without it the app
 * keeps its local notifications (`features/goals/reminders.ts`), which need no server.
 */
export const enablePush = async (): Promise<PushOutcome> => {
  if (isNative) return enableNativePush();
  if (!webPushSupported()) return 'unsupported';
  const { key, configured } = await fetchVapidKey();
  if (!configured || !key) return 'server_off';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'denied';
  const reg = await readyWorker();
  if (!reg) return 'failed';
  try {
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) as BufferSource }));
    const json = sub.toJSON();
    await subscribePush({ kind: 'webpush', endpoint: sub.endpoint, keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' } });
    return 'on';
  } catch {
    return 'failed';
  }
};

export const disablePush = async (): Promise<void> => {
  if (isNative) return disableNativePush();
  const sub = await currentWebPush();
  if (!sub) return;
  await unsubscribePush(sub.endpoint).catch(() => undefined);
  await sub.unsubscribe().catch(() => undefined);
};

// ---------- the phone ----------
const NATIVE_TOKEN_KEY = 'logbook.apnsToken';

const enableNativePush = async (): Promise<PushOutcome> => {
  try {
    // the plugin is optional (a bare name, so the bundler leaves it alone): a build without it falls back to local notifications
    const pluginName = ['@capacitor', 'push-notifications'].join('/');
    const mod = (await import(/* @vite-ignore */ pluginName).catch(() => null)) as { PushNotifications?: { requestPermissions: () => Promise<{ receive: string }>; register: () => Promise<void>; addListener: (ev: string, fn: (t: { value: string }) => void) => Promise<unknown> } } | null;
    if (!mod?.PushNotifications) {
      const { enableReminders } = await import('@/features/goals/reminders');
      return (await enableReminders()) ? 'on' : 'denied';
    }
    const pn = mod.PushNotifications;
    const p = await pn.requestPermissions();
    if (p.receive !== 'granted') return 'denied';
    const token = await new Promise<string>((resolve, reject) => {
      void pn.addListener('registration', (t) => resolve(t.value));
      void pn.addListener('registrationError', () => reject(new Error('registration failed')));
      void pn.register();
      setTimeout(() => reject(new Error('timeout')), 15_000);
    });
    await subscribePush({ kind: 'apns', endpoint: token });
    try {
      localStorage.setItem(NATIVE_TOKEN_KEY, token);
    } catch {
      /* fine */
    }
    return 'on';
  } catch {
    return 'failed';
  }
};

const disableNativePush = async () => {
  let token: string | null = null;
  try {
    token = localStorage.getItem(NATIVE_TOKEN_KEY);
    localStorage.removeItem(NATIVE_TOKEN_KEY);
  } catch {
    /* fine */
  }
  if (token) await unsubscribePush(token).catch(() => undefined);
  const { disableReminders } = await import('@/features/goals/reminders');
  await disableReminders();
};
