import { useSyncExternalStore } from 'react';
import { isNative } from './native';

/**
 * The keyboard as an inset (docs/feel.md §12, contracts §A.6). The WebView never resizes for it (`Keyboard.resize = 'none'`);
 * instead `--kb` on :root carries its height in px and `html.kb-open` is set while it is up. Consumers: a sheet's `bottom`,
 * the page's bottom padding, the tab bar (hidden). Native reads keyboardWillShow/Hide; the web reads visualViewport with a
 * 60 px hysteresis, so the browser chrome sliding in and out never counts as a keyboard.
 */
const HYSTERESIS = 60;
let open = false;
const subs = new Set<() => void>();

const set = (px: number) => {
  const h = Math.max(0, Math.round(px));
  const root = document.documentElement;
  root.style.setProperty('--kb', `${h}px`);
  const next = h > 0;
  if (next !== open) {
    open = next;
    root.classList.toggle('kb-open', next);
    for (const f of subs) f();
  }
};

let started = false;
/** Called once from main.tsx. */
export const startKeyboard = () => {
  if (started || typeof document === 'undefined') return;
  started = true;
  document.documentElement.style.setProperty('--kb', '0px');
  if (isNative) {
    void import('@capacitor/keyboard')
      .then(({ Keyboard }) => {
        void Keyboard.addListener('keyboardWillShow', (info) => set(info.keyboardHeight));
        void Keyboard.addListener('keyboardWillHide', () => set(0));
      })
      .catch(() => undefined);
    return;
  }
  const vv = window.visualViewport;
  if (!vv) return;
  const read = () => {
    // the layout viewport stays put (nothing resizes); what the visual viewport lost at the bottom is the keyboard
    const lost = window.innerHeight - vv.height - vv.offsetTop;
    if (lost > HYSTERESIS) set(lost);
    else if (open || lost <= 0) set(0);
  };
  vv.addEventListener('resize', read);
  vv.addEventListener('scroll', read);
};

const subscribe = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};
export const useKeyboardOpen = () => useSyncExternalStore(subscribe, () => open, () => false);

/** Scroll a focused field into view after the keyboard's 250 ms, inside the nearest .tab-scroll / .pushed / .sheet-body. */
export const revealField = (el: HTMLElement) => {
  setTimeout(() => {
    const scroller = el.closest<HTMLElement>('.sheet-body, .pushed, .tab-scroll');
    if (!scroller) return;
    const kb = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--kb')) || 0;
    const r = el.getBoundingClientRect();
    const s = scroller.getBoundingClientRect();
    const bottom = Math.min(s.bottom, window.innerHeight - kb) - 16;
    if (r.bottom > bottom) scroller.scrollBy({ top: r.bottom - bottom, behavior: 'smooth' });
    else if (r.top < s.top + 16) scroller.scrollBy({ top: r.top - s.top - 16, behavior: 'smooth' });
  }, 250);
};
