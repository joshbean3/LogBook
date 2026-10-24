import { Check } from 'lucide-react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import type * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { FILL_MS, HOLD_SLOP_PX } from '@/lib/gesture';
import { haptics } from '@/lib/haptics';
import { COMPLETE_SCALE, springs } from '@/lib/motion';

/** How long the thumb rests on the ring before the session counts as done (`FILL_MS`). */
export const HOLD_TO_COMPLETE_MS = FILL_MS;
const TAP_MS = 200;
const R = 24;
const C = 2 * Math.PI * R;

/**
 * Hold-to-complete (docs/feel.md §3.2, §6.2; contracts §F): the deliberate way to mark a session done by hand. The ring fills
 * while the thumb rests on it (`FILL_MS`, linear); full, the session is done: `haptics.success()` (the day's one, M18) and
 * `onComplete`. Let go early and it drains back on `springs.settle`; a quick tap is `onTap` (the session sheet). Enter or
 * Space completes at once (VoiceOver and the keyboard).
 *
 * - The ring and the check are one node (`.hold-ring`, `.hold-ring[data-done]`): `done` crossfades the stroke into the check
 *   in place, so the run landing's morph and a held ring never swap elements.
 * - `touch-action: pan-y` and no pointer capture: a horizontal swipe that starts on the ring still pages the day (the pager
 *   captures the pointer on its lock and the ring lets go), a vertical one scrolls. The hero ignores pointers that start
 *   here, so a hold on the ring is only ever a completion (no pre-grow, no menu, no `lift`).
 * - A quick tap opens on the click, not on pointerup: the click a touch makes after pointerup would otherwise land on the
 *   sheet's new scrim. If no click follows, a short timer opens it.
 * - 48 on the hero (a 56 hit), 40 on the second-session card and the Close row.
 */
export const HoldRing = ({ label, onComplete, onTap, size = 48, done: doneProp }: { label: string; onComplete: () => void; onTap: () => void; size?: 48 | 40; done?: boolean }): React.JSX.Element => {
  const reduce = useReducedMotion();
  const p = useMotionValue(doneProp ? 1 : 0);
  const dash = useTransform(p, (v) => C * (1 - v));
  const [doneSelf, setDone] = useState(false);
  const done = doneProp ?? doneSelf;
  const g = useRef<{ id: number; x: number; y: number; t: number; anim: ReturnType<typeof animate> | null } | null>(null);
  const tapAt = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef({ onComplete, onTap });
  latest.current = { onComplete, onTap };
  useEffect(() => {
    // a controlled change: the fill follows (full with the check, empty without)
    if (doneProp === undefined) return;
    if (!g.current) p.set(doneProp ? 1 : 0);
    if (!doneProp) setDone(false);
  }, [doneProp, p]);
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
    haptics.success();
    latest.current.onComplete();
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
    <motion.button
      type="button"
      className={`hold-ring ${done ? 'is-done' : ''}`}
      data-done={done || undefined}
      data-size={size}
      aria-label={done ? `${label}: done` : label}
      aria-pressed={done}
      animate={done && !reduce ? { scale: [1, COMPLETE_SCALE, 1] } : { scale: 1 }}
      transition={springs.complete}
      onPointerDown={(e) => {
        if (done || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
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
        if (e.detail === 0 && !done) {
          p.set(1);
          finish();
          return;
        }
        if (tapAt.current && performance.now() - tapAt.current < 600) tap();
        else if (done) latest.current.onTap();
      }}
    >
      <svg className="hold-svg" viewBox="0 0 56 56" aria-hidden="true">
        <circle cx={28} cy={28} r={R} className="hold-track" />
        <motion.circle cx={28} cy={28} r={R} className="hold-fill" strokeDasharray={C} style={{ strokeDashoffset: dash }} transform="rotate(-90 28 28)" />
      </svg>
      <Check className="hold-check" size={size === 40 ? 18 : 22} strokeWidth={2.75} aria-hidden="true" />
    </motion.button>
  );
};
