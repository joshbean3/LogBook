import { animate, cancelFrame, frame, motion, useMotionValue, useReducedMotion, useTransform, type AnimationPlaybackControls, type FrameData, type MotionValue } from 'motion/react';
import type * as React from 'react';
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { PushedScrollerScope, useNavInternal, type LayerControl } from '@/app/NavController';
import { EDGE_PX, FLICK_V, LOCK_PX, lockAxis, POP_COMMIT_FRAC, POP_COMMIT_V } from '@/lib/gesture';
import { springs } from '@/lib/motion';
import { restoreFocus } from './focus';
import type { PushedEntry, TabId } from './nav';
import { springAdvance, springParams } from './springSim';
import { pointerClaimed } from './useHold';

/**
 * A pushed page (docs/feel.md §9.3, contracts §A.4). One MotionValue `x` per layer (0 at rest, W off screen right); the layer
 * under it rides `x` through three bindings: its translate (−0.3 × (W − x)), the scrim of this depth (0.12 × (1 − x/W)) and
 * this layer's left shadow (0.6 × (1 − x/W)). The edge pop is pointer events on the layer itself, claimed within 24 px of
 * its CURRENT left edge, so a push in flight can be caught. Rendered by the Shell only.
 *
 * Leaving is a promise kept to every caller: each `leave(done)` is remembered until the layer has left (`done(true)`) or a
 * catch brought it home (`done(false)`), so a pop-all, a chevron pop and an edge pop that overlap all finish together. In a
 * pop-all of two layers the depth-1 page is covered (hidden under the top one) and the root rides the top layer's x, so only
 * the top page slides off while the root comes from −30 % (UIKit's pop to root never shows the middle page).
 */

/** The motion values a tab's stack shares (the Shell owns them). */
export interface StackMotion {
  tab: TabId;
  /** [0] the tab scroller's x; [1] the depth-1 layer's extra x, written by a depth-2 layer. */
  offsets: readonly [MotionValue<number>, MotionValue<number>];
  /** [0] `.tab-scrim[data-depth="1"]`; [1] depth 2. */
  scrims: readonly [MotionValue<number>, MotionValue<number>];
  /** The depth-1 layer's element (the parent of a depth-2 layer). */
  layer1: RefObject<HTMLDivElement | null>;
}
export const StackCtx = createContext<StackMotion | null>(null);
const LayerCtx = createContext<{ pop: () => void } | null>(null);

/** The pop of the layer the caller is inside: the chevron calls it; equals nav.pop() for the top layer. */
export const usePop = (): (() => void) => {
  const layer = useContext(LayerCtx);
  const ctl = useNavInternal();
  return layer?.pop ?? ctl.pop;
};

export interface PushedLayerProps {
  entry: PushedEntry;
  depth: 1 | 2;
  parent: RefObject<HTMLElement | null>;
  children: ReactNode;
}

interface Running {
  controls: Pick<AnimationPlaybackControls, 'stop'>;
  target: number;
  onDone: () => void;
  token: number;
}
interface Flight {
  el: HTMLElement;
  src: HTMLElement;
  /** The source's rect with its parent at rest. */
  from: { left: number; top: number; width: number; height: number };
  dst: HTMLElement | null;
}

/** One frame of a 60 Hz display: the push's first painted frame shows the spring this far in. */
const FRAME_S = 1 / 60;
const PAGE = springParams(springs.page);

