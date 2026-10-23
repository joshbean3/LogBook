import { fmtDate, shiftDays, type ISODate } from '@logbook/shared';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { haptics } from '@/lib/haptics';
import { springs } from '@/lib/motion';

/** A held arrow keeps stepping: the first repeat after this long, then one a beat. */
const REPEAT_AFTER = 420;
const REPEAT_EVERY = 170;

/** An arrow you can tap for one day or hold to run through them. */
const Arrow = ({ dir, label, onStep }: { dir: -1 | 1; label: string; onStep: (dir: -1 | 1) => void }) => {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);
  const run = (wait: number) => {
    timer.current = setTimeout(() => {
      held.current = true;
      onStep(dir);
      run(REPEAT_EVERY);
    }, wait);
  };
  return (
    <button
      type="button"
      className="daystep-arrow"
      aria-label={label}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        held.current = false;
        run(REPEAT_AFTER);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        // a hold already stepped; its release is not one more
        if (held.current) return void (held.current = false);
        onStep(dir);
      }}
    >
      {dir < 0 ? <ChevronLeft size={20} aria-hidden="true" /> : <ChevronRight size={20} aria-hidden="true" />}
    </button>
  );
};

/**
 * The day arrows in the top-right corner of a dated page (Today, Morning): back a day, on a day, hold either to run
 * through them. Off today, a Today button slides in beside them, its chevrons pointing the way home. Every step is one
 * `haptics.select()`.
 */
export const DayStepper = ({ date, today, onGo }: { date: ISODate; today: ISODate; onGo: (d: ISODate) => void }) => {
  const reduce = useReducedMotion();
  const ref = useRef(date);
  ref.current = date;
  const step = (dir: -1 | 1) => {
    haptics.select();
    onGo(shiftDays(ref.current, dir));
  };
  const ahead = date > today;
  return (
    <div className="daystep" role="group" aria-label="Change day">
      <AnimatePresence initial={false}>
        {date !== today ? (
          <motion.button
            key="today"
            type="button"
            className="daystep-today"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
            transition={springs.settle}
            onClick={() => {
              haptics.select();
              onGo(today);
            }}
            aria-label={`Back to today, ${fmtDate('long', today)}`}
          >
            {ahead ? <ChevronsLeft size={15} aria-hidden="true" /> : null}
            Today
            {ahead ? null : <ChevronsRight size={15} aria-hidden="true" />}
          </motion.button>
        ) : null}
      </AnimatePresence>
      <div className="daystep-arrows">
        <Arrow dir={-1} label={`Previous day, ${fmtDate('long', shiftDays(date, -1))}`} onStep={step} />
        <Arrow dir={1} label={`Next day, ${fmtDate('long', shiftDays(date, 1))}`} onStep={step} />
      </div>
    </div>
  );
};
