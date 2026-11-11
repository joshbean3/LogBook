import { motion } from 'motion/react';
import { useCallback, useId } from 'react';
import { crossfadeSlow, springs, useReduced } from '@/lib/motion';
import { useNowMark, usePageShown } from '@/ui/nowBudget';
import { niceTop, useWidth } from './charts';
import { monotonePath } from './curve';
import { axisLabels, type AxisLabel, type RangeSpan, type RunBucket } from './ranges';
import { useScrub } from './useScrub';

const PAD_TOP = 16;
const LEFT = 8;

/** Runs of consecutive buckets that have loaded: a line breaks at a gap, it never bridges one with a value it does not have. */
const runsOf = (bs: RunBucket[], from: number, upTo: number) => {
  const out: number[][] = [];
  let cur: number[] = [];
  bs.forEach((p, i) => {
    if (i < from || i > upTo) return;
    if (p.missing) {
      if (cur.length) out.push(cur);
      cur = [];
    } else cur.push(i);
  });
  if (cur.length) out.push(cur);
  return out;
};

/** A caption label's width: about 9 px a letter at the 11 px caption (its +0.14 em tracking included), grown with the text. */
const captionWidth = (scale: number) => (s: string) => s.length * 9 * scale;

/**
 * Miles as two curves (guide 6.8), one point per bucket of the range (a day, a week or a month): the plan a 1.5 px Dusk line
 * dashed 4 / 4 over every bucket, the days ahead included (plan only); what was run a 2.5 px Deep Sky line over Sky at 16
 * percent, up to the bucket holding today, which a dotted reach joins (it is not over yet) and the 8 px Sunrise now dot
 * marks. "Plan" and "You" label the lines where they start (no legend). The y scale fits the range's largest bucket; the x
 * labels are the set that fits (`axisLabels`). The hero remounts the chart on a new range or mode: its marks fade in over
 * 200 ms (the Week / Month cross-fade, guide 9.1: only opacity and transform move) and daily bars rise from the baseline on
 * `springs.number`; the grid and the axes stand still. Under Reduce Motion nothing animates. Press and slide to read a bucket: a rule and a dot on each line follow the
 * finger, the headline rewrites (`onScrub`), a `select` tick per bucket. A quick tap opens it (`onOpen`, when it opens
 * anything). Arrow keys and Enter on the focused chart; a hidden list of buckets for VoiceOver.
 */
