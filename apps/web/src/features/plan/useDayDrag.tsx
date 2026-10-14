import { tone, type Session } from '@logbook/shared';
import { motion, useMotionValue, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { haptics } from '@/lib/haptics';
import { DROP_SPRING, INSTANT, LIFT, REST, setDragInfo, useHoldDrag } from '@/lib/useDrag';

/** Every day you can drop a session on carries `data-plan-day="YYYY-MM-DD"` (a week row, an in-month cell). */
export const PLAN_DAY = 'data-plan-day';
const hitDay = (x: number, y: number): { day: string; el: HTMLElement } | null => {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>(`[${PLAN_DAY}]`) ?? null;
  const day = el?.getAttribute(PLAN_DAY);
  return el && day ? { day, el } : null;
};

type Ghost = { leaving: null | 'back' | 'gone' };
/** The copy in the air sits this far above the finger, so the day under the finger stays readable. */
const GHOST_RISE = 28;

/**
 * Hold a session (300ms: it lifts, one `lift` haptic), then drag it: a pill with its colour and name follows just above
 * the finger, the day under the finger lights (`select` per day crossed), and letting go on another day hands the drop to
 * `onDrop`. Let go where it started, or off any day, and the pill springs home. A hold that never moves opens the
 * context menu when the finger lifts (`onHoldRelease`), after the release's click has landed, so the menu's scrim never
 * eats it: the reviewed long-press-to-Move fix, now with every action in the menu.
 */
export const useDayDrag = ({ date, session, title, disabled, onDrop, onHoldRelease }: { date: string; session: Session; title: string; disabled?: boolean; onDrop: (to: string) => void; onHoldRelease: (el: HTMLElement) => void }) => {
  const reduce = useReducedMotion();
  const [lifted, setLifted] = useState(false);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const gx = useMotionValue(0);
  const gy = useMotionValue(0);
  const origin = useRef({ x: 0, y: 0 });
  const over = useRef<HTMLElement | null>(null);
  const swallow = useRef(false);
  const light = (el: HTMLElement | null) => {
    if (over.current === el) return false;
    over.current?.classList.remove('is-drop');
    el?.classList.add('is-drop');
    over.current = el;
    return true;
  };
  const land = (leaving: 'back' | 'gone') => setGhost((g) => (g ? { ...g, leaving } : g));
  const drag = useHoldDrag<HTMLElement>({
    disabled,
    autoScroll: true,
    onArm: () => {
      haptics.lift();
      setLifted(true);
    },
    onStart: (p) => {
      origin.current = { x: p.x, y: p.y };
      gx.set(p.x);
      gy.set(p.y);
      setGhost({ leaving: null });
      setDragInfo({ kind: 'session', date, id: session.id });
    },
    onMove: (p) => {
      gx.set(p.x);
      gy.set(p.y);
      const hit = hitDay(p.x, p.y);
      const el = hit && hit.day !== date ? hit.el : null;
      if (light(el) && el) haptics.select();
    },
    onDrop: (p) => {
      // the release point is the last word: a final move can be coalesced away before the up
      const hit = hitDay(p.x, p.y);
      light(null);
      setLifted(false);
      setDragInfo(null);
      if (!hit || hit.day === date) return land('back');
      land('gone');
      onDrop(hit.day);
    },
    onCancel: (phase, reason) => {
      light(null);
      setLifted(false);
      setDragInfo(null);
      if (phase === 'dragging') return land('back');
      if (phase === 'armed' && reason === 'up') {
        // the release still makes a click a few frames later: let it land on this row (swallowed) before the menu exists
        swallow.current = true;
        const el = drag.ref.current;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const open = () => {
          window.removeEventListener('click', open, true);
          if (timer) clearTimeout(timer);
          setTimeout(() => el && onHoldRelease(el), 0);
        };
        window.addEventListener('click', open, { capture: true, once: true });
        timer = setTimeout(() => {
          swallow.current = false;
          open();
        }, 350);
      }
    },
  });
  useEffect(
    () => () => {
      light(null);
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  // once the session is in the air its touch moves are the drag's alone: the Shell's pull to refresh (a document
  // listener) must not read a downward drag from the top of the page as a pull
  const phase = useRef(drag.phase);
  phase.current = drag.phase;
  useEffect(() => {
    const el = drag.ref.current;
    if (!el) return;
    const own = (e: TouchEvent) => {
      if (phase.current === 'armed' || phase.current === 'dragging') e.stopPropagation();
    };
    el.addEventListener('touchmove', own, { passive: true });
    return () => el.removeEventListener('touchmove', own);
  });
  /** True once, for the click that follows a drag or a hold: it is not a tap. */
  const consumeClick = () => {
    const held = swallow.current;
    swallow.current = false;
    return drag.consumeClick() || held;
  };
  /** Pointer handlers for the row; a row in the air keeps its moves from the swipe and the week pager under it. */
  const bind = {
    ...drag.bind,
    onPointerMove: (e: React.PointerEvent) => {
      drag.bind.onPointerMove(e);
      if (drag.phase === 'armed' || drag.phase === 'dragging') e.stopPropagation();
    },
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      // a right-click opens the menu; a touch hold has its own path above
      const pt = (e.nativeEvent as PointerEvent).pointerType;
      if (pt === 'mouse' || (!pt && e.button === 2)) onHoldRelease(e.currentTarget as HTMLElement);
    },
  };
  const portal = ghost
    ? createPortal(
        <motion.div
          className={`srow-ghost t-${tone(session)}`}
          aria-hidden="true"
          style={{ x: gx, y: gy }}
          initial={REST}
          animate={ghost.leaving === 'back' ? { ...REST, x: origin.current.x, y: origin.current.y } : ghost.leaving === 'gone' ? { ...REST, opacity: 0 } : reduce ? REST : LIFT}
          transition={reduce ? INSTANT : DROP_SPRING}
          onAnimationComplete={() => ghost.leaving && setGhost(null)}
        >
          <span className="srow-ghost-pill" style={{ transform: `translate(-50%, calc(-100% - ${GHOST_RISE}px))` }}>
            <i className="srow-ghost-dot" />
            <span className="srow-ghost-title">{title}</span>
          </span>
        </motion.div>,
        document.body,
      )
    : null;
  return { ref: drag.ref, bind, portal, lifted, dragging: !!ghost && !ghost.leaving, consumeClick, cancel: drag.cancel };
};
