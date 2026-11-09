import { fmtDate } from '@logbook/shared';
import { useCallback } from 'react';
import { niceTop, useWidth } from './charts';
import type { BarWeek } from './hero';
import { useScrub } from './useScrub';

const H = 172;
const PAD_TOP = 14;
const Y0 = H - 22;
const RIGHT = 26;
const monthShort = new Intl.DateTimeFormat('en-US', { month: 'short' });
const monthOfWeek = (w: string) => monthShort.format(new Date(`${w}T12:00:00`));

/** A bar standing on the baseline: rounded at the top, square where it meets the axis. */
const barPath = (x: number, y: number, w: number, h: number, r: number) => {
  if (h <= 0 || w <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
};

/**
 * Planned against done, a bar per week: the plan as a light well with a hairline edge, what got done as a solid bar
 * filling it from the bottom (navy; this week orange). A week with no plan draws the solid bar alone; a missed week is an
 * empty well; a week whose month has not loaded is a dash on the baseline.
 *
 * Press and slide to read a week (`onScrub` rewrites the headline, a `select` tick per week); a quick tap opens it. Arrow
 * keys read and Enter opens on the focused chart; VoiceOver gets a hidden list of week buttons.
 */
export const PlanBars = ({ weeks, count, label, words, onScrub, onOpen, mode }: { weeks: BarWeek[]; count?: boolean; label: string; words: (i: number) => string; onScrub: (i: number | null) => void; onOpen: (i: number) => void; mode: string }) => {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const W = Math.max(220, width || 340);
  const n = weeks.length;
  const max = Math.max(0, ...weeks.map((p) => Math.max(p.planned, p.done)));
  const top = count ? Math.max(3, Math.ceil(max)) : niceTop(max * 1.08);
  const y = (v: number) => Y0 - (v / top) * (Y0 - PAD_TOP);
  const band = (W - RIGHT) / n;
  const bw = Math.max(6, Math.min(26, band * 0.66));
  const xc = (i: number) => band * i + band / 2;
  const ci = weeks.findIndex((p) => p.current);
  let peak: number | null = null;
  weeks.forEach((p, i) => {
    if (p.done > 0 && (peak == null || p.done > weeks[peak]!.done)) peak = i;
  });

  const scrub = useScrub({
    count: n,
    indexAt: (cx) => {
      const r = wrapRef.current?.getBoundingClientRect();
      if (!r) return null;
      const x = ((cx - r.left) / r.width) * W;
      return Math.min(n - 1, Math.max(0, Math.floor(x / band)));
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

  // y: quiet dashed lines at round values, the number at the right
  const grid: number[] = count ? (top <= 4 ? Array.from({ length: top }, (_, i) => i + 1) : [Math.round(top / 2), top]) : [top / 2, top];
  // x: a month's name where it begins, and "Now" under this week; a label keeps its own room
  const xLabels: Array<{ x: number; text: string; now?: boolean }> = [];
  if (ci >= 0) xLabels.push({ x: xc(ci), text: 'Now', now: true });
  weeks.forEach((p, i) => {
    if (i > 0 && monthOfWeek(p.w) === monthOfWeek(weeks[i - 1]!.w)) return;
    const x = Math.max(14, xc(i));
    if (xLabels.some((l) => Math.abs(l.x - x) < 34)) return;
    xLabels.push({ x, text: monthOfWeek(p.w) });
  });
  const inset = bw >= 12 ? 3 : 1.5;

  return (
    <div className="pb-chart">
      <div
        ref={setRefs}
        className="pb-plot pg-touch"
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
              <linearGradient id="pb-done" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#2a5a86" />
                <stop offset="1" stopColor="#12324f" />
              </linearGradient>
              <linearGradient id="pb-now" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#ff8a3d" />
                <stop offset="1" stopColor="#ef5f12" />
              </linearGradient>
            </defs>
            {grid.map((v) => (
              <g key={v}>
                <line x1={0} x2={W - RIGHT + 4} y1={y(v)} y2={y(v)} className="pb-grid" />
                <text x={W} y={y(v)} dy="0.32em" textAnchor="end" className="pb-ax">
                  {Math.round(v)}
                </text>
              </g>
            ))}
            {a != null ? <rect x={xc(a) - bw / 2 - 5} y={PAD_TOP - 8} width={bw + 10} height={Y0 - PAD_TOP + 8} rx={8} className="pb-col" /> : null}
            <g key={mode} className="pb-bars">
              {weeks.map((p, i) => {
                const x = xc(i) - bw / 2;
                if (p.missing)
                  return (
                    <g key={p.w} data-week={p.w}>
                      <line x1={x} x2={x + bw} y1={Y0 - 1} y2={Y0 - 1} className="pb-gap" />
                    </g>
                  );
                const dim = a != null && a !== i;
                const planH = p.planned > 0 ? Y0 - y(p.planned) : 0;
                const doneH = p.done > 0 ? Math.max(3, Y0 - y(p.done)) : 0;
                // inside a well the bar sits in from its edges; with no plan it is the full width
                const pad = planH > 0 ? inset : 0;
                // a week done in full fills its well to just under the edge; a bigger week rises past it
                const doneTop = planH > 0 && p.done <= p.planned ? Math.max(Y0 - doneH, Y0 - planH + pad) : Y0 - doneH;
                return (
                  <g key={p.w} className={`pb-week ${p.current ? 'is-now' : ''}`} style={{ opacity: dim ? 0.35 : 1, animationDelay: `${i * 22}ms` }} data-week={p.w}>
                    {planH > 0 ? <path className="pb-plan" d={barPath(x + 0.5, Y0 - planH + 0.5, bw - 1, planH - 0.5, 6)} /> : null}
                    {doneH > 0 ? <path className="pb-done" fill={p.current ? 'url(#pb-now)' : 'url(#pb-done)'} d={barPath(x + pad, doneTop, bw - pad * 2, Y0 - doneTop, 4.5)} /> : null}
                  </g>
                );
              })}
            </g>
            <line x1={0} x2={W - RIGHT + 4} y1={Y0} y2={Y0} className="pb-base" />
            {ci >= 0 && !weeks[ci]!.done && !weeks[ci]!.planned ? <circle cx={xc(ci)} cy={Y0} r={2.5} className="pb-now-dot" /> : null}
            {xLabels.map((l) => (
              <text key={l.text + l.x} x={l.x} y={H - 4} textAnchor="middle" className={`pb-ax ${l.now ? 'is-now' : ''}`}>
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
