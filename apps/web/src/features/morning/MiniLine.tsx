import { durationWords, type MorningTimeline } from '@logbook/shared';
import { motion, useReducedMotion } from 'motion/react';
import { springs } from '@/lib/motion';
import { blockLabel, stopsOf, timeParts } from './model';
import './mini.css';

/**
 * A morning in one line, for small places (Today's hero, the routine editor, the day editor).
 *
 * - default: a metro line, wake → door → back → leave as evenly spaced stops with their clock times under them, and a
 *   pulsing "now" dot between the stops it falls between (today only, when `now` is given).
 * - `bar`: the morning drawn to scale instead, each block a segment of its true length (the session in its tone, free time
 *   as a gap), with the same stops as a row of stamps under it. Used where the proportions are the point: an editor preview.
 */
export const MiniLine = ({ T, now, bar, className = '' }: { T: MorningTimeline; now?: number | null; bar?: boolean; className?: string }) => {
  const reduce = useReducedMotion();
  const stops = stopsOf(T);
  const n = stops.length;
  let nowPos: number | null = null;
  if (now != null && now >= stops[0]!.at && now <= stops[n - 1]!.at) {
    if (bar) nowPos = (now - T.day.wake) / Math.max(1, T.leave - T.day.wake);
    else {
      for (let i = 0; i < n - 1; i++) {
        const a = stops[i]!.at;
        const b = stops[i + 1]!.at;
        if (now >= a && now <= b) {
          nowPos = (i + (b > a ? (now - a) / (b - a) : 0)) / (n - 1);
          break;
        }
      }
    }
  }
  const span = Math.max(1, T.leave - T.day.wake);
  const read = stops.map((s) => `${s.label} ${timeParts(s.at).v}`).join(', ');
  return (
    <div className={`mini ${bar ? 'mini-bar' : 'mini-metro'} ${className}`} role="img" aria-label={`${read}.${T.day.mode === 'rest' ? ' A rest morning.' : ''}`}>
      <div className="mini-track" aria-hidden="true" style={bar ? undefined : { marginInline: `${50 / n}%` }}>
        {bar
          ? T.blocks.map((b, i) =>
              b.key === 'free' ? null : (
                <motion.i
                  key={`${b.key}-${b.key === 'buffer' ? i : ''}`}
                  className={`mini-seg k-${b.key} ${b.tone ? `t-${b.tone}` : ''}`}
                  initial={false}
                  animate={{ left: `${((b.start - T.day.wake) / span) * 100}%`, width: `${(b.mins / span) * 100}%` }}
                  transition={reduce ? { duration: 0 } : springs.settle}
                  title={`${blockLabel(T, b)}, ${durationWords(b.mins)}`}
                />
              ),
            )
          : stops.map((s, i) => <i key={s.key} className={`mini-stop k-${s.key} ${nowPos != null && i / (n - 1) <= nowPos ? 'passed' : ''}`} style={{ left: `${(i / (n - 1)) * 100}%` }} />)}
        {!bar && nowPos != null ? <i className="mini-fill" style={{ width: `${nowPos * 100}%` }} /> : null}
        {nowPos != null ? <i className="mini-now now-pulse" style={{ left: `${nowPos * 100}%` }} /> : null}
      </div>
      <div className="mini-stamps" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }} aria-hidden="true">
        {stops.map((s) => {
          const t = timeParts(s.at);
          return (
            <span key={s.key} className={`mini-stamp k-${s.key}`}>
              <span className="caps">{s.label}</span>
              <span className="stamp">{t.v}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
};
