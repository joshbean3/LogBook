import { motion } from 'motion/react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { springs, useReduced } from '@/lib/motion';
import { useScrub } from '@/ui/charts';

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

const readTextScale = () => (typeof document === 'undefined' ? 1 : Math.max(1, (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16));
/**
 * The text size the phone is set to, as a multiple of the brand's own (1 at the default, 2 at the largest the app follows):
 * the root font size over 16 px. A chart's labels are set in rem and grow with it while its plot does not, so a chart
 * reads this to give them room. It is read again when the root's size changes (app/dynamicType.ts sets it on the root's
 * style when the app comes back from Settings), so a chart on screen redraws for the new size.
 */
export const useTextScale = () => {
  const [scale, setScale] = useState(readTextScale);
  useEffect(() => {
    const read = () => setScale(readTextScale());
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'data-text-xl'] });
    window.addEventListener('resize', read);
    return () => {
      mo.disconnect();
      window.removeEventListener('resize', read);
    };
  }, []);
  return scale;
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

/** Two or three round tick values inside [lo, hi]. `steps` lists the allowed intervals (pace: 15 s, 30 s, a minute). */
export const niceTicks = (lo: number, hi: number, steps?: number[]) => {
  const span = Math.max(hi - lo, 1e-6);
  const base = steps ?? [-1, 0, 1, 2, 3, 4].flatMap((k) => [1, 2, 2.5, 5].map((m) => m * 10 ** k));
  const step = base.find((s) => span / s <= 3) ?? base[base.length - 1]!;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
  return out.length ? out : [(lo + hi) / 2];
};

export interface LinePoint {
  key: string;
  /** Short caps label for the axis and the readout ("SEP 7"). */
  label: string;
  y: number | null;
}

/**
 * The sheets' chart: a line with a dot per point, read by dragging across it like the hero chart (the readout above
 * rewrites to the point under the finger, a tick per point), a quick tap calls `onTap`. `invert` puts smaller values
 * higher (pace). The readout is the caller's: `readout(i)` with i = null when nobody is touching it.
 */
export const LineChart = ({ points, invert, format, readout, onTap, label, height = 168, steps }: { points: LinePoint[]; invert?: boolean; format: (v: number) => string; readout: (i: number | null) => ReactNode; onTap?: (i: number) => void; label: string; height?: number; steps?: number[] }) => {
  const [ref, width] = useWidth<HTMLDivElement>();
  const reduce = useReduced();
  const W = Math.max(200, width || 320);
  const H = height;
  const left = 4;
  const right = 34;
  const top = 12;
  const y0 = H - 20;
  const vals = points.map((p) => p.y).filter((v): v is number => v != null);
  // no values: nothing is measured from an empty list (min and max of nothing are infinite); the plot says so below
  let lo = vals.length ? Math.min(...vals) : 0;
  let hi = vals.length ? Math.max(...vals) : 1;
  const pad = (hi - lo) * 0.15 || Math.max(1, Math.abs(hi) * 0.05);
  lo -= pad;
  hi += pad;
  const n = points.length;
  const xAt = (i: number) => left + (n <= 1 ? (W - left - right) / 2 : (i / (n - 1)) * (W - left - right));
  const yAt = (v: number) => {
    const f = (v - lo) / (hi - lo || 1);
    return top + (invert ? f : 1 - f) * (y0 - top);
  };
  const scrub = useScrub({
    count: n,
    indexAt: (cx) => {
      const r = ref.current?.getBoundingClientRect();
      if (!r || n === 0) return null;
      const x = ((cx - r.left) / r.width) * W;
      let bi = 0;
      for (let i = 1; i < n; i++) if (Math.abs(xAt(i) - x) < Math.abs(xAt(bi) - x)) bi = i;
      return points[bi]!.y == null ? null : bi;
    },
    onScrub: () => undefined,
    onTap,
    home: n - 1,
  });
  const a = scrub.active;
  const bindRef = scrub.bind.ref;
  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      bindRef(node);
    },
    [ref, bindRef],
  );
  const line = points
    .map((p, i) => (p.y == null ? null : `${xAt(i).toFixed(1)},${yAt(p.y).toFixed(1)}`))
    .filter(Boolean)
    .join('L');
  const ticks = niceTicks(lo, hi, steps);
  // x labels: evenly spaced, the last always shown, none closer than 64px
  const xl: number[] = [];
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((W - left - right) / 64))));
  for (let i = 0; i < n; i += every) xl.push(i);
  if (n && xl[xl.length - 1] !== n - 1) {
    if (xl.length && xAt(n - 1) - xAt(xl[xl.length - 1]!) < 64) xl.pop();
    xl.push(n - 1);
  }
  if (!vals.length)
    return (
      <div className="pg-line">
        <p className="pg-line-none">Nothing to draw yet.</p>
      </div>
    );
  return (
    <div className="pg-line">
      <div className="pg-line-readout" aria-live="polite">
        {readout(a)}
      </div>
      <div
        ref={setRefs}
        className="pg-line-plot pg-touch"
        tabIndex={0}
        role="group"
        aria-label={`${label}. Arrow keys read each point${onTap ? ', Enter opens it' : ''}.`}
        onPointerDown={scrub.bind.onPointerDown}
        onPointerMove={scrub.bind.onPointerMove}
        onPointerUp={scrub.bind.onPointerUp}
        onPointerCancel={scrub.bind.onPointerCancel}
        onPointerLeave={scrub.bind.onPointerLeave}
        onClick={scrub.bind.onClick}
        onKeyDown={scrub.bind.onKeyDown}
        onBlur={scrub.bind.onBlur}
      >
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          {ticks.map((v, i) => (
            <g key={i}>
              <line x1={left} x2={W - right + 4} y1={yAt(v)} y2={yAt(v)} className="pg-grid" />
              <text x={W} y={yAt(v)} dy="0.32em" textAnchor="end" className="pg-ax">
                {format(v)}
              </text>
            </g>
          ))}
          {vals.length > 1 ? <motion.path d={`M${line}`} className="pg-line-path" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={reduce ? { duration: 0 } : { ...springs.page }} /> : null}
          {points.map((p, i) =>
            p.y == null ? null : <circle key={p.key} cx={xAt(i)} cy={yAt(p.y)} r={a === i ? 4.5 : i === n - 1 ? 3.5 : 2.5} className={`pg-line-dot ${a === i ? 'on' : ''} ${a != null && a !== i ? 'dim' : ''}`} />,
          )}
          {a != null ? <line x1={xAt(a)} x2={xAt(a)} y1={top - 6} y2={y0} className="pg-cursor" /> : null}
          {xl.map((i) => (
            <text key={`x-${points[i]!.key}`} x={xAt(i)} y={H - 4} textAnchor={i === 0 && n > 1 ? 'start' : i === n - 1 && n > 1 ? 'end' : 'middle'} className="pg-ax">
              {points[i]!.label}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
};
