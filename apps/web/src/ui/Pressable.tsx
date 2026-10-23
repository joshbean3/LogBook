import { motion, useReducedMotion, type HTMLMotionProps } from 'motion/react';
import { forwardRef, type ReactNode } from 'react';
import { fireHaptic, type HapticEvent } from '@/lib/haptics';
import { deprecated, PRESS_SCALE, springs } from '@/lib/motion';
import { useContextMenu, type ContextMenuItem } from './ContextMenu';
import type { DragPoint, HoldInfo } from './useHold';
import { useLongPress, type LongPressInfo } from './useLongPress';

/** scale: 0.97 (cards, pills, orbs, strip cells, chevron, tab items). surface: --surface-2 (rows). dim: opacity .55 (text verbs). */
export type PressStyle = 'scale' | 'surface' | 'dim' | 'none';

type Base = {
  children?: ReactNode;
  /** The tap. Keyboard Enter and Space call it too. */
  onPress?: (e: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => void;
  /** @deprecated use `onHold` (contracts rule 5: mapped to it). */
  onLongPress?: (info: LongPressInfo) => void;
  /** 450 ms unmoved: lift + `haptics.lift()`; usually paired with `holdMenu`. Right-click / Shift+F10 open it at 0 ms. */
  onHold?: (info: HoldInfo) => void;
  /** ≤ 4 items, destructive last; opened on hold through the one ContextMenu. */
  holdMenu?: ContextMenuItem[] | (() => ContextMenuItem[]);
  menuLabel?: string;
  /** A move > 8 px after the hold: the object follows the finger. (Wired in WP1's next step.) */
  onDragStart?: (p: DragPoint, e: PointerEvent) => void;
  onDragMove?: (p: DragPoint, e: PointerEvent) => void;
  onDragEnd?: (p: DragPoint, e: PointerEvent, cancelled: boolean) => void;
  /** Pointers that start inside this selector, and the click they produce, are not this Pressable's. */
  ignore?: string;
  press?: PressStyle;
  /** A named haptic fired with `onPress` (leave it off for taps that only navigate or open a sheet). */
  haptic?: HapticEvent;
  /** @deprecated accepted and ignored by the final Pressable (use `press`); kept working until WP1's next step. */
  pressScale?: number;
  disabled?: boolean;
  /** Accessible name when the content does not say it (an icon). */
  label?: string;
  className?: string;
};
export type PressableProps = Base &
  (({ as?: 'button' } & Omit<HTMLMotionProps<'button'>, keyof Base | 'onClick' | 'ref' | 'onDrag'>) | ({ as: 'div' | 'li' } & Omit<HTMLMotionProps<'div'>, keyof Base | 'onClick' | 'ref' | 'onDrag'>));

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
    onHold,
    holdMenu,
    menuLabel,
    onDragStart: _ds,
    onDragMove: _dm,
    onDragEnd: _de,
    ignore,
    press: _press,
    haptic,
    pressScale = PRESS_SCALE,
    disabled,
    label,
    className = '',
    ...rest
  } = props as Base & { as?: 'button' | 'div' | 'li' } & Record<string, unknown>;
  const reduce = useReducedMotion();
  const menu = useContextMenu();
  if (onLongPress) deprecated('Pressable onLongPress');
  if (pressScale !== PRESS_SCALE) deprecated('Pressable pressScale');
  const hold =
    onHold || onLongPress || holdMenu
      ? (info: LongPressInfo) => {
          (onHold ?? onLongPress)?.(info);
          const items = typeof holdMenu === 'function' ? holdMenu() : holdMenu;
          if (items?.length) menu.open({ items, anchor: info.target, label: menuLabel });
        }
      : undefined;
  const lp = useLongPress(hold, { disabled });
  const ignored = (e: { target: EventTarget | null }) => !!ignore && e.target instanceof Element && !!e.target.closest(ignore);
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
    transition: springs.settle,
    ...lp.handlers,
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => !ignored(e) && lp.handlers.onPointerDown(e),
    onClick: (e: React.MouseEvent<HTMLElement>) => !ignored(e) && press(e),
    ...rest,
  };
  if (as === 'div' || as === 'li') {
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
