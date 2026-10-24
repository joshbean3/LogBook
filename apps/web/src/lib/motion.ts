import { spring as motionSpring, useReducedMotion, type GeneratorFactory, type Transition, type ValueAnimationOptions, type Variants } from 'motion/react';

/**
 * The motion vocabulary (docs/feel.md §10, contracts §D.1). Eight springs, one sheet curve, one press tween, nothing else.
 *
 * Springs are written as Apple's duration + bounce and converted once, here: k = (2π/d)², c = 4π(1 − b)/d, mass 1. Every
 * spring rests at |Δ| ≤ 1 px and |v| ≤ 30 px/s (`restDelta: 1`, `restSpeed: 30`), so "rest" is the frame
 * `animationComplete` fires: a full-width page, push or pop from rest in ≈ 460 ms, a released swipe in 260–420 ms.
 * Only `transform` and `opacity` animate; tweens are for opacity and colour only.
 */
export const springFor = (duration: number, bounce: number): Transition => ({
  type: unitAware,
  stiffness: (2 * Math.PI / duration) ** 2,
  damping: (4 * Math.PI * (1 - bounce)) / duration,
  mass: 1,
  restDelta: PX_DELTA,
  restSpeed: PX_SPEED,
});
const PX_DELTA = 1;
const PX_SPEED = 30;
/**
 * motion's own spring, with one difference: the px rest thresholds (|Δ| ≤ 1, |v| ≤ 30) apply to px. A spring that travels
 * less than 5 units from where it starts is a unitless value (a scale, an opacity, a 0–1 fill): there they would end it on
 * its first frame, so it rests on scale thresholds instead (`forScale`'s), as motion's own default does for a span under 5.
 * So every use contracts §D.1 lists works as written: `animate(scale, LIFT_SCALE, springs.lift)`, a check 0 → 1 on
 * `springs.settle`, a ring fill on `springs.number` (consumer review 3 #3). Thresholds a caller sets itself (`forScale`,
 * `forRange`, a `restDelta` of its own) are kept as given; every px move runs exactly as before, frame for frame.
 */
const unitAware: GeneratorFactory = (o: ValueAnimationOptions) => {
  const k = o.keyframes as unknown[];
  const span = Math.abs(Number(k[k.length - 1]) - Number(k[0]));
  const px = o.restDelta === PX_DELTA && o.restSpeed === PX_SPEED;
  return motionSpring(px && span < 5 ? { ...o, restDelta: 0.0005, restSpeed: 0.01 } : o);
};
// the WAAPI path (an element's opacity or transform): motion turns the spring into a linear() easing over 0–100, as for its own
unitAware.applyToOptions = (motionSpring as GeneratorFactory).applyToOptions;

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
  /**
   * 0.30 s / 0.30 → 439 · 29.3: the one overshoot, an orb or a check to 1.12. Every use is a scale, so it carries scale rest
   * thresholds itself (`forScale`'s): animated as contracts §D.3 writes it, `animate(scale, 1.12, springs.complete)`, it
   * plays its overshoot instead of ending on its first frame (consumer review 2 #5). `forScale(springs.complete)` is the same.
   */
  complete: { ...springFor(0.3, 0.3), restDelta: 0.0005, restSpeed: 0.01 },
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

/**
 * A spring for a unitless value (a scale): the same stiffness and damping, with rest thresholds in scale units. The px
 * thresholds of `springFor` (|Δ| ≤ 1, |v| ≤ 30) would end a 1.00 → 1.03 lift on its first frame.
 */
export const forScale = (t: Transition): Transition => ({ ...t, restDelta: 0.0005, restSpeed: 0.01 });
/**
 * A spring for a value that travels `span` units (a Ticker's 6.2 miles, a ring's pathLength 0 → 1): the same stiffness and
 * damping, with the rest thresholds scaled to the travel (1/1000 of it, like motion's 0–1000 progress for a FLIP), so the
 * last frame snaps by a thousandth of the change, never by a whole unit (consumer review 1 #4).
 */
export const forRange = (t: Transition, span: number): Transition => {
  const u = Math.max(1e-6, Math.abs(span)) / 1000;
  return { ...t, restDelta: u, restSpeed: 30 * u };
};

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
