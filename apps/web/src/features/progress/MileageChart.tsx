import { fmtDate, mi, num } from '@logbook/shared';
import { motion } from 'motion/react';
import { useCallback, useRef, useState } from 'react';
import { crossfade, useReduced } from '@/lib/motion';
import { niceTop, useWidth } from './charts';
import { weekTitle, type Range, type WeekPoint } from './data';
import { useScrub } from './useScrub';

export const CHART_H = 220;
const up = (s: string) => s.toUpperCase();
const monthShort = new Intl.DateTimeFormat('en-US', { month: 'short' });
const monthOfWeek = (w: string) => up(monthShort.format(new Date(`${w}T12:00:00`)));

/** Words for one week, for VoiceOver and the week buttons. */
export const weekWords = (p: WeekPoint, today: string) => {
  const t = weekTitle(p.w, today);
  if (p.missing) return `${t}: not loaded yet`;
  if (p.future) return `${t}: ${num(p.planned)} miles planned`;
  const ran = `${mi(p.ran)} miles in ${p.runs} ${p.runs === 1 ? 'run' : 'runs'}${p.logged > 0.05 ? `, ${mi(p.logged)} logged by hand` : ''}`;
  return `${t}${p.current ? ' so far' : ''}: ${ran}${p.planned ? `, ${num(p.planned)} planned` : ''}`;
};

/**
 * The weekly mileage chart: run bars, ghost plan bars (outlined; dashed for weeks ahead), a four-week average line, this
 * week in blue, each series named on the chart itself. A new range crossfades in 150 ms; nothing animates a size.
 *
 * Gestures: press and slide to read a week (the parent's headline rewrites through `onScrub`); a quick tap opens it; a
 * pinch changes the range. Fallbacks: the range chips, arrow keys + Enter on the focused chart, and a hidden list of week
 * buttons for VoiceOver.
 */
