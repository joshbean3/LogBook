import { clockOfDay, fmtDate, monthOf, shiftDays, type MorningTimeline } from '@logbook/shared';
import { ArrowUpRight, ChevronRight, Clock, SlidersHorizontal } from 'lucide-react';
import type * as React from 'react';
import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNav } from '@/app/NavController';
import { useToday } from '@/lib/useToday';
import { dayCaption } from '@/ui/captions';
import type { ContextMenuItem } from '@/ui/ContextMenu';
import { Pressable } from '@/ui/Pressable';
import { useNowMark, usePageShown } from '@/ui/nowBudget';
import { useSheet } from '@/ui/Sheet';
import { Skeleton, SkeletonGroup } from '@/ui/Skeleton';
import { useReleaseTap } from '../day/release';
import { useNowMinutes } from '../day/useNow';
import { useLog } from '../log/useLog';
import { morningOf, timeParts } from '../morning/model';
import { numParts } from '../morning/numParts';
import { useMonthsFailed } from './LoadFail';
import { cardStops, gapsOf, headline, nowOnTrack, quietLine, trackOf, whichMorning, workOf } from './morningTrack';
import './morningcard.css';

/** The morning's sheets come with the morning's code (and its styles), fetched on the first ask: Plan's chunk stays Plan's. */
const loadSheets = () => Promise.all([import('../morning/StepSheets'), import('../morning/RoutineEditor'), import('../morning/morning.css')]).then(([a, b]) => ({ WakeEditor: a.WakeEditor, RoutineEditor: b.RoutineEditor }));

const path = (date: string, today: string) => (date === today ? '/plan/morning' : `/plan/morning/${date}`);
const pct = (p: number) => ({ '--p': p }) as React.CSSProperties;


/**
 * The morning at the top of Plan (above the week line, outside the pager: it belongs to the day, not to the week shown):
 * today's morning until today's leave time has passed, then tomorrow's. One card you can open: the caps eyebrow, the one big
 * line that matters now, the morning as a track (Wake · Run out · Back · Leave, the run's stretch in its tone and named; Wake ·
 * Leave on a rest morning) with past stops filled and the now dot on it today, the step count and the routine's length, and
 * `See the schedule ›`. A tap pushes the schedule (`/plan/morning[/<date>]`); a hold offers Open · Change the wake time · Edit the
 * routine (the schedule's own sheets).
 */
export const MorningCard = memo(function MorningCard(): React.JSX.Element {
  const today = useToday();
  const tomorrow = shiftDays(today, 1);
  const months = useMemo(() => [...new Set([monthOf(today), monthOf(tomorrow)])], [today, tomorrow]);
  const log = useLog(months);
  const now = useNowMinutes();
  const nav = useNav();
  const sheet = useSheet();
  const st = log.boot ? (log.boot.morningSettings ?? null) : undefined;

  const Ttoday = useMemo(() => (st && log.loaded(today) ? morningOf(log.snap.sessionsOn(today), log.snap.morningOverride(today), st) : null), [st, log, today]);
  const which = whichMorning(today, now, Ttoday?.leave ?? null);
  const T = useMemo(() => {
    if (which.rel === 'today') return Ttoday;
    return st && log.loaded(which.date) ? morningOf(log.snap.sessionsOn(which.date), log.snap.morningOverride(which.date), st) : null;
  }, [which.rel, which.date, Ttoday, st, log]);

  const to = path(which.date, today);
  const rel = useReleaseTap(() => nav.push(to));
  const tap = { onPointerDown: rel.onPointerDown, onPointerMove: rel.onPointerMove, onPointerUp: rel.onPointerUp, onPointerCancel: rel.onPointerCancel, onPress: rel.onClick };
  const fail = useMonthsFailed(months);

  // a new account with no morning at all: one card that says so and opens the schedule
  if (st === null)
    return (
      <div className="mc-wrap">
        <Pressable className="mc is-setup" press="surface" label="Your morning. Set up your morning. Wake, the run, the routine, out the door. Set up" {...tap}>
          <span className="caps mc-eyebrow">Your morning</span>
          <span className="mc-head">Set up your morning</span>
          <span className="mc-quiet">Wake, the run, the routine, out the door.</span>
          <span className="mc-foot">
            <span className="mc-open">
              Set up
              <ChevronRight size={16} aria-hidden="true" />
            </span>
          </span>
        </Pressable>
      </div>
    );

  // the month did not load: Today's card under this one says so with Retry; no blank card here
  if (!T && st && fail.failed) return <></>;
  if (!T)
    return (
      <div className="mc-wrap">
        <SkeletonGroup label="Loading the morning">
          <Skeleton className="mc-skel" r="card" h="var(--mc-h)" />
        </SkeletonGroup>
      </div>
    );

  return <Card T={T} date={which.date} rel={which.rel} now={now} tap={tap} menu={() => menuOf(T, which.date, today)} />;

  function menuOf(T: MorningTimeline, date: string, today: string): ContextMenuItem[] {
    const dayName = date === today ? 'today' : 'tomorrow';
    const dayWord = date === today ? 'This morning' : 'Tomorrow';
    return [
      { label: 'Open', icon: <ArrowUpRight size={18} />, onSelect: () => nav.push(path(date, today)) },
      {
        label: 'Change the wake time',
        icon: <Clock size={18} />,
        onSelect: () => void loadSheets().then(({ WakeEditor }) => sheet.open({ eyebrow: `Morning · ${fmtDate('md', date)}`, title: 'Wake time', body: <WakeEditor settings={T.settings} day={T.day} date={date} dayName={dayName} /> })),
      },
      {
        label: 'Edit the routine',
        icon: <SlidersHorizontal size={18} />,
        onSelect: () => void loadSheets().then(({ RoutineEditor }) => sheet.open({ eyebrow: 'Every morning', title: 'Timings', detent: 'large', body: <RoutineEditor day={T.day} settings={T.settings} dayWord={dayWord} /> })),
      },
    ];
  }
});

