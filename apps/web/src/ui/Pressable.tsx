import { motion, useReducedMotion, type HTMLMotionProps } from 'motion/react';
import { forwardRef, type ReactNode } from 'react';
import { fireHaptic, type HapticEvent } from '@/lib/haptics';
import { PRESS_SCALE, springs } from '@/lib/motion';
import { useLongPress, type LongPressInfo } from './useLongPress';

type Base = {
  children?: ReactNode;
  /** The tap. Keyboard Enter and Space call it too. */
  onPress?: (e: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => void;
  /** A 450ms hold that moved less than 8px, a right-click, or Shift+F10 / the ContextMenu key. The tap that follows is swallowed. */
  onLongPress?: (info: LongPressInfo) => void;
  /** A named haptic fired with `onPress` (leave it off for taps that only navigate or open a sheet). */
  haptic?: HapticEvent;
  /** The scale while pressed. Default 0.97; pass 1 for no scale (a row in a list that shows its press with a background). */
  pressScale?: number;
  disabled?: boolean;
  /** Accessible name when the content does not say it (an icon). */
  label?: string;
  className?: string;
};
export type PressableProps = Base &
  (({ as?: 'button' } & Omit<HTMLMotionProps<'button'>, keyof Base | 'onClick' | 'ref'>) | ({ as: 'div' } & Omit<HTMLMotionProps<'div'>, keyof Base | 'onClick' | 'ref'>));

/**
 * The one way to make a thing pressable. A `motion.button` (or, with `as="div"`, a `div` with role="button", tabIndex and
 * Enter/Space) that scales to 0.97 on `springs.press` while held, fires an optional named `haptic` with `onPress`, and offers
 * `onLongPress` (450ms, cancelled by 8px of travel or a scroll; also right-click and Shift+F10). It replaces ad-hoc `whileTap`.
 * Under reduced motion it does not scale; the `:active` styles of its class still show the press. The hit area is the
 * element: give it at least 44px (the `.pressable` class sets a 44px minimum height).
 */
export const Pressable = forwardRef<HTMLElement, PressableProps>(function Pressable(props, ref) {
  const {
    as = 'button',
    children,
    onPress,
    onLongPress,
    haptic,
    pressScale = PRESS_SCALE,
    disabled,
    label,
    className = '',
    ...rest
  } = props as Base & { as?: 'button' | 'div' } & Record<string, unknown>;
  const reduce = useReducedMotion();
  const lp = useLongPress(onLongPress, { disabled });
  const press = (e: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => {
    if (disabled) return;
    fireHaptic(haptic);
    onPress?.(e);
  };
  const common = {
    ref: ref as never,
    className: `pressable ${className}`,
    'aria-label': label,
    whileTap: disabled || reduce || pressScale === 1 ? undefined : { scale: pressScale },
    transition: springs.press,
    ...lp.handlers,
    onClick: (e: React.MouseEvent<HTMLElement>) => press(e),
    ...rest,
  };
  if (as === 'div') {
    const onKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
      lp.handlers.onKeyDown(e);
      if (e.defaultPrevented || e.target !== e.currentTarget) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        press(e);
      }
    };
    return (
      <motion.div role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled || undefined} {...(common as HTMLMotionProps<'div'>)} onKeyDown={onKeyDown}>
        {children}
      </motion.div>
    );
  }
  return (
    <motion.button type="button" disabled={disabled} {...(common as HTMLMotionProps<'button'>)}>
      {children}
    </motion.button>
  );
});
