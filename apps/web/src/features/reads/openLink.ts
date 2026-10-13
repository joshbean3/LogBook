import { useCallback, useEffect, useRef } from 'react';
import { isNative } from '@/lib/native';

/** Open a link: the in-app browser in the iOS app, a new tab on the web. */
export const openLink = async (url: string) => {
  if (isNative) {
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url, presentationStyle: 'popover' });
      return;
    } catch {
      /* plugin missing: fall through to the window */
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
};

/**
 * Open a link and run `onBack` once the athlete comes back from it: when the in-app browser closes, or this page
 * regains focus. A link that opened without taking the page away (a background tab on a desktop) counts as read after a moment.
 */
export const useOpenLink = () => {
  const pending = useRef<{ onBack: () => void; left: boolean; timer: ReturnType<typeof setTimeout> } | null>(null);
  const clear = useCallback(() => {
    if (pending.current) clearTimeout(pending.current.timer);
    pending.current = null;
  }, []);
  const fire = useCallback(() => {
    const p = pending.current;
    if (!p) return;
    clear();
    p.onBack();
  }, [clear]);
  useEffect(() => {
    const away = () => {
      if (pending.current) pending.current.left = true;
    };
    const back = () => {
      if (pending.current?.left && document.visibilityState === 'visible') fire();
    };
    const vis = () => (document.visibilityState === 'hidden' ? away() : back());
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('blur', away);
    window.addEventListener('focus', back);
    window.addEventListener('pagehide', away);
    window.addEventListener('pageshow', back);
    let off: (() => void) | undefined;
    if (isNative) {
      void import('@capacitor/browser').then(({ Browser }) => Browser.addListener('browserFinished', fire).then((h) => (off = () => void h.remove())).catch(() => undefined));
    }
    return () => {
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('blur', away);
      window.removeEventListener('focus', back);
      window.removeEventListener('pagehide', away);
      window.removeEventListener('pageshow', back);
      off?.();
      clear();
    };
  }, [fire, clear]);
  /** For an `<a target="_blank">`: lets the browser follow the link on the web, opens the in-app browser in the app. */
  return useCallback(
    (url: string, onBack?: () => void) => (e: React.MouseEvent) => {
      if (e.defaultPrevented) return;
      clear();
      if (onBack) {
        const timer = setTimeout(() => {
          // nothing took the page away: the link opened beside us, so count it now
          if (pending.current && !pending.current.left) fire();
        }, 1500);
        pending.current = { onBack, left: false, timer };
      }
      if (isNative) {
        e.preventDefault();
        void openLink(url);
      }
    },
    [clear, fire],
  );
};
