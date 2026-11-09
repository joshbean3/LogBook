import { fmtDate } from '@logbook/shared';
import { motion } from 'motion/react';
import { useCallback, useId } from 'react';
import { useReduced } from '@/lib/motion';
import { niceTop, useWidth } from './charts';
import { monotonePath } from './curve';
import type { BarWeek } from './hero';
import { useScrub } from './useScrub';

const H = 176;
const PAD_TOP = 16;
const Y0 = H - 24;
const LEFT = 8;
const RIGHT = 30;
const monthShort = new Intl.DateTimeFormat('en-US', { month: 'short' });
const monthOfWeek = (w: string) => monthShort.format(new Date(`${w}T12:00:00`));

/** Runs of consecutive weeks that have loaded: a line breaks at a gap, it never bridges one with a value it does not have. */
const runsOf = (weeks: BarWeek[], from: number) => {
  const out: number[][] = [];
  let cur: number[] = [];
  weeks.forEach((p, i) => {
    if (i < from) return;
    if (p.missing) {
      if (cur.length) out.push(cur);
      cur = [];
    } else cur.push(i);
  });
  if (cur.length) out.push(cur);
  return out;
};

/**
 * Weekly miles as two curves: the plan a soft dashed line, what was run a solid navy line over a gentle fill, this week a
 * bright orange dot. Both lines draw in once (and again on a new mode); reduced motion draws them in place. Press and slide
 * to read a week: a rule and a dot on each line follow the finger, the headline rewrites (`onScrub`), a `select` tick per
 * week. A quick tap opens the week. Arrow keys and Enter on the focused chart; a hidden list of weeks for VoiceOver.
 */
