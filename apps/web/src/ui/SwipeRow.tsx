import { animate, motionValue, useMotionValue } from 'motion/react';
import type * as React from 'react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { LOCK_PX, lockAxis, PROJECT_S, SWIPE_FULL_FRAC, SWIPE_FULL_V, SWIPE_REVEAL_PX } from '@/lib/gesture';
import { haptics } from '@/lib/haptics';
import { springs, useReduced } from '@/lib/motion';
import { swallowClickOf } from './clickSwallow';
import { useContextMenu, type ContextMenuItem } from './ContextMenu';
import { useHold } from './useHold';

export interface SwipeAction {
  /** One verb: "Done", "Later", "Archive". Also the hold menu's item. */
  label: string;
  icon?: ReactNode;
  /** The pane's colour once armed: blue done, amber later, red delete, grey neutral. */
  tone?: 'ok' | 'warn' | 'bad' | 'neutral';
  onCommit: () => void;
  /** Mark the menu item destructive (red, last). Default: tone === 'bad'. */
  destructive?: boolean;
}
export interface SwipeRowProps {
  /** swipe → reveals on the left edge */
  right?: SwipeAction;
  /** swipe ← reveals on the right edge */
  left?: SwipeAction;
  children: ReactNode;
  /** Extra actions for the hold menu, after the swipe actions. */
  menuItems?: ContextMenuItem[];
  /** The object's name, for the menu's accessible name ("Buy milk actions"). */
  label?: string;
  /** Default true: the hold menu lists every action (the keyboard and VoiceOver path). */
  menu?: boolean;
  disabled?: boolean;
  className?: string;
  as?: 'div' | 'li';
  /** The reveal detent opened (the side whose action shows) or closed. */
  onReveal?: (side: 'left' | 'right' | null) => void;
}

/** The list item a row is (a wrapper with only the row in it counts as the row). */
const itemOf = (row: HTMLElement) => {
  let item = row;
  while (item.parentElement && item.parentElement.childElementCount === 1 && !/^(UL|OL)$/.test(item.parentElement.tagName)) item = item.parentElement;
  return item;
};

/**
 * SwipeRow v2 (docs/feel.md §11.3, contracts §C.5; sheets, Library and Reads only, never inside a DayPager). The first
 * 10 px inside a 40° cone decide the direction, so a vertical scroll always wins; then the content follows the finger 1:1
 * (a side with no action does not move). Released past 72 px (projected 350 ms) it rests open at the **reveal detent**:
 * the action is a 44 px button there, until a tap elsewhere or a scroll closes it. Past 0.55 W, or flicked at ≥ 600 px/s,
 * it is **full**: the content slides out with the release velocity on `springs.settle`, `onCommit` runs on its completion,
 * and when the page removes the row it leaves by a 100 ms fade while the rows below FLIP up on `settle`. `threshold` fires
 * once when it arms, never when it disarms. A hold (the one clock) lifts the row and opens a menu with every action.
 */
