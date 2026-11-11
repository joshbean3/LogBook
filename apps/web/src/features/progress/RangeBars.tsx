import { useCallback } from 'react';
import { barCenter, barLayout, bucketAt, useScrub } from '@/ui/charts';
import { useNowMark, usePageShown } from '@/ui/nowBudget';
import { useTextScale, useWidth } from './charts';
import { axisLabels, gridFor, labelExtent, type RangeSpan } from './ranges';

/** One bar: what its bucket holds so far, and what its plan still asks for. The chart knows no unit. */
export interface BarMark {
  key: string;
  /** Done so far (miles run, lift sessions). */
  value: number;
  /** Still planned ahead: drawn as a dashed outline on top of what is done. */
  ahead: number;
  /** Today falls in it. */
  current: boolean;
  /** It starts after today. */
  future: boolean;
  /** A day of it has not loaded: a quiet gap. */
  missing: boolean;
}

/** The rim and the plan outline: 1.5 px (guide 6.8). A bar under 7 px wide has no room for a rim around a fill that still reads as Sky: it is the rim's color, whole. */
const EDGE = 1.5;
const THIN = 7;

/** The rise: each bar starts this long after the one before it, the last no later than the cap; the overlay follows. */
const STAGGER_MS = 12;
const STAGGER_CAP_MS = 240;
const AFTER_MS = 200;

/** A caption label's width: about 9 px a letter at the 11 px caption (its +0.14 em tracking included), grown with the text. */
const captionWidth = (scale: number) => (s: string) => s.length * 9 * scale;

/**
 * A bar with a dome for a top (the brand's rising disc, guide 8.5), standing on the baseline: straight sides and a half
 * ellipse as wide as the bar, flattened when the bar is shorter than its own half width. Open at the bottom: the caller
 * closes it for a fill.
 */
const dome = (cx: number, w: number, top: number, base: number) => {
  const rx = w / 2;
  const ry = Math.min(rx, Math.max(0, base - top));
  const f = (v: number) => v.toFixed(1);
  return `M${f(cx - rx)},${f(base)}L${f(cx - rx)},${f(top + ry)}A${f(rx)},${f(ry)} 0 0 1 ${f(cx + rx)},${f(top + ry)}L${f(cx + rx)},${f(base)}`;
};

/**
 * The hero chart (guide 6.8): one bar per bucket of the range (a day, a week or a month), from a horizon baseline. What was
 * done is a Sky dome with a Deep Sky rim; what the plan still asks for (the days ahead, and the rest of the bucket holding
 * today) is a dashed Deep Sky outline on top of it, labeled "Plan" where it first shows. History is never two marks. The y
 * scale fits the tallest bar with two or three round gridlines (`gridFor`); the x labels are the set that fits
 * (`axisLabels`); the 8 px Sunrise now dot sits on the bucket holding today.
 *
 * Drag across the plot to read a bucket (`useScrub`): a marker snaps to it, its bar lights Deep Sky, the hero's readout
 * rewrites (`onScrub`), one `select` tick per bucket; letting go returns to the headline. A quick tap opens the bucket
 * (`onOpen`, when it opens anything), else shows it for a moment. A swipe up or down that starts on the plot still scrolls
 * the page. To VoiceOver and the keyboard the plot is one slider: its value is the focused bucket in words, and arrows (or
 * a swipe up or down, which VoiceOver itself announces for a slider) move it.
 *
 * The hero remounts the chart on a new range or mode: the bars rise from the baseline over 480 ms (`--dur-number`), a few
 * milliseconds apart, and the plan outline, its label and the now dot fade in once they have; the grid and the axes stand
 * still. The rise is a CSS animation on each bar's own box (`transform-box: fill-box`, origin at its foot), so a bar grows
 * up from the horizon and never from its middle. Under Reduce Motion nothing moves.
 */
