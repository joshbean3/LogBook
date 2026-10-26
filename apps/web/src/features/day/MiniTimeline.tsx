import type * as React from 'react';
import { usePress } from '@/ui/usePress';
import { shortClock } from './dayWords';
import { useReleaseTap } from './release';

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

/** The line and its dots: the part behind `now` lit by a scaleX, the now dot placed by a translate (transform only, §10). */
const Line = ({ p, n }: { p: number; n: number }) => (
  <span className="mini-tl-line" aria-hidden="true">
    <span className="mini-tl-done" style={{ transform: `scaleX(${p})` }} />
    {Array.from({ length: n + 1 }, (_, i) => (
      <i key={i} className={`mini-tl-stop ${n && p > 0 && i / n <= p ? 'past' : ''}`} style={{ left: `${n ? (i / n) * 100 : 0}%` }} />
    ))}
    {/* the track spans the line; translating it by p of its own width puts the dot at p (static per minute) */}
    <span className="mini-tl-nowtrack" style={{ transform: `translateX(${(p * 100).toFixed(3)}%)` }}>
      <i className="mini-tl-now" />
    </span>
  </span>
);

/**
 * The morning as four stops on one line (Wake · Door · Back · Leave), evenly spaced so the four clock times never collide at
 * 320 (docs/feel.md §3.2, contracts §F): a 2 px line, 8 px dots, the accent now dot (static per minute), labels 11/13 caps and
 * times 13/18 tabular, 44 tall. With `onPress` it is a button (the hero's deck: a tap pushes This morning) with the dim press
 * on touch-down; without, a picture of the line (the Now card's landing). `shared` sets `data-shared`, the id the
 * Today → This morning flyer travels between (`morning-line-<date>`); the hero ignores pointers that start on it, so its tap
 * never also opens the session, and a horizontal swipe on it still pages the day.
 */
export const MiniTimeline = ({ stops, now, onPress, label, shared }: { stops: Stop[]; now: number; onPress?: () => void; label: string; shared?: string }): React.JSX.Element => {
  const press = usePress({ disabled: !onPress });
  // the push starts on the touch's release, not on the click a task later (§0.2 6:30 step 3)
  const rel = useReleaseTap(() => onPress?.());
  const p = stopProgress(stops, now);
  const n = stops.length - 1;
  const body = (
    <>
      <Line p={p} n={n} />
      <span className="mini-tl-times" data-n={stops.length} aria-hidden="true">
        {stops.map((s, i) => (
          <span key={s.key} className="mini-tl-time" data-edge={i === 0 ? 'start' : i === n ? 'end' : undefined} style={{ left: `${n ? (i / n) * 100 : 0}%` }}>
            <span className="caps">{s.label}</span>
            <span className="tnum">{shortClock(s.at)}</span>
          </span>
        ))}
      </span>
    </>
  );
  if (!onPress)
    return (
      <div className="mini-tl" role="img" aria-label={label} data-shared={shared}>
        {body}
      </div>
    );
  return (
    <button
      type="button"
      className="mini-tl pressable"
      data-press="dim"
      aria-label={label}
      data-shared={shared}
      {...press.handlers}
      onPointerDown={(e) => {
        press.handlers.onPointerDown?.(e);
        rel.onPointerDown(e);
      }}
      onPointerMove={(e) => {
        press.handlers.onPointerMove?.(e);
        rel.onPointerMove(e);
      }}
      onPointerUp={(e) => {
        press.handlers.onPointerUp?.(e);
        rel.onPointerUp(e);
      }}
      onPointerCancel={(e) => {
        press.handlers.onPointerCancel?.(e);
        rel.onPointerCancel();
      }}
      onClick={(e) => {
        e.stopPropagation();
        rel.onClick();
      }}
    >
      {body}
    </button>
  );
};

/** Door → back as one thin line with the now dot: the out face's deck. */
export const OutLine = ({ door, back, progress }: { door: number; back: number; progress: number }): React.JSX.Element => {
  const p = Math.max(0, Math.min(1, progress));
  return (
    <div className="out-line" role="img" aria-label={`Out at ${shortClock(door)}, back by ${shortClock(back)}. ${Math.round(p * 100)}% of the way`}>
      <Line p={p} n={1} />
      <span className="out-line-ends" aria-hidden="true">
        <span className="tnum">{shortClock(door)}</span>
        <span className="tnum">{shortClock(back)}</span>
      </span>
    </div>
  );
};
