import { animate, motion, motionValue, useMotionValue } from 'motion/react';
import { useEffect, useRef } from 'react';
import { HOLD_SLOP_PX } from '@/lib/gesture';
import { hapticAtPeak } from '@/lib/haptics';
import { springs, useReduced } from '@/lib/motion';
import { usePress } from '@/ui/usePress';
import { PointsPop, usePops } from '../goals/game';

/** The pop's start velocity: `springs.complete` from rest at 1 overshoots to ≈ 1.12 (see OrbRow's POP_V). */
const POP_V = 5.5;

/**
 * A to-do's mark (§3.1 row 5, M9, §11.4): 22 px, a 44 px hit. The tap fills it on its own frame (the colour and the check,
 * no fade in), the box pops 1 → 1.12 → 1 on `springs.complete`, and `toggle` fires on the pop's peak frame
 * (`hapticAtPeak`, never in the handler). Un-checking is silent. Reduced motion: no pop; the haptic lands when the fill does.
 */
export const TodoMark = ({ on, label, onToggle, disabled, points }: { on: boolean; label: string; onToggle: (next: boolean) => void; disabled?: boolean; points?: number }) => {
  const { pops, fire } = usePops();
  const reduce = useReduced();
  const pop = useMotionValue(1);
  const press = usePress({ disabled });
  const unpeak = useRef<() => void>(() => {});
  useEffect(() => () => unpeak.current(), []);
  // the tap is the release: the fill lands on its frame (the click may come a frame later on touch, and is then swallowed);
  // a click with no pointer before it (Enter, Space, VoiceOver) toggles from the click; a press that travelled was a scroll
  const travel = useRef<{ x: number; y: number; moved: boolean; done: boolean } | null>(null);
  const tap = () => {
    const next = !on;
    if (next) {
      unpeak.current();
      if (reduce) {
        const fill = motionValue(0);
        unpeak.current = hapticAtPeak(fill, 'toggle');
        animate(fill, 1, { duration: 0.16, ease: 'linear' });
      } else {
        unpeak.current = hapticAtPeak(pop, 'toggle');
        animate(pop, 1, { ...springs.complete, velocity: POP_V });
      }
    }
    if (next && points) fire(points);
    onToggle(next);
  };
  return (
    <button type="button" className="tmark-hit" data-press="scale" role="checkbox" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => {
        const p = travel.current;
        travel.current = null;
        if (p && (p.done || p.moved)) return;
        tap();
      }}
      {...press.handlers}
      onPointerDown={(e) => {
        travel.current = e.isPrimary && (e.pointerType !== 'mouse' || e.button === 0) ? { x: e.clientX, y: e.clientY, moved: false, done: false } : null;
        press.handlers.onPointerDown?.(e);
      }}
      onPointerMove={(e) => {
        const p = travel.current;
        if (p && !p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) > HOLD_SLOP_PX) p.moved = true;
      }}
      onPointerUp={(e) => {
        press.handlers.onPointerUp?.(e);
        const p = travel.current;
        if (!p || p.moved || p.done || disabled) return;
        p.done = true;
        tap();
      }}
      onPointerCancel={(e) => {
        press.handlers.onPointerCancel?.(e);
        travel.current = null;
      }}
    >
      {points ? <PointsPop pops={pops} /> : null}
      <motion.span className={`tmark ${on ? 'on' : ''}`} style={{ scale: pop }}>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <motion.path d="M20 6 9 17l-5-5" initial={false} animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }} transition={reduce ? { duration: 0 } : on ? { pathLength: { duration: 0.16, ease: 'easeOut' }, opacity: { duration: 0.01 } } : { duration: 0.1 }} />
        </svg>
      </motion.span>
    </button>
  );
};
