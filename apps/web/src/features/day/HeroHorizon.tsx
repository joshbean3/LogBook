import { ChevronRight } from 'lucide-react';
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import type * as React from 'react';
import { memo, useEffect, useId, useRef, useState } from 'react';
import { crossfade, fadeIn, fadeOut, reducedFade, springs } from '@/lib/motion';
import { useNowMark, usePageShown } from '@/ui/nowBudget';
import { registerRunner } from '@/ui/orbPaint';
import { Segmented } from '@/ui/primitives';
import { Pressable } from '@/ui/Pressable';
import { crestY, HZ, markX, NEAR_CREST, sunAt, VIEW_WORD, type HeroScene, type HeroView } from './heroWeek';

/**
 * Today's hero, the week horizon (the hero spec, docs/brand/hero.md; guide 6.5). The scene zone of the hero card: the
 * day's words (children), the drawing, and the band on the far hill. Two drawings share one landscape:
 *
 * - **Day** (`DayScene`): the week is a sunrise. The sun climbs from the left horizon to its place at the upper right, one
 *   step per run (or workout) done; each one on the week is a mark on the horizon, filled when done. The band says in words
 *   what the picture counts ("RUNS THIS WEEK", "2 of 4", the miles), and the view pill switches what is counted.
 * - **Dusk** (`DuskScene`): a day with no run and no workout. The same hills after sunset, an Apricot sun setting on the
 *   right, the light breathing very slowly. The band carries the week's totals.
 *
 * The drawing is data in, picture out: everything comes from `heroScene` (heroWeek.ts). Only transform and opacity move;
 * the sun travels by one motion value. Nothing moves on a page that is not live, and under Reduce Motion nothing travels.
 * Gradient and clip ids come from `useId()`: the day pager mounts several heroes.
 */

// ---------- the fixed drawing (spec 4.1, 4.2), in the 358 x 88 viewBox ----------
type Pt = readonly [number, number];
const crestPath = (segs: readonly (readonly [Pt, Pt, Pt, Pt])[]) => `M ${segs[0]![0].join(' ')} ` + segs.map(([, c1, c2, p1]) => `C ${c1.join(' ')} ${c2.join(' ')} ${p1.join(' ')}`).join(' ');
const VB_W = 358;
const VB_H = 88;
const NEAR = crestPath(NEAR_CREST);
const MIDDLE = 'M 0 81 C 60 82 120 80.5 180 77.5 C 235 75 300 76.5 358 80';
const FAR = 'M 0 78 C 70 76 140 79 205 82.5 C 260 85.5 315 85 358 82.5';
const closed = (crest: string) => `${crest} L ${VB_W} ${VB_H} L 0 ${VB_H} Z`;
const SKY = `${NEAR} L ${VB_W} -90 L 0 -90 Z`;
const SUN_R = 15;
const KEY = 3.5;
const MARK_R = 4.5;
/** The way's dots: one every 7 along the parabola, never past 301 (clear of the sun's place). */
const WAY = Array.from({ length: 40 }, (_, i) => {
  const x = HZ.x0 + 7 * (i + 1);
  const u = (x - HZ.x0) / HZ.W;
  return { x, y: HZ.yTop + HZ.D * (1 - u) * (1 - u) };
}).filter((d) => d.x <= 301);
/** With nothing done, the sun rises from 18.5 under its resting place on the first view of the day. */
const RISE = SUN_R + KEY;
/** The first view of the day: everything is home by this, then the gate lifts (spec 9.1: all of it inside 850 ms). */
const FIRST_MS = 900;
const SUN_TRAVEL_MS = 480;

/** The opening splash covers the first second or two of a cold open: the once-a-day moments wait until it is gone. */
const splashUp = () => typeof document !== 'undefined' && !!document.querySelector('.brand-splash');
const useAfterSplash = (on: boolean) => {
  const [gone, setGone] = useState(() => !on || !splashUp());
  useEffect(() => {
    if (gone) return;
    const t = setInterval(() => !splashUp() && setGone(true), 100);
    return () => clearInterval(t);
  }, [gone]);
  return gone;
};

/** The sun's offset from its resting place (38, 63) at fraction f, as the group's translate. */
const sunDx = (f: number) => HZ.W * f;
const sunDy = (f: number) => HZ.D * (1 - f) * (1 - f) - HZ.D;

