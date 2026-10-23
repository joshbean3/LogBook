import { useReducedMotion, type Transition, type Variants } from 'motion/react';

/**
 * The motion vocabulary (docs/feel.md §10, contracts §D.1). Eight springs, one sheet curve, one press tween, nothing else.
 *
 * Springs are written as Apple's duration + bounce and converted once, here: k = (2π/d)², c = 4π(1 − b)/d, mass 1. Every
 * spring rests at |Δ| ≤ 1 px and |v| ≤ 30 px/s (`restDelta: 1`, `restSpeed: 30`), so "rest" is the frame
 * `animationComplete` fires: a full-width page, push or pop from rest in ≈ 460 ms, a released swipe in 260–420 ms.
 * Only `transform` and `opacity` animate; tweens are for opacity and colour only.
 */
export const springFor = (duration: number, bounce: number): Transition => ({
  type: 'spring',
  stiffness: (2 * Math.PI / duration) ** 2,
  damping: (4 * Math.PI * (1 - bounce)) / duration,
  mass: 1,
  restDelta: 1,
  restSpeed: 30,
});

const named = {
  /** 0.35 s / 0 → 322 · 35.9: pager release and goTo, push, pop, the flyer, sheet push/pop inside a sheet. */
  page: springFor(0.35, 0),
  /** 0.35 s / 0.15 → 322 · 30.5: a pager or edge-swipe release that ended in a flick (|v| ≥ FLICK_V). */
  pageFlick: springFor(0.35, 0.15),
  /** 0.30 s / 0.10 → 439 · 37.7: swipe row home, drop into a slot, siblings reflowing, landing FLIP, segmented thumb, disc snap, ring → check. */
  settle: springFor(0.3, 0.1),
  /** 0.25 s / 0 → 632 · 50.3: the hold lift to 1.03. */
  lift: springFor(0.25, 0),
  /** 0.50 s / 0 → 158 · 25.1: detent snaps and spring-backs after a drag. */
  sheet: springFor(0.5, 0),
  /** 0.50 s / 0.10 → 158 · 22.6: a flick dismiss. */
  sheetFlick: springFor(0.5, 0.1),
  /** 0.48 s / 0 → 171 · 26.2: Ticker, the week ring fill. */
  number: springFor(0.48, 0),
  /** 0.30 s / 0.30 → 439 · 29.3: the one overshoot, an orb or a check to 1.12. */
  complete: springFor(0.3, 0.3),
};

/**
 * The eight springs. `press` is a deprecated alias of `settle` (contracts rule 5): it stays only while a feature file still
 * reads it, and is not one of the names (`SpringName`).
 */
export const springs: typeof named & {
  /** @deprecated the press is CSS now (`[data-pressed]`, 120 ms in / 160 ms out); this aliases `springs.settle`. */
  press: Transition;
} = {
  ...named,
  get press() {
    deprecated('springs.press');
    return named.settle;
  },
};
export type SpringName = keyof typeof named;

export const ease = [0.22, 1, 0.36, 1] as const;
/** Opacity in: header words, the inline title, the Today pill, toasts, the status line. */
export const fadeIn: Transition = { duration: 0.12, ease };
export const fadeOut: Transition = { duration: 0.1, ease };
/** 150 ms, opacity only: hero faces, Close card slots, Journal segments, the reduced-motion page change. */
export const crossfade: Transition = { duration: 0.15, ease };
/** 200 ms: Week ⇄ Month. */
export const crossfadeSlow: Transition = { duration: 0.2, ease };
/** 200 ms: halo, row surface, the alarm flash (× 2). */
export const colorTween: Transition = { duration: 0.2, ease };
/** Sheet open and close by tap / Escape / Back, on `sheetY`. */
export const sheetOpen: Transition = { duration: 0.5, ease: [0.32, 0.72, 0, 1] };
/** The context menu card: scale .94 → 1 + opacity. */
export const menuIn: Transition = { duration: 0.14, ease: [0.23, 1, 0.32, 1] };
/** What every x/y/z move becomes under reduced motion: a 150 ms fade. */
export const reducedFade: Transition = { duration: 0.15, ease: 'linear' };

export const PRESS_SCALE = 0.97;
export const PREHOLD_SCALE = 1.02;
export const LIFT_SCALE = 1.03;
export const COMPLETE_SCALE = 1.12;

/** The transition for a spring, given the reduced-motion setting. */
export const motionFor = (name: SpringName, reduce: boolean | null | undefined): Transition => (reduce ? reducedFade : named[name]);
/** `motionFor` as a hook: reads the user's reduced-motion setting. */
export const useMotionFor = (name: SpringName): Transition => motionFor(name, useReducedMotion());
/** True when the user asked for reduced motion (never null). */
export const useReduced = () => !!useReducedMotion();

// ---------- deprecated aliases (contracts rule 5): kept while a feature file imports them; WP1 deletes them after WP6 lands ----------
const seen = new Set<string>();
/** One dev console count per deprecated name, on its first use. */
export const deprecated = (name: string) => {
  if (!import.meta.env.DEV || seen.has(name)) return;
  seen.add(name);
  console.count(`deprecated: ${name}`);
};

/** @deprecated use `springs.settle`. */
export const spring: Transition = named.settle;
/** @deprecated use `springs.page`. */
export const springSoft: Transition = named.page;
/** @deprecated use `fadeIn` / `colorTween`. */
export const tween: Transition = { duration: 0.2, ease };
/** @deprecated a page arriving is a 0 ms cut now; opacity only. */
export const pageVariants: Variants = {
  initial: { opacity: 0 },
  enter: { opacity: 1, transition: fadeIn },
  exit: { opacity: 0, transition: fadeOut },
};
/** @deprecated lists do not stagger. */
export const listVariants: Variants = { hidden: {}, show: {} };
/** @deprecated lists do not stagger. */
export const itemVariants: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: fadeIn } };
/** @deprecated use `crossfade`. */
export const fadeVariants: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: fadeIn }, exit: { opacity: 0, transition: fadeOut } };
/**
 * @deprecated animates height (a FLIP is the rule now, §10.1); kept, behaviour unchanged, until the to-do and journal
 * lists that import it are rebuilt by their packages.
 */
export const rowPresence = {
  get initial() {
    deprecated('rowPresence');
    return { height: 0, opacity: 0 };
  },
  animate: { height: 'auto', opacity: 1, transition: { height: named.settle, opacity: fadeIn } },
  exit: { height: 0, opacity: 0, transition: { height: named.settle, opacity: fadeOut } },
} as const;