export const PlanLine = ({ span, buckets, label, words, onScrub, onOpen }: { span: RangeSpan; buckets: RunBucket[]; label: string; words: (i: number) => string; onScrub: (i: number | null) => void; onOpen?: (i: number) => void }) => {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const reduce = useReduced();
  const uid = useId().replace(/:/g, '');
  const W = Math.max(220, width || 340);
  // the plot spans the card's inner width: 160 tall on a 320 pt phone, 180 from 375 up (guide 6.8)
  const H = W < 300 ? 160 : 180;
  const Y0 = H - 24;
  const n = buckets.length;
  const max = Math.max(0, ...buckets.map((p) => Math.max(p.planned, p.done)));
  // the y scale fits the range's largest bucket; its two gridlines sit on whole miles (a 15 top would put one at 7.5)
  const top0 = niceTop(max * 1.12, span.unit === 'day' ? 5 : 10);
  const top = top0 % 2 ? top0 + 5 : top0;
  const y = (v: number) => Y0 - (v / top) * (Y0 - PAD_TOP);
  // the caption labels grow with the text size (rem), the plot does not: their room grows with them (the y labels' column
  // on the trailing side, the spacing of the x labels)
  const textScale = Math.max(1, (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16);
  // (9 a figure, as `captionWidth` counts them), and the grid stops 4 past the plot, so a label keeps 6 clear of its line
  const RIGHT = Math.max(30, Math.ceil(String(Math.round(top)).length * 9 * textScale + 10));
  const GRID_END = W - RIGHT + 4;
  const step = (W - LEFT - RIGHT) / Math.max(1, n - 1);
  const x = (i: number) => LEFT + step * i;
  const ci = buckets.findIndex((p) => p.current);
  // the last bucket with anything run in it so far: this one, or the last before the days ahead
  const lastPast = ci >= 0 ? ci : buckets.reduce((a, p, i) => (p.future ? a : i), -1);
  // the lines start where the log does: no flat run of zeros before the first bucket with anything in it
  const first = Math.max(0, buckets.findIndex((p) => !p.missing && (p.planned > 0 || p.done > 0)));
  let peak: number | null = null;
  buckets.forEach((p, i) => {
    if (p.done > 0 && (peak == null || p.done > buckets[peak]!.done)) peak = i;
  });

  const scrub = useScrub({
    count: n,
    indexAt: (cx) => {
      const r = wrapRef.current?.getBoundingClientRect();
      if (!r) return null;
      const px = ((cx - r.left) / r.width) * W;
      // a bucket before the log began has nothing to read or open: the finger reads from the first one that does
      return Math.min(n - 1, Math.max(first, Math.round((px - LEFT) / step)));
    },
    min: first,
    onScrub,
    onTap: onOpen,
    peak,
    home: ci >= 0 ? ci : n - 1,
  });
  const a = scrub.active;
  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      (wrapRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      scrub.bind.ref(node);
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const line = (key: 'planned' | 'done', rs: number[][]) => rs.map((r) => monotonePath(r.map((i) => [x(i), y(buckets[i]![key])] as const))).join('');
  const planSegs = runsOf(buckets, first, n - 1);
  const planD = line('planned', planSegs);
  // the bucket holding today is not over: the actual line stops at the last finished one, and a dotted reach goes on to now
  // (a Monday's few miles would otherwise read as a crash); the days ahead have nothing run
  const doneSegs = runsOf(buckets, first, lastPast)
    .map((r) => r.filter((i) => i !== ci))
    .filter((r) => r.length);
  const doneD = line('done', doneSegs);
  const prevI = ci > first && !buckets[ci]!.missing && !buckets[ci - 1]!.missing ? ci - 1 : -1;
  const reachD = prevI >= 0 ? `M${x(prevI).toFixed(1)},${y(buckets[prevI]!.done).toFixed(1)}L${x(ci).toFixed(1)},${y(buckets[ci]!.done).toFixed(1)}` : '';
  const areaD = doneSegs
    .map((r) => {
      const d = monotonePath(r.map((i) => [x(i), y(buckets[i]!.done)] as const));
      return r.length > 1 ? `${d}L${x(r[r.length - 1]!).toFixed(1)},${Y0}L${x(r[0]!).toFixed(1)},${Y0}Z` : '';
    })
    .join('');
  const hasPlan = buckets.some((p, i) => i >= first && p.planned > 0);
  const hasDone = doneSegs.length > 0;
  // by day the chart is bars (guide 6.8): a day is run or rested, and a line between days would draw miles that were never run
  const bars = span.unit === 'day';
  const barW = Math.min(24, step * 0.56);

  const grid = [top / 2, top];
  const xLabels = width ? axisLabels(span, x, captionWidth(textScale), GRID_END) : [];
  // a centered label near either end is drawn where `axisLabels` measured it: kept inside the plot, never into the card's edge
  const labelX = (l: AxisLabel) => {
    if (l.anchor !== 'middle') return x(l.i);
    const half = captionWidth(textScale)(l.text) / 2;
    return Math.max(half, Math.min(GRID_END - half, x(l.i)));
  };
  // "Plan" and "You" where the lines start: the label of the line that runs higher there sits above both lines, the other
  // under both, each clear of the lines across its own width
  const startI = buckets.findIndex((p, i) => i >= first && !p.missing && !p.future);
  const lineLabels = (() => {
    if (bars || !(hasPlan && hasDone && startI >= 0 && startI < n - 1)) return [];
    const cw = captionWidth(textScale);
    const x0 = x(startI);
    const under = (w: number) => buckets.map((p, i) => ({ p, i })).filter(({ p, i }) => i >= startI && !p.missing && x(i) <= x0 + w + step);
    const span = under(cw('Plan'));
    const mean = (k: 'planned' | 'done') => span.reduce((t, { p }) => t + p[k], 0) / Math.max(1, span.length);
    const planUp = mean('planned') >= mean('done');
    const capH = 11 * textScale;
    const top = (w: number) => Math.min(...under(w).flatMap(({ p, i }) => (i > lastPast ? [y(p.planned)] : [y(p.planned), y(p.done)])));
    const bottom = (w: number) => Math.max(...under(w).flatMap(({ p, i }) => (i > lastPast ? [y(p.planned)] : [y(p.planned), y(p.done)])));
    // a label that cannot clear the lines (no room above them under the top of the plot, or below them over the axis, as at
    // 200 percent text on a small plot) is left out rather than drawn across a line or the axis
    const above = (t: string) => {
      const v = top(cw(t)) - 6;
      return v - capH >= 0 ? v : null;
    };
    const below = (t: string) => {
      const v = bottom(cw(t)) + capH + 4;
      return v <= Y0 - 3 ? v : null;
    };
    const out = [
      { key: 'plan', text: 'Plan', y: planUp ? above('Plan') : below('Plan') },
      { key: 'you', text: 'You', y: planUp ? below('You') : above('You') },
    ];
    return out.filter((l): l is { key: string; text: string; y: number } => l.y != null);
  })();
  // a new range fades the marks in (opacity only); daily bars rise from the baseline (a transform); nothing under Reduce Motion
  const fade = reduce ? { initial: false as const } : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: crossfadeSlow };
  const grow = reduce ? { initial: false as const } : { initial: { scaleY: 0 }, animate: { scaleY: 1 }, transition: springs.number };
  const cur = ci >= 0 ? buckets[ci]! : null;
  // the now dot is one Sunrise mark (drawn as .pl-now at rest, as the read dot while the finger is on this bucket)
  const shown = usePageShown();
  const nowPaint = useNowMark('pointer', shown && !!cur && !cur.missing);
  const inkNow = nowPaint === 'ink' ? 'ink' : undefined;

  return (
    <div className="pl-chart">
      <div
        ref={setRefs}
        className="pl-plot pg-touch"
        tabIndex={0}
        role="group"
        aria-label={`${label} Press and slide, or use the arrow keys, to read a point.${onOpen ? ' Tap or press Enter to open it.' : ''}`}
        onPointerDown={scrub.bind.onPointerDown}
        onPointerMove={scrub.bind.onPointerMove}
        onPointerUp={scrub.bind.onPointerUp}
        onPointerCancel={scrub.bind.onPointerCancel}
        onPointerLeave={scrub.bind.onPointerLeave}
        onClick={scrub.bind.onClick}
        onKeyDown={scrub.bind.onKeyDown}
        onBlur={scrub.bind.onBlur}
      >
        {!width ? (
          <div style={{ height: H }} />
        ) : (
          <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
            <defs>
              <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" className="pl-fill-top" />
                <stop offset="1" className="pl-fill-end" />
              </linearGradient>
            </defs>
            {grid.map((v) => (
              <g key={v}>
                <line x1={LEFT} x2={GRID_END} y1={y(v)} y2={y(v)} className="pl-grid" />
                <text x={W} y={y(v)} dy="0.32em" textAnchor="end" className="pl-ax">
                  {Math.round(v)}
                </text>
              </g>
            ))}
            <line x1={LEFT} x2={GRID_END} y1={Y0} y2={Y0} className="pl-base" />
            <motion.g {...fade}>
            {bars
              ? buckets.map((p, i) => {
                  if (p.missing) return null;
                  const cx = x(i);
                  const x0 = cx - barW / 2;
                  const rest = p.planned <= 0 && p.done <= 0;
                  if (rest) return <circle key={p.key} cx={cx} cy={Y0 - 3} r={2} className="pl-rest" />;
                  return (
                    <g key={p.key}>
                      {p.planned > 0 ? <rect x={x0} y={y(p.planned)} width={barW} height={Math.max(0, Y0 - y(p.planned))} rx={4} className={`pl-bar-plan ${p.future ? 'is-ahead' : ''}`} /> : null}
                      {p.done > 0 ? (
                        <motion.g style={{ transformOrigin: `${cx}px ${Y0}px`, transformBox: 'view-box' }} {...grow}>
                          <rect x={x0} y={y(p.done)} width={barW} height={Math.max(0, Y0 - y(p.done))} rx={4} className="pl-bar-done" />
                          <line x1={x0 + 2} x2={x0 + barW - 2} y1={y(p.done) + 0.75} y2={y(p.done) + 0.75} className="pl-bar-top" />
                        </motion.g>
                      ) : null}
                    </g>
                  );
                })
              : null}
            {bars ? null : (
              <>
            {areaD ? <path d={areaD} fill={`url(#${uid}-fill)`} /> : null}
            {hasPlan ? <path d={planD} className="pl-plan" /> : null}
            {planSegs
              .filter((r) => r.length === 1 && buckets[r[0]!]!.planned > 0)
              .map((r) => (
                <circle key={`p${r[0]}`} cx={x(r[0]!)} cy={y(buckets[r[0]!]!.planned)} r={3.5} className="pl-dot-plan" />
              ))}
            <path d={doneD} className="pl-done" />
            {reachD ? <path d={reachD} className="pl-reach" /> : null}
            {/* single buckets between gaps have no line to draw: a dot holds their place */}
            {doneSegs
              .filter((r) => r.length === 1)
              .map((r) => (
                <circle key={r[0]} cx={x(r[0]!)} cy={y(buckets[r[0]!]!.done)} r={3} className="pl-solo" />
              ))}
              </>
            )}
            {buckets.map((p, i) => (p.missing ? <line key={p.key} x1={x(i) - 4} x2={x(i) + 4} y1={Y0 - 1} y2={Y0 - 1} className="pl-gap" /> : null))}
            {lineLabels.map((l) => (
              <text key={l.key} x={x(startI)} y={l.y} textAnchor="start" className="pl-ax pl-line-label">
                {l.text}
              </text>
            ))}
            </motion.g>
            {a != null && !buckets[a]!.missing ? (
              <g className="pl-read">
                <line x1={x(a)} x2={x(a)} y1={PAD_TOP - 8} y2={Y0} className="pl-rule" />
                {buckets[a]!.planned > 0 ? <circle cx={x(a)} cy={y(buckets[a]!.planned)} r={4} className="pl-dot-plan" /> : null}
                {buckets[a]!.future ? null : buckets[a]!.current ? <circle cx={x(a)} cy={y(buckets[a]!.done)} r={4} className="pl-dot-done is-now" data-now={inkNow} /> : <circle cx={x(a)} cy={y(buckets[a]!.done)} r={5} className="pl-dot-done" />}
              </g>
            ) : null}
            {cur && !cur.missing && a !== ci ? (
              <motion.g {...fade}>
                <circle cx={x(ci)} cy={y(cur.done)} r={4} className="pl-now" data-now={inkNow} />
              </motion.g>
            ) : null}
            {xLabels.map((l) => (
              <text key={l.text + l.i} x={labelX(l)} y={H - 5} textAnchor={l.anchor} className={`pl-ax ${l.now ? (span.unit === 'day' && span.range === '1W' ? 'is-today' : 'is-now') : ''}`}>
                {l.text}
              </text>
            ))}
          </svg>
        )}
      </div>
      <ul className="sr-only" aria-label="Points">
        {buckets.map((p, i) =>
          i < first ? null : (
            <li key={p.key}>
              {onOpen ? (
                <button type="button" onClick={() => onOpen(i)}>
                  {words(i)}. Open
                </button>
              ) : (
                words(i)
              )}
            </li>
          ),
        )}
      </ul>
    </div>
  );
};
