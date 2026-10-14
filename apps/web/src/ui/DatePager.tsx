import { shiftDays } from '@logbook/shared';
import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { haptics } from '@/lib/haptics';
import { springs } from '@/lib/motion';

export interface DatePagerProps {
  /** The date shown (YYYY-MM-DD). The pager is controlled: it calls `onChange` and waits for the new `date`. */
  date: string;
  onChange: (date: string) => void;
  /** Renders a date's content. Called for the neighbours too while a drag is under way. */
  render: (date: string) => ReactNode;
  /** One page is a day (default) or a week (7 days). */
  step?: 'day' | 'week';
  /** Bounds (inclusive). A drag past them rubber-bands. */
  min?: string;
  max?: string;
  /** Names for VoiceOver: "Previous day", "Next day" by default. */
  prevLabel?: string;
  nextLabel?: string;
  /** The pager's accessible name, e.g. "Day". */
  label?: string;
  className?: string;
  disabled?: boolean;
}

const COMMIT = 0.3;
const VELOCITY = 500;
const LOCK = 10;
/** Matches --dpager-gap: the space between pages while they slide. */
const PAGE_GAP = 16;

/**
 * A horizontal pager for date-keyed content (the Today hero, Morning's timeline, Plan's week). It renders the current date;
 * a drag follows the finger 1:1 with the neighbouring date's content alongside, and commits to the previous or next date at
 * 30% of the width or a 500px/s fling, with `haptics.select()` on the commit, sliding the new content home on `springs.page`.
 * A `date` change from outside (the "Today" chip) slides in from the side it lies on. Keyboard: Left/Right arrows when the
 * pager has focus; VoiceOver: the hidden Previous/Next buttons. The first 10px decide the direction: a vertical scroll wins.
 * Reduced motion: a 150ms crossfade, and the drag still works.
 */
export const DatePager = ({ date, onChange, render, step = 'day', min, max, prevLabel, nextLabel, label = step === 'week' ? 'Week' : 'Day', className = '', disabled }: DatePagerProps) => {
  const reduce = useReducedMotion();
  const n = step === 'week' ? 7 : 1;
  const prev = shiftDays(date, -n);
  const next = shiftDays(date, n);
  const canPrev = !min || prev >= min;
  const canNext = !max || next <= max;
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  // neighbours are rendered only while they can be seen: during a drag and the slide that follows
  const [warm, setWarm] = useState(false);
  const cool = useRef<ReturnType<typeof setTimeout>>(undefined);
  const coolSoon = () => {
    clearTimeout(cool.current);
    cool.current = setTimeout(() => setWarm(false), 500);
  };
  useEffect(() => () => clearTimeout(cool.current), []);
  const [fade, setFade] = useState(0);
  const g = useRef({ id: -1, x0: 0, y0: 0, lock: null as null | 'x' | 'y', w: 1, samples: [] as Array<[number, number]> });
  const shown = useRef(date);

  // the new date arrived: carry the offset over so the content keeps its place, then slide it home
  useLayoutEffect(() => {
    const was = shown.current;
    shown.current = date;
    if (was === date) return;
    const w = ref.current?.offsetWidth ?? window.innerWidth;
    if (reduce) {
      x.jump(0);
      setFade((f) => f + 1);
      return;
    }
    const dir = date > was ? 1 : -1;
    // after a drag the old content sits at x; the new one was beside it, at x + dir * w
    setWarm(true);
    coolSoon();
    x.jump(x.get() + dir * (w + PAGE_GAP));
    const c = animate(x, 0, springs.page);
    return () => c.stop();
  }, [date, reduce, x]);

  const go = (dir: -1 | 1) => {
    if (disabled || (dir < 0 ? !canPrev : !canNext)) return;
    haptics.select();
    onChange(dir < 0 ? prev : next);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    g.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, lock: null, w: ref.current?.offsetWidth ?? 1, samples: [[e.clientX, performance.now()]] };
    x.stop();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const st = g.current;
    if (e.pointerId !== st.id) return;
    const dx = e.clientX - st.x0;
    const dy = e.clientY - st.y0;
    if (!st.lock) {
      if (Math.abs(dx) < LOCK && Math.abs(dy) < LOCK) return;
      st.lock = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (st.lock === 'y') return;
      clearTimeout(cool.current);
      setWarm(true);
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* gone */
      }
    }
    if (st.lock !== 'x') return;
    const blocked = (dx > 0 && !canPrev) || (dx < 0 && !canNext);
    x.set(blocked ? dx * 0.2 : dx);
    st.samples.push([e.clientX, performance.now()]);
    if (st.samples.length > 6) st.samples.shift();
  };
  const end = (cancelled: boolean) => {
    const st = g.current;
    st.id = -1;
    if (st.lock !== 'x') return;
    st.lock = null;
    const v0 = st.samples[0]!;
    const v1 = st.samples[st.samples.length - 1]!;
    const v = v1[1] > v0[1] ? ((v1[0] - v0[0]) / (v1[1] - v0[1])) * 1000 : 0;
    const off = x.get();
    const dir: -1 | 1 | 0 = cancelled ? 0 : off < -st.w * COMMIT || v < -VELOCITY ? 1 : off > st.w * COMMIT || v > VELOCITY ? -1 : 0;
    if (dir && (dir < 0 ? canPrev : canNext)) go(dir);
    else void animate(x, 0, reduce ? { duration: 0.15 } : springs.settle);
    // neighbours stay rendered until the slide home is done
    coolSoon();
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(1);
    }
  };
  const showNeighbours = !reduce && warm;

  return (
    <div ref={ref} className={`dpager ${className}`} role="group" aria-roledescription="pager" aria-label={label} tabIndex={0} onKeyDown={onKeyDown}>
      <motion.div className="dpager-track" style={{ x }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={() => end(false)} onPointerCancel={() => end(true)}>
        {showNeighbours && canPrev ? (
          <div className="dpager-page prev" aria-hidden="true" inert>
            {render(prev)}
          </div>
        ) : null}
        <motion.div key={reduce ? `${date}-${fade}` : 'cur'} className="dpager-page cur" initial={reduce ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
          {render(date)}
        </motion.div>
        {showNeighbours && canNext ? (
          <div className="dpager-page next" aria-hidden="true" inert>
            {render(next)}
          </div>
        ) : null}
      </motion.div>
      <button type="button" className="dpager-sr" onClick={() => go(-1)} disabled={!canPrev || disabled}>
        {prevLabel ?? `Previous ${step}`}
      </button>
      <button type="button" className="dpager-sr" onClick={() => go(1)} disabled={!canNext || disabled}>
        {nextLabel ?? `Next ${step}`}
      </button>
    </div>
  );
};
