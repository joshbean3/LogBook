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
  const go = () => registerSW({ immediate: true });
  if ('requestIdleCallback' in window) (window as Window & { requestIdleCallback: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback(go, { timeout: 4000 });
  else setTimeout(go, 1500);
};
