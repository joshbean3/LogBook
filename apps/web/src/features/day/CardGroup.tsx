import type * as React from 'react';
import { forwardRef, useRef, type HTMLAttributes, type ReactNode } from 'react';
import { useContextMenu, type ContextMenuItem } from '@/ui/ContextMenu';
import type { PressStyle } from '@/ui/Pressable';
import { useHold, type HoldInfo } from '@/ui/useHold';
import { usePress } from '@/ui/usePress';

export interface CardGroupProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  children?: ReactNode;
  /** The group's accessible name: what the card is about ("Easy 5, Today"). */
  label: string;
  /** The press under the finger (as Pressable's). 'none': the card does nothing on a tap. */
  press?: PressStyle;
  /** Pointers that start inside this selector are the inner control's: no press state, no hold clock. */
  ignore?: string;
  /** 450 ms unmoved: the card lifts. */
  onHold?: (info: HoldInfo) => void;
  /** ≤ 4 items, opened on the hold; also behind a hidden "… actions" button for VoiceOver and the keyboard. */
  holdMenu?: ContextMenuItem[] | (() => ContextMenuItem[]);
  menuLabel?: string;
}

/**
 * A card whose whole surface answers a touch but which is not itself a control (a11y-07, today-top-03): `role="group"` with
 * a name, never `role="button"`. A button role makes everything inside it presentational to assistive tech, so the hold
 * ring, the Morning / Afternoon / No time switch and the week pill inside the old one-big-button card could not be reached
 * with VoiceOver. Here:
 *
 * - the press (`data-pressed`, the 0.97 scale or the row surface) and the hold (the 450 ms lift, the hold menu) stay on the
 *   card, from the same hooks Pressable uses, so the card feels as it did;
 * - what a tap does is a real `<button>` inside it (`CardOpen`: the title, with a hit layer stretched over the card), so the
 *   keyboard and VoiceOver have one honest "Open" control and every other control in the card is its sibling;
 * - the hold menu is also behind a visually hidden "… actions" button (shown on focus), as `ContextMenu`'s is.
 */
export const CardGroup = forwardRef<HTMLDivElement, CardGroupProps>(function CardGroup(props, ref) {
  const { children, label, press = 'scale', ignore, onHold, holdMenu, menuLabel, className = '', onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onPointerLeave, ...rest } = props;
  const menu = useContextMenu();
  const el = useRef<HTMLDivElement | null>(null);
  const p = usePress({ disabled: press === 'none', ignore });
  // this card's own menu is up (a move after the hold closes only that one)
  const ownMenu = useRef(false);
  const itemsNow = () => (typeof holdMenu === 'function' ? holdMenu() : holdMenu) ?? [];
  const h = useHold({
    ignore,
    onHold:
      onHold || holdMenu
        ? (info) => {
            onHold?.(info);
            const items = itemsNow();
            if (!items.length) return;
            // the lift's haptic already fired with the hold (useHold); a keyboard open has none
            menu.open({ items, anchor: info.target, lift: info.target, label: menuLabel, haptic: false });
            ownMenu.current = true;
          }
        : undefined,
    onHoldMoved: () => {
      if (ownMenu.current && menu.isOpen()) menu.close();
      ownMenu.current = false;
    },
  });
  return (
    <div
      {...rest}
      ref={(node) => {
        el.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      }}
      role="group"
      aria-label={label}
      className={`pressable card-group ${className}`.trim()}
      data-press={press === 'none' ? undefined : press}
      onPointerDown={(e) => {
        p.handlers.onPointerDown?.(e);
        h.handlers.onPointerDown(e);
        onPointerDown?.(e);
      }}
      onPointerMove={(e) => {
        p.handlers.onPointerMove?.(e);
        onPointerMove?.(e);
      }}
      onPointerUp={(e) => {
        p.handlers.onPointerUp?.(e);
        onPointerUp?.(e);
      }}
      onPointerCancel={(e) => {
        p.handlers.onPointerCancel?.(e);
        onPointerCancel?.(e);
      }}
      onPointerLeave={(e) => {
        p.handlers.onPointerLeave?.(e);
        onPointerLeave?.(e);
      }}
      onContextMenu={h.handlers.onContextMenu}
      onClickCapture={h.handlers.onClickCapture}
      // Shift+F10 / the ContextMenu key, from whichever control in the card has focus
      onKeyDown={h.handlers.onKeyDown}
    >
      {children}
      {holdMenu ? (
        <button
          type="button"
          className="cm-sr"
          aria-haspopup="menu"
          onClick={(e) => {
            const items = itemsNow();
            const card = el.current;
            if (items.length && card) menu.open({ items, anchor: card, lift: card, label: menuLabel, returnFocus: e.currentTarget });
          }}
        >
          {menuLabel ?? `${label} actions`}
        </button>
      ) : null}
    </div>
  );
});

/**
 * The card's one "open" control: a real button around the title, whose `::after` layer is stretched over the whole card
 * (day.css `.card-open`), so a tap anywhere that is not another control still opens it. The other controls sit above that
 * layer (`position: relative; z-index: 1`), as siblings, each reachable on its own.
 */
export const CardOpen = ({ label, onOpen, className = '', children }: { label: string; onOpen: (e: React.MouseEvent<HTMLButtonElement>) => void; className?: string; children: ReactNode }): React.JSX.Element => (
  <button type="button" className={`card-open ${className}`.trim()} aria-label={label} onClick={onOpen}>
    {children}
  </button>
);
