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

const H = () => (typeof window === 'undefined' ? 844 : window.innerHeight);
let current: SheetMotion = { sheetY: motionValue(H()), height: motionValue(0), open: false };
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
