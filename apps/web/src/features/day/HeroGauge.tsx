import { mondayOf, weekSummary, type ISODate } from '@logbook/shared';
import { ChevronRight } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type * as React from 'react';
import { useMemo } from 'react';
import { springs } from '@/lib/motion';
import { useNowMark, usePageShown } from '@/ui/nowBudget';
import { Pressable } from '@/ui/Pressable';
import { useFirstToday } from '@/ui/useFirstToday';
import type { Log } from '../log/useLog';
import { useOpenWeek } from '../progress/sheets';
import { milesText } from './faces';
import { gaugeTicks } from './gauge';
import { useIsLive } from './live';

/**
 * The hero's gauge (guide 6.5): the day's session sits in the middle of a U-shaped dial whose fill is the week's miles so far
 * against the week's plan. A Haze track, a Deep Sky fill from the start cap to the pointer, ticks by the mile, the Sunrise
 * pointer at the week's progress (the screen's now-mark, 3.5 job 2), the ends labelled 0 and the plan in caption style, and
 * the readout pill under the day's words, which reads the week and opens it.
 *
 * Geometry: a circle centred at (150, 62), r 118, drawn from 200° round the bottom to −20° (220° of arc, clockwise in SVG's
 * y-down frame), so the ends sit a little above the centre and the day's words fit inside the bowl.
 */
const CX = 150;
const CY = 62;
const R = 118;
const FROM = 200;
const SWEEP = 220;
/** Half the track's 16 px: the outer edge the ticks sit on. */
const EDGE = R + 8;
const rad = (d: number) => (d * Math.PI) / 180;
const pt = (deg: number, r = R) => [CX + r * Math.cos(rad(deg)), CY + r * Math.sin(rad(deg))] as const;
/** The arc from the start to fraction `t` (0..1) of the sweep, as an SVG path. */
const arc = (t: number, r = R) => {
  const a0 = FROM;
  const a1 = FROM - SWEEP * t;
  const [x0, y0] = pt(a0, r);
  const [x1, y1] = pt(a1, r);
  const large = SWEEP * t > 180 ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 0 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};
/** The end labels' places, as a share of the dial's box: centred over each end of the arc (horizontal, never rotated). */
const [END_LX] = pt(FROM);
const [END_RX] = pt(FROM - SWEEP);

export const weekGauge = (log: Log, date: ISODate) => {
  const s = weekSummary(log.snap, mondayOf(date));
  const planned = s.plannedMiles;
  const done = s.doneMiles;
  return { mon: s.weekStart, planned, done, t: planned > 0 ? Math.min(1, done / planned) : done > 0 ? 1 : 0, runsDone: s.runsDone, runsPlanned: s.runsPlanned };
};
/** The gauge draws (and so its pointer shows) when the week has a plan or any miles. */
export const gaugeShown = (g: ReturnType<typeof weekGauge>) => g.planned > 0 || g.done > 0;

export const HeroGauge = ({ date, log, children }: { date: ISODate; log: Log; children: React.ReactNode }) => {
  const reduce = useReducedMotion();
  // the fill sweeps, the pointer settles and the ticks draw in on the first view of the day only (guide 6.5)
  const first = useFirstToday('hero-gauge');
  const still = reduce || !first;
  const g = useMemo(() => weekGauge(log, date), [log, date]);
  const ticks = useMemo(() => gaugeTicks(g.planned > 0 ? g.planned : g.done), [g.planned, g.done]);
  const openWeek = useOpenWeek(log.today);
  const show = gaugeShown(g);
  // the pointer is the screen's now-mark while its page is the one on screen (3.5: priority 2, after today's strip dot)
  const live = useIsLive(date);
  const shown = usePageShown();
  const paint = useNowMark('pointer', show && live && shown);
  const [sx, sy] = pt(FROM);
  // the week to one decimal, as everywhere else ("7.1 of 40.5", never "7.12"; today-top-18)
  const tenth = (v: number) => milesText(Math.round(v * 10) / 10);
  /*
   * The readout prints the gauge's value, the week's miles ("4.2 of 23 mi"), and VoiceOver hears the week in full with its
   * runs. The runs are not printed: at Inter 17 the guide's "4.2 of 23 mi · 1 of 4 runs" is 200 to 230 px wide, and no pill
   * that wide clears the track's inner edge by 8 px anywhere in this bowl (6.5). 320 already dropped them; the week strip
   * shows each run's day, and the pill opens the week with every run in it.
   */
  const week = g.planned > 0 ? `${tenth(g.done)} of ${tenth(g.planned)} mi` : `${tenth(g.done)} mi`;
  const weekSaid = g.planned > 0 ? `${tenth(g.done)} of ${tenth(g.planned)} miles this week` : `${tenth(g.done)} miles this week`;
  const runs = g.runsPlanned > 0 ? `${g.runsDone} of ${g.runsPlanned} runs` : null;
  return (
    <div className={`hg ${show ? '' : 'is-empty'} ${still ? '' : 'is-first'}`}>
      {show ? (
        <>
          <svg className="hg-dial" viewBox="0 0 300 200" aria-hidden="true">
            <path d={arc(1)} className="hg-track" />
            {ticks.map((k, i) => {
              const a = FROM - SWEEP * k.t;
              const h = k.major ? 5 : 2.5;
              const [x0, y0] = pt(a, EDGE - h);
              const [x1, y1] = pt(a, EDGE + h);
              return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} className={k.major ? 'hg-tick is-major' : 'hg-tick'} style={{ '--i': i } as React.CSSProperties} />;
            })}
            {g.t > 0 ? (
              <motion.path d={arc(g.t)} className="hg-fill" initial={still ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={springs.number} />
            ) : null}
            {g.t > 0 ? <circle cx={sx} cy={sy} r={4.5} className="hg-start" /> : null}
            {/* the pointer rides the arc by a rotation about the dial's centre: a transform, on the settle spring. The group
                sits at the centre and holds an unpainted circle of the dial's size, so its box (which motion rotates about)
                is centred on the dial's centre */}
            <g transform={`translate(${CX} ${CY})`}>
              <motion.g className="hg-pointer" initial={still ? false : { rotate: 0 }} animate={{ rotate: -SWEEP * g.t }} transition={springs.settle}>
                <circle r={R + 10} fill="none" />
                <circle cx={sx - CX} cy={sy - CY} r={6} className="hg-dot" data-now={paint === 'ink' ? 'ink' : undefined} />
              </motion.g>
            </g>
          </svg>
          <span className="hg-ends" aria-hidden="true">
            <span className="hg-end" style={{ left: `${(END_LX / 300) * 100}%` }}>
              0
            </span>
            {g.planned > 0 ? (
              <span className="hg-end" style={{ left: `${(END_RX / 300) * 100}%` }}>
                {tenth(g.planned)} mi
              </span>
            ) : null}
          </span>
        </>
      ) : null}
      <div className="hg-in">
        {children}
        {show ? (
          <Pressable
            className="hero-week"
            press="dim"
            label={`${weekSaid}${runs ? `, ${runs}` : ''}. Open the week`}
            onPress={(e) => {
              e.stopPropagation();
              openWeek(g.mon);
            }}
          >
            {week}
            <ChevronRight size={15} aria-hidden="true" />
          </Pressable>
        ) : null}
      </div>
    </div>
  );
};
