import { animate, useMotionValue, type MotionValue, type PanInfo } from 'motion/react';
import { useRef, type RefObject } from 'react';
import { haptics } from '@/lib/haptics';
import { springs, useReduced } from '@/lib/motion';

/** How far (px) or how fast (px/s) a card must travel sideways for a swipe to count. */
export const SHUFFLE_DISTANCE = 56;
export const SHUFFLE_VELOCITY = 500;

/**
 * Swipe a card sideways to shuffle it (the quote line, the memory card): it follows the finger with some resistance, a release
 * past 56px or a fling commits with `haptics.select()`, and it springs home on `springs.settle` either way while the new
 * content slides in. A vertical scroll always wins (direction lock), and the tap that ends a swipe is swallowed.
 * Every swipe has a ContextMenu twin ("Another quote"), so the gesture is never the only way.
 */
export const useCardSwipe = (onCommit: (dir: -1 | 1) => void, enabled = true) => {
  const x = useMotionValue(0);
  const reduce = useReduced();
  const moved = useRef(false);
  const props = enabled
    ? {
        drag: 'x' as const,
        dragDirectionLock: true,
        dragConstraints: { left: 0, right: 0 },
        dragElastic: reduce ? 0.2 : 0.45,
        dragSnapToOrigin: true,
        // springs.settle (450 / 34), in drag's own terms
        dragTransition: { bounceStiffness: 450, bounceDamping: 34 },
        style: { x, touchAction: 'pan-y' as const },
        onDragStart: () => {
          moved.current = true;
        },
        onDragEnd: (_e: unknown, info: PanInfo) => {
          const d = info.offset.x;
          if (Math.abs(d) > SHUFFLE_DISTANCE || Math.abs(info.velocity.x) > SHUFFLE_VELOCITY) {
            haptics.select();
            onCommit(d < 0 ? 1 : -1);
          }
          setTimeout(() => (moved.current = false), 60);
        },
      }
    : { style: { x } };
  /** On the card: a click that ends a swipe is not a tap. */
  const onClickCapture = (e: React.MouseEvent) => {
    if (!moved.current) return;
    e.preventDefault();
    e.stopPropagation();
  };
  return { x, props, onClickCapture };
};

/**
 * The shuffle's slide, as a pager: the card that was swiped keeps going and leaves in the swipe's direction (from wherever
 * the finger let go), and only once it is gone does the next one come in from the other side. The two never overlap and
 * nothing cross-dissolves. `x` is the card's drag value (from `useCardSwipe`), `ref` the card (for its width).
 * Reduced motion: no travel; the caller fades the new content in.
 */
export const useSlideSwap = (x: MotionValue<number>, ref: RefObject<HTMLElement | null>) => {
  const reduce = useReduced();
  const width = () => (ref.current?.getBoundingClientRect().width ?? 320) + 32;
  return {
    /** Send the current card off the side it was swiped to (`dir` 1 = it leaves to the left). Resolves when it is gone. */
    out: (dir: -1 | 1): Promise<void> => (reduce ? Promise.resolve() : new Promise<void>((done) => void animate(x, -dir * width(), { ...springs.settle, restDelta: 2, onComplete: done }))),
    /** Bring the next card in from the other side. */
    in: (dir: -1 | 1) => {
      if (reduce) return x.jump(0);
      x.jump(dir * width());
      void animate(x, 0, springs.page);
    },
    /** Nothing new came: the card comes home. */
    back: () => void animate(x, 0, reduce ? { duration: 0 } : springs.settle),
  };
};

/** Content that slides in from the side a swipe sent it (`custom` = direction), opacity only under reduced motion. */
export const slideVariants = (reduce: boolean) => ({
  enter: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: d * 48 }),
  center: { opacity: 1, x: 0 },
  exit: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: d * -48 }),
});

/** A one-time teaching cue, counted in localStorage: true for the first `times` views, until `done()` is called. */
export const hintKey = (k: string) => `logbook.hint.${k}`;
export const readHint = (k: string, times = 3) => {
  try {
    const n = Number(localStorage.getItem(hintKey(k)) ?? '0');
    return n < times;
  } catch {
    return false;
  }
};
export const bumpHint = (k: string, to?: number) => {
  try {
    const n = Number(localStorage.getItem(hintKey(k)) ?? '0');
    localStorage.setItem(hintKey(k), String(to ?? n + 1));
  } catch {
    /* private mode: the hint shows again next time */
  }
};
