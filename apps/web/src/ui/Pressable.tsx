import type * as React from 'react';
import { forwardRef, useRef, type HTMLAttributes, type ReactNode } from 'react';
import { fireHaptic, type HapticEvent } from '@/lib/haptics';
import { useContextMenu, type ContextMenuItem } from './ContextMenu';
import { useHold, type DragPoint, type HoldInfo } from './useHold';
import { usePress } from './usePress';

/** scale: 0.97 (cards, pills, orbs, strip cells, chevron, tab items). surface: --surface-2 (rows). dim: opacity .55 (text verbs). */
export type PressStyle = 'scale' | 'surface' | 'dim' | 'none';

export interface PressableProps extends Omit<HTMLAttributes<HTMLElement>, 'onClick' | 'title' | 'onDragStart' | 'onDragEnd' | 'onDrag'> {
  children?: ReactNode;
  /** Fired from the element's click (and Enter/Space), never from useHold: Pressable passes no onPress to useHold, only its hold and drag callbacks. */
  onPress?: (e: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => void;
  /** 450 ms unmoved: lift + `haptics.lift()`; usually paired with `holdMenu`. Right-click / Shift+F10 open it at 0 ms. */
  onHold?: (info: HoldInfo) => void;
  /** ≤ 4 items, destructive last; opened on hold through the one ContextMenu. */
  holdMenu?: ContextMenuItem[] | (() => ContextMenuItem[]);
  menuLabel?: string;
  /**
   * With a holdMenu: render the visually hidden "… actions" button after this element, so VoiceOver and keyboard users reach
   * the same menu without a hold (a11y-08). Default true; false where another element already carries it (a second copy of
   * the same control).
   */
  menuButton?: boolean;
  /** A move > 8 px after the hold: the menu closes and the object follows the finger (orbs, steps, Plan rows). */
  onDragStart?: (p: DragPoint, e: PointerEvent) => void;
  onDragMove?: (p: DragPoint, e: PointerEvent) => void;
  onDragEnd?: (p: DragPoint, e: PointerEvent, cancelled: boolean) => void;
  /** Fired with onPress, in the handler (never 'orb'/'toggle': those fire at the visual peak, §D.3). */
  haptic?: HapticEvent;
  /** Pointers that start inside this selector, and the click they produce, are not this Pressable's (no press state, no hold clock, no onPress). The hero: '.hold-ring, [data-shared]'. */
  ignore?: string;
  /** Default 'scale'. */
  press?: PressStyle;
  disabled?: boolean;
  /** aria-label. */
  label?: string;
  as?: 'button' | 'div' | 'li';
  className?: string;
}

/**
 * The one way to make a thing pressable (docs/feel.md §11.1–11.2, contracts §C.2). A `<button>` (or, with `as="div" | "li"`,
 * an element with role="button", tabIndex and Enter/Space) whose press is CSS: `data-pressed` is written on pointerdown
 * (usePress) and `[data-pressed][data-press="scale"]` runs the 0.97 scale in over 120 ms, out over 160; `surface` rows show
 * `--surface-2`, `dim` verbs `opacity .55`. The hold is `useHold`: the 300 ms pre-grow, the 450 ms lift in place with
 * `haptics.lift()`, then `onHold` and the `holdMenu` (opened lifted on the real element under the menu's cut-out scrim);
 * a move after the hold closes the menu and, with `onDragStart`, hands the object to the finger. `onPress` comes from the
 * click, so the keyboard and VoiceOver reach it, and the click after a hold is swallowed. Give it ≥ 44 px (`.pressable`
 * sets a 44 px minimum height).
 */
export const Pressable = forwardRef<HTMLElement, PressableProps>(function Pressable(props, ref) {
  const {
    as = 'button',
    children,
    onPress,
    onHold,
    holdMenu,
    menuLabel,
    menuButton = true,
    onDragStart,
    onDragMove,
    onDragEnd,
    ignore,
    press,
    haptic,
    disabled,
    label,
    className = '',
    onPointerDown,
    onPointerUp,
    onPointerCancel,
    onPointerMove,
    onPointerLeave,
    onContextMenu,
    onKeyDown,
    onClickCapture,
    ...rest
  } = props;
  const menu = useContextMenu();
  const style: PressStyle = press ?? 'scale';
  const p = usePress({ disabled, ignore });
  // this Pressable's own menu is up (a drag or a move after the hold closes only that one)
  const ownMenu = useRef(false);
  const holdFn = onHold;
  const closeOwn = () => {
    if (ownMenu.current && menu.isOpen()) menu.close();
    ownMenu.current = false;
  };
  const h = useHold({
    disabled,
    ignore,
    onHold:
      holdFn || holdMenu
        ? (info) => {
            holdFn?.(info);
            const items = typeof holdMenu === 'function' ? holdMenu() : holdMenu;
            if (items?.length) {
              // the lift's haptic already fired with the hold (useHold); a keyboard open has none
              menu.open({ items, anchor: info.target, lift: info.target, label: menuLabel, haptic: false });
              ownMenu.current = true;
            }
          }
        : undefined,
    onDragStart: onDragStart
      ? (pt, e) => {
          closeOwn();
          onDragStart(pt, e);
        }
      : undefined,
    onDragMove,
    onDragEnd,
    onHoldMoved: closeOwn,
  });
  // the element itself, for the hidden menu button's anchor (the forwarded ref is the caller's)
  const self = useRef<HTMLElement | null>(null);
  const setRef = (el: HTMLElement | null) => {
    self.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) (ref as React.RefObject<HTMLElement | null>).current = el;
  };
  const items = () => (typeof holdMenu === 'function' ? holdMenu() : holdMenu) ?? [];
  const hidden = rest['aria-hidden'] === true || rest['aria-hidden'] === 'true';
  const srButton =
    holdMenu && menuButton && !disabled && !hidden ? (
      <button
        type="button"
        className="cm-sr"
        aria-haspopup="menu"
        onClick={(e) => {
          const el = self.current;
          const list = items();
          if (!el || !list.length) return;
          menu.open({ items: list, anchor: el, lift: el, label: menuLabel, returnFocus: e.currentTarget, haptic: false });
          ownMenu.current = true;
        }}
      >
        {menuLabel ?? (label ? `${label} actions` : 'Actions')}
      </button>
    ) : null;
  const ignored = (e: { target: EventTarget | null }) => !!ignore && e.target instanceof Element && !!e.target.closest(ignore);
  const fire = (e: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => {
    if (disabled) return;
    fireHaptic(haptic);
    onPress?.(e);
  };
  const common = {
    ...rest,
    ref: setRef as React.Ref<never>,
    className: `pressable ${className}`.trim(),
    'data-press': style === 'none' ? undefined : style,
    'aria-label': label,
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      p.handlers.onPointerDown?.(e);
      h.handlers.onPointerDown(e);
      onPointerDown?.(e);
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      p.handlers.onPointerMove?.(e);
      onPointerMove?.(e);
    },
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
      p.handlers.onPointerUp?.(e);
      onPointerUp?.(e);
    },
    onPointerCancel: (e: React.PointerEvent<HTMLElement>) => {
      p.handlers.onPointerCancel?.(e);
      onPointerCancel?.(e);
    },
    onPointerLeave: (e: React.PointerEvent<HTMLElement>) => {
      p.handlers.onPointerLeave?.(e);
      onPointerLeave?.(e);
    },
    onContextMenu: (e: React.MouseEvent<HTMLElement>) => {
      h.handlers.onContextMenu(e);
      onContextMenu?.(e);
    },
    onClickCapture: (e: React.MouseEvent<HTMLElement>) => {
      h.handlers.onClickCapture(e);
      onClickCapture?.(e);
    },
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      if (!ignored(e)) fire(e);
    },
  };
  if (as === 'div' || as === 'li') {
    const Tag = as as 'div';
    const el = (
      <Tag
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        {...(common as HTMLAttributes<HTMLElement>)}
        onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
          h.handlers.onKeyDown(e);
          onKeyDown?.(e);
          if (e.defaultPrevented || e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fire(e);
          }
        }}
      >
        {children}
      </Tag>
    );
    return srButton ? (
      <>
        {el}
        {srButton}
      </>
    ) : (
      el
    );
  }
  const btn = (
    <button
      type="button"
      disabled={disabled}
      {...(common as HTMLAttributes<HTMLButtonElement>)}
      onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
        h.handlers.onKeyDown(e);
        onKeyDown?.(e);
      }}
    >
      {children}
    </button>
  );
  // the hidden button follows as a sibling (absolutely positioned, so it takes no grid cell or line): no wrapper, so
  // the page's own child selectors still match the pressable
  return srButton ? (
    <>
      {btn}
      {srButton}
    </>
  ) : (
    btn
  );
});
