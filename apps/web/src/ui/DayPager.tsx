import { addMonths, shiftDays } from '@logbook/shared';
import { motionValue, useReducedMotion, type MotionValue, type Transition } from 'motion/react';
import type * as React from 'react';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { FLICK_V, LOCK_PX, PAGE_COMMIT_FRAC, PROJECT_S, RUBBER, lockAxis } from '@/lib/gesture';
import { crossfade, reducedFade, springs } from '@/lib/motion';
import { PAGE_COMMIT, type PageCommitDetail } from './nav';

/**
 * DayPager v2 (docs/feel.md §9.2, §3.5; contracts §B.1): the day (week, month) pager under the bar.
 *
 * One persistent motion value `x` per pager drives the track; prev, cur and next are always mounted, keyed by date, the
 * neighbours absolute beside the cur page (inert, clipped to its height). A pointer re-bases on every `pointerdown`
 * (`x0 = clientX − x`), so a running slide is caught where it is; a catch past halfway commits the page under the finger
 * at once (`onCommit` + `x.jump(x ± W)` in one synchronous commit: no pixel moves) and the drag pages on from the new
 * centre. A caught pointer released without a lock settles on the nearest page and its click is swallowed. A drag is
 * clamped to one page with the 0.2 rubber band; the release projects `x + v × 0.35` (sign-checked: a reverse flick goes
 * home) and springs to the page on `springs.page` (`pageFlick` at ≥ 500 px/s), home on `springs.settle`. The commit runs
 * on the completion frame: `onCommit` inside `flushSync`, and `x.jump(0)` in the same commit's layout effect, so the frame
 * before and the frame after are pixel-identical. `goTo` slides one page for an adjacent date, renders the destination in
 * the neighbour slot for 2–7 pages (with `target` and `span` set first, so the bar's labels and the strip's disc follow),
 * and crossfades the cur slot (150 ms) further out or with `mode: 'crossfade'`. Reduced motion: the drag tracks 1:1, every
 * release and goTo is a 150 ms opacity change.
 *
 * The springs are integrated here (mass 1, the stiffness and damping of `springs.*`, rest at |Δ| ≤ 1 px and |v| ≤ 30 px/s):
 * the first frame after a release already moves along the spring from the release time, the velocity is the release's,
 * and a catch reads the exact position and velocity. The track's transform is written synchronously from `x`.
 */
export interface DayPagerHandle {
  /** The track's translateX in px; 0 = the shown page at rest. One per pager, persistent. */
  readonly x: MotionValue<number>;
  /** p = −x / W ∈ [−1, 1] (positive = toward next). Bind labels and the strip disc to it. */
  readonly progress: MotionValue<number>;
  /** W = the pager's clientWidth (ResizeObserver), never innerWidth. */
  readonly width: () => number;
  /** Slide to a date ('auto': adjacent / 2–7 pages in the neighbour slot / further a 150 ms crossfade; 'crossfade' at any distance). */
  goTo: (date: string, opts?: { mode?: 'auto' | 'crossfade' }) => void;
  /** The destination of a running goTo (null otherwise) and the number of pages it represents. Set before its first frame, reset on commit. */
  readonly target: MotionValue<string | null>;
  readonly span: MotionValue<number>;
  /** Bind the drag recogniser to extra elements outside the pager (the DateStrip and the large title row). Replaces the list; [] unbinds. */
  attach: (els: Array<HTMLElement | null>) => void;
  /** True while a finger drives the track or a release spring runs. */
  readonly moving: MotionValue<boolean>;
}

interface Engine {
  goTo: (date: string, opts?: { mode?: 'auto' | 'crossfade' }) => void;
  rebind: () => void;
}
interface HandleInternal extends DayPagerHandle {
  _w: { current: number };
  _attached: { current: HTMLElement[] };
  _engine: { current: Engine | null };
}

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

