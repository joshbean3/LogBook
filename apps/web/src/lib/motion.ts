import type { Transition, Variants } from 'motion/react';

/** The house motion vocabulary. Soft, quick, never bouncy for layout; a little spring for things you tap. */
export const ease = [0.22, 1, 0.36, 1] as const;

export const spring: Transition = { type: 'spring', stiffness: 420, damping: 32, mass: 0.8 };
export const springSoft: Transition = { type: 'spring', stiffness: 260, damping: 30 };
export const tween: Transition = { duration: 0.26, ease };

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 10 },
  enter: { opacity: 1, y: 0, transition: { duration: 0.3, ease } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.16, ease } },
};

export const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035, delayChildren: 0.02 } },
};
export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease } },
};

export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.14 } },
};