const DayDefs = ({ id }: { id: string }) => (
  <defs>
    <linearGradient id={`${id}-glow`} x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" style={{ stopColor: 'var(--apricot)' }} stopOpacity=".95" />
      <stop offset=".3" style={{ stopColor: 'var(--horizon-2)' }} stopOpacity=".8" />
      <stop offset=".64" style={{ stopColor: 'var(--horizon-2)' }} stopOpacity=".32" />
      <stop offset="1" style={{ stopColor: 'var(--horizon-2)' }} stopOpacity="0" />
    </linearGradient>
    <radialGradient id={`${id}-halo`} cx="50%" cy="50%" r="50%">
      <stop offset="0" style={{ stopColor: 'var(--apricot)' }} stopOpacity=".8" />
      <stop offset=".4" style={{ stopColor: 'var(--horizon-2)' }} stopOpacity=".55" />
      <stop offset=".72" style={{ stopColor: 'var(--welcome-warm)' }} stopOpacity=".3" />
      <stop offset="1" style={{ stopColor: 'var(--welcome-warm)' }} stopOpacity="0" />
    </radialGradient>
    <clipPath id={`${id}-sky`}>
      <path d={SKY} />
    </clipPath>
  </defs>
);

/** The hills and the rim: constants, drawn once per instance. */
const Hills = memo(function Hills({ dusk, rim }: { dusk: boolean; rim?: string }) {
  return (
    <>
      <path className={dusk ? 'hz-dhill-1' : 'hz-hill-1'} d={closed(NEAR)} />
      <path className={dusk ? 'hz-dhill-2' : 'hz-hill-2'} d={closed(MIDDLE)} />
      <path className={dusk ? 'hz-dhill-3' : 'hz-hill-3'} d={closed(FAR)} />
      <path className={dusk ? 'hz-rim-dusk' : 'hz-rim'} d={NEAR} stroke={rim} />
    </>
  );
});

/**
 * The marks of one view (spec 6.5): a Paper keyline, a Deep Sky ring, and a Deep Sky disc that fades in when the session is
 * done. The one that fills on a change does the one overshoot (`is-pop`). A lit mark in the sun is not drawn.
 */
const Marks = ({ scene, moves, memo }: { scene: HeroScene; moves: boolean; memo: string }) => {
  // what this page's marks were before the face changed (a completion swaps the face, and the drawing with it)
  const prev = useRef<boolean[] | null>(shown.get(memo)?.lits ?? null);
  const popped = useRef(new Set<number>());
  const lits = scene.marks.map((m) => m.lit);
  if (prev.current && moves)
    lits.forEach((l, i) => {
      if (l && prev.current && prev.current[i] === false) popped.current.add(i);
    });
  lits.forEach((l, i) => {
    if (!l) popped.current.delete(i);
  });
  prev.current = lits;
  useEffect(() => {
    shown.set(memo, { ...(shown.get(memo) ?? { f: scene.f }), lits });
  });
  return (
    <>
      {scene.marks.map((m, i) => {
        const x = markX(m.share);
        const y = crestY(x);
        return (
          <g key={i} className={`hz-mark-g${m.inSun ? ' is-in-sun' : ''}`} style={{ '--i': i } as React.CSSProperties}>
            <circle className="hz-mark-key" cx={x} cy={y} r={MARK_R + 2} />
            <circle className="hz-mark" cx={x} cy={y} r={MARK_R - 0.75} />
            <circle className={`hz-mark-disc${m.lit ? ' is-lit' : ''}${popped.current.has(i) ? ' is-pop' : ''}`} cx={x} cy={y} r={MARK_R} />
          </g>
        );
      })}
    </>
  );
};

/**
 * What each page's drawing last showed, by page and view: a mark, a Skip or an Undo changes the face, which mounts a new
 * drawing, so the sun steps from where the old one stood and the mark it passes fills (spec 9.4) instead of the new face
 * starting at rest.
 */
const shown = new Map<string, { f: number; lits: boolean[] }>();

/**
 * The day drawing. `play`: the first view of the day on the live page (spec 9.1): the sun travels from rest to its place,
 * then the way and the rings come in. `moves`: the page is live and motion is allowed; otherwise every change jumps.
 * `quiet`: the sun yields to Apricot (another day's page, or the screen's now budget is spent).
 */