export const PushedLayer = ({ entry, depth, parent, children }: PushedLayerProps): React.JSX.Element => {
  const ctl = useNavInternal();
  const sm = useContext(StackCtx);
  if (!sm) throw new Error('PushedLayer outside the Shell');
  const reduce = !!useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const [slide] = useState(() => ctl.takeSlideIn(entry.key));
  // the control that opened this page gets focus back when it pops (a push only; a cold-start layer has no opener)
  const [opener] = useState(() => (slide && typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null));
  const x = useMotionValue(slide && !reduce ? (typeof window === 'undefined' ? 390 : window.innerWidth) : 0);
  const fade = useMotionValue(slide && reduce ? 0 : 1);
  const zero = useMotionValue(0);
  const childOffset = depth === 1 ? sm.offsets[1] : zero;
  const shownX = useTransform(() => x.get() + childOffset.get());
  const shadow = useMotionValue(0);
  const width = () => ref.current?.parentElement?.clientWidth || window.innerWidth;
  const running = useRef<Running | null>(null);
  const seq = useRef(0);
  const gone = useRef(false);
  const flight = useRef<Flight | null>(null);
  /** Everyone waiting for this layer to leave (a pop, a pop-all, a jump), answered together. */
  const waiters = useRef<Array<(left: boolean) => void>>([]);
  /** A pop-all of two layers: this (top) layer drives the root's bindings instead of the depth-1 layer's. */
  const allMode = useRef(false);
  /** A pop-all of two layers: this (depth-1) layer is hidden under the top one and writes nothing. */
  const covered = useRef(false);
  const settleWaiters = (left: boolean) => {
    const w = waiters.current;
    waiters.current = [];
    for (const f of w) f(left);
  };

  // ---------- the flyer (entry.shared): a fixed copy, portalled to body, rect to rect with p = 1 − x/W ----------
  const sel = entry.shared ? `[data-shared="${CSS.escape(entry.shared)}"]` : null;
  const startFly = () => {
    if (!sel || reduce || flight.current || allMode.current || covered.current) return;
    const src = parent.current?.querySelector<HTMLElement>(sel);
    if (!src) return;
    const r = src.getBoundingClientRect();
    const off = sm.offsets[depth - 1]!.get();
    const el = src.cloneNode(true) as HTMLElement;
    el.removeAttribute('data-shared');
    el.classList.add('flyer');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = `position:fixed;left:${r.left - off}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;margin:0;transform-origin:0 0;pointer-events:none;z-index:40;`;
    document.body.appendChild(el);
    src.style.visibility = 'hidden';
    // the destination is hidden from its first paint until rest (it may mount after the push starts)
    ref.current?.setAttribute('data-flying', '');
    flight.current = { el, src, from: { left: r.left - off, top: r.top, width: r.width, height: r.height }, dst: null };
  };
  const moveFly = (p: number) => {
    const f = flight.current;
    if (!f || !sel) return;
    f.dst ??= ref.current?.querySelector<HTMLElement>(sel) ?? null;
    if (!f.dst || !ref.current) return;
    // the destination's rest rect: its offset inside the layer (both read from the same rendered frame)
    const d = f.dst.getBoundingClientRect();
    const left = d.left - ref.current.getBoundingClientRect().left;
    const sx = 1 + (d.width / (f.from.width || 1) - 1) * p;
    const sy = 1 + (d.height / (f.from.height || 1) - 1) * p;
    f.el.style.transform = `translate(${(left - f.from.left) * p}px, ${(d.top - f.from.top) * p}px) scale(${sx}, ${sy})`;
  };
  const endFly = () => {
    const f = flight.current;
    if (!f) return;
    flight.current = null;
    f.el.remove();
    f.src.style.visibility = '';
    ref.current?.removeAttribute('data-flying');
  };

  // ---------- the bindings ----------
  const apply = () => {
    if (covered.current) return;
    const w = width();
    const px = Math.max(0, Math.min(1, 1 - x.get() / w));
    const p = Math.min(px, fade.get());
    // reduced motion: x/y moves become fades (§10.2), so the page under never slides; only its scrim follows the fade
    const off = reduce ? 0 : -0.3 * w * px;
    if (allMode.current && depth === 2) {
      // the depth-1 page is covered: the root is what shows beside this layer
      sm.offsets[0].set(off);
      sm.scrims[0].set(0.12 * p);
      sm.scrims[1].set(0);
    } else {
      sm.offsets[depth - 1]!.set(off);
      sm.scrims[depth - 1]!.set(0.12 * p);
    }
    shadow.set(0.6 * p);
    moveFly(px);
  };
  const setParentInert = (on: boolean) => {
    const el = parent.current;
    if (el) el.inert = on;
  };
  const atRest = () => {
    setParentInert(true);
    endFly();
  };

  /** Run one animation; `onDone` only if it is still the running one when it completes. */
  const run = (controls: AnimationPlaybackControls, target: number, onDone: () => void) => {
    const token = ++seq.current;
    running.current = { controls, target, onDone, token };
    void (controls as unknown as PromiseLike<void>).then(() => {
      if (running.current?.token !== token) return;
      running.current = null;
      onDone();
    });
  };
  const stop = () => {
    const r = running.current;
    running.current = null;
    r?.controls.stop();
  };
  /** Back to rest at 0 (a catch let go short of the pop): every pending leave is answered `false`. */
  const home = (v: number) => {
    stop();
    if (allMode.current) {
      allMode.current = false;
      apply();
    }
    settleWaiters(false);
    if (reduce) {
      x.jump(0);
      return atRest();
    }
    run(animate(x, 0, { ...springs.page, velocity: v }), 0, atRest);
  };
  const leave = (v: number, done?: (left: boolean) => void, opts: { all?: boolean } = {}) => {
    if (done) waiters.current.push(done);
    if (gone.current) return settleWaiters(true);
    if (opts.all && depth === 2 && !allMode.current) {
      allMode.current = true;
      endFly();
      apply();
    }
    const W = width();
    // already on its way out: the new waiter rides along
    if (running.current && running.current.target === W) return;
    stop();
    setParentInert(false);
    startFly();
    const finish = () => {
      gone.current = true;
      settleWaiters(true);
    };
    if (reduce) return run(animate(fade, 0, { duration: 0.12, ease: 'linear' }), W, finish);
    run(animate(x, W, { ...(Math.abs(v) >= FLICK_V ? springs.pageFlick : springs.page), velocity: v }), W, finish);
  };
  /** Pop-all of two layers: the depth-1 layer hides under the top one (it leaves with it), or comes back. */
  const cover = (on: boolean) => {
    if (covered.current === on) return;
    covered.current = on;
    for (const el of [ref.current, shadowRef.current]) if (el) el.style.visibility = on ? 'hidden' : '';
    if (on) {
      stop();
      endFly();
      setParentInert(false);
    } else {
      apply();
      if (!running.current) setParentInert(true);
    }
  };

  /**
   * The push starts on the frame that first paints the layer, never earlier: the first painted frame shows the spring one
   * frame in, and from the next frame on the spring runs on its own clock from two frames in. A heavy page's first render
   * and first paint (the mount, its style and layout) are not counted as elapsed time, so the slide is never skipped.
   */
  const startPush = () => {
    const W = width();
    x.jump(W);
    startFly();
    apply();
    // in motion's own frame step (not a separate rAF), so the layer's transform, which motion renders, and the bindings
    // written from x's change (the parent, the scrim, the flyer) land on the same frame
    let step: ((d: FrameData) => void) | null = null;
    const token = ++seq.current;
    running.current = { controls: { stop: () => step && cancelFrame(step) }, target: 0, onDone: atRest, token };
    step = () => {
      if (running.current?.token !== token) return;
      x.set(springAdvance(PAGE, W, 0, 0, FRAME_S)[0]);
      step = () => {
        if (running.current?.token !== token) return;
        step = null;
        const [p2, v2] = springAdvance(PAGE, W, 0, 0, 2 * FRAME_S);
        x.set(p2);
        run(animate(x, 0, { ...springs.page, velocity: v2 }), 0, pushRest);
      };
      frame.update(step);
    };
    frame.update(step);
  };
  /** A push at rest: the parent goes inert and focus moves into the new page (its title), for VoiceOver and the keyboard. */
  const pushRest = () => {
    atRest();
    const t = ref.current?.querySelector<HTMLElement>('.pushed-bar .pb-title');
    const a = document.activeElement;
    if (t && (!a || a === document.body || !ref.current?.contains(a))) t.focus({ preventScroll: true });
  };

  useLayoutEffect(() => {
    // a layer that mounts at rest never changes x, so `shownX` must be right from here (code review 2 #2): a depth-2 layer
    // removed in this same commit reset offsets[1] after `shownX` was first computed (its cleanup runs before this effect)
    shownX.set(x.get() + childOffset.get());
    const offX = x.on('change', apply);
    const offF = fade.on('change', apply);
    const offC = childOffset.on('change', () => moveFly(Math.max(0, Math.min(1, 1 - x.get() / width()))));
    if (slide) {
      if (reduce) run(animate(fade, 1, { duration: 0.12, ease: 'linear' }), 0, pushRest);
      else startPush();
    } else atRest();
    apply();
    const offsets = sm.offsets;
    const scrims = sm.scrims;
    const parentEl = parent.current;
    return () => {
      offX();
      offF();
      offC();
      stop();
      endFly();
      if (!covered.current) {
        offsets[depth - 1]!.set(0);
        scrims[depth - 1]!.set(0);
      }
      if (allMode.current) {
        offsets[0].set(0);
        scrims[0].set(0);
      }
      if (parentEl) parentEl.inert = false;
      // removed some other way: whoever waited for it to leave is answered (after this commit)
      if (waiters.current.length) queueMicrotask(() => settleWaiters(true));
      // a pop: focus goes back to the control that opened the page, if it would otherwise be lost
      if (opener)
        queueMicrotask(() => {
          const a = document.activeElement;
          if (opener.isConnected && (!a || a === document.body) && !opener.closest('[inert]')) restoreFocus(opener);
        });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const c: LayerControl = { leave: (done, opts) => leave(0, done, opts), cover, leaving: () => !gone.current && running.current?.target === width() };
    return ctl.registerLayer(entry.key, c);
  }); // re-registered each render so `leave` sees the current reduce flag

  // --hdr for the pushed bar's hairline: one passive listener
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const f = () => {
      const hdr = Math.min(1, Math.max(0, el.scrollTop / 44));
      el.style.setProperty('--hdr', String(hdr));
      el.querySelector(':scope > * > .pushed-bar, :scope > .pushed-bar')?.classList.toggle('is-collapsed', hdr >= 0.99);
    };
    el.addEventListener('scroll', f, { passive: true });
    return () => el.removeEventListener('scroll', f);
  }, []);

  // ---------- the edge pop ----------
  const g = useRef<{ id: number; sx: number; sy: number; x0: number; lock: null | 'x' | 'no'; caught: boolean } | null>(null);
  const swallow = useRef(false);
  // a leave that a catch brought home answers `false`: nothing is popped (code review 2 #1)
  const popSelf = () => leave(0, (left) => left && ctl.finishPop(sm.tab, entry.key));
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    swallow.current = false;
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0) || gone.current) return;
    // the band is measured from the edge as it is shown (a depth-1 layer under a moving depth-2 one is offset)
    if (e.clientX - shownX.get() > EDGE_PX) {
      // a tap on a page still sliding in or out opens nothing (feel review 2 N1: UIKit takes no touch on the content during
      // a transition): a double tap on the opener pushes once
      const r = running.current;
      if (r && Math.abs(x.get() - r.target) > 1) swallow.current = true;
      return;
    }
    let caught = false;
    const r = running.current;
    if (r) {
      if (Math.abs(x.get() - r.target) <= 1) {
        // within 1 px of its target: not a catch; the animation completes on this event
        running.current = null;
        r.controls.stop();
        x.jump(r.target);
        r.onDone();
        if (gone.current) return;
      } else {
        stop();
        caught = true;
        setParentInert(false);
      }
    }
    g.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x0: e.clientX - x.get(), lock: null, caught };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = g.current;
    if (!st || e.pointerId !== st.id) return;
    // a hold that became a drag owns this pointer (an object follows the finger)
    if (!st.lock && pointerClaimed(e.pointerId)) {
      g.current = null;
      if (st.caught) home(0);
      return;
    }
    if (!st.lock) {
      const dx = e.clientX - st.sx;
      const dy = e.clientY - st.sy;
      if (Math.hypot(dx, dy) < LOCK_PX) return;
      // a fresh edge drag locks only rightward (the layer at 0 cannot go further left); a caught layer follows the finger
      // either way, back toward home too (code review 2 #3: the catch stops it and re-bases; every gesture tracks 1:1)
      if (lockAxis(dx, dy) === 'x' && (dx > 0 || st.caught)) {
        // §9.3: x0 stays where the pointer went down (no re-base at the lock): the layer then sits exactly under the finger
        st.lock = 'x';
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* gone */
        }
        setParentInert(false);
        startFly();
      } else {
        st.lock = 'no';
        if (!st.caught) g.current = null;
        return;
      }
    }
    if (st.lock === 'x') x.set(Math.max(0, e.clientX - st.x0));
  };
  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = g.current;
    if (!st || e.pointerId !== st.id) return;
    g.current = null;
    if (st.lock === 'x') {
      swallow.current = true;
      const v = e.type === 'pointercancel' ? 0 : x.getVelocity();
      const commit = v >= 0 && (x.get() > POP_COMMIT_FRAC * width() || v > POP_COMMIT_V);
      if (commit) leave(v, (left) => left && ctl.finishPop(sm.tab, entry.key));
      else home(v);
      return;
    }
    if (st.caught) {
      // a tap that stopped a push or a pop: the nearest rest, and the click it makes is swallowed
      swallow.current = true;
      if (x.get() > width() / 2) popSelf();
      else home(0);
    }
  };
  const onClickCapture = (e: React.MouseEvent) => {
    if (!swallow.current) return;
    swallow.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  const layerApi = useMemo(
    () => ({
      pop: () => {
        const top = ctl.getState().tabs[sm.tab].stack.at(-1);
        if (top?.key === entry.key) ctl.pop();
      },
    }),
    [ctl, sm.tab, entry.key],
  );

  return (
    <>
      <motion.div ref={shadowRef} className="pushed-shadow" aria-hidden="true" style={{ x: shownX, opacity: shadow }} />
      <motion.div
        ref={(el: HTMLDivElement | null) => {
          ref.current = el;
          if (depth === 1) sm.layer1.current = el;
        }}
        className="pushed"
        data-depth={depth}
        data-key={entry.key}
        style={{ x: shownX, opacity: fade }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={onClickCapture}
      >
        <PushedScrollerScope scroller={ref}>
          <LayerCtx.Provider value={layerApi}>{children}</LayerCtx.Provider>
        </PushedScrollerScope>
      </motion.div>
    </>
  );
};
