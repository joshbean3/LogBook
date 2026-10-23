import { animate, motion, useMotionValue, useReducedMotion, useTransform, type AnimationPlaybackControls, type MotionValue } from 'motion/react';
import type * as React from 'react';
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useNavInternal, type LayerControl } from '@/app/NavController';
import { EDGE_PX, FLICK_V, LOCK_PX, lockAxis, POP_COMMIT_FRAC, POP_COMMIT_V } from '@/lib/gesture';
import { springs } from '@/lib/motion';
import type { PushedEntry, TabId } from './nav';

/**
 * A pushed page (docs/feel.md §9.3, contracts §A.4). One MotionValue `x` per layer (0 at rest, W off screen right); the layer
 * under it rides `x` through three bindings: its translate (−0.3 × (W − x)), the scrim of this depth (0.12 × (1 − x/W)) and
 * this layer's left shadow (0.6 × (1 − x/W)). The edge pop is pointer events on the layer itself, claimed within 24 px of
 * its CURRENT left edge, so a push in flight can be caught. Rendered by the Shell only.
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
  controls: AnimationPlaybackControls;
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

export const PushedLayer = ({ entry, depth, parent, children }: PushedLayerProps): React.JSX.Element => {
  const ctl = useNavInternal();
  const sm = useContext(StackCtx);
  if (!sm) throw new Error('PushedLayer outside the Shell');
  const reduce = !!useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [slide] = useState(() => ctl.takeSlideIn(entry.key));
  const x = useMotionValue(slide && !reduce ? (typeof window === 'undefined' ? 390 : window.innerWidth) : 0);
  const fade = useMotionValue(slide && reduce ? 0 : 1);
  const zero = useMotionValue(0);
  const childOffset = depth === 1 ? sm.offsets[1] : zero;
  const shownX = useTransform(() => x.get() + childOffset.get());
  const width = () => ref.current?.parentElement?.clientWidth || window.innerWidth;
  const running = useRef<Running | null>(null);
  const seq = useRef(0);
  const gone = useRef(false);
  const flight = useRef<Flight | null>(null);

  // ---------- the flyer (entry.shared): a fixed copy, portalled to body, rect to rect with p = 1 − x/W ----------
  const sel = entry.shared ? `[data-shared="${CSS.escape(entry.shared)}"]` : null;
  const startFly = () => {
    if (!sel || reduce || flight.current) return;
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
    flight.current = { el, src, from: { left: r.left - off, top: r.top, width: r.width, height: r.height }, dst: null };
  };
  const moveFly = (p: number) => {
    const f = flight.current;
    if (!f || !sel) return;
    f.dst ??= ref.current?.querySelector<HTMLElement>(sel) ?? null;
    if (!f.dst) return;
    f.dst.style.visibility = 'hidden';
    const d = f.dst.getBoundingClientRect();
    const left = d.left - shownX.get();
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
    if (f.dst) f.dst.style.visibility = '';
  };

  // ---------- the bindings ----------
  const apply = () => {
    const w = width();
    const px = Math.max(0, Math.min(1, 1 - x.get() / w));
    const p = Math.min(px, fade.get());
    sm.offsets[depth - 1]!.set(-0.3 * w * px);
    sm.scrims[depth - 1]!.set(0.12 * p);
    ref.current?.style.setProperty('--shadow-o', String(0.6 * p));
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
  const home = (v: number) => {
    stop();
    if (reduce) {
      x.jump(0);
      return atRest();
    }
    run(animate(x, 0, { ...springs.page, velocity: v }), 0, atRest);
  };
  const leave = (v: number, done: () => void) => {
    if (gone.current) return;
    stop();
    setParentInert(false);
    startFly();
    const finish = () => {
      gone.current = true;
      done();
    };
    if (reduce) return run(animate(fade, 0, { duration: 0.12, ease: 'linear' }), width(), finish);
    run(animate(x, width(), { ...(Math.abs(v) >= FLICK_V ? springs.pageFlick : springs.page), velocity: v }), width(), finish);
  };

  useLayoutEffect(() => {
    const offX = x.on('change', apply);
    const offF = fade.on('change', apply);
    const offC = childOffset.on('change', () => moveFly(Math.max(0, Math.min(1, 1 - x.get() / width()))));
    if (slide) {
      if (reduce) run(animate(fade, 1, { duration: 0.12, ease: 'linear' }), 0, atRest);
      else {
        x.jump(width());
        startFly();
        apply();
        run(animate(x, 0, springs.page), 0, atRest);
      }
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
      offsets[depth - 1]!.set(0);
      scrims[depth - 1]!.set(0);
      if (parentEl) parentEl.inert = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const c: LayerControl = { leave: (done) => leave(0, done) };
    return ctl.registerLayer(entry.key, c);
  }); // re-registered each render so `leave` sees the current reduce flag

  // --hdr for the pushed bar's hairline: one passive listener
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const f = () => el.style.setProperty('--hdr', String(Math.min(1, Math.max(0, el.scrollTop / 44))));
    el.addEventListener('scroll', f, { passive: true });
    return () => el.removeEventListener('scroll', f);
  }, []);

  // ---------- the edge pop ----------
  const g = useRef<{ id: number; sx: number; sy: number; x0: number; lock: null | 'x' | 'no'; caught: boolean } | null>(null);
  const swallow = useRef(false);
  const popSelf = () => leave(0, () => ctl.finishPop(sm.tab, entry.key));
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    swallow.current = false;
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0) || gone.current) return;
    if (e.clientX - x.get() > EDGE_PX) return;
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
    if (!st.lock) {
      const dx = e.clientX - st.sx;
      const dy = e.clientY - st.sy;
      if (Math.hypot(dx, dy) < LOCK_PX) return;
      if (lockAxis(dx, dy) === 'x' && dx > 0) {
        st.lock = 'x';
        st.x0 = e.clientX - x.get();
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
      if (commit) leave(v, () => ctl.finishPop(sm.tab, entry.key));
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
      <LayerCtx.Provider value={layerApi}>{children}</LayerCtx.Provider>
    </motion.div>
  );
};
