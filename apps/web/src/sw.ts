/// <reference lib="webworker" />
/**
 * The service worker (built by vite-plugin-pwa's injectManifest from this file): the build is precached and the fonts
 * cached as they are used, as before; and now a push shows a notification, and a tap on it opens the reminder's route.
 */
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

// ---------- the build, precached (registerType autoUpdate: a new worker takes over at once) ----------
self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }));

// ---------- fonts: eight files, 400 KB, cached as they are used ----------
registerRoute(
  ({ url }) => url.pathname.startsWith('/fonts/'),
  new CacheFirst({ cacheName: 'fonts', plugins: [new ExpirationPlugin({ maxEntries: 16, maxAgeSeconds: 60 * 60 * 24 * 365 }), new CacheableResponsePlugin({ statuses: [0, 200] })] }),
);

// ---------- push ----------
interface PushPayload {
  id?: string;
  title?: string;
  body?: string | null;
  route?: string | null;
}

self.addEventListener('push', (event) => {
  let payload: PushPayload = {};
  try {
    payload = (event.data?.json() as PushPayload) ?? {};
  } catch {
    payload = { title: event.data?.text() ?? 'Logbook' };
  }
  const title = payload.title || 'Logbook';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body ?? undefined,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: payload.id ?? undefined,
      data: { route: payload.route ?? '/today' },
    }),
  );
});

/** A tap opens the reminder's route in the app: an open window is focused and sent there, else one is opened. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const route = typeof event.notification.data?.route === 'string' ? (event.notification.data.route as string) : '/today';
  const target = new URL(route, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = all.find((c) => 'focus' in c);
      if (open) {
        await open.focus();
        if ('navigate' in open) await (open as WindowClient).navigate(target).catch(() => undefined);
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});
