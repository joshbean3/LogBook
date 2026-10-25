import { Check } from 'lucide-react';
import { animate, motionValue, useMotionValueEvent, useReducedMotion, type MotionValue } from 'motion/react';
import type * as React from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FILL_MS, HOLD_SLOP_PX } from '@/lib/gesture';
import { hapticAtPeak, haptics } from '@/lib/haptics';
import { forScale, springs } from '@/lib/motion';

/** How long the thumb rests on the ring before the session counts as done (`FILL_MS`). */
export const HOLD_TO_COMPLETE_MS = FILL_MS;
const TAP_MS = 200;
const R = 24;
const C = 2 * Math.PI * R;
/** The check grows into the circle from this scale on `settle` (§6.1 stage 2). */
const CHECK_FROM = 0.8;
/** Stage 2's opacity swap, stroke → check (§6.1). */
export const MORPH_MS = 200;
/** One frame (16.7 ms) into the linear swap. */
const FIRST_FRAME = 16.7 / MORPH_MS;

/**
 * The ring's three motion values, so the run landing can play stages 1 and 2 on the same node (§6.1): `fill` (0 → 1, the
 * stroke), `morph` (0 → 1, the stroke's layer out and the check's in) and `check` (the check's scale, 0.8 → 1 on `settle`).
 */
export interface RingDrive {
  fill: MotionValue<number>;
  morph: MotionValue<number>;
  check: MotionValue<number>;
}
export const ringDrive = (done = false): RingDrive => ({ fill: motionValue(done ? 1 : 0), morph: motionValue(done ? 1 : 0), check: motionValue(done ? 1 : CHECK_FROM) });

