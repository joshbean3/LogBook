import { registerSW } from 'virtual:pwa-register';
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
  /**
   * A new build waits (registerType: 'prompt', vite.config.ts) and is applied only when nobody is looking (shell-25): the
   * next time the page is hidden it takes over and the page reloads behind the app switcher, or on the next cold start,
   * when the waiting worker activates by itself. Never mid-use.
   */
  let waiting: ((reload?: boolean) => Promise<void>) | null = null;
  const applyIfHidden = () => {
    if (document.hidden && waiting) void waiting(true);
  };
  document.addEventListener('visibilitychange', applyIfHidden);
  const go = () => {
    const update = registerSW({
      immediate: true,
      onNeedRefresh: () => {
        waiting = update;
        applyIfHidden();
      },
    });
  };
  if ('requestIdleCallback' in window) (window as Window & { requestIdleCallback: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback(go, { timeout: 4000 });
  else setTimeout(go, 1500);
};
