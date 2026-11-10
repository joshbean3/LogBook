import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { matchRoute, resolveRoute } from '@/ui/nav';
import { DEFAULT_API_ORIGIN } from './apiOriginDefault';
import { DEV_TOOLS, STRAVA_BUILT } from './features';

/** True inside the iOS app; false in Safari and on the desktop. */
export const isNative = Capacitor.isNativePlatform();

/** Where the API lives. In the browser it is the same origin; the app talks to your server. */
export const apiOrigin = isNative ? ((import.meta.env.VITE_API_ORIGIN as string | undefined) || DEFAULT_API_ORIGIN) : '';

/**
 * The in-app path a logbook:// link may open, or null. Any app or web page can open the scheme, so a link is honoured only
 * when it names a real page of the signed-in app (a tab root or a pushed page in ui/nav.ts's table, after its redirects):
 * never a sign-in screen, first run, or a path the table does not know. The query string is dropped, except the one the
 * account connection returns with in builds that have it.
 */
export const deepLinkPath = (url: string): string | null => {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'logbook:') return null;
  const raw = `/${u.host}${u.pathname}`.replace(/\/+$/, '') || '/today';
  // the table's catch-all sends unknown paths to Today: a link has to name a page the table knows
  const named = matchRoute(raw).route;
  if (!named || named.pattern === '*') return null;
  const m = resolveRoute(raw);
  if (m.kind !== 'root' && m.kind !== 'pushed') return null;
  if (STRAVA_BUILT && m.path === '/settings') {
    const flag = u.searchParams.get('strava');
    if (flag && /^(connected|denied|error)$/.test(flag)) return `${m.path}?strava=${flag}`;
  }
  return m.path;
};

/** Deep links (logbook://goals) become in-app navigations; anything off the allow-list is ignored. */
export const onDeepLink = async (go: (path: string) => void) => {
  if (!isNative) return;
  try {
    const { App } = await import('@capacitor/app');
    await App.addListener('appUrlOpen', ({ url }) => {
      const path = deepLinkPath(url);
      if (!path) return;
      void import('@capacitor/browser').then(({ Browser }) => Browser.close().catch(() => undefined));
      go(path);
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
/** Fired once, when the first screen has painted and the splash may go. */
export const SPLASH_DONE = 'logbook:splash-done';
export const isSplashDone = () => splashHidden;
export const hideSplash = () => {
  if (splashHidden) return;
  splashHidden = true;
  try {
    if (DEV_TOOLS) {
      // test hooks: how many times, and when (the splash is native; on the web this is all there is to see)
      const w = window as Window & { __splashHides?: number; __splashAt?: number };
      w.__splashHides = (w.__splashHides ?? 0) + 1;
      w.__splashAt = performance.now();
    }
    // the brand splash (app/BrandSplash.tsx) dissolves on the same beat
    window.dispatchEvent(new CustomEvent(SPLASH_DONE));
  } catch {
    /* no window */
  }
  if (!isNative) return;
  void import('@capacitor/splash-screen')
    .then(({ SplashScreen }) => SplashScreen.hide({ fadeOutDuration: 200 }))
    .catch(() => undefined);
};
/** A screen outside the framed app (welcome, sign in, first run) is up: let the splash go once it has painted. */
export const useSplashDoneOnPaint = () =>
  useEffect(() => {
    const r = requestAnimationFrame(hideSplash);
    return () => cancelAnimationFrame(r);
  }, []);
/** A cap: hide the splash after `ms` if nothing hid it first. */
export const hideSplashBy = (ms: number) => void setTimeout(hideSplash, ms);

/**
 * The status bar's glyphs follow what is behind them (shell-10): dark on the light canvas, light while a sheet is up, when
 * the page recedes and the band behind the clock is navy. Capacitor's names are the background's: Style.Light is dark
 * glyphs, Style.Dark light ones. The last call wins, so a quick open and close cannot leave the wrong one.
 */
let barSeq = 0;
export const statusBarOverSheet = (sheetUp: boolean) => {
  if (!isNative) return;
  const seq = ++barSeq;
  void import('@capacitor/status-bar')
    .then(({ StatusBar, Style }) => (seq === barSeq ? StatusBar.setStyle({ style: sheetUp ? Style.Dark : Style.Light }) : undefined))
    .catch(() => undefined);
};

/** One-time native setup: status bar over the canvas, no keyboard accessory, the splash's 1500 ms hard cap. */
export const bootNative = async () => {
  if (!isNative) return;
  // the cap is armed before anything is awaited: a plugin that never answers cannot leave the splash over the app
  hideSplashBy(1500);
  try {
    const [{ StatusBar, Style }, { Keyboard }] = await Promise.all([import('@capacitor/status-bar'), import('@capacitor/keyboard')]);
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setOverlaysWebView({ overlay: true });
    Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => undefined);
  } catch {
    /* plugin missing on this platform */
  }
};
