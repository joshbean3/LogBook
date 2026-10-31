import { useLayoutEffect, useRef, useState } from 'react';

/** Width of an element, kept current. */
export const useWidth = <T extends HTMLElement>() => {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
};

/** A round-number ceiling for an axis: 10, 20, 30, 40, 60, 80, 100… */
export const niceTop = (v: number, min = 10) => {
  const m = Math.max(min, v);
  const step = m > 80 ? 20 : m > 40 ? 10 : m > 20 ? 10 : 5;
  return Math.ceil(m / step) * step;
};

/**
 * A sparkline: one line, a dot on the latest value. `invert` draws smaller as higher (pace: faster is up). Nulls break
 * nothing; they are skipped. Decorative: the row it sits in says the number in words.
 */
export const Spark = ({ values: all, invert, w = 56, h = 24 }: { values: Array<number | null>; invert?: boolean; w?: number; h?: number }) => {
  // the line starts where the data does
  const lead = all.findIndex((v) => v != null);
  const values = lead < 0 ? [] : all.slice(lead);
  const pts = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] != null);
  if (pts.length < 2) return <span className="pg-spark pg-spark-none" style={{ width: w, height: h }} aria-hidden="true" />;
  const vs = pts.map((p) => p[1]);
  let lo = Math.min(...vs);
  let hi = Math.max(...vs);
  if (hi - lo < 1e-6) {
    lo -= 1;
    hi += 1;
  }
  const n = values.length - 1 || 1;
  const xy = pts.map(([i, v]) => {
    const f = (v - lo) / (hi - lo);
    return [2 + (i / n) * (w - 4), 3 + (invert ? f : 1 - f) * (h - 6)] as const;
  });
  const last = xy[xy.length - 1]!;
  return (
    <svg className="pg-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={`M${xy.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L')}`} className="pg-spark-line" />
      <circle cx={last[0]} cy={last[1]} r={2.25} className="pg-spark-dot" />
    </svg>
  );
};
