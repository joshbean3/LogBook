import { useState, type ReactNode } from 'react';
import { deprecated } from '@/lib/motion';
import { DayPager, useDayPagerHandle } from './DayPager';

/*
 * @deprecated module (contracts rule 5): the old controlled pager's API, kept for the pages that still import it (DayView's
 * hero, MorningView, PlanView, the session sheet's DayPicker) and implemented on DayPager v2. WP1 deletes it after the last
 * of them lands. No haptic on a commit (§11.4); the drag, the catch, the clamp and the springs are DayPager's.
 */
export interface DatePagerProps {
  /** The date shown (YYYY-MM-DD). The pager is controlled: it calls `onChange` and waits for the new `date`. */
  date: string;
  onChange: (date: string) => void;
  /** Renders a date's content (the neighbours are always mounted now). */
  render: (date: string) => ReactNode;
  /** One page is a day (default) or a week (7 days). */
  step?: 'day' | 'week';
  /** Bounds (inclusive). A drag past them rubber-bands. */
  min?: string;
  max?: string;
  prevLabel?: string;
  nextLabel?: string;
  label?: string;
  className?: string;
  /** No drag (the sr buttons and arrow keys still step). */
  disabled?: boolean;
}

/**
 * @deprecated use `DayPager` with `useDayPagerHandle`. The host's `date` arrives a render (or a router round trip) after
 * `onChange`, so the adapter shows the committed date itself at once (DayPager needs it in the same commit) and follows the
 * host's `date` whenever that changes. A page that is not the whole page body keeps its own height (`.dp-intrinsic`).
 */
export const DatePager = ({ date, onChange, render, step = 'day', min, max, prevLabel, nextLabel, label, className = '', disabled }: DatePagerProps) => {
  deprecated('DatePager');
  const handle = useDayPagerHandle();
  const [shown, setShown] = useState(date);
  const [seen, setSeen] = useState(date);
  if (date !== seen) {
    setSeen(date);
    setShown(date);
  }
  return (
    <DayPager
      date={shown}
      step={step}
      handle={handle}
      onCommit={(d) => {
        setShown(d);
        if (d !== date) onChange(d);
      }}
      render={(d) => render(d)}
      min={min}
      max={max}
      ignore={disabled ? '*' : undefined}
      label={label}
      prevLabel={prevLabel}
      nextLabel={nextLabel}
      className={`dp-intrinsic ${className}`.trim()}
    />
  );
};