const settleK = () => {
  const sp = springs.settle as { stiffness: number; damping: number };
  const w = Math.sqrt(sp.stiffness);
  const z = sp.damping / (2 * w);
  return { w, z, wd: w * Math.sqrt(Math.max(1e-6, 1 - z * z)) };
};
/** `springs.settle`'s step response at `t` ms (the analytic spring: the same k and c motion integrates), 0 → 1. */
export const settleAt = (t: number) => {
  const { w, z, wd } = settleK();
  const s = t / 1000;
  return 1 - Math.exp(-z * w * s) * (Math.cos(wd * s) + ((z * w) / wd) * Math.sin(wd * s));
};
/** Its velocity at `t` ms, in units of the step per second. */
export const settleVelAt = (t: number) => {
  const { w, z, wd } = settleK();
  const s = t / 1000;
  return ((w * w) / wd) * Math.exp(-z * w * s) * Math.sin(wd * s);
};
/** Resolves on the first frame after `ms` of `fn(elapsed)` driving values: one clock, the frames' own timestamps. */
const onFrames = (t0: number, ms: number, fn: (elapsed: number) => void, alive: () => boolean = () => true) =>
  new Promise<number>((res) => {
    const tick = (t: number) => {
      // a sequence that was stopped writes nothing more (its caller resolves into its own `alive()` check)
      if (!alive()) return res(t);
      const e = t - t0;
      fn(Math.min(e, ms));
      if (e >= ms) res(t);
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

/** Resolves on the first frame whose timestamp is ≥ `t` (with that timestamp). */
export const frameAt = (t: number) =>
  new Promise<number>((res) => {
    const tick = (now: number) => (now >= t ? res(now) : requestAnimationFrame(tick));
    requestAnimationFrame(tick);
  });

/** Stage 1 of the landing (§6.1) on the frames' clock from `t0`: the stroke fills from where it is to full in `ms`, linear. */
export const fillRingAt = async (d: RingDrive, t0: number, ms: number, alive: () => boolean = () => true): Promise<number> => {
  const p0 = d.fill.get();
  const t1 = p0 >= 1 ? t0 : await onFrames(t0, ms, (e) => d.fill.set(p0 + (1 - p0) * (e / ms)), alive);
  if (alive()) d.fill.set(1);
  return t1;
};
/**
 * Stage 2 on the same clock from `t1`: the stroke's layer crossfades into the check (`MORPH_MS`, an opacity swap) while the
 * check scales 0.8 → 1 on `settle` (computed from the spring's own k and c, so a busy frame never shifts it). No React render
 * runs in it: the node takes `data-done` itself. Resolves on the frame the swap ends.
 */
export const morphRingAt = async (d: RingDrive, t1: number, reduce = false, alive: () => boolean = () => true): Promise<number> => {
  if (d.morph.get() >= 1) return t1;
  const tEnd = await onFrames(
    t1,
    MORPH_MS,
    (e) => {
      d.morph.set(e / MORPH_MS);
      d.check.set(reduce ? 1 : CHECK_FROM + (1 - CHECK_FROM) * settleAt(e));
    },
    alive,
  );
  if (!alive()) return tEnd;
  d.morph.set(1);
  // the spring keeps settling past the swap (≈ 0.99 at 200 ms); it rests on its own clock
  if (!reduce) void animate(d.check, 1, forScale(springs.settle));
  return tEnd;
};
/**
 * Stage 2 alone (the hand's completion): the stroke's layer into the check, on motion's clock. `lead` starts the swap one
 * frame in (motion's first frame samples the start value), so the check shows on the first frame after the completion.
 */
export const morphRing = (d: RingDrive, reduce = false, lead = false) =>
  new Promise<void>((res) => {
    if (d.morph.get() >= 1) return res();
    if (lead && d.morph.get() < FIRST_FRAME) d.morph.jump(FIRST_FRAME);
    d.check.jump(reduce ? 1 : CHECK_FROM);
    if (!reduce) void animate(d.check, 1, forScale(springs.settle));
    void animate(d.morph, 1, { duration: MORPH_MS / 1000, ease: 'linear', onComplete: () => res() });
  });

/**
 * Hold-to-complete (docs/feel.md §3.2, §6.2; contracts §F): the deliberate way to mark a session done by hand. The ring fills
 * while the thumb rests on it (`FILL_MS`, linear); full, the session is done: `haptics.success()` (the day's one, M18) and
 * `onComplete`, and the stroke crossfades into the check (stage 2 of the landing). Let go early and it drains back on
 * `springs.settle`; a quick tap is `onTap` (the session sheet). Enter or Space completes at once (VoiceOver and the keyboard).
 *
 * - The ring and the check are one node (`.hold-ring`, `.hold-ring[data-done]`): two layers inside the same button, the
 *   stroke's and the check's, so the run landing's morph and a held ring never swap elements. `drive` hands the three
 *   motion values to the landing (`useStravaLanding`), which plays stages 1 and 2 on them.
 * - `touch-action: pan-y` and no pointer capture: a horizontal swipe that starts on the ring still pages the day (the pager
 *   captures the pointer on its lock and the ring lets go), a vertical one scrolls. The hero ignores pointers that start
 *   here, so a hold on the ring is only ever a completion (no pre-grow, no menu, no `lift`).
 * - A quick tap opens on the click, not on pointerup: the click a touch makes after pointerup would otherwise land on the
 *   sheet's new scrim. If no click follows, a short timer opens it.
 * - 48 on the hero (a 56 hit), 40 on the second-session card and the Close row.
 */
export const HoldRing = ({ label, onComplete, onTap, size = 48, done: doneProp, drive, haptic = 'success' }: { label: string; onComplete: () => void | Promise<unknown>; onTap: () => void; size?: 48 | 40; done?: boolean; drive?: RingDrive; haptic?: 'success' | 'toggle' }): React.JSX.Element => {
  const reduce = useReducedMotion() ?? false;
  const [own] = useState(() => ringDrive(!!doneProp));
  const d = drive ?? own;
  const p = d.fill;
  const [doneSelf, setDone] = useState(false);
  // a completion shows at once, from the ring's own latch: the caller's `done` comes from the page's log, which is rendered
  // in the background and can arrive most of a second later at 4× (code review 2 #3)
  const done = doneSelf || !!doneProp;
  // a `done` the caller takes back (true → false: the session cleared elsewhere) clears the latch too, so it is the empty
  // ring again and answers the next hold (code review 1 #2); so does a completion whose write fails (`onComplete`'s promise)
  const prevProp = useRef(doneProp);
  useEffect(() => {
    const was = prevProp.current;
    prevProp.current = doneProp;
    if (was && doneProp === false) setDone(false);
  }, [doneProp]);
  const g = useRef<{ id: number; x: number; y: number; t: number; anim: ReturnType<typeof animate> | null } | null>(null);
  const tapAt = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef({ onComplete, onTap });
  latest.current = { onComplete, onTap };
  const first = useRef(true);
  const selfMorph = useRef(false);
  useEffect(() => {
    // the node follows `done` (unless the landing drives it): done → the check (stage 2 from where the stroke is); not → the empty ring
    const mount = first.current;
    first.current = false;
    if (drive) return;
    if (done) {
      if (mount) return;
      // a hold that completed here started its swap in `finish`, in the completing frame's own task
      if (selfMorph.current) {
        selfMorph.current = false;
        return;
      }
      p.stop();
      p.set(1);
      void morphRing(d, reduce);
    } else {
      setDone(false);
      selfMorph.current = false;
      if (g.current) return;
      d.morph.jump(0);
      d.check.jump(CHECK_FROM);
      if (!mount) p.set(0);
    }
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps
  // the three values are written to the node on their change, synchronously (not through motion's next-frame style batch),
  // so a frame shows exactly what the clock set on it; the landing's stage 2 runs with no render, so the node says it is done
  // the frame its check starts to show
  const btn = useRef<HTMLButtonElement>(null);
  const fillEl = useRef<SVGCircleElement>(null);
  const faceEl = useRef<HTMLSpanElement>(null);
  const doneEl = useRef<HTMLSpanElement>(null);
  // the three values reach the node only here, never through React's `style` (a page rendered in the background reads them
  // mid-animation and its later commit would write that stale value back over the frame's: a check stuck part-way)
  useLayoutEffect(() => {
    if (fillEl.current) fillEl.current.style.strokeDashoffset = String(C * (1 - p.get()));
    if (faceEl.current) faceEl.current.style.opacity = String(1 - d.morph.get());
    if (doneEl.current) {
      doneEl.current.style.opacity = String(d.morph.get());
      doneEl.current.style.transform = `scale(${d.check.get()})`;
    }
  }, [d, p]);
  useMotionValueEvent(p, 'change', (v) => {
    if (fillEl.current) fillEl.current.style.strokeDashoffset = String(C * (1 - v));
  });
  useMotionValueEvent(d.check, 'change', (v) => {
    if (doneEl.current) doneEl.current.style.transform = `scale(${v})`;
  });
  useMotionValueEvent(d.morph, 'change', (v) => {
    if (faceEl.current) faceEl.current.style.opacity = String(1 - v);
    if (doneEl.current) doneEl.current.style.opacity = String(v);
    const el = btn.current;
    if (!drive || !el) return;
    // a landing that was left before its end puts the ring back (useStravaLanding): the node says so again
    if (v <= 0) {
      if (!done && el.hasAttribute('data-done')) {
        el.removeAttribute('data-done');
        el.setAttribute('aria-pressed', 'false');
      }
      return;
    }
    if (el.hasAttribute('data-done')) return;
    el.setAttribute('data-done', 'true');
    el.setAttribute('aria-pressed', 'true');
  });
  /** The window listeners of the pointer being followed (removed exactly as added). */
  const attached = useRef<null | { move: (e: PointerEvent) => void; up: (e: PointerEvent) => void; cancel: (e: PointerEvent) => void }>(null);
  const detach = () => {
    const a = attached.current;
    if (!a) return;
    attached.current = null;
    window.removeEventListener('pointermove', a.move);
    window.removeEventListener('pointerup', a.up);
    window.removeEventListener('pointercancel', a.cancel);
  };
  useEffect(
    () => () => {
      g.current?.anim?.stop();
      clearTimeout(tapTimer.current);
      detach();
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  /** The click that ends a completing hold is not a tap (it would open the sheet over the landing). */
  const quietUntil = useRef(0);
  const finish = () => {
    quietUntil.current = performance.now() + 700;
    g.current = null;
    detach();
    setDone(true);
    // the check starts in this task, ahead of any render (code review 2 #3); the caller sends its write after this frame
    p.stop();
    p.set(1);
    selfMorph.current = true;
    const swapped = morphRing(d, reduce, true);
    // the day's session: its one success (M18); any other (the second session of the day): a toggle on the frame the check
    // is fully in (§11.4, feel review 1 #7), the swap's last frame. It listens to a value of its own: `hapticAtPeak` lets go
    // of its value inside that value's change notification, which skips the listener after it, and on `morph` that was the
    // node's own (the check stayed at the opacity of the frame before: 0.46 at 4×; WP1 request in docs/reviews/wp2.md)
    if (haptic === 'toggle') {
      const peak = motionValue(0);
      hapticAtPeak(peak, 'toggle');
      void swapped.then(() => peak.set(1));
    } else haptics.success();
    const w = latest.current.onComplete();
    if (w && typeof w.then === 'function') w.then(undefined, () => setDone(false));
  };
  const drain = () => void animate(p, 0, reduce ? { duration: 0.15 } : springs.settle);
  const cancel = () => {
    const s = g.current;
    if (!s) return;
    s.anim?.stop();
    g.current = null;
    detach();
    drain();
  };
  const tap = () => {
    clearTimeout(tapTimer.current);
    tapAt.current = 0;
    latest.current.onTap();
  };
  // the pointer is followed from window: the pager may capture it on its lock, which takes its moves away from the ring
  const follow = () => {
    detach();
    const a = {
      move: (e: PointerEvent) => {
        const s = g.current;
        if (s && e.pointerId === s.id && Math.hypot(e.clientX - s.x, e.clientY - s.y) > HOLD_SLOP_PX) cancel();
      },
      up: (e: PointerEvent) => {
        const s = g.current;
        if (!s || e.pointerId !== s.id) return;
        const quick = performance.now() - s.t < TAP_MS;
        cancel();
        if (!quick) return;
        // wait for the click (see above); open anyway if none comes
        tapAt.current = performance.now();
        clearTimeout(tapTimer.current);
        tapTimer.current = setTimeout(() => tapAt.current && tap(), 350);
      },
      cancel: (e: PointerEvent) => {
        if (g.current && e.pointerId === g.current.id) cancel();
      },
    };
    attached.current = a;
    window.addEventListener('pointermove', a.move, { passive: true });
    window.addEventListener('pointerup', a.up);
    window.addEventListener('pointercancel', a.cancel);
  };

  return (
    <button
      ref={btn}
      type="button"
      className={`hold-ring ${done ? 'is-done' : ''}`}
      data-done={done || undefined}
      data-size={size}
      aria-label={done ? `${label}: done` : label}
      aria-pressed={done}
      onPointerDown={(e) => {
        if (done || drive || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
        cancel();
        const anim = animate(p, 1, { duration: (FILL_MS / 1000) * (1 - p.get()), ease: 'linear', onComplete: () => g.current && finish() });
        g.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), anim };
        follow();
      }}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        e.stopPropagation();
        if (performance.now() < quietUntil.current) return;
        // Enter / Space (detail 0) completes at once
        if (e.detail === 0 && !done && !drive) {
          p.set(1);
          finish();
          return;
        }
        if (tapAt.current && performance.now() - tapAt.current < 600) tap();
        else if (done) latest.current.onTap();
      }}
    >
      {/* the stroke's layer: the track, the fill and a faint check that says what holding does */}
      <span ref={faceEl} className="hold-face" aria-hidden="true">
        <svg className="hold-svg" viewBox="0 0 56 56">
          <circle cx={28} cy={28} r={R} className="hold-track" />
          <circle ref={fillEl} cx={28} cy={28} r={R} className="hold-fill" strokeDasharray={C} transform="rotate(-90 28 28)" />
        </svg>
        <Check className="hold-check" size={size === 40 ? 18 : 22} strokeWidth={2.75} />
      </span>
      {/* the check's layer, in the same circle: crossfades in and grows 0.8 → 1 */}
      <span ref={doneEl} className="hold-done" aria-hidden="true">
        <Check size={size === 40 ? 18 : 22} strokeWidth={2.75} />
      </span>
    </button>
  );
};
