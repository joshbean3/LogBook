import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { haptics } from '@/lib/haptics';
import { springs } from '@/lib/motion';
import { ContextMenu, type ContextMenuItem } from './ContextMenu';

export interface SwipeAction {
  /** One verb: "Done", "Later", "Move". Also the context-menu item. */
  label: string;
  icon?: ReactNode;
  /** The colour of the pane behind the row once armed: blue done, amber floor/later, red delete, grey neutral. */
  tone?: 'ok' | 'warn' | 'bad' | 'neutral';
  onCommit: () => void;
  /** Mark the context-menu item destructive (red, last). Default: tone === 'bad'. */
  destructive?: boolean;
}
export interface SwipeRowProps {
  /** Swiping the row to the right (→) reveals this action on the left edge. To-dos: Done. */
  right?: SwipeAction;
  /** Swiping the row to the left (←) reveals this action on the right edge. To-dos: Later. */
  left?: SwipeAction;
  children: ReactNode;
  /** Extra actions for the long-press menu, after the swipe actions. */
  menuItems?: ContextMenuItem[];
  /** The object's name, for the menu's accessible name ("Buy milk actions"). */
  label?: string;
  /** Wrap in a ContextMenu listing every action. Default true (every gesture has a visible fallback). */
  menu?: boolean;
  disabled?: boolean;
  className?: string;
  as?: 'div' | 'li';
  /** The reveal detent opened or closed. (SwipeRow v2, WP1's next step.) */
  onReveal?: (side: 'left' | 'right' | null) => void;
}

/** @deprecated the thresholds live in lib/gesture.ts (SWIPE_REVEAL_PX, SWIPE_FULL_FRAC, SWIPE_FULL_V); kept for SwipeRow v1. */
export const SWIPE_LOCK = 10;
export const SWIPE_COMMIT = 0.4;
export const SWIPE_RUBBER = 0.6;
const rubber = (dx: number, w: number) => {
  const lim = w * SWIPE_RUBBER;
  const a = Math.abs(dx);
  if (a <= lim) return dx;
  return Math.sign(dx) * (lim + (a - lim) * 0.25);
};

/**
 * A row you triage with a horizontal swipe. It follows the finger 1:1 and rubber-bands past 60% of its width; the action's
 * icon grows as it nears the commit point (40%), `haptics.threshold()` fires once each time that line is crossed, and a
 * release past it commits (the row slides out, `onCommit` runs, the row comes back unless the page removes it); otherwise it
 * springs back on `springs.settle`. The first 10px decide the direction, so a vertical scroll always wins. Every action is
 * also in the row's long-press ContextMenu (plus `menuItems`), which is the keyboard and VoiceOver path.
 */
export const SwipeRow = ({ right, left, children, menuItems = [], label, menu = true, disabled, className = '', as = 'div' }: SwipeRowProps) => {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const [side, setSide] = useState<'left' | 'right' | null>(null);
  const [armed, setArmed] = useState(false);
  const g = useRef({ id: -1, x0: 0, y0: 0, lock: null as null | 'x' | 'y', w: 1, armed: false, swallow: false });

  // the action icon grows from 0.6 to 1 on the way to the commit point, and a touch past it once armed
  const progress = useTransform(x, (v) => Math.min(1, Math.abs(v) / Math.max(1, g.current.w * SWIPE_COMMIT)));
  const iconScale = useTransform(progress, (p) => (reduce ? 1 : 0.6 + 0.4 * p));
  useMotionValueEvent(x, 'change', (v) => {
    const s = v > 0 ? 'right' : v < 0 ? 'left' : null;
    setSide((cur) => (cur === s ? cur : s));
  });

  const action = side === 'right' ? right : side === 'left' ? left : undefined;
  const settle = (to: number, after?: () => void) => {
    const c = animate(x, to, reduce ? { duration: 0 } : springs.settle);
    if (after) void c.then(after);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const st = g.current;
    st.id = e.pointerId;
    st.x0 = e.clientX;
    st.y0 = e.clientY;
    st.lock = null;
    st.armed = false;
    st.swallow = false;
    st.w = ref.current?.offsetWidth ?? 1;
    x.stop();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const st = g.current;
    if (e.pointerId !== st.id) return;
    const dx = e.clientX - st.x0;
    const dy = e.clientY - st.y0;
    if (!st.lock) {
      if (Math.abs(dx) < SWIPE_LOCK && Math.abs(dy) < SWIPE_LOCK) return;
      st.lock = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (st.lock === 'y') return;
      st.swallow = true;
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* already gone */
      }
    }
    if (st.lock !== 'x') return;
    // a side with no action barely moves
    const has = dx > 0 ? !!right : !!left;
    const v = has ? rubber(dx, st.w) : Math.sign(dx) * Math.min(24, Math.abs(dx) * 0.15);
    x.set(v);
    const over = has && Math.abs(v) >= st.w * SWIPE_COMMIT;
    if (over !== st.armed) {
      st.armed = over;
      setArmed(over);
      haptics.threshold();
    }
  };
  const end = (commit: boolean) => {
    const st = g.current;
    st.id = -1;
    if (st.lock !== 'x') return;
    const v = x.get();
    const act = v > 0 ? right : left;
    st.armed = false;
    setArmed(false);
    if (commit && act && Math.abs(v) >= st.w * SWIPE_COMMIT) {
      settle(Math.sign(v) * st.w, () => {
        act.onCommit();
        // if the page keeps the row (Later moved it, say), it comes home after a beat
        setTimeout(() => {
          if (ref.current?.isConnected) settle(0);
        }, 280);
      });
    } else settle(0);
  };
  // the click after a swipe is not a tap
  const onClickCapture = (e: React.MouseEvent) => {
    if (g.current.swallow) {
      g.current.swallow = false;
      e.preventDefault();
      e.stopPropagation();
    }
  };
  useEffect(() => () => x.stop(), [x]);

  const items: ContextMenuItem[] = [
    ...(right ? [{ label: right.label, icon: right.icon, onSelect: right.onCommit, destructive: right.destructive ?? right.tone === 'bad' }] : []),
    ...(left ? [{ label: left.label, icon: left.icon, onSelect: left.onCommit, destructive: left.destructive ?? left.tone === 'bad' }] : []),
    ...menuItems,
  ];
  const wrapped = menu && items.length > 0;
  // with a menu, the ContextMenu wrapper is the <li> (display: contents) and the row inside it a div
  const Tag = as === 'li' && !wrapped ? motion.li : motion.div;
  const row = (
    <Tag
      ref={ref as never}
      className={`swipe-row ${armed ? 'is-armed' : ''} ${className}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => end(true)}
      onPointerCancel={() => end(false)}
      onClickCapture={onClickCapture}
    >
      <div className={`swipe-pane tone-${action?.tone ?? 'neutral'} ${side ? `from-${side}` : ''}`} aria-hidden="true">
        {action ? (
          <motion.span className="swipe-act" style={{ scale: iconScale }}>
            {action.icon}
            <span className="swipe-label">{action.label}</span>
          </motion.span>
        ) : null}
      </div>
      <motion.div className="swipe-content" style={{ x }}>
        {children}
      </motion.div>
    </Tag>
  );
  if (!wrapped) return row;
  return (
    <ContextMenu items={items} label={label} disabled={disabled} as={as}>
      {row}
    </ContextMenu>
  );
};
