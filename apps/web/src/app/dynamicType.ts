import { isNative } from '@/lib/native';

/**
 * Dynamic Type. iOS exposes the text size it is set to through the `-apple-system-body` font keyword: at the default
 * setting it is 17px, and it grows and shrinks with Settings > Display & Text Size. The app's type scale is in rem off a
 * 16px root, so the root is scaled by the same factor and every size follows, while the brand's pixel scale holds at 100%.
 * Anywhere else (Android, desktop, a browser that does not know the keyword) the probe reads 17px and nothing changes.
 */
const BASE = 17;
/**
 * The scale the layout is built and tested for: never smaller than the brand's own sizes (the smallest iOS settings would
 * take captions under 10 px), and no larger than 200% (iOS's largest accessibility sizes ask for up to 310%; past 200% the
 * pages no longer hold a phone's width).
 */
export const MIN_FACTOR = 1;
export const MAX_FACTOR = 2;
export const clampFactor = (f: number): number => (Number.isFinite(f) ? Math.min(MAX_FACTOR, Math.max(MIN_FACTOR, f)) : 1);
/** Above this the dock drops its tab words and keeps the icons (shell.css reads `html[data-text-xl]`). */
export const XL_FACTOR = 1.5;
let probe: HTMLSpanElement | null = null;
let applied = '';

/** iOS and iPadOS only: macOS Safari also knows the keyword (at 13pt) and would shrink the app. */
const isIOS = () => {
  if (isNative) return true;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  // an iPad that asks for the desktop site reports itself as a Mac with a touch screen
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
};

const measure = () => {
  if (!probe) {
    probe = document.createElement('span');
    probe.setAttribute('aria-hidden', 'true');
    probe.textContent = 'M';
    Object.assign(probe.style, { position: 'absolute', visibility: 'hidden', pointerEvents: 'none', left: '-9999px', top: '0', font: `${BASE}px/1 sans-serif` });
    // the keyword, if the engine knows it, replaces the fallback font above; if it does not, the fallback stays
    probe.style.font = '-apple-system-body';
    if (!probe.style.font) probe.style.font = `${BASE}px/1 sans-serif`;
    document.body.appendChild(probe);
  }
  const px = parseFloat(getComputedStyle(probe).fontSize);
  return Number.isFinite(px) && px > 0 ? px : BASE;
};

/**
 * Tell the stylesheets when text is very large, whatever made it so (the iOS setting above, or a browser's own default
 * size): the root's computed size over 16 px. The dock is fixed chrome and reads this to drop its tab words.
 */
const markTextSize = () => {
  const root = document.documentElement;
  const px = parseFloat(getComputedStyle(root).fontSize);
  const xl = Number.isFinite(px) && px / 16 > XL_FACTOR + 0.005;
  if (xl) root.setAttribute('data-text-xl', '');
  else root.removeAttribute('data-text-xl');
};

export const applyDynamicType = () => {
  try {
    if (isIOS()) {
      const px = measure();
      const factor = clampFactor(px / BASE);
      const next = Math.abs(factor - 1) < 0.01 ? '' : `${Math.round(factor * 1000) / 10}%`;
      if (next !== applied) {
        applied = next;
        document.documentElement.style.fontSize = next;
      }
    }
    markTextSize();
  } catch {
    /* no probe, no scaling */
  }
};

/** Apply now, and again whenever the text size could have changed: a return to the app, a layout change. Returns the stop function. */
export const watchDynamicType = () => {
  applyDynamicType();
  const onVisible = () => !document.hidden && applyDynamicType();
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('resize', applyDynamicType);
  window.addEventListener('focus', applyDynamicType);
  return () => {
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('resize', applyDynamicType);
    window.removeEventListener('focus', applyDynamicType);
  };
};
