import { clockOfDay, fmtDate, monthOf, shiftDays, type MorningTimeline } from '@logbook/shared';
import { AlarmClock, ArrowUpRight, ChevronRight, SlidersHorizontal } from 'lucide-react';
import type * as React from 'react';
import { memo, useMemo } from 'react';
import { useNav } from '@/app/NavController';
import { useToday } from '@/lib/useToday';
import { dayCaption } from '@/ui/captions';
import type { ContextMenuItem } from '@/ui/ContextMenu';
import { Pressable } from '@/ui/Pressable';
import { useSheet } from '@/ui/Sheet';
import { Skeleton, SkeletonGroup } from '@/ui/Skeleton';
import { useReleaseTap } from '../day/release';
import { useNowMinutes } from '../day/useNow';
import { useLog } from '../log/useLog';
import { morningOf, timeParts } from '../morning/model';
import { cardStops, gapsOf, headline, nowOnTrack, quietLine, trackOf, whichMorning, workOf } from './morningCard';
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
 * `See the schedule ›`. A tap pushes the schedule (`/plan/morning[/<date>]`); a hold offers Open · Change the alarm · Edit the
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

  // a new account with no morning at all: one card that says so and opens the schedule
  if (st === null)
    return (
      <div className="mc-wrap">
        <Pressable className="mc is-setup" press="surface" label="Set up your morning. Open the morning schedule" {...tap}>
          <span className="caps mc-eyebrow">Your morning</span>
          <span className="mc-head display">Set up your morning</span>
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
        label: 'Change the alarm',
        icon: <AlarmClock size={18} />,
        onSelect: () => void loadSheets().then(({ WakeEditor }) => sheet.open({ eyebrow: `Morning · ${fmtDate('md', date)}`, title: 'Alarm', body: <WakeEditor settings={T.settings} day={T.day} date={date} dayName={dayName} /> })),
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
  const stops = cardStops(T);
  const pos = trackOf(
    stops.map((s) => s.at),
    gapsOf(stops),
  );
  const isToday = rel === 'today';
  const nowP = isToday ? nowOnTrack(stops, pos, now) : null;
  const work = workOf(T);
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
  const label = `${eyebrow.replace(' · ', ', ')}. ${head}. ${stops.map((s) => `${s.label} ${clockOfDay(s.at)}`).join(', ')}. ${work.name}. ${quiet}. Open the morning schedule`;
  return (
    <div className="mc-wrap">
      <Pressable className={`mc t-${work.tone} is-${rel}`} press="surface" label={label} holdMenu={menu} menuLabel="Morning actions" {...tap}>
        <span className="caps mc-eyebrow">{eyebrow}</span>
        <span className="mc-head display">{head}</span>
        <span className="mc-track halo" aria-hidden="true">
          <span className="mc-row mc-labels">
            {stops.map((s, i) => (
              <span key={s.key} className={`mc-at mc-lab ${edge(i)} ${past(s.at)}`} style={pct(pos[i]!)}>
                <span className="mc-long">{s.label}</span>
                <span className="mc-short">{s.short}</span>
              </span>
            ))}
          </span>
          <span className="mc-row mc-line">
            <span className="mc-rail" />
            {nowP != null ? <span className="mc-done" style={{ transform: `scaleX(${nowP})` }} /> : null}
            {seg ? <span className="mc-seg" style={{ '--a': seg.a, '--b': seg.b } as React.CSSProperties} /> : null}
            {stops.map((s, i) => (
              <i key={s.key} className={`mc-at mc-dot k-${s.key} ${past(s.at)}`} style={pct(pos[i]!)} />
            ))}
            {nowP != null ? <i className="mc-at mc-now" style={pct(nowP)} /> : null}
            <span className={`mc-at mc-work ${seg ? '' : 'is-rest'}`} style={{ ...pct(mid), '--room': room } as React.CSSProperties}>
              <i className="tone-dot" />
              <span className="mc-work-name">{work.name}</span>
            </span>
          </span>
          <span className="mc-row mc-times">
            {stops.map((s, i) => {
              const t = timeParts(s.at);
              return (
                <span key={s.key} className={`mc-at mc-time stamp ${edge(i)} ${past(s.at)}`} style={pct(pos[i]!)}>
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
            See the schedule
            <ChevronRight size={16} aria-hidden="true" />
          </span>
        </span>
      </Pressable>
    </div>
  );
};
