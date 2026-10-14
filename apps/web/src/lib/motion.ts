import { useReducedMotion, type Transition, type Variants } from 'motion/react';

/**
 * The house motion vocabulary (docs/experience.md §3.2, docs/foundation.md "Motion").
 *
 * Springs for anything that moves, tweens only for things that do not (opacity, colour). Layout springs sit at a
 * damping ratio of 0.85 or more, so they never visibly bounce; only `complete` overshoots, once, for a check or an orb.
 */
export const ease = [0.22, 1, 0.36, 1] as const;

export const springs = {
  /** A press: scale 0.97 on down, 1 on up. ~150ms. */
  press: { type: 'spring', stiffness: 600, damping: 35, mass: 0.6 },
  /** A long-press pick-up to scale 1.03 (ContextMenu, drag lift). */
  lift: { type: 'spring', stiffness: 500, damping: 30, mass: 0.8 },
  /** A drop into a slot, a swipe springing back, siblings reflowing, a list row inserting. */
  settle: { type: 'spring', stiffness: 450, damping: 34, mass: 1 },
  /** Sheets and detents. ~320ms, inherits drag velocity. */
  sheet: { type: 'spring', stiffness: 380, damping: 38, mass: 1 },
  /** Pushed pages, the date pager, sheet push/pop, shared elements. ~360ms. */
  page: { type: 'spring', stiffness: 300, damping: 32, mass: 1 },
  /** Numbers (Ticker) and the week ring fill. ~480ms, no overshoot. */
  number: { type: 'spring', stiffness: 170, damping: 26, mass: 1 },
  /** The one overshoot: a check or an orb popping to 1.12. Completion only. */
  complete: { type: 'spring', stiffness: 500, damping: 18, mass: 0.8 },
} as const satisfies Record<string, Transition>;
export type SpringName = keyof typeof springs;

/** Opacity tweens: 120ms in, 100ms out. Colour and halo: 200ms on `ease`. Never ease-in. */
export const fadeIn: Transition = { duration: 0.12, ease };
export const fadeOut: Transition = { duration: 0.1, ease };
export const colorTween: Transition = { duration: 0.2, ease };

/** What every spring becomes under reduced motion: a 150ms opacity fade. */
export const reducedFade: Transition = { duration: 0.15, ease: 'linear' };
/** The press and lift scales, so nobody types a fifth number. */
export const PRESS_SCALE = 0.97;
export const LIFT_SCALE = 1.03;
export const COMPLETE_SCALE = 1.12;

/** The transition to use for a preset, given the reduced-motion setting. */
export const motionFor = (name: SpringName, reduce: boolean | null | undefined): Transition => (reduce ? reducedFade : springs[name]);
/** `motionFor` as a hook: reads the user's reduced-motion setting. */
export const useMotionFor = (name: SpringName): Transition => motionFor(name, useReducedMotion());
/** True when the user asked for reduced motion (never null). */
export const useReduced = () => !!useReducedMotion();

/**
 * @deprecated use `springs.press` (taps) or `springs.settle` (layout). Kept so old imports compile.
 */
export const spring: Transition = springs.press;
/** @deprecated use `springs.page`. */
export const springSoft: Transition = springs.page;
/** @deprecated use `fadeIn` / `colorTween`. */
export const tween: Transition = { duration: 0.2, ease };

/** A page arriving: opacity only, 120ms in, 100ms out. No y offset: tab switches are a cut with a fade. */
export const pageVariants: Variants = {
  initial: { opacity: 0 },
  enter: { opacity: 1, transition: fadeIn },
  exit: { opacity: 0, transition: fadeOut },
};

/** Lists do not stagger on revisit. These stay so old imports compile; children simply fade in together. */
export const listVariants: Variants = {
  hidden: {},
  show: {},
};
export const itemVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: fadeIn },
};

export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: fadeIn },
  exit: { opacity: 0, transition: fadeOut },
};

/** A row entering a list (height 0 → auto plus a fade) and leaving it (collapse). Use with AnimatePresence + `layout`. */
export const rowPresence = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto', opacity: 1, transition: { height: springs.settle, opacity: fadeIn } },
  exit: { height: 0, opacity: 0, transition: { height: springs.settle, opacity: fadeOut } },
} as const;
