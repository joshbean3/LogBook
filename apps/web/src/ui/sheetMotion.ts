import { motionValue, type MotionValue } from 'motion/react';
import { useSyncExternalStore } from 'react';

/**
 * The sheet's motion, as a module store (docs/feel.md §9.4, contracts §C.1): one sheet is up at a time, and the toast host
 * sits ABOVE SheetProvider, so `sheetY` cannot live in a provider's context. SheetProvider is the only writer.
 */
export interface SheetMotion {
  /** px from the detent's top: 0 at rest, H off screen. The ONLY owner of the sheet's motion; toasts read it for placement. */
  sheetY: MotionValue<number>;
  /** The sheet's current height in px (changes at a detent snap). */
  height: MotionValue<number>;
  open: boolean;
}

/*
 * H and the top safe inset change only with the window (a rotation, a resize): they are read once and kept until a `resize`.
 * Read live, each forced the layout of a sheet being mounted inside the open's first frame (25 ms of 70 at 4×, feel review 1
 * #5); with Keyboard.resize 'none' the keyboard never changes them.
 */
let cachedH: number | null = null;
let cachedSafeT: number | null = null;
if (typeof window !== 'undefined')
  window.addEventListener('resize', () => {
    cachedH = null;
    cachedSafeT = null;
  });
/** H: the `.shell` height (innerHeight): the sheet is portalled to body and covers the tab bar. */
export const sheetH = () => (typeof window === 'undefined' ? 844 : (cachedH ??= window.innerHeight));

let current: SheetMotion = { sheetY: motionValue(sheetH()), height: motionValue(0), open: false };
// test hook (dev and fake-clock builds), like window.__nav
if (typeof window !== 'undefined' && (import.meta.env.DEV || import.meta.env.VITE_FAKE_CLOCK)) (window as unknown as { __sheetMotion?: () => SheetMotion }).__sheetMotion = () => current;
const subs = new Set<() => void>();

/** SheetProvider only: mark the sheet up or down (the motion values stay the same objects). */
export const setSheetOpen = (open: boolean) => {
  if (current.open === open) return;
  current = { ...current, open };
  for (const f of subs) f();
};
/** SheetProvider only: the store's motion values, to animate. */
export const sheetMotion = () => current;

const subscribe = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};
/** Reads the module store; works anywhere, provider or not. */
export const useSheetMotion = (): SheetMotion => useSyncExternalStore(subscribe, sheetMotion, sheetMotion);

/** The top safe-area inset in px (a custom property is not resolved by getComputedStyle, so a probe measures it). */
let probe: HTMLDivElement | null = null;
export const safeTopPx = () => {
  if (typeof document === 'undefined') return 0;
  if (!probe) {
    probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:var(--safe-t, 0px);visibility:hidden;pointer-events:none';
    document.body.appendChild(probe);
  }
  return (cachedSafeT ??= probe.offsetHeight);
};
