import { spring } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { haptics } from '@/lib/haptics';
import { springs } from '@/lib/motion';
import { edgeScroll, scrollerOf, type DragPoint, type EdgeScrollOpts } from '@/lib/useDrag';
import { swallowClickAfterHold } from '../day/HoldRing';
import { drawnY, flipY, stopFlip } from '../morning/flip';
import { clampTo, liftScaleFor, moveTo, slideFrom, slotOf } from './sort';

/**
 * A list of to-dos sorted by hand: Plan your day's line and each group in the To-dos sheet. The hold that starts it is the
 * caller's (`useHoldDrag` on the line, SwipeRow's own hold in the sheet: the one clock, the lift in place and its `lift`
 * haptic); from the first move after it, this hook has the row.
 *
 * The row stays in the list and its contents follow the finger in one axis (a row's children move, never the row itself:
 * on the line the rail, its dots and the nodes' places stay drawn, so the line is unbroken under the gap). Where the row
 * must ride over the page's sticky bar and strip to reach a dock (Today), the row in the list is held open as its gap and a
 * copy of it (`ghost`) follows the finger over everything but the docks, lifted at 1.03. Each time the
 * row passes another, the order on screen changes at once (the line redraws: the first open to-do is the lit "Next"), the
 * rows it passed slide to their new places on `springs.settle` (a compositor FLIP) and one `tick` fires. On release the
 * row settles into the gap on the same spring with one `drop`; the caller saves the order. A cancelled drag (the browser
 * took the pointer, a second finger, the app hidden, a sheet opening) springs everything back and saves nothing, with no
 * haptic. Under Reduce Motion nothing slides: rows jump to their places and the row lands where it is let go.
 *
 * The order on screen is held after a drop until the data has it, so nothing jumps back for a frame. It lives in a small
 * store (`useSortOrder`): only what draws the rows reads it, so a row passing another redraws the list, never the page
 * around it.
 */