const DayScene = ({ scene, play, moves, quiet, page }: { scene: HeroScene; play: boolean; moves: boolean; quiet: boolean; page: string }) => {
  const ready = useAfterSplash(play);
  const id = useId().replace(/:/g, '');
  const reduce = useReducedMotion();
  const memo = `${page}|${scene.view}`;
  const was = shown.get(memo)?.f;
  const fv = useMotionValue(play ? 0 : moves && !reduce && was != null ? was : scene.f);
  useEffect(() => {
    shown.set(memo, { lits: shown.get(memo)?.lits ?? [], f: scene.f });
  }, [memo, scene.f]);
  const lift = useMotionValue(play && scene.f === 0 ? RISE : 0);
  const x = useTransform(fv, sunDx);
  const y = useTransform([fv, lift], ([f, l]: number[]) => sunDy(f!) + l!);
  const halo = useTransform(fv, (f) => 0.85 + 0.15 * f);
  const glow = useTransform(fv, (f) => 0.4 + 0.6 * f);
  // the first view of the day: 'rise' (the sun travels), 'home' (the way and the rings come in), then 'rest'
  const [stage, setStage] = useState<'rise' | 'home' | 'rest'>(play ? 'rise' : 'rest');
  const [traveling, setTraveling] = useState(false);
  useEffect(() => {
    if (stage === 'rest') return;
    if (reduce) return setStage('rest');
    // today's page waits at its first frame until it is the live one and the splash has gone
    if (!moves || !ready) return;
    const t = setTimeout(() => setStage(stage === 'rise' ? 'home' : 'rest'), stage === 'rise' ? SUN_TRAVEL_MS : FIRST_MS - SUN_TRAVEL_MS);
    return () => clearTimeout(t);
  }, [stage, moves, ready, reduce]);
  const first = stage !== 'rest' && ready;
  // the sun travels on springs.number to the view's place; a page that is not live (or Reduce Motion) jumps
  const waiting = stage === 'rise' && !(moves && ready) && !reduce;
  useEffect(() => {
    if (waiting) return;
    if (!moves || reduce) {
      fv.jump(scene.f);
      lift.jump(0);
      return;
    }
    if (fv.get() === scene.f && lift.get() === 0) return;
    setTraveling(true);
    const a = animate(fv, scene.f, springs.number);
    const b = animate(lift, 0, springs.number);
    const t = setTimeout(() => setTraveling(false), SUN_TRAVEL_MS);
    return () => {
      a.stop();
      b.stop();
      clearTimeout(t);
    };
  }, [scene.f, moves, reduce, waiting, fv, lift]);
  const [sx] = sunAt(scene.f);
  const marksAt = scene.marks.filter((m) => !m.inSun).map((m) => [markX(m.share), crestY(markX(m.share))] as const);
  // the way still to go: from the sun's place onward, never within 11 of a mark (drawn once the sun is home)
  const wayOn = scene.target && !scene.complete && stage !== 'rise';
  const ringsOn = scene.complete && stage !== 'rise';
  const switchFade = reduce ? reducedFade : undefined;
  return (
    <svg className={`hz-scene${first ? ' is-first' : ''}${traveling ? ' is-moving' : ''}`} viewBox={`0 0 ${VB_W} ${VB_H}`} aria-hidden="true">
      <DayDefs id={id} />
      <g clipPath={`url(#${id}-sky)`}>
        <motion.rect className="hz-glow" x="0" y="9" width={VB_W} height="68" fill={`url(#${id}-glow)`} style={{ opacity: glow }} />
        {WAY.map((d, i) => {
          const on = wayOn && d.x >= sx + 25.5 && !marksAt.some(([mx, my]) => Math.hypot(mx - d.x, my - d.y) < 11);
          return <circle key={d.x} className={`hz-dotp${on ? ' is-on' : ''}`} cx={d.x} cy={d.y} r="0.9" style={{ '--i': i } as React.CSSProperties} />;
        })}
        <circle className={`hz-target${wayOn ? ' is-on' : ''}`} cx={HZ.x1} cy={HZ.yTop} r={SUN_R} />
        <motion.g className="hz-sun-g" style={{ x, y }}>
          <motion.circle className="hz-halo" cx={HZ.x0} cy={HZ.yH} r="48" fill={`url(#${id}-halo)`} style={{ opacity: halo }} />
          <circle className={`hz-ring${ringsOn ? ' is-on' : ''}`} cx={HZ.x0} cy={HZ.yH} r={SUN_R + 9} />
          <circle className={`hz-ring is-outer${ringsOn ? ' is-on' : ''}`} cx={HZ.x0} cy={HZ.yH} r={SUN_R + 17} />
          <circle className="hz-sun-key" cx={HZ.x0} cy={HZ.yH} r={SUN_R + KEY} />
          <circle className={`hz-sun${quiet ? ' is-quiet' : ''}`} cx={HZ.x0} cy={HZ.yH} r={SUN_R} />
        </motion.g>
      </g>
      <Hills dusk={false} />
      {/* a switch: the old view's marks fade out together, the new ones fade in at their places once those are gone */}
      <AnimatePresence initial={false}>
        <motion.g key={scene.view} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: switchFade ?? { ...fadeIn, delay: 0.1 } }} exit={{ opacity: 0, transition: switchFade ?? fadeOut }}>
          <Marks scene={scene} moves={moves && !reduce} memo={memo} />
        </motion.g>
      </AnimatePresence>
    </svg>
  );
};