interface Tap {
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerCancel: () => void;
  onPress: () => void;
}

const Card = ({ T, date, rel, now, tap, menu }: { T: MorningTimeline; date: string; rel: 'today' | 'tomorrow'; now: number; tap: Tap; menu: () => ContextMenuItem[] }) => {
  // the line's width (between the edge dots' centers) sets how close two stops may sit; a first guess from the window
  const lineRef = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState(() => Math.max(200, Math.min(window.innerWidth, 720) - 32 - 38 - 12));
  useLayoutEffect(() => {
    const el = lineRef.current;
    if (!el) return;
    const read = () => setWidth(Math.round(el.clientWidth) - 12);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const stops = cardStops(T);
  // the stops' minimum stretches are sized for the default text: at a larger text size the line counts as that much
  // narrower (the CSS reads the same thing through its rem container queries)
  const scale = Math.max(1, (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16);
  const pos = trackOf(
    stops.map((s) => s.at),
    gapsOf(stops, width / scale),
  );
  const isToday = rel === 'today';
  const nowP = isToday ? nowOnTrack(stops, pos, now) : null;
  // the live node is a Sunrise mark while it shows on the page on screen; past the screen's budget it paints Night Ink
  const shown = usePageShown();
  const nowPaint = useNowMark('pointer', nowP != null && shown);
  const work = workOf(T);
  // the pill never ends in an ellipsis: when the name does not fit its stretch it says the kind word (`Strength`)
  const nameRef = useRef<HTMLSpanElement>(null);
  const fitKey = `${work.name}|${width}|${scale}`;
  const [tight, setTight] = useState<string | null>(null);
  const short = tight === fitKey && work.kind !== work.name;
  useLayoutEffect(() => {
    const el = nameRef.current;
    if (el && !short && el.scrollWidth > el.clientWidth + 0.5) setTight(fitKey);
  });
  const head = headline(T, now, rel);
  const quiet = quietLine(T);
  const eyebrow = `${isToday ? 'This morning' : 'Tomorrow morning'} · ${dayCaption(date)}`;
  const di = stops.findIndex((s) => s.key === 'door');
  const bi = stops.findIndex((s) => s.key === 'back');
  // the workout's stretch on the line: door → back; a rest morning's name sits in the middle of wake → leave
  const seg = di >= 0 && bi >= 0 ? { a: pos[di]!, b: pos[bi]! } : null;
  const mid = seg ? (seg.a + seg.b) / 2 : 0.5;
  const room = seg ? seg.b - seg.a : 1;
  const n = stops.length - 1;
  const edge = (i: number) => (i === 0 ? 'is-start' : i === n ? 'is-end' : '');
  const past = (at: number) => (isToday && now >= at ? 'is-past' : '');
  // the printed words first, in the order they are printed (Voice Control: "Tap This morning"), then the track in words
  const label = `${eyebrow}. ${head}. ${quiet}. Schedule. ${stops.map((s) => `${s.label} ${clockOfDay(s.at)}`).join(', ')}. ${work.name}`;
  return (
    <div className="mc-wrap">
      <Pressable className={`mc t-${work.tone} is-${rel}`} press="surface" label={label} holdMenu={menu} menuLabel="Morning actions" {...tap}>
        <span className="caps mc-eyebrow">{eyebrow}</span>
        <span className="mc-head">{numParts(head)}</span>
        <span className="mc-track halo" aria-hidden="true">
          <span className="mc-row mc-labels">
            {stops.map((s, i) => (
              <span key={s.key} className={`mc-at mc-lab ${edge(i)} ${past(s.at)}`} style={pct(pos[i]!)}>
                <span className="mc-long">{s.label}</span>
                <span className="mc-short">{s.short}</span>
              </span>
            ))}
          </span>
          <span ref={lineRef} className="mc-row mc-line">
            <span className="mc-rail" />
            {nowP != null ? <span className="mc-done" style={{ transform: `scaleX(${nowP})` }} /> : null}
            {seg ? <span className="mc-seg" style={{ '--a': seg.a, '--b': seg.b } as React.CSSProperties} /> : null}
            {stops.map((s, i) => (
              <i key={s.key} className={`mc-at mc-dot k-${s.key} ${past(s.at)}`} style={pct(pos[i]!)} />
            ))}
            {nowP != null ? <i className="mc-at mc-now" data-now={nowPaint === 'ink' ? 'ink' : undefined} style={pct(nowP)} /> : null}
            <span className={`mc-at mc-work ${seg ? '' : 'is-rest'}`} style={{ ...pct(mid), '--room': room } as React.CSSProperties}>
              <i className="tone-dot" />
              <span ref={nameRef} className="mc-work-name">
                {short ? work.kind : work.name}
              </span>
            </span>
          </span>
          <span className="mc-row mc-times">
            {stops.map((s, i) => {
              const t = timeParts(s.at);
              return (
                <span key={s.key} className={`mc-at mc-time ${edge(i)} ${past(s.at)}`} style={pct(pos[i]!)}>
                  {t.v}
                  <small className="mc-u">{t.u}</small>
                </span>
              );
            })}
          </span>
        </span>
        <span className="mc-foot">
          <span className="mc-quiet">{quiet}</span>
          <span className="mc-open">
            Schedule
            <ChevronRight size={16} aria-hidden="true" />
          </span>
        </span>
      </Pressable>
    </div>
  );
};