export const SwipeRow = ({ right, left, children, menuItems = [], label, menu = true, disabled, className = '', as = 'div', onReveal }: SwipeRowProps): React.JSX.Element => {
  const reduce = useReduced();
  const ref = useRef<HTMLElement>(null);
  const x = useMotionValue(0);
  const cm = useContextMenu();
  const [side, setSide] = useState<'left' | 'right' | null>(null);
  const [armed, setArmed] = useState(false);
  const [revealed, setRevealed] = useState<'left' | 'right' | null>(null);
  const g = useRef({ id: -1, x0: 0, y0: 0, from: 0, lock: null as null | 'x' | 'y', w: 1, armed: false, fired: false, busy: false });
  const rev = useRef<'left' | 'right' | null>(null);
  const o = useRef({ onReveal });
  o.current.onReveal = onReveal;

  // the pane is written from x's change, synchronously (a drag's frame shows the finger's own position, never a frame
  // behind); `translateX(…px)` is the format Plan's row reads
  const content = useRef<HTMLDivElement>(null);
  useEffect(
    () =>
      x.on('change', (v) => {
        if (content.current) content.current.style.transform = `translateX(${v}px)`;
        const s = v > 0.5 ? 'right' : v < -0.5 ? 'left' : null;
        setSide((c) => (c === s ? c : s));
      }),
    [x],
  );
  useEffect(() => () => x.stop(), [x]);

  const actionFor = (v: number) => (v > 0 ? right : v < 0 ? left : undefined);
  const setRev = (s: 'left' | 'right' | null) => {
    if (rev.current === s) return;
    rev.current = s;
    setRevealed(s);
    o.current.onReveal?.(s);
  };
  const to = (target: number, v = 0, after?: () => void) =>
    animate(x, target, reduce ? { duration: 0, onComplete: after } : { ...springs.settle, velocity: v, onComplete: after });
  const home = (v = 0) => {
    setRev(null);
    to(0, v);
  };

  // open at the detent: a tap elsewhere (capture, so it is seen before anything handles it) or a scroll closes it. A
  // closing tap inside the row's list is consumed (its click reaches nothing), as iOS's table does; one on a bar, the tab
  // bar or a sheet's header acts on that first tap (consumer review 4 #4: the sheet's Close and the chevron needed two)
  useEffect(() => {
    if (!revealed) return;
    const onDown = (e: PointerEvent) => {
      const row = ref.current;
      const t = e.target as Element | null;
      if (t?.closest?.('.swipe-action') && row?.contains(t)) return;
      const list = row?.closest('.sheet-body, .pushed, .tab-scroll');
      const inList = !!t && !!list?.contains(t) && !t.closest?.('.nb-bar, .pushed-bar');
      // that pointer's click only (code review 3 #6): a closing touch that scrolls leaves nothing armed
      if (inList) swallowClickOf(e.pointerId);
      home();
    };
    const onScroll = () => home();
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [revealed]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Full: out with the velocity; onCommit on completion; if the page removes the row, it fades and the rows below FLIP up. */
  const commit = (act: SwipeAction, dir: number, v: number) => {
    const row = ref.current;
    const st = g.current;
    st.busy = true;
    setRev(null);
    setArmed(true);
    const w = row?.offsetWidth ?? window.innerWidth;
    to(dir * w, v, () => {
      if (!row) return act.onCommit();
      const item = itemOf(row);
      const r = item.getBoundingClientRect();
      // everything below the row in its scroller: the rows after it, then what follows each ancestor up to the scroller
      const sibs: HTMLElement[] = [];
      const scroller = item.closest('.sheet-body, .pushed, .tab-scroll');
      for (let a: Element | null = item; a && a !== scroller; a = a.parentElement) for (let n = a.nextElementSibling; n; n = n.nextElementSibling) sibs.push(n as HTMLElement);
      const before = sibs.map((s) => s.getBoundingClientRect().top);
      // what is left on screen is the armed pane: its look, for the 100 ms fade after the row is gone
      const pane = row.querySelector<HTMLElement>('.swipe-pane');
      const ghost = (pane?.cloneNode(true) as HTMLElement | undefined) ?? document.createElement('div');
      if (pane) {
        const cs = getComputedStyle(pane);
        ghost.style.background = cs.backgroundColor;
        ghost.style.color = cs.color;
      }
      ghost.style.cssText += `;position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;margin:0;z-index:45;pointer-events:none;border-radius:${getComputedStyle(row).borderRadius}`;
      ghost.setAttribute('aria-hidden', 'true');
      let gone = false;
      const scope = item.parentElement?.parentElement ?? document.body;
      const onGone = () => {
        gone = true;
        document.body.appendChild(ghost);
        const a = animate(ghost, { opacity: 0 }, { duration: reduce ? 0 : 0.1, ease: 'easeOut' });
        void a.then(() => ghost.remove());
        // the inverse transforms land in this task (before the frame that would show the rows jumped), then settle to 0
        const moves = sibs.map((s, i) => [s, s.isConnected ? before[i]! - s.getBoundingClientRect().top : 0] as const);
        for (const [s, d] of moves) {
          if (Math.abs(d) < 0.5 || reduce) continue;
          const y = motionValue(d);
          // a CSS transition on transform (a .btn's press) would ease the inverse in instead of applying it
          const tr = s.style.transition;
          s.style.transition = 'none';
          s.style.transform = `translateY(${d}px)`;
          const off = y.on('change', (v) => (s.style.transform = v ? `translateY(${v}px)` : ''));
          // the spring's clock starts on the frame that paints the inverse: a long frame after the removal (the page's
          // re-render, the toast) must not be counted as elapsed time, or the rows jump most of the way in one step
          requestAnimationFrame(() =>
            animate(y, 0, {
              ...springs.settle,
              onComplete: () => {
                off();
                s.style.transform = '';
                s.style.transition = tr;
              },
            }),
          );
        }
      };
      // the row leaves when the page re-renders without it (often a tick later): the inverse transforms land before that paint
      const mo = new MutationObserver(() => {
        if (gone || item.isConnected) return;
        mo.disconnect();
        onGone();
      });
      mo.observe(scope, { childList: true, subtree: true });
      flushSync(() => act.onCommit());
      if (!item.isConnected && !gone) {
        mo.disconnect();
        onGone();
        return;
      }
      // the page kept the row (a "Later" that only moved it): it comes home (a removal that comes a tick later is caught first)
      setTimeout(() => {
        mo.disconnect();
        if (gone || !row.isConnected) return;
        st.busy = false;
        setArmed(false);
        to(0);
      }, 120);
    });
  };

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    hold.handlers.onPointerDown(e);
    const st = g.current;
    if (disabled || st.busy || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if ((e.target as Element).closest('.swipe-action, .cm-sr')) return;
    x.stop();
    st.id = e.pointerId;
    st.x0 = e.clientX;
    st.y0 = e.clientY;
    st.from = x.get();
    st.lock = null;
    st.armed = Math.abs(st.from) >= (ref.current?.offsetWidth ?? 1) * SWIPE_FULL_FRAC;
    st.fired = false;
    st.w = ref.current?.offsetWidth ?? 1;
  };
  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const st = g.current;
    if (e.pointerId !== st.id) return;
    const dx = e.clientX - st.x0;
    const dy = e.clientY - st.y0;
    if (!st.lock) {
      if (Math.hypot(dx, dy) < LOCK_PX) return;
      const ax = lockAxis(dx, dy);
      if (ax !== 'x') {
        st.lock = 'y';
        st.id = -1;
        return;
      }
      st.lock = 'x';
      // the click a swipe makes (a mouse) is not a tap; bound to this pointer, so a swipe that makes no click leaves nothing
      // armed for the next keyboard or assistive activation (code review 3 #6)
      swallowClickOf(e.pointerId);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* gone */
      }
    }
    // 1:1; a side with no action does not move; never past the row's width
    let v = st.from + dx;
    if (v > 0 && !right) v = 0;
    if (v < 0 && !left) v = 0;
    v = Math.max(-st.w, Math.min(st.w, v));
    x.set(v);
    const over = Math.abs(v) >= st.w * SWIPE_FULL_FRAC;
    if (over !== st.armed) {
      st.armed = over;
      setArmed(over);
      // once on arming, never on disarming
      if (over && !st.fired) {
        st.fired = true;
        haptics.threshold();
      }
    }
  };
  const onPointerEnd = (e: React.PointerEvent<HTMLElement>, cancelled: boolean) => {
    const st = g.current;
    if (e.pointerId !== st.id) return;
    st.id = -1;
    if (st.lock !== 'x') return;
    const cur = x.get();
    const v = cancelled ? 0 : x.getVelocity();
    const act = actionFor(cur);
    const dir = Math.sign(cur);
    st.armed = false;
    if (act && !cancelled && (Math.abs(cur) >= st.w * SWIPE_FULL_FRAC || (Math.abs(v) >= SWIPE_FULL_V && Math.sign(v) === dir))) return commit(act, dir, v);
    setArmed(false);
    const proj = cur + v * PROJECT_S;
    if (act && Math.sign(proj) === dir && Math.abs(proj) >= SWIPE_REVEAL_PX) {
      setRev(dir > 0 ? 'right' : 'left');
      to(dir * SWIPE_REVEAL_PX, v);
      return;
    }
    home(v);
  };
  const onClickCapture = (e: React.MouseEvent<HTMLElement>) => hold.handlers.onClickCapture(e);

  const items: ContextMenuItem[] = [
    ...(right ? [{ label: right.label, icon: right.icon, onSelect: right.onCommit, destructive: right.destructive ?? right.tone === 'bad' }] : []),
    ...(left ? [{ label: left.label, icon: left.icon, onSelect: left.onCommit, destructive: left.destructive ?? left.tone === 'bad' }] : []),
    ...menuItems,
  ];
  const withMenu = menu && items.length > 0;
  const openMenu = (focus?: HTMLElement | null) => {
    const row = ref.current;
    if (!row || disabled) return;
    cm.open({ items, anchor: row, lift: row, label: label ? `${label} actions` : undefined, returnFocus: focus ?? undefined, haptic: false });
  };
  const hold = useHold({ disabled: disabled || !withMenu, onHold: () => openMenu() });

  const shown = side === 'right' ? right : side === 'left' ? left : undefined;
  const Tag = as as 'div';
  return (
    <Tag
      ref={ref as React.RefObject<HTMLDivElement>}
      className={`swipe-row ${armed ? 'is-armed' : ''} ${className}`.trim()}
      data-revealed={revealed ?? undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => onPointerEnd(e, false)}
      onPointerCancel={(e) => onPointerEnd(e, true)}
      onContextMenu={hold.handlers.onContextMenu}
      onKeyDown={hold.handlers.onKeyDown}
      onClickCapture={onClickCapture}
    >
      <div className={`swipe-pane tone-${shown?.tone ?? 'neutral'} ${side ? `from-${side}` : ''}`} aria-hidden={revealed ? undefined : true}>
        {shown ? (
          <button
            type="button"
            className="swipe-action"
            data-side={side ?? undefined}
            tabIndex={revealed ? 0 : -1}
            onClick={(e) => {
              e.stopPropagation();
              const s = side === 'right' ? 1 : -1;
              commit(shown, s, 0);
            }}
          >
            <span className="swipe-act">
              {shown.icon}
              <span className="swipe-label">{shown.label}</span>
            </span>
          </button>
        ) : null}
      </div>
      <div ref={content} className="swipe-content">
        {children}
      </div>
      {withMenu && !disabled ? (
        <button type="button" className="cm-sr" aria-haspopup="menu" onClick={(e) => openMenu(e.currentTarget)}>
          {label ? `${label} actions` : 'Actions'}
        </button>
      ) : null}
    </Tag>
  );
};