// ---------- dusk (spec 8) ----------
const DUSK_SUN_X = 292;
const DUSK_SUN_Y = crestY(DUSK_SUN_X) - 4;
const STARS: readonly [number, number, number, number][] = [
  [72, 14, 0.8, 0.5],
  [158, 7, 0.7, 0.4],
  [216, 22, 0.9, 0.5],
  [298, -18, 0.9, 0.55],
  [334, -2, 0.7, 0.4],
];

const DuskScene = ({ first }: { first: boolean }) => {
  const id = useId().replace(/:/g, '');
  return (
    <div className="hz-stage">
      <span className="hz-dusk-light" aria-hidden="true" />
      <svg className="hz-scene hz-scene-dusk" viewBox={`0 0 ${VB_W} ${VB_H}`} aria-hidden="true">
        <defs>
          <linearGradient id={`${id}-drim`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={VB_W} y2="0">
            <stop offset="0" style={{ stopColor: 'var(--apricot)' }} stopOpacity=".35" />
            <stop offset=".55" style={{ stopColor: 'var(--apricot)' }} stopOpacity=".9" />
            <stop offset="1" style={{ stopColor: 'var(--apricot)' }} stopOpacity="1" />
          </linearGradient>
          <clipPath id={`${id}-sky`}>
            <path d={SKY} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${id}-sky)`}>
          {STARS.map(([sx, sy, r, op], i) => (
            <circle key={i} className="hz-star" cx={sx} cy={sy} r={r} opacity={op} style={{ '--i': i } as React.CSSProperties} />
          ))}
          <circle className={`hz-sun-dusk${first ? ' is-first' : ''}`} cx={DUSK_SUN_X} cy={DUSK_SUN_Y} r="20" />
        </g>
        <Hills dusk rim={`url(#${id}-drim)`} />
      </svg>
    </div>
  );
};

// ---------- the band ----------

/** The day band: the label and the numbers (one button, it opens the week), then the view pill. */
const DayBand = ({ scene, onWeek, onPick }: { scene: HeroScene; onWeek: () => void; onPick: (v: HeroView) => void }) => {
  const reduce = useReducedMotion();
  const picking = useRef(false);
  const [status, setStatus] = useState('');
  useEffect(() => {
    if (!picking.current) return;
    picking.current = false;
    setStatus(`${scene.label}, ${scene.count}`);
  }, [scene.view, scene.label, scene.count]);
  const pill = scene.views.length > 1;
  return (
    <div className={`hz-band${pill ? ' has-views' : ''}`}>
      <Pressable
        className="hz-read"
        press="dim"
        label={scene.said}
        onPress={(e) => {
          e.stopPropagation();
          onWeek();
        }}
      >
        {/* a switch cross-fades the label and the count in one grid cell: nothing shifts */}
        <span className="hz-words-x">
          <AnimatePresence initial={false}>
            <motion.span key={scene.view} className="hz-words-in" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={reduce ? reducedFade : crossfade}>
              <span className="hz-label">
                <span className="hz-label-text">{scene.label}</span>
                <ChevronRight size={12} aria-hidden="true" />
              </span>
              <span className="hz-nums">
                <span className="hz-nums-in">
                  <span className="hz-count">{scene.count}</span>
                  {scene.second ? <span className="hz-second">{scene.second}</span> : null}
                </span>
              </span>
            </motion.span>
          </AnimatePresence>
        </span>
      </Pressable>
      {pill ? (
        <Segmented
          className="hz-views"
          label="This week’s count"
          value={scene.view}
          onChange={(v) => {
            picking.current = true;
            onPick(v);
          }}
          options={scene.views.map((v) => [
            v,
            <span key={v} className="hz-view-label" data-text={VIEW_WORD[v]}>
              {VIEW_WORD[v]}
            </span>,
          ])}
        />
      ) : null}
      <span className="sr-only" role="status">
        {status}
      </span>
    </div>
  );
};

/** The dusk band: the week's totals, small, on the far hill at night. With no totals, the bare hill. */
const DuskBand = ({ scene, onWeek }: { scene: HeroScene; onWeek: () => void }) =>
  scene.totals.length ? (
    <div className="hz-band">
      <Pressable
        className="hz-read hz-read-dusk"
        press="dim"
        label={scene.totalsSaid}
        onPress={(e) => {
          e.stopPropagation();
          onWeek();
        }}
      >
        <span className="hz-label">
          <span className="hz-label-text">This week</span>
          <ChevronRight size={12} aria-hidden="true" />
        </span>
        <span className="hz-totals">
          <span className="hz-totals-in">
            {scene.totals.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </span>
        </span>
      </Pressable>
    </div>
  ) : (
    <div className="hz-band hz-band-bare" aria-hidden="true" />
  );

/** The dusk card's line under the title when it is a button: the next session, or the way to add one. */
export const HorizonNext = ({ text, tail, label, onPress }: { text: string; tail?: string; label: string; onPress: () => void }) => (
  <Pressable
    className="hz-next"
    press="dim"
    label={label}
    onPress={(e) => {
      e.stopPropagation();
      onPress();
    }}
  >
    <span className="hz-next-text">
      {text}
      {tail ? <span className="hz-next-tail">{tail}</span> : null}
    </span>
    {' '}
    <ChevronRight size={14} aria-hidden="true" />
  </Pressable>
);

/** One beat after the sun is down, the dusk light starts to breathe (spec 9.2). */
const BREATH_AFTER_MS = 4900;

export interface HeroHorizonProps {
  scene: HeroScene;
  /** The page is today's: the once-a-day sequences may play here. */
  isToday: boolean;
  /** The once-a-day gate (`useFirstToday`) for this mode. */
  firstToday: boolean;
  /** Another day's page: the quiet colors. */
  quiet: boolean;
  /** The page is the pager's live page. */
  live: boolean;
  /** The page's date: what its drawing last showed is kept by it. */
  page: string;
  onWeek: () => void;
  onPick: (v: HeroView) => void;
  /** The day's words: the name (or the dusk title) and the line under it. */
  children: React.ReactNode;
}

/** The scene zone: the sky, the words, the drawing, the band. */
export const HeroHorizon = ({ scene, isToday, firstToday, quiet, live, page, onWeek, onPick, children }: HeroHorizonProps) => {
  const reduce = useReducedMotion();
  const shown = usePageShown();
  const day = scene.mode === 'day';
  // the week's sun is the screen's now-mark while its page is on screen (guide 3.5 job 2); it yields to Apricot
  const paint = useNowMark('pointer', day && live && shown);
  const moves = live && !reduce;
  // the first view of the day plays on today's page only, and only once it is the live one
  const [play] = useState(() => firstToday && isToday && !reduce);
  const ref = useRef<HTMLDivElement>(null);
  // dusk: the sunset plays once a day; the light breathes only while the page is seen and still (orbPaint's data-run gate)
  const [duskFirst, setDuskFirst] = useState(play && !day);
  const [breathe, setBreathe] = useState(!(play && !day));
  const ready = useAfterSplash(play && !day);
  const sunsetOn = !day && duskFirst && ready && live;
  useEffect(() => {
    if (!sunsetOn) return;
    const t = setTimeout(() => setDuskFirst(false), 1600);
    return () => clearTimeout(t);
  }, [sunsetOn]);
  // the breath starts one beat after the sun is down (its own timer: the sunset's end must not cancel it)
  const breathWait = !day && !breathe && ready && live;
  useEffect(() => {
    if (!breathWait) return;
    const t = setTimeout(() => setBreathe(true), BREATH_AFTER_MS);
    return () => clearTimeout(t);
  }, [breathWait]);
  useEffect(() => (!day && breathe && live && shown && ref.current ? registerRunner(ref.current) : undefined), [day, breathe, live, shown]);
  return (
    <div ref={ref} className={`hz${day ? '' : ' is-dusk'}${quiet ? ' is-quiet' : ''}${sunsetOn ? ' is-first' : ''}`}>
      <span className="hz-sky" aria-hidden="true" />
      <div className="hz-words">{children}</div>
      {day ? (
        <>
          <DayScene scene={scene} play={play} moves={moves} quiet={quiet || paint === 'ink'} page={page} />
          <DayBand scene={scene} onWeek={onWeek} onPick={onPick} />
        </>
      ) : (
        <>
          <DuskScene first={sunsetOn} />
          <DuskBand scene={scene} onWeek={onWeek} />
        </>
      )}
    </div>
  );
};