const createHandle = (): HandleInternal => {
  const x = motionValue(0);
  const progress = motionValue(0);
  const w = { current: 0 };
  x.on('change', (v) => progress.set(w.current ? clamp1(-v / w.current) : 0));
  const engine: HandleInternal['_engine'] = { current: null };
  const attached: HandleInternal['_attached'] = { current: [] };
  return {
    x,
    progress,
    target: motionValue<string | null>(null),
    span: motionValue(1),
    moving: motionValue(false),
    width: () => w.current,
    goTo: (date, opts) => engine.current?.goTo(date, opts),
    attach: (els) => {
      attached.current = els.filter((e): e is HTMLElement => !!e);
      engine.current?.rebind();
    },
    _w: w,
    _attached: attached,
    _engine: engine,
  };
};

/** One handle per pager host (DayView, PlanView): x, progress, target, span, goTo, attach. Persistent for the host's life. */
export const useDayPagerHandle = (): DayPagerHandle => useState(createHandle)[0];

export interface DayPagerProps {
  /** The shown page's key: ISO day; the Monday for 'week'; the first of the month for 'month'. */
  date: string;
  step: 'day' | 'week' | 'month';
  /** Once per page change, after the settle, inside flushSync; the host sets `date` synchronously. */
  onCommit: (date: string) => void;
  /** prev, cur, next are ALWAYS mounted; live=false for the neighbours (inert, aria-hidden). */
  render: (date: string, live: boolean) => ReactNode;
  handle: DayPagerHandle;
  min?: string;
  max?: string;
  /** Pointers that start inside this selector are never claimed. Default 'textarea, input, [data-no-page]'. */
  ignore?: string;
  label?: string;
  prevLabel?: string;
  nextLabel?: string;
  className?: string;
}

const stepOf = (date: string, step: DayPagerProps['step'], n: number) => (step === 'day' ? shiftDays(date, n) : step === 'week' ? shiftDays(date, 7 * n) : addMonths(date, n));
const D = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
/** Signed number of pages from a to b. */
const pagesBetween = (a: string, b: string, step: DayPagerProps['step']) => {
  if (step === 'month') return (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7));
  const days = Math.round((D(b) - D(a)) / 86_400_000);
  return step === 'week' ? Math.round(days / 7) : days;
};

