import type * as React from 'react';
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
 * The morning as four stops on one line (Wake · Door · Back · Leave), evenly spaced so the four clock times never collide at
 * 320: a 2 px line, 8 px dots, the accent now dot (static per minute), caps labels and tabular times, 44 tall. A picture of
 * the line (This morning's Now card); `shared` sets `data-shared`, the id a flyer travels between.
 */
export const MiniTimeline = ({ stops, now, label, shared }: { stops: Stop[]; now: number; label: string; shared?: string }): React.JSX.Element => {
  const p = stopProgress(stops, now);
  const n = stops.length - 1;
  return (
    <div className="mini-tl" role="img" aria-label={label} data-shared={shared}>
      <span className="mini-tl-line" aria-hidden="true">
        <span className="mini-tl-done" style={{ transform: `scaleX(${p})` }} />
        {Array.from({ length: n + 1 }, (_, i) => (
          <i key={i} className={`mini-tl-stop ${n && p > 0 && i / n <= p ? 'past' : ''}`} style={{ left: `${n ? (i / n) * 100 : 0}%` }} />
        ))}
        <span className="mini-tl-nowtrack" style={{ transform: `translateX(${(p * 100).toFixed(3)}%)` }}>
          <i className="mini-tl-now" />
        </span>
      </span>
      <span className="mini-tl-times" data-n={stops.length} aria-hidden="true">
        {stops.map((s, i) => (
          <span key={s.key} className="mini-tl-time" data-edge={i === 0 ? 'start' : i === n ? 'end' : undefined} style={{ left: `${n ? (i / n) * 100 : 0}%` }}>
            <span className="caps">{s.label}</span>
            <span className="tnum">{shortClock(s.at)}</span>
          </span>
        ))}
      </span>
    </div>
  );
};
