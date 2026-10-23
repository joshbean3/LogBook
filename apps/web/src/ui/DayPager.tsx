import { addMonths, shiftDays } from '@logbook/shared';
import { motion, useMotionValue, useTransform, type MotionValue } from 'motion/react';
import type * as React from 'react';
import { useMemo, useRef, type ReactNode } from 'react';

/**
 * DayPager v2 (docs/feel.md §9.2, contracts §B.1). STEP 1 OF WP1: the handle and the props are final and the DOM is the
 * contract's (prev, cur, next keyed by date; the hidden Previous/Next buttons); the drag, the springs, the catch and goTo's
 * slide arrive in the next step. Until then goTo commits at once and the buttons and arrow keys step a page.
 */
export interface DayPagerHandle {
  /** The track's translateX in px; 0 = the shown page at rest. */
  readonly x: MotionValue<number>;
  /** p = −x / W ∈ [−1, 1] (positive = toward next). */
  readonly progress: MotionValue<number>;
  /** W = the pager's clientWidth, never innerWidth. */
  readonly width: () => number;
  /** Slide to a date ('auto': adjacent / 2–7 / far crossfade; 'crossfade' at any distance). */
  goTo: (date: string, opts?: { mode?: 'auto' | 'crossfade' }) => void;
  /** The destination of a running goTo (null otherwise) and the number of pages it represents. */
  readonly target: MotionValue<string | null>;
  readonly span: MotionValue<number>;
  /** Bind the drag recogniser to extra elements outside the pager (the DateStrip and the large title row). */
  attach: (els: Array<HTMLElement | null>) => void;
  /** True while a finger drives the track or a release spring runs. */
  readonly moving: MotionValue<boolean>;
}

interface HandleInternal extends DayPagerHandle {
  /** Set by the mounted pager: how it commits a date. */
  _commit: { current: ((date: string) => void) | null };
  _el: { current: HTMLDivElement | null };
  _attached: { current: Array<HTMLElement | null> };
}

export const useDayPagerHandle = (): DayPagerHandle => {
  const x = useMotionValue(0);
  const target = useMotionValue<string | null>(null);
  const span = useMotionValue(1);
  const moving = useMotionValue(false);
  const el = useRef<HTMLDivElement | null>(null);
  const commit = useRef<((date: string) => void) | null>(null);
  const attached = useRef<Array<HTMLElement | null>>([]);
  const progress = useTransform(x, (v) => {
    const w = el.current?.clientWidth || 1;
    return Math.max(-1, Math.min(1, -v / w));
  });
  return useMemo<HandleInternal>(
    () => ({
      x,
      progress,
      target,
      span,
      moving,
      width: () => el.current?.clientWidth ?? 0,
      goTo: (date) => commit.current?.(date),
      attach: (els) => {
        attached.current = els;
      },
      _commit: commit,
      _el: el,
      _attached: attached,
    }),
    [x, progress, target, span, moving],
  );
};

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

export const DayPager = ({ date, step, onCommit, render, handle, min, max, label = step === 'week' ? 'Week' : step === 'month' ? 'Month' : 'Day', prevLabel, nextLabel, className = '' }: DayPagerProps): React.JSX.Element => {
  const h = handle as HandleInternal;
  const prev = stepOf(date, step, -1);
  const next = stepOf(date, step, 1);
  const canPrev = !min || prev >= min;
  const canNext = !max || next <= max;
  h._commit.current = (d) => {
    if (d !== date) onCommit(d);
  };
  const go = (dir: -1 | 1) => {
    if (dir < 0 ? !canPrev : !canNext) return;
    onCommit(dir < 0 ? prev : next);
  };
  const pages: Array<[string, 'prev' | 'cur' | 'next']> = [
    [prev, 'prev'],
    [date, 'cur'],
    [next, 'next'],
  ];
  return (
    <div
      ref={(el) => {
        h._el.current = el;
      }}
      className={`dp ${className}`}
      role="group"
      aria-roledescription="pager"
      aria-label={label}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'ArrowLeft') go(-1);
        else if (e.key === 'ArrowRight') go(1);
      }}
    >
      <motion.div className="dp-track" style={{ x: h.x }}>
        {pages.map(([d, role]) => (
          <div key={d} className="dp-page" data-role={role} data-date={d} inert={role !== 'cur' || undefined} aria-hidden={role !== 'cur' || undefined}>
            {render(d, role === 'cur')}
          </div>
        ))}
      </motion.div>
      <button type="button" className="dpager-sr" onClick={() => go(-1)} disabled={!canPrev}>
        {prevLabel ?? `Previous ${step}`}
      </button>
      <button type="button" className="dpager-sr" onClick={() => go(1)} disabled={!canNext}>
        {nextLabel ?? `Next ${step}`}
      </button>
    </div>
  );
};
