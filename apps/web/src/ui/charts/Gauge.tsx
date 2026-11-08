import { useId, type ReactNode } from 'react';
import { arcPath, clamp01, gaugeAngle, polar } from './scale';
import './charts.css';

/**
 * A half-arc gauge, 9 o'clock over the top to 3 o'clock. The track is Columbia; `band` shades a stretch of it (a normal
 * range, a target zone); the arc fills navy up to the value, and the value itself is a glowing orange dot. The stamped
 * number and a word sit inside the arc. `value` null keeps the track and shows "–".
 */
export const Gauge = ({ value, band, center, word, min, max, size = 200, stroke = 12, label }: { value: number | null; band?: [number, number] | null; center?: ReactNode; word?: ReactNode; min?: string; max?: string; size?: number; stroke?: number; label: string }) => {
  const id = useId().replace(/:/g, '');
  const v = clamp01(value);
  const cx = size / 2;
  const r = cx - stroke / 2 - 8;
  const cy = r + stroke / 2 + 8;
  const h = cy + 6;
  const [dx, dy] = v != null ? polar(cx, cy, r, gaugeAngle(v)) : [0, 0];
  return (
    <div className="ck-gauge" role="img" aria-label={label} style={{ width: size }}>
      <svg width={size} height={h} viewBox={`0 0 ${size} ${h}`} aria-hidden="true">
        <defs>
          <radialGradient id={`gg${id}`}>
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.55" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path d={arcPath(cx, cy, r, 180, 360)} className="ck-gauge-track" strokeWidth={stroke} />
        {band ? <path d={arcPath(cx, cy, r, gaugeAngle(band[0]), gaugeAngle(band[1]))} className="ck-gauge-band" strokeWidth={stroke} /> : null}
        {v != null && v > 0.002 ? <path d={arcPath(cx, cy, r, 180, gaugeAngle(v))} className="ck-gauge-fill" strokeWidth={stroke * 0.42} /> : null}
        {v != null ? (
          <g>
            <circle cx={dx} cy={dy} r={stroke * 1.25} fill={`url(#gg${id})`} />
            <circle cx={dx} cy={dy} r={stroke * 0.46} className="ck-gauge-dot" />
          </g>
        ) : null}
      </svg>
      <div className="ck-gauge-mid" style={{ top: cy - r * 0.62 }}>
        <span className="ck-gauge-num stamp">{v == null ? '–' : center}</span>
        {word ? <span className="ck-gauge-word">{word}</span> : null}
      </div>
      {min || max ? (
        <div className="ck-gauge-ends caps" aria-hidden="true">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      ) : null}
    </div>
  );
};
