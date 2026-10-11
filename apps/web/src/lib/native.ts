import { Capacitor } from '@capacitor/core';

/** True inside the iOS app; false in Safari and on the desktop. */
export const isNative = Capacitor.isNativePlatform();

/** Where the API lives. In the browser it is the same origin; the app talks to your server. */
export const apiOrigin = isNative ? ((import.meta.env.VITE_API_ORIGIN as string | undefined) ?? 'https://josh-logbook.fly.dev') : '';

/** Deep links (logbook://settings?strava=connected) become in-app navigations. */
export const onDeepLink = async (go: (path: string) => void) => {
  if (!isNative) return;
  try {
    const { App } = await import('@capacitor/app');
    await App.addListener('appUrlOpen', ({ url }) => {
      try {
        const u = new URL(url);
        const path = `/${u.host}${u.pathname}`.replace(/\/+$/, '') || '/today';
        void import('@capacitor/browser').then(({ Browser }) => Browser.close().catch(() => undefined));
        go(`${path}${u.search}`);
      } catch {
        /* not ours */
      }
    });
  } catch {
    /* plugin missing */
  }
};

/** One-time native setup: status bar over the canvas, splash held until first paint. */
export const bootNative = async () => {
  if (!isNative) return;
  try {
    const [{ StatusBar, Style }, { SplashScreen }, { Keyboard }] = await Promise.all([import('@capacitor/status-bar'), import('@capacitor/splash-screen'), import('@capacitor/keyboard')]);
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setOverlaysWebView({ overlay: true });
    Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => undefined);
    requestAnimationFrame(() => {
      setTimeout(() => void SplashScreen.hide({ fadeOutDuration: 240 }), 120);
    });
  } catch {
    /* plugin missing on this platform */
  }
};