export interface Store<T> {
  get: () => T;
  set: (next: T) => void;
  subscribe: (fn: () => void) => () => void;
}
export type SortStore = Store<string[] | null>;
/** A value that only its readers re-render for (`useStore`). */
export const makeStore = <T>(initial: T): Store<T> => {
  let v = initial;
  const subs = new Set<() => void>();
  return {
    get: () => v,
    set: (next) => {
      if (Object.is(next, v)) return;
      v = next;
      for (const f of subs) f();
    },
    subscribe: (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
};
export const useStore = <T>(store: Store<T>): T => useSyncExternalStore(store.subscribe, store.get, store.get);
/** The order a drag (or a drop not yet in the data) holds for the rows, or null: draw the data's. */
export const useSortOrder = (store: SortStore): string[] | null => useStore(store);

export interface SortDragOpts {
  /** The list: the rows are found inside it, and a sheet group keeps its dragged row inside it (`clamp`). */
  root: RefObject<HTMLElement | null>;
  /** The rows that sort, in the order drawn. */
  rows: (root: HTMLElement) => HTMLElement[];
  idOf: (row: HTMLElement) => string;
  /** The ids in the data's order: when it changes, a drop's held order has been taken up. */
  ids: readonly string[];
  reduce: boolean;
  /** Keep the dragged row inside the list's box (a group in the sheet: rows sort within their group). */
  clamp?: boolean;
  /** Where the page scrolls itself under the finger (see `edgeScroll`). */
  edges?: EdgeScrollOpts['edges'];
  /** Where the finger is, on every move and scroll step: true when it is over the list (the slot follows it), false over something else (a dock), where the order holds. */
  onPoint?: (x: number, y: number) => boolean;
  /** Checked every frame of a drag: true cancels it (a sheet opened over the page). */
  cancelWhen?: () => boolean;
  /** Let go of the hold when the drag is cancelled from here (a second finger, the app hidden). */
  onAbort?: () => void;
  /**
   * The row is drawn in the air as a copy at the top of the page (over the sticky bar and strip), not in the list: this
   * wraps the copy in what its styles need (the line's classes). The row's own contents keep its gap.
   */
  ghost?: (copy: HTMLElement) => HTMLElement;
}

export interface SortDrop {
  id: string;
  /** The order the rows now stand in. */
  order: string[];
  /** Where the row landed among them. */
  index: number;
}

interface Live {
  id: string;
  row: HTMLElement;
  root: HTMLElement;
  /** where the finger is inside the row (from the press, so the row takes up the slop and stays under the thumb) */
  grab: number;
  x: number;
  y: number;
  /** the row's contents, drawn this far from its place */
  drawn: number;
  from: string[];
  overList: boolean;
  /** the copy in the air, when the row is drawn as one */
  ghost: HTMLElement | null;
  off: () => void;
}

/** What moves for a row: its children (on the line the row's own box carries the rail, which stays). */
const movers = (row: HTMLElement) => Array.from(row.children).filter((c): c is HTMLElement => c instanceof HTMLElement);
const setY = (row: HTMLElement, y: number) => {
  const t = Math.abs(y) < 0.01 ? '' : `translateY(${y.toFixed(2)}px)`;
  for (const m of movers(row)) m.style.transform = t;
};
const topOf = (el: HTMLElement) => el.getBoundingClientRect().top;
const hide = (row: HTMLElement, hidden: boolean) => {
  for (const m of movers(row)) m.style.visibility = hidden ? 'hidden' : '';
};
const FRAME = 1 / 120;
/**
 * The copy lands in the gap: from `fromY` (and the lift's scale) to its place and scale 1, on `springs.settle`, sampled
 * into one compositor animation (the same physics as the FLIP's, so it lands with the rows beside it).
 */
const landGhost = (el: HTMLElement, fromY: number, fromScale: number, done: () => void) => {
  const t = springs.settle as { stiffness?: number; damping?: number; mass?: number };
  const gen = spring({ keyframes: [0, 1], stiffness: t.stiffness, damping: t.damping, mass: t.mass, restDelta: 0.001, restSpeed: 0.01 });
  const us = [0];
  for (let i = 1; i <= 240; i++) {
    const s = gen.next(i * FRAME * 1000);
    us.push(s.value as number);
    if (s.done) break;
  }
  us[us.length - 1] = 1;
  const frames = us.map((u, i) => ({ transform: `translateY(${(fromY * (1 - u)).toFixed(2)}px) scale(${(fromScale + (1 - fromScale) * u).toFixed(4)})`, offset: i / (us.length - 1) }));
  el.style.transform = '';
  el.style.scale = '';
  const a = el.animate(frames, { duration: (us.length - 1) * FRAME * 1000, easing: 'linear', fill: 'forwards' });
  a.onfinish = done;
  a.oncancel = done;
};
interface Spot {
  top: number;
  drawn: number;
}
const HELD_MS = 3000;
const AWAY_MS = 1500;

export const useSortDrag = (opts: SortDragOpts) => {
  const o = useRef(opts);
  o.current = opts;
  const live = useRef<Live | null>(null);
  const store = useRef<SortStore | null>(null);
  store.current ??= makeStore<string[] | null>(null);
  const st = store.current;
  const setOrder = st.set;
  /** a row dropped on a target (a dock, the goal): the others close up, by FLIP, when it leaves the list */
  const closing = useRef<{ id: string; before: Map<string, Spot>; at: number } | null>(null);
  const heldTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // the data took the drop's order (or changed under it): draw the data again
  const sig = opts.ids.join('|');
  useEffect(() => {
    if (!live.current) setOrder(null);
  }, [sig]);
  useEffect(
    () => () => {
      clearTimeout(heldTimer.current);
      live.current?.ghost?.remove();
      live.current?.off();
    },
    [],
  );

  const rowsNow = (root: HTMLElement) => o.current.rows(root);
  /**
   * The rows other than `except` whose place changed slide from where they were drawn (`before`, keyed by id) to it. A row
   * whose place did not change keeps whatever slide it is in, so a second pass never restarts it.
   */
  const slide = (root: HTMLElement, before: Map<string, Spot>, except?: HTMLElement) => {
    for (const r of rowsNow(root)) {
      if (r === except) continue;
      const was = before.get(o.current.idOf(r));
      if (!was) continue;
      const from = slideFrom(was, topOf(r), o.current.reduce);
      if (from === null) continue;
      for (const m of movers(r)) {
        if (from === 0) {
          stopFlip(m);
          m.style.transform = '';
        } else flipY(m, from);
      }
    }
  };
  /** Where each row is now: its place, and how far its contents are drawn from it (a running slide). */
  const spots = (root: HTMLElement) => new Map(rowsNow(root).map((r) => [o.current.idOf(r), { top: topOf(r), drawn: movers(r)[0] ? drawnY(movers(r)[0]!) : 0 }] as const));

  useLayoutEffect(() => {
    const c = closing.current;
    const root = o.current.root.current;
    if (!c || !root) return;
    if (performance.now() - c.at > AWAY_MS) return void (closing.current = null);
    if (rowsNow(root).some((r) => o.current.idOf(r) === c.id)) return;
    closing.current = null;
    if (!o.current.reduce) slide(root, c.before);
  });

  /** The dragged row's contents under the finger, 1:1 (no spring). */
  const place = (d: Live) => {
    const r = d.row.getBoundingClientRect();
    let y = d.y - d.grab - r.top;
    if (o.current.clamp) {
      const b = d.root.getBoundingClientRect();
      y = clampTo(y, b.top - r.top, b.bottom - r.bottom);
    }
    d.drawn = y;
    if (d.ghost) d.ghost.style.transform = `translateY(${(r.top + y).toFixed(2)}px)`;
    else setY(d.row, y);
  };
  /** A copy of the row for the air: no ids, none of the lift's or a slide's inline moves, out of the accessibility tree. */
  const makeGhost = (d: Live): HTMLElement | null => {
    const wrap = o.current.ghost;
    if (!wrap) return null;
    const copy = d.row.cloneNode(true) as HTMLElement;
    for (const el of [copy, ...copy.querySelectorAll<HTMLElement>('*')]) {
      el.removeAttribute('id');
      el.style.scale = '';
      el.style.transform = '';
      el.style.visibility = '';
    }
    const g = wrap(copy);
    g.setAttribute('aria-hidden', 'true');
    g.inert = true;
    const r = d.row.getBoundingClientRect();
    g.style.position = 'fixed';
    g.style.top = '0';
    g.style.left = `${r.left}px`;
    g.style.width = `${r.width}px`;
    g.style.margin = '0';
    g.style.pointerEvents = 'none';
    g.style.scale = String(liftScaleFor(o.current.reduce));
    return g;
  };
  /** The row's look changed under the finger (it became "Next"): the copy is made again from it. */
  const refreshGhost = (d: Live) => {
    if (!d.ghost) return;
    const g = makeGhost(d);
    if (!g) return;
    g.style.transform = d.ghost.style.transform;
    g.toggleAttribute('data-over', d.ghost.hasAttribute('data-over'));
    d.ghost.replaceWith(g);
    d.ghost = g;
    // a part the row grew (the check of the "Next" stop) is part of the gap too
    hide(d.row, true);
  };
  /** The slot under the finger: when it changes, the order on screen changes, the passed rows slide, one tick. */
  const reslot = (d: Live) => {
    if (!d.overList) return;
    const rows = rowsNow(d.root);
    const r = d.row.getBoundingClientRect();
    const mid = r.top + d.drawn + r.height / 2;
    const others = rows.filter((x) => x !== d.row);
    const at = slotOf(
      others.map((x) => {
        const b = x.getBoundingClientRect();
        return b.top + b.height / 2;
      }),
      mid,
    );
    const now = rows.map(o.current.idOf);
    const next = moveTo(now, d.id, at);
    if (next.join('|') === now.join('|')) return;
    const before = spots(d.root);
    flushSync(() => setOrder(next));
    haptics.tick();
    slide(d.root, before, d.row);
    refreshGhost(d);
    place(d);
  };
  const point = (d: Live) => {
    d.overList = o.current.onPoint ? o.current.onPoint(d.x, d.y) : true;
    // over a target the copy steps back, so the target's own light shows through it
    d.ghost?.toggleAttribute('data-over', !d.overList);
  };

  /** Tear down the drag's listeners; the live drag, if there was one. */
  const end = (): Live | null => {
    const d = live.current;
    if (!d) return null;
    live.current = null;
    d.off();
    return d;
  };
  /** The row's contents spring from where they are drawn into its place; the lifted look goes when they are home. */
  const settle = (d: Live, from: number) => {
    const home = () => {
      d.ghost?.remove();
      hide(d.row, false);
      d.row.removeAttribute('data-lifted');
      d.root.removeAttribute('data-sorting');
    };
    if (d.ghost) {
      if (o.current.reduce || !d.row.isConnected) return home();
      // the copy lands on the gap, then the row shows again under it
      d.ghost.style.top = `${topOf(d.row)}px`;
      return landGhost(d.ghost, from, Number(d.ghost.style.scale) || 1, home);
    }
    const ms = movers(d.row);
    if (o.current.reduce || Math.abs(from) < 0.5 || !ms.length) {
      setY(d.row, 0);
      return home();
    }
    ms.forEach((m, i) => flipY(m, from, i === 0 ? home : undefined));
  };
  const holdFor = () => {
    clearTimeout(heldTimer.current);
    heldTimer.current = setTimeout(() => {
      if (!live.current) setOrder(null);
    }, HELD_MS);
  };

  /** The drag proper begins (the first move after the hold): the row is taken up. False when there is no such row. */
  const start = (id: string, p: DragPoint): boolean => {
    const root = o.current.root.current;
    if (!root || live.current) return false;
    const rows = rowsNow(root);
    const row = rows.find((r) => o.current.idOf(r) === id);
    if (!row) return false;
    clearTimeout(heldTimer.current);
    for (const m of movers(row)) stopFlip(m);
    const top = topOf(row);
    const offs: Array<() => void> = [];
    const d: Live = { id, row, root, grab: p.y - p.dy - top, x: p.x, y: p.y, drawn: 0, from: rows.map(o.current.idOf), overList: true, ghost: null, off: () => offs.forEach((f) => f()) };
    live.current = d;
    row.setAttribute('data-lifted', '');
    root.setAttribute('data-sorting', '');
    d.ghost = makeGhost(d);
    if (d.ghost) {
      document.body.appendChild(d.ghost);
      hide(row, true);
    }
    place(d);
    // the page scrolls itself while the finger is held near its top or bottom edge
    offs.push(
      edgeScroll({
        scroller: scrollerOf(root),
        y: () => d.y,
        edges: o.current.edges,
        onScroll: () => {
          if (live.current !== d) return;
          place(d);
          point(d);
          reslot(d);
        },
      }),
    );
    // a second finger, the app hidden, a sheet over the page: the drag is off
    const onDown = () => {
      if (live.current === d) cancel();
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden' && live.current === d) cancel();
    };
    window.addEventListener('pointerdown', onDown, true);
    document.addEventListener('visibilitychange', onHide);
    offs.push(() => {
      window.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('visibilitychange', onHide);
    });
    if (o.current.cancelWhen) {
      let raf = 0;
      const watch = () => {
        if (live.current !== d) return;
        if (o.current.cancelWhen?.()) return void cancel();
        raf = requestAnimationFrame(watch);
      };
      raf = requestAnimationFrame(watch);
      offs.push(() => cancelAnimationFrame(raf));
    }
    // the click that ends the hold belongs to nothing (the rows moved under the finger): it takes itself off on that click or
    // the next press, so it outlives the drag's own listeners
    swallowClickAfterHold(window);
    return true;
  };

  const move = (p: DragPoint) => {
    const d = live.current;
    if (!d) return;
    d.x = p.x;
    d.y = p.y;
    place(d);
    point(d);
    reslot(d);
  };

  /** Let go over the list: the row settles into its gap (one `drop`). The new order, or null when it ended where it began. */
  const drop = (): SortDrop | null => {
    const d = end();
    if (!d) return null;
    haptics.drop();
    settle(d, d.drawn);
    const final = rowsNow(d.root).map(o.current.idOf);
    if (final.join('|') === d.from.join('|')) {
      setOrder(null);
      return null;
    }
    holdFor();
    return { id: d.id, order: final, index: final.indexOf(d.id) };
  };

  /**
   * Let go over a target (a dock, the goal): the row fades where it is and the others close up when it leaves the list.
   * `haptic`: the landing's (`select`), or false when the action fires its own (Delete's `delete`).
   */
  const away = (haptic: 'select' | false = 'select') => {
    const d = end();
    if (!d) return;
    if (haptic) haptics[haptic]();
    const before = spots(d.root);
    before.delete(d.id);
    closing.current = { id: d.id, before, at: performance.now() };
    const fadeOut = (el: HTMLElement) => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: o.current.reduce ? 0 : 100, fill: 'forwards' });
    const fades = d.ghost ? [] : movers(d.row).map(fadeOut);
    if (d.ghost) {
      const g = d.ghost;
      fadeOut(g).onfinish = () => g.remove();
    }
    holdFor();
    // the action left the row where it was (it failed, or it was undone at once): it comes back
    setTimeout(() => {
      if (!d.row.isConnected) return d.root.removeAttribute('data-sorting');
      fades.forEach((f) => f.cancel());
      setY(d.row, 0);
      hide(d.row, false);
      d.row.removeAttribute('data-lifted');
      d.root.removeAttribute('data-sorting');
    }, AWAY_MS);
  };

  /** Called off: everything springs back to where it was and nothing is saved. No haptic. */
  function cancel() {
    const d = end();
    if (!d) return;
    o.current.onAbort?.();
    const before = spots(d.root);
    const visual = topOf(d.row) + d.drawn;
    flushSync(() => setOrder(null));
    slide(d.root, before, d.row);
    d.ghost?.removeAttribute('data-over');
    refreshGhost(d);
    if (d.row.isConnected) settle(d, visual - topOf(d.row));
    else {
      d.ghost?.remove();
      d.root.removeAttribute('data-sorting');
    }
  }

  return { store: st, start, move, drop, away, cancel };
};
