import { useId } from 'react';
import { areaPath, extent, segments, smoothPath, type Series } from './scale';
import './charts.css';

/**
 * A sparkline: one smooth navy line that ends in a glowing orange dot (the newest value). `invert` draws smaller values
 * higher (pace: faster is up); `zero` pins the floor at 0. With fewer than two values it draws a dashed baseline in the same box, so a card keeps its
 * shape when it is empty. Decorative: the row or card it sits in says the number in words.
 */
export const Spark = ({ values, w = 64, h = 24, invert, zero, glow = true, area, className = '' }: { values: Series; w?: number; h?: number; invert?: boolean; zero?: boolean; glow?: boolean; /** A soft fill under the line (tiles, the trend table). */ area?: boolean; className?: string }) => {
  const id = useId().replace(/:/g, '');
  const e = extent(values);
  const segs = segments(values);
  const count = segs.reduce((n, s) => n + s.length, 0);
  const pad = glow ? 5 : 3;
  if (!e || count < 2)
    return (
      <svg className={`ck-spark is-empty ${className}`} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
        <line x1={2} x2={w - 2} y1={h / 2} y2={h / 2} className="ck-spark-none" />
      </svg>
    );
  let [lo, hi] = e;
  // a zero floor keeps a small wobble small (a share that moves from 64% to 79% is not a cliff)
  if (zero) lo = Math.min(0, lo);
  if (hi - lo < 1e-9) {
    lo -= 1;
    hi += 1;
  }
  const n = Math.max(1, values.length - 1);
  const xy = (i: number, v: number) => {
    const t = (v - lo) / (hi - lo);
    return [pad + (i / n) * (w - pad * 2), pad + (invert ? t : 1 - t) * (h - pad * 2)] as const;
  };
  const lastSeg = segs[segs.length - 1]!;
  const last = lastSeg[lastSeg.length - 1]!;
  const [lx, ly] = xy(last.i, last.v);
  return (
    <svg className={`ck-spark ${className}`} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <defs>
        <linearGradient id={`a${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" className="ck-spark-top" />
          <stop offset="1" className="ck-spark-end" />
        </linearGradient>
      </defs>
      {area ? segs.map((s, k) => (s.length > 1 ? <path key={`a${k}`} d={areaPath(s.map((p) => xy(p.i, p.v)), h)} fill={`url(#a${id})`} /> : null)) : null}
      {segs.map((s, k) => (
        <path key={k} d={smoothPath(s.map((p) => xy(p.i, p.v)))} className="ck-spark-line" />
      ))}
      {glow ? <circle cx={lx} cy={ly} r={2.8} className="ck-spark-dot" /> : null}
    </svg>
  );
};