export const RangeBars = ({ span, marks, label, words, format = String, hint, onScrub, onOpen, onRead }: { span: Pick<RangeSpan, 'range' | 'unit' | 'buckets'>; marks: BarMark[]; label: string; words: (i: number) => string; format?: (v: number) => string; hint?: string | null; onScrub: (i: number | null) => void; onOpen?: (i: number) => void; onRead?: () => void }) => {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const W = Math.max(220, width || 340);
  // the plot spans the card's inner width: 160 tall on a 320 pt phone, 180 from 375 up (guide 6.8)
  const H = W < 300 ? 160 : 180;
  const n = marks.length;
  // the caption labels grow with the text size (rem), the plot does not: their room grows with them (the band over the
  // tallest bar, the band under the baseline, the y labels' column on the trailing side)
  const textScale = useTextScale();
  const capH = 11 * textScale;
  const TOP = Math.round(capH) + 10;
  const Y0 = H - Math.max(24, Math.round(capH) + 13);
  const { lines, top } = gridFor(Math.max(0, ...marks.map((m) => (m.missing ? 0 : m.value + m.ahead))));
  const y = (v: number) => Y0 - (Math.min(v, top) / top) * (Y0 - TOP);
  // 9 px a figure (as `captionWidth` counts them); the grid stops 4 past the bars, so a label keeps 6 clear of its line
  const RIGHT = Math.max(30, Math.ceil(Math.max(...lines.map((v) => format(v).length)) * 9 * textScale + 10));
  const plotW = W - RIGHT;
  const GRID_END = plotW + 4;
  const lay = barLayout(plotW, n);
  const thin = lay.barW < THIN;
  const x = (i: number) => barCenter(lay, i);
  const ci = marks.findIndex((m) => m.current);
  // the bars start where the log does: nothing is drawn, read or opened before the first bucket with anything in it
  const first = Math.max(0, marks.findIndex((m) => !m.missing && (m.value > 0 || m.ahead > 0)));
  const home = ci >= 0 ? ci : n - 1;

  const scrub = useScrub({
    count: n,
    indexAt: (cx) => {
      const r = wrapRef.current?.getBoundingClientRect();
      if (!r || !r.width) return null;
      return bucketAt(lay, ((cx - r.left) / r.width) * W, first);
    },
    min: first,
    home,
    onScrub,
    onTap: onOpen,
    onRead,
  });
  const a = scrub.active;
  const bindRef = scrub.bind.ref;
  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      (wrapRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      bindRef(node);
    },
    [wrapRef, bindRef],
  );

  /** A bar's top: a value that is more than nothing always shows (3 px at least). */
  const topOf = (v: number) => Math.min(y(v), Y0 - 3);
  const cw = captionWidth(textScale);
  const xLabels = width ? axisLabels(span, x, cw, plotW) : [];
  const labelX = (cx: number, text: string) => {
    const [l, r] = labelExtent(cx, cw(text), plotW);
    return (l + r) / 2;
  };
  // "Plan" over the first dashed outline (a direct label, no legend), clear of every bar that stands under its width
  const pi = marks.findIndex((m, i) => i >= first && !m.missing && m.ahead > 0);
  const planLabel = (() => {
    if (pi < 0 || !width) return null;
    const [l, r] = labelExtent(x(pi), cw('Plan'), plotW);
    const under = marks.filter((m, i) => i >= first && !m.missing && x(i) + lay.barW / 2 > l - 2 && x(i) - lay.barW / 2 < r + 2);
    const highest = Math.min(...under.map((m) => (m.value + m.ahead > 0 ? topOf(m.value + m.ahead) : Y0)));
    return { x: (l + r) / 2, y: Math.max(capH, highest - 6) };
  })();
  // the bars rise a few milliseconds apart, 240 ms from the first to the last at most (guide 9.1); what is drawn over
  // them (the plan outline, its label, the now dot) fades in as the last one arrives
  const stagger = n - first > 1 ? Math.min(STAGGER_MS, STAGGER_CAP_MS / (n - first - 1)) : 0;
  const riseAt = (i: number) => ({ animationDelay: `${Math.round((i - first) * stagger)}ms` });
  const after = { animationDelay: `${Math.round(Math.max(0, n - 1 - first) * stagger) + AFTER_MS}ms` };
  const cur = ci >= 0 ? marks[ci]! : null;
  // the now dot is one Sunrise mark while this chart shows on the page on screen (guide 3.5 job 6)
  const shown = usePageShown();
  const nowPaint = useNowMark('pointer', shown && !!cur && !cur.missing);
  const at = a != null && !marks[a]!.missing ? marks[a]! : null;
  // where the reading sits on its bar: the top of what is done, the top of the plan for a bucket still ahead
  const atY = at ? (at.value > 0 ? topOf(at.value) : at.future && at.ahead > 0 ? topOf(at.ahead) : Y0) : 0;

  return (
    <div className="rb-chart">
      <div
        ref={setRefs}
        className="rb-plot pg-touch"
        tabIndex={0}
        role="slider"
        aria-orientation="horizontal"
        aria-label={onOpen ? `${label} Double tap or press Enter to open.` : label}
        aria-valuemin={first}
        aria-valuemax={Math.max(first, n - 1)}
        aria-valuenow={a ?? home}
        aria-valuetext={n ? words(a ?? home) : undefined}
        data-reading={a != null ? '' : undefined}
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
            {lines.map((v) => (
              <g key={v}>
                <line x1={0} x2={GRID_END} y1={y(v)} y2={y(v)} className="rb-grid" />
                <text x={W} y={y(v)} dy="0.32em" textAnchor="end" className="rb-ax">
                  {format(v)}
                </text>
              </g>
            ))}
            {marks.map((m, i) => {
              if (i < first) return null;
              const cx = x(i);
              if (m.missing) return <line key={m.key} x1={cx - 4} x2={cx + 4} y1={Y0 - 1} y2={Y0 - 1} className="rb-gap" />;
              const whole = m.value + m.ahead;
              // nothing run and nothing ahead: a dot holds the bucket's place on the horizon (guide 6.8, a rest day); the
              // bucket holding today has the now dot there instead
              if (whole <= 0) return m.current ? null : <circle key={m.key} cx={cx} cy={Y0 - 4} r={2} className={`rb-rest ${m.future ? 'is-ahead' : ''}`} />;
              return (
                <g key={m.key} className={a === i ? 'rb-bar is-lit' : 'rb-bar'}>
                  {/* the strokes are drawn inside the bar's width (half a stroke in), so a rim never widens its bar */}
                  {m.ahead > 0 ? <path d={dome(cx, lay.barW - EDGE, topOf(whole) + EDGE / 2, Y0)} className="rb-plan rb-fade" style={after} /> : null}
                  {m.value > 0 ? (
                    <g className="rb-rise" style={riseAt(i)}>
                      {/* under a rim the fill stops a hair short of the bar's edge, so no Sky fringe shows outside the rim */}
                      <path d={`${thin ? dome(cx, lay.barW, topOf(m.value), Y0) : dome(cx, lay.barW - 1, topOf(m.value) + 0.5, Y0)}Z`} className={thin ? 'rb-done is-thin' : 'rb-done'} />
                      {thin ? null : <path d={dome(cx, lay.barW - EDGE, topOf(m.value) + EDGE / 2, Y0)} className="rb-rim" />}
                    </g>
                  ) : null}
                </g>
              );
            })}
            <line x1={0} x2={GRID_END} y1={Y0} y2={Y0} className="rb-base" />
            {planLabel ? (
              <text x={planLabel.x} y={planLabel.y} textAnchor="middle" className="rb-ax rb-plan-label rb-fade" style={after}>
                Plan
              </text>
            ) : null}
            {at ? (
              <g className="rb-read">
                {atY - 6 > 3 ? <line x1={x(a!)} x2={x(a!)} y1={3} y2={atY - 6} className="rb-rule" /> : null}
                {at.current ? null : <circle cx={x(a!)} cy={atY} r={5} className="rb-dot" />}
              </g>
            ) : null}
            {cur && !cur.missing ? <circle cx={x(ci)} cy={cur.value > 0 ? topOf(cur.value) : Y0} r={4} className="rb-now rb-fade" style={after} data-now={nowPaint === 'ink' ? 'ink' : undefined} /> : null}
            {xLabels.map((l) => (
              <text key={l.text + l.i} x={labelX(x(l.i), l.text)} y={Y0 + 8 + capH * 0.82} textAnchor="middle" className={`rb-ax ${l.now ? (span.unit === 'day' && span.range === '1W' ? 'is-today' : 'is-now') : ''}`}>
                {l.text}
              </text>
            ))}
          </svg>
        )}
      </div>
      {hint ? <p className="rb-hint">{hint}</p> : null}
    </div>
  );
};
