import { Check } from 'lucide-react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { haptics } from '@/lib/haptics';
import { COMPLETE_SCALE, springs } from '@/lib/motion';

/** How long the thumb rests on the ring before the session counts as done. */
export const HOLD_TO_COMPLETE_MS = 400;
const TAP_MS = 200;
const SLOP = 8;
const R = 24;
const C = 2 * Math.PI * R;

/**
 * Hold-to-complete: the deliberate way to mark a session done by hand (Streaks' grammar). The ring fills while the thumb rests
 * on it (400ms); full, it pops on `springs.complete`, fires `haptics.success()` and calls `onComplete`. Let go early and it
 * drains back; a quick tap is `onTap` (the session sheet). Keyboard and VoiceOver: Enter or Space completes at once.
 *
 * - The press is not stopped at the ring: a swipe that starts on it still pages the day (the date pager takes the pointer
 *   once the finger travels; the ring has let go by then). The hero's long-press ignores presses that start on `.hold-ring`,
 *   so a hold here is only ever a completion.
 * - A quick tap opens the sheet on the click, not on pointerup: the click a touch makes after pointerup would otherwise land
 *   on the sheet's new scrim and close it again. If no click follows (a browser that drops it), a short timer opens it.
 * - Contracts §F: the ring and the check are one node. `done` (controlled, e.g. a session already marked done or the run
 *   landing's morph) shows the check in place (`.hold-ring[data-done]`); without it the ring keeps its own state after a
 *   completed hold. `size` draws the ring at 48 (the hero) or 40 (the second-session card, the Close row); unset, it keeps
 *   the current 64 px box.
 */
export const HoldRing = ({ label, onComplete, onTap, size, done: doneProp }: { label: string; onComplete: () => void; onTap: () => void; size?: 48 | 40; done?: boolean }) => {
  const reduce = useReducedMotion();
  const p = useMotionValue(doneProp ? 1 : 0);
  const dash = useTransform(p, (v) => C * (1 - v));
  const [doneSelf, setDone] = useState(false);
  const done = doneProp ?? doneSelf;
  const g = useRef<{ id: number; x: number; y: number; t: number; anim: ReturnType<typeof animate> | null } | null>(null);
  useEffect(() => {
    // a controlled change: the fill follows (full with the check, empty without)
    if (doneProp === undefined) return;
    if (!g.current) p.set(doneProp ? 1 : 0);
  }, [doneProp, p]);
  const tapAt = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(
    () => () => {
      g.current?.anim?.stop();
      clearTimeout(tapTimer.current);
    },
    [],
  );

  const finish = () => {
    g.current = null;
    setDone(true);
    haptics.success();
    onComplete();
  };
  const drain = () => {
    void animate(p, 0, reduce ? { duration: 0.15 } : springs.settle);
  };
  const cancel = () => {
    const s = g.current;
    if (!s) return;
    s.anim?.stop();
    g.current = null;
    drain();
  };
  const tap = () => {
    clearTimeout(tapTimer.current);
    tapAt.current = 0;
    onTap();
  };

  return (
    <motion.button
      type="button"
      className={`hold-ring ${done ? 'is-done' : ''}`}
      data-done={done || undefined}
      data-size={size}
      aria-label={label}
      animate={done && !reduce ? { scale: [1, COMPLETE_SCALE, 1] } : { scale: 1 }}
      transition={springs.complete}
      onPointerDown={(e) => {
        if (done || (e.pointerType === 'mouse' && e.button !== 0)) return;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* gone */
        }
        const anim = animate(p, 1, { duration: (HOLD_TO_COMPLETE_MS / 1000) * (1 - p.get()), ease: 'linear', onComplete: () => g.current && finish() });
        g.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), anim };
      }}
      onPointerMove={(e) => {
        const s = g.current;
        if (s && e.pointerId === s.id && Math.hypot(e.clientX - s.x, e.clientY - s.y) > SLOP) cancel();
      }}
      onPointerUp={() => {
        const s = g.current;
        if (!s) return;
        const quick = performance.now() - s.t < TAP_MS;
        cancel();
        if (!quick) return;
        // wait for the click (see above); open anyway if none comes
        tapAt.current = performance.now();
        clearTimeout(tapTimer.current);
        tapTimer.current = setTimeout(() => tapAt.current && tap(), 350);
      }}
      onPointerCancel={cancel}
      onLostPointerCapture={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        e.stopPropagation();
        // Enter / Space (detail 0) completes at once
        if (e.detail === 0 && !done) {
          p.set(1);
          finish();
          return;
        }
        if (tapAt.current && performance.now() - tapAt.current < 600) tap();
      }}
    >
      <svg viewBox="0 0 56 56" aria-hidden="true">
        <circle cx={28} cy={28} r={R} className="hold-track" />
        <motion.circle cx={28} cy={28} r={R} className="hold-fill" strokeDasharray={C} style={{ strokeDashoffset: dash }} transform="rotate(-90 28 28)" />
      </svg>
      <Check className="hold-check" size={22} strokeWidth={2.75} aria-hidden="true" />
    </motion.button>
  );
};
