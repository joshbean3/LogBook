import { animate, useMotionValue, useReducedMotion } from 'motion/react';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { springs } from '@/lib/motion';
import { useFirstToday } from './useFirstToday';

export interface TickerProps {
  value: number;
  /** How the number is written. Default: rounded to an integer. */
  format?: (v: number) => string;
  /**
   * Where a mount animation starts. Without `onceADay` it animates from here on every mount; with it, only on the first
   * view of the day. Without either, the first value is shown as is and only later changes animate.
   */
  from?: number;
  /** A `useFirstToday` key: the mount animation (from `from`, default 0) runs once a day. */
  onceADay?: string;
  className?: string;
}

/**
 * A number that springs to its value on `springs.number`. By default it does not animate on mount (no counting up from 0
 * on a revisit); it animates on change. `from` + `onceADay` give the once-a-day count-up for a hero. The animated text is
 * hidden from VoiceOver, which reads the final value once. Reduced motion: the value is shown directly.
 */
export const Ticker = ({ value, format = (v) => String(Math.round(v)), from, onceADay, className }: TickerProps) => {
  const reduce = useReducedMotion();
  const first = useFirstToday(onceADay ?? null);
  const startAt = onceADay ? (first ? (from ?? 0) : value) : (from ?? value);
  const mv = useMotionValue(startAt);
  const out = useRef<HTMLSpanElement>(null);
  const fmt = useRef(format);
  fmt.current = format;
  // React renders the first text once; from then on the spring writes the node directly, so a re-render never flashes the end value
  const initialText = useRef(format(startAt)).current;

  useLayoutEffect(() => {
    const write = (v: number) => {
      if (out.current) out.current.textContent = fmt.current(v);
    };
    write(mv.get());
    return mv.on('change', write);
  }, [mv]);
  useEffect(() => {
    if (!Number.isFinite(value)) return;
    if (reduce || !Number.isFinite(mv.get())) {
      mv.jump(value);
      return;
    }
    if (mv.get() === value) return;
    const c = animate(mv, value, springs.number);
    return () => c.stop();
  }, [value, reduce, mv]);
  // a format change (units) rewrites the shown value
  useEffect(() => {
    if (out.current) out.current.textContent = format(mv.get());
  });

  return (
    <span className={className}>
      <span ref={out} aria-hidden="true">
        {initialText}
      </span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
};