export const PlanLine = ({ weeks, label, words, onScrub, onOpen }: { weeks: BarWeek[]; label: string; words: (i: number) => string; onScrub: (i: number | null) => void; onOpen: (i: number) => void }) => {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const reduce = useReduced();
  const uid = useId().replace(/:/g, '');
  const W = Math.max(220, width || 340);
  const n = weeks.length;
  const max = Math.max(0, ...weeks.map((p) => Math.max(p.planned, p.done)));
  const top = niceTop(max * 1.12);
  const y = (v: number) => Y0 - (v / top) * (Y0 - PAD_TOP);
  const step = (W - LEFT - RIGHT) / Math.max(1, n - 1);
  const x = (i: number) => LEFT + step * i;
  const ci = weeks.findIndex((p) => p.current);
  // the lines start where the log does: no flat run of zeros before the first week with anything in it
  const first = Math.max(0, weeks.findIndex((p) => !p.missing && (p.planned > 0 || p.done > 0)));
  let peak: number | null = null;
  weeks.forEach((p, i) => {
    if (p.done > 0 && (peak == null || p.done > weeks[peak]!.done)) peak = i;
  });

  const scrub = useScrub({
    count: n,
    indexAt: (cx) => {
      const r = wrapRef.current?.getBoundingClientRect();
      if (!r) return null;
      const px = ((cx - r.left) / r.width) * W;
      return Math.min(n - 1, Math.max(0, Math.round((px - LEFT) / step)));
    },
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

  const segs = runsOf(weeks, first);
  const line = (key: 'planned' | 'done', rs: number[][]) => rs.map((r) => monotonePath(r.map((i) => [x(i), y(weeks[i]![key])] as const))).join('');
  const planD = line('planned', segs);
  // this week is not over: the actual line stops at the last finished week, and a dotted reach goes on to the week so far
  // (a Monday's few miles would otherwise read as a crash)
  const doneSegs = segs.map((r) => r.filter((i) => i !== ci)).filter((r) => r.length);
  const doneD = line('done', doneSegs);
  const prevI = ci > first && segs.some((r) => r.includes(ci) && r.includes(ci - 1)) ? ci - 1 : -1;
  const reachD = prevI >= 0 ? `M${x(prevI).toFixed(1)},${y(weeks[prevI]!.done).toFixed(1)}L${x(ci).toFixed(1)},${y(weeks[ci]!.done).toFixed(1)}` : '';
  const areaD = doneSegs
    .map((r) => {
      const d = monotonePath(r.map((i) => [x(i), y(weeks[i]!.done)] as const));
      return r.length > 1 ? `${d}L${x(r[r.length - 1]!).toFixed(1)},${Y0}L${x(r[0]!).toFixed(1)},${Y0}Z` : '';
    })
    .join('');
  const hasPlan = weeks.some((p, i) => i >= first && p.planned > 0);

  const grid = [top / 2, top];
  const xLabels: Array<{ x: number; text: string; now?: boolean; anchor: 'start' | 'middle' | 'end' }> = [];
  if (ci >= 0) xLabels.push({ x: x(ci), text: 'Now', now: true, anchor: ci === n - 1 ? 'end' : 'middle' });
  weeks.forEach((p, i) => {
    // a month starts a label where the lines are drawn (the first drawn week names its month)
    if (i < first || (i > first && monthOfWeek(p.w) === monthOfWeek(weeks[i - 1]!.w))) return;
    const lx = x(i);
    if (xLabels.some((l) => Math.abs(l.x - lx) < 36)) return;
    xLabels.push({ x: lx, text: monthOfWeek(p.w), anchor: i === 0 ? 'start' : 'middle' });
  });
  // the line draws in, then the fill under it settles
  const draw = reduce ? { initial: false as const } : { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { duration: 0.9, ease: [0.33, 1, 0.68, 1] as const } };
  const fade = (delay: number) => (reduce ? { initial: false as const } : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.5, delay } });
  const cur = ci >= 0 ? weeks[ci]! : null;

  return (
    <div className="pl-chart">
      <div
        ref={setRefs}
        className="pl-plot pg-touch"
        tabIndex={0}
        role="group"
        aria-label={`${label} Press and slide, or use the arrow keys, to read a week. Tap or press Enter to open it.`}
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
                <stop offset="0" stopColor="#2a5a86" stopOpacity="0.22" />
                <stop offset="1" stopColor="#2a5a86" stopOpacity="0" />
              </linearGradient>
              <linearGradient id={`${uid}-line`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#3b6d99" />
                <stop offset="1" stopColor="#12324f" />
              </linearGradient>
              {/* the dashed plan draws in through a solid copy of itself */}
              <mask id={`${uid}-plan`} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
                <motion.path d={planD} fill="none" stroke="#fff" strokeWidth={6} strokeLinecap="round" {...draw} />
              </mask>
            </defs>
            {grid.map((v) => (
              <g key={v}>
                <line x1={LEFT} x2={W - RIGHT + 8} y1={y(v)} y2={y(v)} className="pl-grid" />
                <text x={W} y={y(v)} dy="0.32em" textAnchor="end" className="pl-ax">
                  {Math.round(v)}
                </text>
              </g>
            ))}
            <line x1={LEFT} x2={W - RIGHT + 8} y1={Y0} y2={Y0} className="pl-base" />
            {areaD ? <motion.path d={areaD} fill={`url(#${uid}-fill)`} {...fade(0.45)} /> : null}
            {hasPlan ? <path d={planD} className="pl-plan" mask={`url(#${uid}-plan)`} /> : null}
            {segs
              .filter((r) => r.length === 1 && weeks[r[0]!]!.planned > 0)
              .map((r) => (
                <circle key={`p${r[0]}`} cx={x(r[0]!)} cy={y(weeks[r[0]!]!.planned)} r={3.5} className="pl-dot-plan" />
              ))}
            <motion.path d={doneD} className="pl-done" stroke={`url(#${uid}-line)`} {...draw} />
            {reachD ? <motion.path d={reachD} className="pl-reach" {...fade(0.75)} /> : null}
            {/* single weeks between gaps have no line to draw: a dot holds their place */}
            {doneSegs
              .filter((r) => r.length === 1 && r[0] !== prevI)
              .map((r) => (
                <circle key={r[0]} cx={x(r[0]!)} cy={y(weeks[r[0]!]!.done)} r={3} className="pl-solo" />
              ))}
            {weeks.map((p, i) => (p.missing ? <line key={p.w} x1={x(i) - 4} x2={x(i) + 4} y1={Y0 - 1} y2={Y0 - 1} className="pl-gap" /> : null))}
            {a != null && !weeks[a]!.missing ? (
              <g className="pl-read">
                <line x1={x(a)} x2={x(a)} y1={PAD_TOP - 8} y2={Y0} className="pl-rule" />
                {weeks[a]!.planned > 0 ? <circle cx={x(a)} cy={y(weeks[a]!.planned)} r={4} className="pl-dot-plan" /> : null}
                <circle cx={x(a)} cy={y(weeks[a]!.done)} r={5} className={`pl-dot-done ${weeks[a]!.current ? 'is-now' : ''}`} />
              </g>
            ) : null}
            {cur && !cur.missing && a !== ci ? (
              <motion.g {...fade(0.8)}>
                <circle cx={x(ci)} cy={y(cur.done)} r={9} className="pl-now-halo" />
                <circle cx={x(ci)} cy={y(cur.done)} r={5} className="pl-now" />
              </motion.g>
            ) : null}
            {xLabels.map((l) => (
              <text key={l.text + l.x} x={l.x} y={H - 5} textAnchor={l.anchor} className={`pl-ax ${l.now ? 'is-now' : ''}`}>
                {l.text}
              </text>
            ))}
          </svg>
        )}
      </div>
      <ul className="sr-only" aria-label="Weeks">
        {weeks.map((p, i) => (
          <li key={p.w}>
            <button type="button" onClick={() => onOpen(i)}>
              {words(i)}. Open {fmtDate('md', p.w)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
