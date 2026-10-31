import { Capacitor } from '@capacitor/core';

/** True inside the iOS app; false in Safari and on the desktop. */
export const isNative = Capacitor.isNativePlatform();

/**
 * Where the API lives. In the browser it is the same origin; the app talks to your server, named at build time by
 * `VITE_API_ORIGIN` (README: "The iPhone app"). No default: a build without it talks to nothing, loudly.
 */
const configuredOrigin = ((import.meta.env.VITE_API_ORIGIN as string | undefined) ?? '').replace(/\/+$/, '');
if (isNative && !configuredOrigin) console.error('VITE_API_ORIGIN is not set: the app has no server to talk to. Build with VITE_API_ORIGIN=https://your-server.');
export const apiOrigin = isNative ? configuredOrigin : '';

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

let splashHidden = false;
/**
 * Hide the splash with a 200 ms fade. Idempotent: the first call wins. Called in a rAF after the first content paint (WP2's
 * DayPage; until it lands, App after the framed app's first paint); `bootNative` keeps the 1500 ms hard cap, and
 * `hideSplashBy(900)` is the cap while only the first-run face is up.
 */
export const hideSplash = () => {
  if (splashHidden) return;
  splashHidden = true;
  try {
    // test hooks: how many times, and when (the splash is native; on the web this is all there is to see)
    const w = window as Window & { __splashHides?: number; __splashAt?: number };
    w.__splashHides = (w.__splashHides ?? 0) + 1;
    w.__splashAt = performance.now();
  } catch {
    /* no window */
  }
  if (!isNative) return;
  void import('@capacitor/splash-screen')
    .then(({ SplashScreen }) => SplashScreen.hide({ fadeOutDuration: 200 }))
    .catch(() => undefined);
};
/** A cap: hide the splash after `ms` if nothing hid it first. */
export const hideSplashBy = (ms: number) => void setTimeout(hideSplash, ms);

/** One-time native setup: status bar over the canvas, no keyboard accessory, the splash's 1500 ms hard cap. */
export const bootNative = async () => {
  if (!isNative) return;
  try {
    const [{ StatusBar, Style }, { Keyboard }] = await Promise.all([import('@capacitor/status-bar'), import('@capacitor/keyboard')]);
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setOverlaysWebView({ overlay: true });
    Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => undefined);
  } catch {
    /* plugin missing on this platform */
  } finally {
    hideSplashBy(1500);
  }
};