// ---------- the spring (mass 1), integrated in 1 ms RK4 steps ----------
interface SpringP {
  k: number;
  c: number;
  rd: number;
  rs: number;
}
const sp = (t: Transition): SpringP => {
  const s = t as { stiffness: number; damping: number; restDelta?: number; restSpeed?: number };
  return { k: s.stiffness, c: s.damping, rd: s.restDelta ?? 1, rs: s.restSpeed ?? 30 };
};
const advance = (p: SpringP, pos: number, vel: number, to: number, dt: number) => {
  const a = (x: number, v: number) => -p.k * (x - to) - p.c * v;
  let left = dt;
  while (left > 1e-9) {
    const h = Math.min(0.001, left);
    left -= h;
    const k1x = vel;
    const k1v = a(pos, vel);
    const k2x = vel + (k1v * h) / 2;
    const k2v = a(pos + (k1x * h) / 2, vel + (k1v * h) / 2);
    const k3x = vel + (k2v * h) / 2;
    const k3v = a(pos + (k2x * h) / 2, vel + (k2v * h) / 2);
    const k4x = vel + k3v * h;
    const k4v = a(pos + k3x * h, vel + k3v * h);
    pos += (h / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
    vel += (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
  }
  return [pos, vel] as const;
};
const V_MAX = 4000;
/** Test builds expose the last release (`window.__dpRun`: its start time, x, v, target and spring) to the acceptance scripts. */
const TEST_HOOKS = typeof window !== 'undefined' && !!(import.meta.env.DEV || import.meta.env.VITE_FAKE_CLOCK);

const SCROLLER = '.tab-scroll, .pushed, .sheet-body, [data-scroller]';
/** The natural height of a neighbour page (it is clipped to the cur page's height): its children's extent. */
const naturalHeight = (page: HTMLElement) => {
  let h = 0;
  for (const c of Array.from(page.children) as HTMLElement[]) h = Math.max(h, c.offsetTop + c.offsetHeight);
  return h + (parseFloat(getComputedStyle(page).paddingBottom) || 0);
};

interface Props {
  date: string;
  step: DayPagerProps['step'];
  min?: string;
  max?: string;
  ignore: string;
  reduce: boolean;
  prev: string;
  next: string;
  onCommit: (d: string) => void;
}
type Ovr = { base: string; side: 1 | -1; date: string };

export const DayPager = ({ date, step, onCommit, render, handle, min, max, ignore = 'textarea, input, [data-no-page]', label = step === 'week' ? 'Week' : step === 'month' ? 'Month' : 'Day', prevLabel, nextLabel, className = '' }: DayPagerProps): React.JSX.Element => {
  const h = handle as HandleInternal;
  const reduce = !!useReducedMotion();
  const [ovr, setOvr] = useState<Ovr | null>(null);
  const o = ovr && ovr.base === date ? ovr : null;
  const prev = o?.side === -1 ? o.date : stepOf(date, step, -1);
  const next = o?.side === 1 ? o.date : stepOf(date, step, 1);
  const P = useRef<Props>(null as unknown as Props);
  P.current = { date, step, min, max, ignore, reduce, prev, next, onCommit };
  const dpRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const setOvrRef = useRef(setOvr);
  setOvrRef.current = setOvr;

  // ---------- the engine: everything below runs on events and frames, never on React renders ----------
  const [E] = useState(() => {
    const { x, target, span, moving } = h;
    const W = () => h._w.current || dpRef.current?.clientWidth || 1;
    type G = { id: number; sx: number; sy: number; x0: number; lock: null | 'x' | 'y'; caught: boolean; caughtCommit: boolean };
    const idle: G = { id: -1, sx: 0, sy: 0, x0: 0, lock: null, caught: false, caughtCommit: false };
    let g: G = { ...idle };
    let run: null | { to: number; p: SpringP; pos: number; vel: number; t: number; raf: number; onRest: () => void } = null;
    let swallow = false;
    let swallowTimer: ReturnType<typeof setTimeout> | undefined;
    /** A pointerdown that completed a spring (the 1 px rule) hit the page while it was still an inert neighbour: its click is sent on to what is under the point now. */
    let retarget = 0;
    const st = {
      /** The commit in flight: the date the host is asked to show and where x jumps to in that commit. */
      committing: null as null | { date: string; x: number },
      lastDate: '',
    };
    const can = (side: 1 | -1) => {
      const p = P.current;
      const d = side < 0 ? p.prev : p.next;
      if (side < 0 ? p.min && d < p.min : p.max && d > p.max) return null;
      return d;
    };
    const clampX = (raw: number) => {
      const w = W();
      const hi = can(-1) ? w : 0;
      const lo = can(1) ? -w : 0;
      return raw > hi ? hi + (raw - hi) * RUBBER : raw < lo ? lo + (raw - lo) * RUBBER : raw;
    };
    const stopRun = () => {
      if (!run) return 0;
      cancelAnimationFrame(run.raf);
      const v = run.vel;
      run = null;
      return v;
    };
    const startRun = (to: number, t: Transition, v0: number, onRest: () => void) => {
      stopRun();
      const r = { to, p: sp(t), pos: x.get(), vel: v0, t: performance.now(), raf: 0, onRest };
      run = r;
      if (TEST_HOOKS) (window as unknown as { __dpRun?: unknown }).__dpRun = { t: r.t, x: r.pos, v: v0, to, k: r.p.k, c: r.p.c };
      moving.set(true);
      const tick = () => {
        if (run !== r) return;
        const now = performance.now();
        const [pos, vel] = advance(r.p, r.pos, r.vel, r.to, Math.max(0, now - r.t) / 1000);
        r.pos = pos;
        r.vel = vel;
        r.t = now;
        // rest: within restDelta and restSpeed, and the frame on screen already within restDelta, so the snap is ≤ 1 px
        if (Math.abs(pos - r.to) <= r.p.rd && Math.abs(vel) <= r.p.rs && Math.abs(x.get() - r.to) <= r.p.rd) {
          run = null;
          x.set(r.to);
          if (g.id === -1) moving.set(false);
          r.onRest();
          return;
        }
        x.set(pos);
        r.raf = requestAnimationFrame(tick);
      };
      r.raf = requestAnimationFrame(tick);
    };
    /** Completes the running spring now (its commit runs). */
    const finishRun = () => {
      if (!run) return;
      const r = run;
      stopRun();
      x.set(r.to);
      if (g.id === -1) moving.set(false);
      r.onRest();
    };
    const atRest = () => {
      if (g.id === -1) moving.set(false);
      target.set(null);
      span.set(1);
    };
    const fadeCur = (t: Transition) => {
      const cur = dpRef.current?.querySelector<HTMLElement>(':scope > .dp-track > .dp-page[data-role="cur"]');
      const tt = t as { duration?: number };
      cur?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: (tt.duration ?? 0.15) * 1000, easing: t === reducedFade ? 'linear' : 'cubic-bezier(0.22, 1, 0.36, 1)' });
    };
    /** Commit `d`: the host sets it inside flushSync; the layout effect jumps x to `jx` in the same commit. */
    const commit = (d: string, jx = 0) => {
      const from = P.current.date;
      if (d === from) {
        x.jump(0);
        atRest();
        return;
      }
      st.committing = { date: d, x: jx };
      flushSync(() => {
        P.current.onCommit(d);
        target.set(null);
        span.set(1);
      });
      if (st.committing) {
        // the host kept its date: show it at rest
        st.committing = null;
        x.jump(0);
      }
      if (g.id === -1 && !run) moving.set(false);
      window.dispatchEvent(new CustomEvent<PageCommitDetail>(PAGE_COMMIT, { detail: { from, to: d, step: P.current.step } }));
    };
    const crossfadeTo = (d: string) => {
      stopRun();
      commit(d, 0);
      fadeCur(P.current.reduce ? reducedFade : crossfade);
    };
    /** Release from the current x with velocity v (px/s). */
    const release = (v: number, afterCatch: boolean) => {
      const w = W();
      const xv = x.get();
      const proj = xv + v * PROJECT_S;
      let side: 0 | 1 | -1 = 0;
      if (Math.abs(proj) >= PAGE_COMMIT_FRAC * w && (Math.sign(proj) === Math.sign(xv) || afterCatch)) side = proj < 0 ? 1 : -1;
      const d = side ? can(side) : null;
      if (!d) side = 0;
      if (P.current.reduce) {
        if (d) crossfadeTo(d);
        else {
          x.jump(0);
          fadeCur(reducedFade);
          atRest();
        }
        return;
      }
      if (d) startRun(-side * w, Math.abs(v) >= FLICK_V ? springs.pageFlick : springs.page, v, () => commit(d));
      else startRun(0, springs.settle, v, atRest);
    };
    /** A caught pointer with no drag: the nearest page from the current x, v = 0. */
    const settleNearest = () => {
      const w = W();
      const xv = x.get();
      const side: 0 | 1 | -1 = xv < -w / 2 ? 1 : xv > w / 2 ? -1 : 0;
      const d = side ? can(side) : null;
      if (P.current.reduce) {
        if (d) crossfadeTo(d);
        else (x.jump(0), atRest());
        return;
      }
      if (d) startRun(-side * w, springs.settle, 0, () => commit(d));
      else startRun(0, springs.settle, 0, atRest);
    };
    /** Would committing the neighbour on `side` make the browser clamp the scroller's scrollTop (§3.5)? */
    const wouldClamp = (side: 1 | -1) => {
      const dp = dpRef.current;
      const sc = dp?.closest<HTMLElement>(SCROLLER);
      const cur = dp?.querySelector<HTMLElement>(':scope > .dp-track > .dp-page[data-role="cur"]');
      const nb = dp?.querySelector<HTMLElement>(`:scope > .dp-track > .dp-page[data-role="${side > 0 ? 'next' : 'prev'}"]`);
      if (!sc || !cur || !nb) return false;
      const minH = parseFloat(getComputedStyle(cur).minHeight) || 0;
      const newH = Math.max(naturalHeight(nb), minH);
      const newScrollH = sc.scrollHeight - cur.offsetHeight + newH;
      return sc.scrollTop > newScrollH - sc.clientHeight + 0.5;
    };

    // ---------- pointers ----------
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== g.id) return;
      const dx = e.clientX - g.sx;
      const dy = e.clientY - g.sy;
      if (!g.lock) {
        if (Math.hypot(dx, dy) < LOCK_PX) return;
        const ax = lockAxis(dx, dy);
        if (!ax) return;
        g.lock = ax;
        if (ax === 'y') {
          // the scroll has it; a caught slide settles where it is nearest
          if (g.caught && !run) settleNearest();
          return;
        }
        try {
          dpRef.current?.setPointerCapture(e.pointerId);
        } catch {
          /* the pointer is gone */
        }
        moving.set(true);
        // a fresh drag re-bases here, so the content never jumps by the lock distance; a caught track is already held:
        // it has followed the finger from the touch (x0 was taken on pointerdown) and moves with this event
        if (!g.caught) {
          g.x0 = e.clientX - x.get();
          return;
        }
      }
      if (g.lock !== 'x') return;
      x.set(clampX(e.clientX - g.x0));
    };
    const end = (e: PointerEvent) => {
      if (e.pointerId !== g.id) return;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      const was = g;
      g = { ...idle };
      if (was.lock === 'x') {
        armSwallow();
        const v = e.type === 'pointercancel' ? 0 : Math.max(-V_MAX, Math.min(V_MAX, x.getVelocity()));
        release(v, was.caughtCommit);
      } else if (was.caught) {
        armSwallow();
        if (!run) settleNearest();
      } else if (!run) moving.set(false);
    };
    const armSwallow = () => {
      swallow = true;
      clearTimeout(swallowTimer);
      swallowTimer = setTimeout(() => (swallow = false), 400);
    };
    const onDown = (e: PointerEvent) => {
      if (g.id !== -1 || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const t = e.target as Element | null;
      if (t?.closest?.(P.current.ignore)) return;
      swallow = false;
      retarget = 0;
      g = { ...idle, id: e.pointerId, sx: e.clientX, sy: e.clientY };
      if (run) {
        const w = W();
        const xv = x.get();
        if (Math.abs(xv - run.to) <= 1) {
          finishRun();
          retarget = performance.now();
        }
        else {
          stopRun();
          g.caught = true;
          if (Math.abs(xv) > w / 2 && !P.current.reduce) {
            const side: 1 | -1 = xv < 0 ? 1 : -1;
            const d = can(side);
            // catch-commit: the page under more than half the screen becomes the centre, pixel-identical (unless it would clamp scrollTop)
            if (d && !wouldClamp(side)) {
              commit(d, xv + side * w);
              g.caughtCommit = true;
            }
          }
          moving.set(true);
        }
      }
      g.x0 = e.clientX - x.get();
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
    };
    const onClickCapture = (e: MouseEvent) => {
      if (retarget && !swallow) {
        const fresh = performance.now() - retarget < 1000;
        retarget = 0;
        // the browser aims the click at the common ancestor of the pointer's down and up targets (the pager): the page
        // that landed under the finger gets it, as a tap at rest would
        const under = fresh ? document.elementFromPoint(e.clientX, e.clientY) : null;
        const host = e.currentTarget as HTMLElement;
        if (under && under !== e.target && host.contains(under) && !(under as Element).contains(e.target as Node)) {
          e.preventDefault();
          e.stopPropagation();
          under.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, clientX: e.clientX, clientY: e.clientY, screenX: e.screenX, screenY: e.screenY, detail: e.detail }));
        }
        return;
      }
      if (!swallow) return;
      swallow = false;
      e.preventDefault();
      e.stopPropagation();
    };

    // ---------- binding: the pager element and the attached ones ----------
    let bound: HTMLElement[] = [];
    const bind = () => {
      for (const el of bound) {
        el.removeEventListener('pointerdown', onDown);
        el.removeEventListener('click', onClickCapture, true);
      }
      bound = [dpRef.current, ...h._attached.current].filter((e): e is HTMLElement => !!e);
      for (const el of bound) {
        el.addEventListener('pointerdown', onDown);
        el.addEventListener('click', onClickCapture, true);
        if (el !== dpRef.current) el.style.touchAction = 'pan-y';
      }
    };
    const unbind = () => {
      for (const el of bound) {
        el.removeEventListener('pointerdown', onDown);
        el.removeEventListener('click', onClickCapture, true);
      }
      bound = [];
      stopRun();
      clearTimeout(swallowTimer);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };

    const goTo = (d: string, opts?: { mode?: 'auto' | 'crossfade' }) => {
      if (g.lock === 'x') return; // a finger owns the track
      // a step asked for while a slide runs pages on from where that slide is going
      const p = P.current;
      const n = pagesBetween(p.date, d, p.step);
      if (n === 0) {
        if (run) startRun(0, springs.page, stopRun(), atRest);
        target.set(null);
        span.set(1);
        return;
      }
      if ((opts?.mode ?? 'auto') === 'crossfade' || p.reduce || Math.abs(n) > 7) return crossfadeTo(d);
      const side: 1 | -1 = n > 0 ? 1 : -1;
      const slot = side > 0 ? p.next : p.prev;
      if (slot !== d)
        flushSync(() => {
          setOvrRef.current(Math.abs(n) > 1 ? { base: p.date, side, date: d } : null);
          target.set(d);
          span.set(Math.abs(n));
        });
      else {
        target.set(d);
        span.set(Math.abs(n));
      }
      const v = stopRun();
      startRun(-side * W(), springs.page, v, () => commit(d));
    };
    /** Keyboard and the hidden buttons: one page per press (a slide still running finishes first). */
    const stepBy = (dir: 1 | -1) => {
      finishRun();
      const d = can(dir);
      if (d) goTo(d);
    };
    /** The host changed `date` itself (not our commit): stop, reset, show it at rest. */
    const onDate = (d: string) => {
      if (st.lastDate === d) return;
      st.lastDate = d;
      if (st.committing && st.committing.date === d) {
        const jx = st.committing.x;
        st.committing = null;
        x.jump(jx);
        return;
      }
      stopRun();
      st.committing = null;
      if (g.lock === 'x') g.lock = 'y';
      x.jump(0);
      atRest();
    };
    return { bind, unbind, goTo, stepBy, onDate, onClickCapture };
  });

  // the date: our own commit jumps x in this same commit; anyone else's change shows the new date at rest
  useLayoutEffect(() => E.onDate(date), [E, date]);

  // binding, W, --chrome-h, the engine on the handle
  useLayoutEffect(() => {
    const dp = dpRef.current!;
    const track = trackRef.current!;
    const write = (v: number) => {
      track.style.transform = v ? `translateX(${v}px)` : '';
    };
    write(h.x.get());
    const off = h.x.on('change', write);
    h._engine.current = { goTo: E.goTo, rebind: E.bind };
    E.bind();
    const sc = dp.closest<HTMLElement>(SCROLLER);
    const measure = () => {
      h._w.current = dp.clientWidth;
      const top = sc ? dp.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop : 0;
      dp.style.setProperty('--chrome-h', `${Math.round(top)}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(dp);
    if (sc) ro.observe(sc);
    if (dp.parentElement) ro.observe(dp.parentElement);
    return () => {
      off();
      ro.disconnect();
      E.unbind();
      if (h._engine.current?.goTo === E.goTo) h._engine.current = null;
    };
  }, [E, h]);

  const pages: Array<[string, 'prev' | 'cur' | 'next']> = [
    [prev, 'prev'],
    [date, 'cur'],
    [next, 'next'],
  ];
  const canPrev = !min || prev >= min;
  const canNext = !max || next <= max;
  return (
    <div
      ref={dpRef}
      className={`dp ${className}`.trim()}
      role="group"
      aria-roledescription="pager"
      aria-label={label}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          E.stepBy(-1);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          E.stepBy(1);
        }
      }}
    >
      <div ref={trackRef} className="dp-track">
        {pages.map(([d, role]) => (
          <div key={d} className="dp-page" data-role={role} data-date={d} inert={role !== 'cur' || undefined} aria-hidden={role !== 'cur' || undefined}>
            {render(d, role === 'cur')}
          </div>
        ))}
      </div>
      <button type="button" className="dpager-sr" onClick={() => E.stepBy(-1)} disabled={!canPrev}>
        {prevLabel ?? `Previous ${step}`}
      </button>
      <button type="button" className="dpager-sr" onClick={() => E.stepBy(1)} disabled={!canNext}>
        {nextLabel ?? `Next ${step}`}
      </button>
    </div>
  );
};
