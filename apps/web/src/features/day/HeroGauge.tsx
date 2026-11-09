import { mondayOf, weekSummary, type ISODate } from '@logbook/shared';
import { ChevronRight } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type * as React from 'react';
import { useId, useMemo } from 'react';
import { Pressable } from '@/ui/Pressable';
import type { Log } from '../log/useLog';
import { useOpenWeek } from '../progress/sheets';
import { milesText } from './faces';

/**
 * The hero's gauge: the day's session sits in the middle of a U-shaped dial whose fill is the week's miles so far against
 * the week's plan (it replaces the old This week card). Ticks run round the track, a dot marks where the week is, the ends
 * are labelled 0 and the week's planned miles. Under the day's words, a pill reads the week and opens it.
 *
 * Geometry: a circle centred at (150, 62), r 118, drawn from 200° round the bottom to −20° (220° of arc, clockwise in SVG's
 * y-down frame), so the ends sit a little above the centre and the day's words fit inside the bowl.
 */
const CX = 150;
const CY = 62;
const R = 118;
const FROM = 200;
const SWEEP = 220;
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
const TICKS = 44;

export const weekGauge = (log: Log, date: ISODate) => {
  const s = weekSummary(log.snap, mondayOf(date));
  const planned = s.plannedMiles;
  const done = s.doneMiles;
  return { mon: s.weekStart, planned, done, t: planned > 0 ? Math.min(1, done / planned) : done > 0 ? 1 : 0, runsDone: s.runsDone, runsPlanned: s.runsPlanned };
};

export const HeroGauge = ({ date, log, children }: { date: ISODate; log: Log; children: React.ReactNode }) => {
  const reduce = useReducedMotion();
  const id = useId().replace(/:/g, '');
  const g = useMemo(() => weekGauge(log, date), [log, date]);
  const openWeek = useOpenWeek(log.today);
  const show = g.planned > 0 || g.done > 0;
  const [mx, my] = pt(FROM - SWEEP * g.t);
  const [lx, ly] = pt(FROM, R + 20);
  const [rx, ry] = pt(FROM - SWEEP, R + 20);
  const week = g.planned > 0 ? `${milesText(g.done)} of ${milesText(g.planned)} mi this week` : `${milesText(g.done)} mi this week`;
  const runs = g.runsPlanned > 0 ? `${g.runsDone} of ${g.runsPlanned} runs` : null;
  return (
    <div className={`hg ${show ? '' : 'is-empty'}`}>
      {show ? (
        <svg className="hg-dial" viewBox="0 0 300 200" aria-hidden="true">
          <defs>
            <linearGradient id={`hg-fill-${id}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#f6c879" />
              <stop offset="1" stopColor="#f26522" />
            </linearGradient>
            <linearGradient id={`hg-track-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#e9eef4" />
              <stop offset="1" stopColor="#dfe6ee" />
            </linearGradient>
          </defs>
          <path d={arc(1)} className="hg-track" stroke={`url(#hg-track-${id})`} />
          {Array.from({ length: TICKS + 1 }, (_, i) => {
            const a = FROM - (SWEEP * i) / TICKS;
            const [x0, y0] = pt(a, R - 4);
            const [x1, y1] = pt(a, R + (i % 4 === 0 ? 5 : 3));
            return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} className={i % 4 === 0 ? 'hg-tick is-major' : 'hg-tick'} />;
          })}
          {g.t > 0 ? (
            <motion.path
              d={arc(g.t)}
              className="hg-fill"
              stroke={`url(#hg-fill-${id})`}
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            />
          ) : null}
          {g.t > 0.04 ? <circle cx={pt(FROM)[0]} cy={pt(FROM)[1]} r={4.5} className="hg-start" /> : null}
          <motion.circle cx={mx} cy={my} r={7} className="hg-dot" initial={reduce ? false : { opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: reduce ? 0 : 0.7, duration: 0.3 }} />
          <text x={lx} y={ly} className="hg-end" textAnchor="middle" transform={`rotate(-62 ${lx} ${ly})`}>
            0
          </text>
          <text x={rx} y={ry} className="hg-end" textAnchor="middle" transform={`rotate(62 ${rx} ${ry})`}>
            {g.planned > 0 ? `${milesText(g.planned)} mi` : ''}
          </text>
        </svg>
      ) : null}
      <div className="hg-in">
        {children}
        {show ? (
          <Pressable
            className="hero-week"
            press="dim"
            label={`${week}${runs ? `, ${runs}` : ''}. Open the week`}
            onPress={(e) => {
              e.stopPropagation();
              openWeek(g.mon);
            }}
          >
            {week}
            {runs ? <span className="hero-week-runs">{runs}</span> : null}
            <ChevronRight size={14} strokeWidth={2.4} aria-hidden="true" />
          </Pressable>
        ) : null}
      </div>
    </div>
  );
};
