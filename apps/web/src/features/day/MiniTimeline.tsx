import { motion, useReducedMotion } from 'motion/react';
import { springs } from '@/lib/motion';
import { shortClock } from './dayWords';

export interface Stop {
  key: string;
  label: string;
  at: number;
}

/** Where `now` sits on a line of evenly spaced stops: inside the segment it falls in, 0..1 overall. */
export const stopProgress = (stops: Stop[], now: number) => {
  if (stops.length < 2) return 0;
  const n = stops.length - 1;
  if (now <= stops[0]!.at) return 0;
  for (let i = 0; i < n; i++) {
    const a = stops[i]!.at;
    const b = stops[i + 1]!.at;
    if (now < b) return (i + (b > a ? (now - a) / (b - a) : 1)) / n;
  }
  return 1;
};

/**
 * The morning as four stops on one line (wake → door → back → leave), evenly spaced so the four clock times never collide
 * at 320, with a blue "now" dot travelling along it. It is a button: a tap pushes the full Morning timeline. Its press is not
 * stopped here, so a hold on it is the hero's hold (the hero menu) and a swipe on it pages the day.
 */
export const MiniTimeline = ({ stops, now, onPress, label }: { stops: Stop[]; now: number; onPress: () => void; label: string }) => {
  const reduce = useReducedMotion();
  const p = stopProgress(stops, now);
  const n = stops.length - 1;
  return (
    <button
      type="button"
      className="mini-tl"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onPress();
      }}
    >
      <span className="mini-tl-line" aria-hidden="true">
        <span className="mini-tl-done" style={{ width: `${p * 100}%` }} />
        {stops.map((s, i) => (
          <i key={s.key} className={`mini-tl-stop ${i / n <= p ? 'past' : ''}`} style={{ left: `${(i / n) * 100}%` }} />
        ))}
        <motion.span className="mini-tl-now" initial={false} animate={{ left: `${p * 100}%` }} transition={reduce ? { duration: 0 } : springs.settle} />
      </span>
      <span className="mini-tl-times" data-n={stops.length} aria-hidden="true">
        {stops.map((s) => (
          <span key={s.key} className="mini-tl-time">
            <span className="caps">{s.label}</span>
            <span className="stamp">{shortClock(s.at)}</span>
          </span>
        ))}
      </span>
    </button>
  );
};

/** Door → back as one thin line with the now dot: the "out" hero. */
export const OutLine = ({ door, back, progress }: { door: number; back: number; progress: number }) => {
  const reduce = useReducedMotion();
  const p = Math.max(0, Math.min(1, progress));
  return (
    <div className="out-line" role="img" aria-label={`Out at ${shortClock(door)}, back by ${shortClock(back)}. ${Math.round(p * 100)}% of the way`}>
      <span className="mini-tl-line">
        <span className="mini-tl-done" style={{ width: `${p * 100}%` }} />
        <motion.span className="mini-tl-now" initial={false} animate={{ left: `${p * 100}%` }} transition={reduce ? { duration: 0 } : springs.settle} />
      </span>
      <span className="out-line-ends">
        <span className="stamp">{shortClock(door)}</span>
        <span className="stamp">{shortClock(back)}</span>
      </span>
    </div>
  );
};
