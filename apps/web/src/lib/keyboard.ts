import { useSyncExternalStore } from 'react';
import { isNative } from './native';

/**
 * The keyboard as an inset (docs/feel.md §12, contracts §A.6). The WebView never resizes for it (`Keyboard.resize = 'none'`);
 * instead `--kb` on :root carries its height in px and `html.kb-open` is set while it is up. Consumers: a sheet's `bottom`,
 * the page's bottom padding, the tab bar (hidden). Native reads keyboardWillShow/Hide; the web reads visualViewport with a
 * 60 px hysteresis, so the browser chrome sliding in and out never counts as a keyboard.
 *
 * Because nothing resizes, a focused field has to be scrolled clear of the keyboard by the app. That is done here once,
 * for every text field: a focusin listener on the document reveals whatever takes focus, and again when the keyboard's
 * height arrives. A field that manages its own place opts out with `data-no-reveal` (on itself or an ancestor).
 */
const HYSTERESIS = 60;
let open = false;
let height = 0;
const subs = new Set<() => void>();

const set = (px: number) => {
  const h = Math.max(0, Math.round(px));
  const root = document.documentElement;
  root.style.setProperty('--kb', `${h}px`);
  const next = h > 0;
  const grew = h > height;
  height = h;
  if (next !== open) {
    open = next;
    root.classList.toggle('kb-open', next);
    for (const f of subs) f();
  }
  // the keyboard came up (or got taller) under a field that already had focus: its real height is known only now. The
  // short wait folds the steps of a keyboard that reports its height as it rises into one scroll.
  if (next && grew) revealFocused(80);
};

/** Something a person types into: a text-like input, a textarea, or an editable element. */
export const isTextField = (el: { tagName?: string; type?: string; isContentEditable?: boolean; readOnly?: boolean; disabled?: boolean } | null | undefined): boolean => {
  if (!el || el.disabled || el.readOnly) return false;
  const tag = (el.tagName ?? '').toUpperCase();
  if (tag === 'TEXTAREA') return true;
  if (tag === 'INPUT') return !/^(checkbox|radio|range|file|button|submit|reset|image|color|hidden)$/i.test(el.type ?? 'text');
  return el.isContentEditable === true;
};
const optedOut = (el: Element) => !!el.closest('[data-no-reveal]');
const revealFocused = (delay: number) => {
  const el = document.activeElement;
  if (el instanceof HTMLElement && isTextField(el as HTMLInputElement) && !optedOut(el)) revealField(el, delay);
};

let started = false;
/** Called once from main.tsx. */
export const startKeyboard = () => {
  if (started || typeof document === 'undefined') return;
  started = true;
  document.documentElement.style.setProperty('--kb', '0px');
  // every text field, wherever it is: no screen has to remember to call revealField
  document.addEventListener('focusin', (e) => {
    const el = e.target;
    if (el instanceof HTMLElement && isTextField(el as HTMLInputElement) && !optedOut(el)) revealField(el);
  });
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

/** The nearest ancestor that scrolls up and down: the app's own scrollers first, then anything with overflow. */
const scrollerOf = (el: HTMLElement): HTMLElement | null => {
  const known = el.closest<HTMLElement>('.sheet-body, .pushed, .tab-scroll');
  if (known) return known;
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
};

/**
 * The line a revealed field's bottom must stay above, 16 clear of whichever comes first: its scroller's own bottom, the
 * keyboard's top, or the top of a foot pinned over the scroller's last lines (a sheet's `.sheet-foot`: without it a field
 * just above the foot was "revealed" behind it).
 */
export const revealFloor = (scrollerBottom: number, viewport: number, kb: number, footTop: number | null): number => Math.min(scrollerBottom, viewport - kb, footTop ?? Infinity) - 16;

const pending = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
/**
 * Scroll a focused field (or the box around it) clear of the keyboard, after the keyboard's 250 ms, inside its scroller: a
 * tab, a pushed page, a sheet body, or any other scrolling ancestor. Called for every text field by the focusin listener
 * above; a screen may still call it for a larger box. A second call for the same element replaces the first.
 */
export const revealField = (el: HTMLElement, delay = 250) => {
  clearTimeout(pending.get(el));
  pending.set(
    el,
    setTimeout(() => {
      pending.delete(el);
      if (!el.isConnected) return;
      const scroller = scrollerOf(el);
      if (!scroller) return;
      const kb = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--kb')) || 0;
      const r = el.getBoundingClientRect();
      const s = scroller.getBoundingClientRect();
      // a sheet's pinned foot (not the one the field itself is in) sits over the body's last lines
      const foot = [...scroller.querySelectorAll<HTMLElement>('.sheet-foot')].find((f) => !f.contains(el) && getComputedStyle(f).position === 'sticky');
      const bottom = revealFloor(s.bottom, window.innerHeight, kb, foot ? foot.getBoundingClientRect().top : null);
      if (r.bottom > bottom) scroller.scrollBy({ top: r.bottom - bottom, behavior: 'smooth' });
      else if (r.top < s.top + 16) scroller.scrollBy({ top: r.top - s.top - 16, behavior: 'smooth' });
    }, delay),
  );
};
