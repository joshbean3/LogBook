import { useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { chartDomain } from './niceDomain';
import { areaPath, labelIndices, niceTicks, scaleLinear, segments, smoothPath, type Series } from './scale';
import { useNowMark } from '../nowBudget';
import { useChartWidth } from './useWidth';
import './charts.css';

export interface ChartZone {
  lo: number;
  hi: number;
  /** "Z2" */
  label: string;
}

export interface TrendChartProps {
  /** The smooth line, one value per x. Null breaks it. */
  line: Series;
  /** Faint bars behind the line (the daily values under a rolling line). Drawn from zero. */
  bars?: Series;
  /** Small dots on raw values (a sparse series such as pace, one per run). */
  dots?: Series;
  /** The period before, in grey, on the same x positions. */
  previous?: Series;
  /** The personal normal: a shaded band. */
  band?: { lo: number; hi: number } | null;
  /** A dotted average line with an "Avg" pill. */
  avg?: number | null;
  /** Shaded horizontal zones (heart-rate zones), labelled at the left. */
  zones?: ChartZone[];
  /** The x label for each index ("Nov 8"). Only a few are drawn. */
  labels: string[];
  /** The y labels, drawn on the right only. */
  format: (v: number) => string;
  /** Smaller values higher (pace: faster is up). */
  invert?: boolean;
  /** The y axis starts at zero (miles, volume). */
  zero?: boolean;
  /** Allowed tick intervals (pace: 15, 30, 60 s). */
  steps?: number[];
  /** A fixed y axis, whatever the data (a share: 0 to 100). Without it the axis fits the data. */
  domain?: [number, number];
  /** The line's colour: navy for data, orange for the one series that is the highlight (this month). */
  tone?: 'navy' | 'accent';
  /** A soft fill under the line. */
  fill?: boolean;
  height?: number;
  /** What the chart shows, for VoiceOver. */
  label: string;
  /** Above the plot: what it reads at rest (i = null) and at the point under the finger. */
  readout?: (i: number | null) => ReactNode;
  /** Shown over an empty plot (the frame stays). */
  empty?: ReactNode;
  className?: string;
}

const RIGHT = 38;
const TOP = 10;
const BOTTOM = 22;

/**
 * The chart kit's line chart (docs/inspiration.md §3). Y labels on the right only, over dashed hairlines; a soft personal-normal
 * band; a dotted average with an "Avg" pill that says its value; faint daily bars behind a smooth line; the newest point
 * glowing orange with a faint line down to its day; an optional earlier
 * period in grey. Press and slide to read a point (the readout above rewrites), arrow keys do the same. With nothing to
 * draw it keeps its frame and says so in the middle.
 */
export const TrendChart = ({ line, bars, dots, previous, band, avg, zones, labels, format, invert, zero, steps, domain, tone = 'navy', fill, height = 184, label, readout, empty, className = '' }: TrendChartProps) => {
  const id = useId().replace(/:/g, '');
  const [ref, width] = useChartWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const dragging = useRef(false);
  const W = Math.max(200, width || 320);
  const H = height;
  const y0 = H - BOTTOM;
  // zones are labelled in a gutter of their own at the left, clear of the line
  const LEFT = zones?.length ? 26 : 0;
  const plotW = W - RIGHT - LEFT;
  const n = Math.max(line.length, labels.length, bars?.length ?? 0, previous?.length ?? 0);
  const hasData = line.some((v) => v != null) || (dots?.some((v) => v != null) ?? false) || (bars?.some((v) => v != null && v > 0) ?? false);

  const domainVals: Array<number | null> = [...line, ...(dots ?? []), ...(previous ?? []), ...(zero ? (bars ?? []) : [])];
  if (band) domainVals.push(band.lo, band.hi);
  if (avg != null) domainVals.push(avg);
  if (!hasData && zones?.length) domainVals.push(zones[0]!.lo, zones[zones.length - 1]!.hi ?? zones[zones.length - 1]!.lo);
  const [lo, hi] = chartDomain(domainVals, { zero, steps, count: 3, domain });
  const y = scaleLinear(invert ? [hi, lo] : [lo, hi], [y0, TOP]);
  const step = n > 1 ? plotW / (n - 1) : 0;
  const x = (i: number) => LEFT + (n > 1 ? i * step : plotW / 2);
  // two ticks that would print the same label (0.5 and 1 as "1") keep only the first
  const ticks = niceTicks(lo, hi, 3, steps).filter((v, k, all) => all.findIndex((u) => format(u) === format(v)) === k);
  // caption-style dates ("OCT 20", +0.14 em) need about 80 px each, so the end label never runs into the one before it
  const xl = labelIndices(n, plotW, 80);
  // the Avg pill fits its words: 'Avg' and the value
  const avgW = avg != null ? Math.round(30 + format(avg).length * 6.2) : 0;

  const lineSegs = segments(line);
  const lastSeg = lineSegs[lineSegs.length - 1];
  const newest = lastSeg ? lastSeg[lastSeg.length - 1]! : null;
  const prevSegs = previous ? segments(previous) : [];
  const barW = Math.max(1, Math.min(10, step * 0.62));
  const clampY = (v: number) => Math.min(y0, Math.max(TOP, y(v)));

  // ---------- reading a point ----------
  const indexAt = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || !r.width || n === 0) return null;
    const px = ((clientX - r.left) / r.width) * W;
    const i = Math.round((px - LEFT) / (step || 1));
    return Math.max(0, Math.min(n - 1, i));
  };
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!readout || !hasData) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragging.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setActive(indexAt(e.clientX));
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!readout || !hasData) return;
    if (dragging.current || e.pointerType === 'mouse') setActive(indexAt(e.clientX));
  };
  const onUp = () => {
    dragging.current = false;
    setActive(null);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!readout || !hasData) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const d = e.key === 'ArrowLeft' ? -1 : 1;
      setActive((a) => Math.max(0, Math.min(n - 1, (a ?? (newest?.i ?? n - 1)) + d)));
    } else if (e.key === 'Escape') setActive(null);
  };
  const activeVal = active != null ? (line[active] ?? dots?.[active] ?? null) : null;

  // the newest point is a Sunrise mark (guide 3.5 job 6) while it is drawn; the kit lives on pushed pages and sheets
  const nowPaint = useNowMark('pointer', !!newest && active == null);
  return (
    <div className={`ck-chart ${className}`}>
      {readout ? (
        <div className="ck-readout" aria-live="polite">
          {readout(active)}
        </div>
      ) : null}
      <div
        ref={ref}
        className={`ck-plot ${readout && hasData ? 'is-live' : ''}`}
        role="img"
        aria-label={label}
        tabIndex={readout && hasData ? 0 : undefined}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={(e) => e.pointerType === 'mouse' && onUp()}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
      >
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <defs>
            {/* the area under the actual line: Sky at 16 percent, fading out (guide 6.8) */}
            <linearGradient id={`fill${id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" className="ck-fill-top" />
              <stop offset="1" className="ck-fill-end" />
            </linearGradient>
            {/* the personal normal: a soft Haze band, strongest in its middle, fading to its edges */}
            <linearGradient id={`band${id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" className="ck-band-edge" />
              <stop offset="0.5" className="ck-band-mid" />
              <stop offset="1" className="ck-band-edge" />
            </linearGradient>
          </defs>
          {/* zones: shaded bands, deeper as they climb */}
          {zones?.map((z, k) => {
            const top = clampY(invert ? z.lo : z.hi);
            const bot = clampY(invert ? z.hi : z.lo);
            if (bot - top < 1) return null;
            return (
              <g key={z.label}>
                <rect x={LEFT} y={top} width={plotW} height={bot - top} className="ck-zone" style={{ opacity: 0.25 + (k / Math.max(1, zones.length - 1)) * 0.6 }} />
                {bot - top >= 10 ? (
                  <text x={0} y={(top + bot) / 2} dy="0.32em" className="ck-zone-label">
                    {z.label}
                  </text>
                ) : null}
              </g>
            );
          })}
          {/* the grid, with its labels on the right */}
          {ticks.map((v) => (
            <g key={v}>
              <line x1={LEFT} x2={LEFT + plotW} y1={y(v)} y2={y(v)} className="ck-grid" />
              {/* an empty frame has no scale to read */}
              {hasData ? (
                <text x={W} y={y(v)} dy="0.32em" textAnchor="end" className="ck-ax">
                  {format(v)}
                </text>
              ) : null}
            </g>
          ))}
          {band ? <rect x={LEFT} y={Math.min(y(band.lo), y(band.hi))} width={plotW} height={Math.max(4, Math.abs(y(band.hi) - y(band.lo)))} rx={4} fill={`url(#band${id})`} className="ck-band" /> : null}
          {/* faint daily bars behind the line */}
          {zero && bars
            ? bars.map((v, i) =>
                v != null && v > 0 ? <rect key={i} x={x(i) - barW / 2} y={y(v)} width={barW} height={Math.max(1, y0 - y(v))} rx={Math.min(2, barW / 2)} className={`ck-bar ${active === i ? 'on' : ''}`} /> : null,
              )
            : null}
          {prevSegs.map((s, k) => (
            <path key={`p${k}`} d={smoothPath(s.map((p) => [x(p.i), y(p.v)] as const))} className="ck-prev" />
          ))}
          {fill
            ? lineSegs.map((s, k) =>
                s.length > 1 ? <path key={`f${k}`} d={areaPath(s.map((p) => [x(p.i), y(p.v)] as const), invert ? TOP : y0)} fill={`url(#fill${id})`} /> : null,
              )
            : null}
          {lineSegs.map((s, k) => (s.length > 1 ? <path key={`l${k}`} d={smoothPath(s.map((p) => [x(p.i), y(p.v)] as const))} className={`ck-line ${tone === 'accent' ? 'accent' : ''}`} /> : null))}
          {dots?.map((v, i) => (v == null ? null : <circle key={`d${i}`} cx={x(i)} cy={y(v)} r={active === i ? 3.5 : 2.2} className="ck-dot" />))}
          {/* a lone point still shows (one value is not a line) */}
          {lineSegs.map((s, k) => (s.length === 1 && s[0]!.i !== newest?.i ? <circle key={`o${k}`} cx={x(s[0]!.i)} cy={y(s[0]!.v)} r={2.5} className="ck-dot" /> : null))}
          {avg != null ? (
            <g className="ck-avg">
              <line x1={LEFT} x2={LEFT + plotW} y1={y(avg)} y2={y(avg)} className="ck-avg-line" />
              <rect x={LEFT + 4} y={y(avg) - 9} width={avgW} height={18} rx={9} className="ck-avg-pill" />
              <text x={LEFT + 4 + avgW / 2} y={y(avg)} dy="0.35em" textAnchor="middle" className="ck-avg-word">
                Avg <tspan className="ck-avg-num">{format(avg)}</tspan>
              </text>
            </g>
          ) : null}
          {active != null ? <line x1={x(active)} x2={x(active)} y1={TOP - 4} y2={y0} className="ck-cursor" /> : null}
          {active != null && activeVal != null ? <circle cx={x(active)} cy={y(activeVal)} r={4.5} className="ck-active" /> : null}
          {/* the newest point is now: the 8 px Sunrise dot with its Paper keyline, a faint Dusk line down to its day */}
          {newest && active == null ? (
            <g>
              <line x1={x(newest.i)} x2={x(newest.i)} y1={y(newest.v) + 6} y2={y0} className="ck-drop" />
              <circle cx={x(newest.i)} cy={y(newest.v)} r={4} className="ck-newest" data-now={nowPaint === 'ink' ? 'ink' : undefined} />
            </g>
          ) : null}
          <line x1={LEFT} x2={LEFT + plotW} y1={y0} y2={y0} className="ck-base" />
          {xl.map((i) => (
            <text key={`x${i}`} x={x(i)} y={H - 6} textAnchor={i === 0 && n > 1 ? 'start' : i === n - 1 && n > 1 ? 'end' : 'middle'} className="ck-ax">
              {labels[i] ?? ''}
            </text>
          ))}
        </svg>
        {!hasData && empty ? <div className="ck-empty">{empty}</div> : null}
      </div>
    </div>
  );
};
