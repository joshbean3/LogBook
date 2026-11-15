import { motion } from 'motion/react';
import type * as React from 'react';
import { BrandIcon } from '@/ui/icons';
import { ADD_ROWS, type AddKind, type AddMotion } from './addMenu';

/*
 * What the Add button and its menu draw (guide 6.1), with nothing of the app behind it: `AddMenu.tsx` gives these their
 * state and their handlers.
 */

/** The button's face: the set's plus, which turns into the close mark. Under Reduce Motion nothing turns: the close mark fades in over it. */
export const AddGlyph = ({ open, m }: { open: boolean; m: AddMotion['glyph'] }): React.JSX.Element =>
  m.turn ? (
    <motion.span className="dock-add-ic" initial={false} animate={{ transform: `rotate(${open ? m.turn : 0}deg)` }} transition={open ? m.open : m.closed}>
      <BrandIcon name="add" size={22} />
    </motion.span>
  ) : (
    <span className="dock-add-ic">
      <motion.span className="dock-add-face" initial={false} animate={{ opacity: open ? 0 : 1 }} transition={open ? m.open : m.closed}>
        <BrandIcon name="add" size={22} />
      </motion.span>
      <motion.span className="dock-add-face" initial={false} animate={{ opacity: open ? 1 : 0 }} transition={open ? m.open : m.closed}>
        <BrandIcon name="close" size={22} />
      </motion.span>
    </span>
  );

/** The button itself: a real button named "Add" that says whether its menu is open. */
export const AddButton = ({ open, m, menuId, buttonRef, ...rest }: { open: boolean; m: AddMotion['glyph']; menuId?: string; buttonRef?: React.Ref<HTMLButtonElement> } & React.ButtonHTMLAttributes<HTMLButtonElement>): React.JSX.Element => (
  <button ref={buttonRef} type="button" className="dock-add pressable" data-press="scale" data-open={open ? '' : undefined} aria-label="Add" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} {...rest}>
    <AddGlyph open={open} m={m} />
  </button>
);

export interface AddCardProps {
  id?: string;
  /** As `addOrder` gives them: `rows[0]`, the likeliest, is drawn last, by the button. */
  rows: readonly AddKind[];
  open: boolean;
  m: AddMotion;
  style?: React.CSSProperties;
  cardRef?: React.Ref<HTMLDivElement>;
  onRow?: (index: number) => void;
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  /** The open or the close has played. */
  onRest?: (state: 'open' | 'closed') => void;
}

/**
 * The card: the context menu's own card and rows (`cm-menu`, `cm-item`), each row a Haze icon tile and a word or two,
 * drawn from the bottom up. It stays mounted and moves between its two states (`addMotion`), so opening it costs no
 * mount. The lit row is written straight to the DOM by the menu (`data-lit`), never through a render.
 */
export const AddCard = ({ id, rows, open, m, style, cardRef, onRow, onPointerDown, onRest }: AddCardProps): React.JSX.Element => (
  <motion.div
    ref={cardRef}
    id={id}
    className="cm-menu add-menu"
    role="menu"
    aria-label="Add"
    style={style}
    variants={m.card}
    initial={false}
    animate={open ? 'open' : 'closed'}
    onPointerDown={onPointerDown}
    onAnimationComplete={(state) => {
      if (state === 'open' || state === 'closed') onRest?.(state);
    }}
  >
    {rows
      .map((kind, index) => ({ kind, index }))
      .reverse()
      .map(({ kind, index }) => (
        <motion.button key={kind} type="button" role="menuitem" className="cm-item add-item" data-i={index} data-kind={kind} variants={m.row} custom={index} onClick={() => onRow?.(index)}>
          <span className="icon-tile" aria-hidden="true">
            <BrandIcon name={ADD_ROWS[kind].icon} size={18} />
          </span>
          <span className="cm-label">{ADD_ROWS[kind].label}</span>
        </motion.button>
      ))}
  </motion.div>
);