export const MileageChart = ({ pts, range, today, onScrub, onOpen, onPinch, ghost }: { pts: WeekPoint[]; range: Range; today: string; onScrub: (i: number | null) => void; onOpen: (i: number) => void; onPinch?: (dir: -1 | 1) => void; ghost?: boolean }) => {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const reduce = useReduced();
  const [pinchR, setPinchR] = useState<number | null>(null);
  // the first paint draws in place; a range change crossfades the new bars in. Decided per range change, never per render:
  // the fade class goes only on a group that mounts for a new range (its key), so a scrub or a month landing re-renders
  // the same group without restarting its fade (review code F3)
  const firstRange = useRef<Range | null>(null);
  const changed = useRef(false);
  if (width && firstRange.current == null) firstRange.current = range;
  else if (firstRange.current != null && range !== firstRange.current) changed.current = true;
  const fade = changed.current && !reduce;

  const W = Math.max(220, width || 340);
  const H = CHART_H;
  const left = 0;
  const right = 22;
  const padTop = 26;
  const y0 = H - 22;
  const n = pts.length;
  const max = Math.max(...pts.map((p) => Math.max(p.ran, p.planned, p.avg ?? 0)), 0);
  const top = niceTop(max * 1.08);
  const y = (v: number) => y0 - (v / top) * (y0 - padTop);
  const band = (W - left - right) / n;
  const bw = Math.max(2, Math.min(24, band * 0.64));
  const xc = (i: number) => left + band * i + band / 2;
  const ci = pts.findIndex((p) => p.current);
  let peak: number | null = null;
  pts.forEach((p, i) => {
    if (!p.future && p.ran > 0 && (peak == null || p.ran > pts[peak]!.ran)) peak = i;
  });

  const scrub = useScrub({
    count: n,
    indexAt: (cx) => {
      const r = wrapRef.current?.getBoundingClientRect();
      if (!r) return null;
      const x = ((cx - r.left) / r.width) * W;
      return Math.min(n - 1, Math.max(0, Math.floor((x - left) / band)));
    },
    onScrub,
    onTap: onOpen,
    peak,
    home: ci,
    onPinch,
    onPinchMove: setPinchR,
    disabled: ghost,
  });
  const a = scrub.active;
  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      (wrapRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      scrub.bind.ref(node);
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // the average: finished weeks only
  const avgPts = pts.map((p, i) => (p.avg == null ? null : ([xc(i), y(p.avg)] as const))).filter((q): q is readonly [number, number] => !!q);
  // the line breaks where a month has not loaded: it never bridges a gap with a value it does not have
  const avgPath = (() => {
    let d = '';
    let prev = -2;
    pts.forEach((p, i) => {
      if (p.avg == null) return;
      d += `${i === prev + 1 ? 'L' : 'M'}${xc(i).toFixed(1)},${y(p.avg).toFixed(1)}`;
      prev = i;
    });
    return d;
  })();
  const lastAvg = [...pts].reverse().find((p) => p.avg != null)?.avg ?? null;

  // y grid: three quiet lines
  const step = top / (top >= 40 ? 4 : 2);
  const grid: number[] = [];
  for (let v = step; v <= top + 1e-6; v += step) grid.push(Math.round(v));

  // x: month names where a month begins, and NOW under this week
  const xLabels: Array<{ x: number; text: string; now?: boolean }> = [];
  if (ci >= 0) xLabels.push({ x: xc(ci), text: 'NOW', now: true });
  pts.forEach((p, i) => {
    if (i === 0 || monthOfWeek(p.w) === monthOfWeek(pts[i - 1]!.w)) return;
    const x = xc(i);
    // a label needs its own width and a gap: "OCT" and "NOW" must not touch at 320 (review feel F13)
    if (xLabels.some((l) => Math.abs(l.x - x) < 36)) return;
    if (x > W - right - 8) return;
    xLabels.push({ x, text: monthOfWeek(p.w) });
  });

  // direct labels, no legend: RUN over the biggest week, PLAN over the plan ahead, the average where the line ends.
  // Each tries a few spots and takes the first that covers no bar, no other label and stays inside the plot.
  type Lbl = { x: number; y: number; text: string; anchor: 'start' | 'middle' | 'end'; cls: string };
  const labels: Lbl[] = [];
  const box = (l: Lbl) => {
    const w = l.text.length * 6.2;
    const x0 = l.anchor === 'start' ? l.x : l.anchor === 'end' ? l.x - w : l.x - w / 2;
    return { x0, x1: x0 + w, y0: l.y - 8, y1: l.y + 1 };
  };
  const hit = (b: ReturnType<typeof box>, c: { x0: number; x1: number; y0: number; y1: number }, pad = 2) => b.x0 < c.x1 + pad && c.x0 < b.x1 + pad && b.y0 < c.y1 + pad && c.y0 < b.y1 + pad;
  const bars = pts.map((p, i) => ({ x0: xc(i) - bw / 2, x1: xc(i) + bw / 2, y0: y(Math.max(p.ran, p.planned)), y1: y0 }));
  const fits = (l: Lbl) => {
    const b = box(l);
    if (b.x0 < 0 || b.x1 > W - right || b.y0 < 2 || b.y1 > y0 - 2) return false;
    return !bars.some((c) => c.y1 > c.y0 && hit(b, c)) && !labels.some((m) => hit(b, box(m), 4));
  };
  const place = (cands: Lbl[]) => {
    const l = cands.find(fits);
    if (l) labels.push(l);
  };
  if (peak != null) {
    const x = xc(peak);
    const yy = y(pts[peak]!.ran) - 6;
    place([
      { x, y: yy, text: 'RUN', anchor: 'middle', cls: 'pg-lbl-run' },
      { x: x - bw / 2, y: yy, text: 'RUN', anchor: 'start', cls: 'pg-lbl-run' },
      { x: x + bw / 2, y: yy, text: 'RUN', anchor: 'end', cls: 'pg-lbl-run' },
    ]);
  }
  let planI = -1;
  pts.forEach((p, i) => {
    if ((p.future || p.current) && p.planned > 0 && (planI < 0 || p.planned >= pts[planI]!.planned)) planI = i;
  });
  if (planI >= 0) {
    const x = xc(planI);
    const yy = y(pts[planI]!.planned) - 6;
    place(
      (['middle', 'end', 'start'] as const).flatMap((anchor) => [0, -12].map((dy) => ({ x: anchor === 'middle' ? x : anchor === 'end' ? x + bw / 2 : x - bw / 2, y: yy + dy, text: 'PLAN', anchor, cls: 'pg-lbl-plan' }))),
    );
  }
  // a month of the range still on its way: the label would average the gap as weeks off and change by itself when the month
  // lands (review 2 feel N6); the broken line says enough until then
  if (avgPts.length > 1 && lastAvg != null && !pts.some((p) => p.missing)) {
    const t = `4-WK AVG ${Math.round(lastAvg)}`;
    const cands: Lbl[] = [];
    // walk back along the line from its end: right of a point, above it, below it
    for (let k = avgPts.length - 1; k >= Math.max(0, avgPts.length - 6); k--) {
      const [ax, ay] = avgPts[k]!;
      cands.push({ x: ax + 5, y: ay + 3, text: t, anchor: 'start', cls: 'pg-lbl-avg' }, { x: ax, y: ay - 6, text: t, anchor: 'middle', cls: 'pg-lbl-avg' }, { x: ax, y: ay + 13, text: t, anchor: 'middle', cls: 'pg-lbl-avg' }, { x: ax - 5, y: ay + 3, text: t, anchor: 'end', cls: 'pg-lbl-avg' });
    }
    place(cands);
  }

  const pinchScale = pinchR == null ? 1 : Math.min(1.12, Math.max(0.9, 1 + (pinchR - 1) * 0.35));
  const curWord = ci >= 0 ? weekWords(pts[ci]!, today) : '';

  return (
    <div className={`pg-chart ${ghost ? 'is-ghost' : ''}`}>
      <div
        ref={setRefs}
        className="pg-plot pg-touch"
        tabIndex={ghost ? -1 : 0}
        role="group"
        aria-label={`Weekly miles. ${curWord}. Press and slide, or use the arrow keys, to read a week; tap or press Enter to open it; pinch to change the range.`}
        onPointerDown={scrub.bind.onPointerDown}
        onPointerMove={scrub.bind.onPointerMove}
        onPointerUp={scrub.bind.onPointerUp}
        onPointerCancel={scrub.bind.onPointerCancel}
        onPointerLeave={scrub.bind.onPointerLeave}
        onClick={scrub.bind.onClick}
        onKeyDown={scrub.bind.onKeyDown}
        onBlur={scrub.bind.onBlur}
      >
        {!width ? <div style={{ height: H }} /> : <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <defs>
            <clipPath id="pg-clip">
              <rect x={-4} y={0} width={W + 8} height={y0} />
            </clipPath>
          </defs>
          {grid.map((v) => (
            <g key={v}>
              <line x1={left} x2={W - right + 2} y1={y(v)} y2={y(v)} className="pg-grid" />
              <text x={W} y={y(v)} dy="0.32em" textAnchor="end" className="pg-ax">
                {v}
              </text>
            </g>
          ))}
          <line x1={left} x2={W - right + 2} y1={y0} y2={y0} className="pg-base" />
          <g style={{ transform: `scaleX(${pinchScale})`, transformOrigin: `${W / 2}px ${y0}px`, transition: pinchR == null ? 'transform 200ms var(--ease-out)' : 'none' }}>
            {a != null ? <rect x={xc(a) - Math.max(bw, 10) / 2 - 3} y={padTop - 10} width={Math.max(bw, 10) + 6} height={y0 - padTop + 10} rx={4} className="pg-col" /> : null}
            {/* bars are drawn where they belong (no attribute animates: §10, only transform and opacity); a new range
                crossfades in 150 ms, keyed on the range; a month arriving fills its weeks in place */}
            <motion.g key={`bars-${range}`} clipPath="url(#pg-clip)" initial={fade ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={crossfade}>
              {pts.map((p, i) => {
                const dim = a != null && a !== i;
                // a week whose month has not loaded is a quiet gap: no bar, only a faint dash on the baseline (§8)
                if (p.missing)
                  return (
                    <g key={p.w} className="pg-gap" data-week={p.w}>
                      <line x1={xc(i) - bw / 2} x2={xc(i) + bw / 2} y1={y0 - 1} y2={y0 - 1} className="pg-gap-line" />
                    </g>
                  );
                return (
                  <g key={p.w} className="pg-week" style={{ opacity: dim ? 0.32 : 1 }}>
                    {p.planned > 0 ? <rect className={`pg-plan ${p.future ? 'ahead' : ''}`} rx={3} x={xc(i) - bw / 2 + 0.5} width={Math.max(1, bw - 1)} y={y(p.planned) + 0.5} height={Math.max(0, y0 - y(p.planned)) + 6} /> : null}
                    {p.ran > 0 ? <rect className={`pg-bar ${p.current ? 'cur' : ''}`} rx={Math.min(3, bw / 2)} x={xc(i) - bw / 2} width={bw} y={y(p.ran)} height={y0 - y(p.ran) + 6} /> : null}
                    {p.logged > 0.05 ? <rect className="pg-logged" rx={Math.min(2.5, bw / 2)} x={xc(i) - bw / 2 + 1} width={Math.max(0, bw - 2)} y={y(p.ran) + 1} height={Math.max(0, y(p.ran - p.logged) - y(p.ran) - 1)} /> : null}
                  </g>
                );
              })}
            </motion.g>
            {avgPts.length > 1 ? (
              // its own key (the bars' group and the line once shared `range` as a key: React then kept stray copies)
              <motion.path key={`avg-${range}`} d={avgPath} className="pg-avg" initial={fade ? { opacity: 0 } : false} animate={{ opacity: a != null ? 0.4 : 1 }} transition={{ duration: 0.2, delay: fade ? 0.18 : 0 }} />
            ) : null}
            {ci >= 0 && pts[ci]!.ran <= 0 && !pts[ci]!.planned ? <circle cx={xc(ci)} cy={y0} r={2.5} className="pg-now-dot" /> : null}
          </g>
          {labels.map((l) => (
            <text key={l.text} x={l.x} y={l.y} textAnchor={l.anchor} className={`pg-lbl ${l.cls}`} style={{ opacity: a != null ? 0 : 1 }}>
              {l.text}
            </text>
          ))}
          {xLabels.map((l) => (
            <text key={l.text + l.x} x={l.x} y={H - 5} textAnchor="middle" className={`pg-ax ${l.now ? 'now' : ''}`}>
              {l.text}
            </text>
          ))}
        </svg>}
      </div>
      {ghost ? null : (
        <ul className="sr-only" aria-label="Weeks">
          {pts.map((p, i) => (
            <li key={p.w}>
              <button type="button" onClick={() => onOpen(i)}>
                {weekWords(p, today)}. Open {fmtDate('md', p.w)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
