import { mondayOf, shiftDays, type ISODate } from '@logbook/shared';
import { ChevronLeft } from 'lucide-react';
import type * as React from 'react';
import { memo, useMemo } from 'react';
import { Pressable } from '@/ui/Pressable';
import { dayRange } from '@/ui/charts/range';
import { faceOf } from '../day/faces';
import { DayHero, OtherSessions, useMarkOverride } from '../day/Hero';
import { HeroHorizon } from '../day/HeroHorizon';
import { setHeroView, useHeroView } from '../day/heroView';
import { heroScene, heroWeek, type HeroLead, type HeroScene } from '../day/heroWeek';
import { faceForWhen, useAfternoon, useTrainWhen, whenFace, type AfternoonSettings, type TrainWhen } from '../day/trainWhen';
import { useDeferredMinutes, useFaceMinutes } from '../day/useDeferred';
import type { Log } from '../log/useLog';
import { useOpenWeek } from '../progress/sheets';
import { weekTitle } from './context';

/**
 * The card the Fitness page leads with (guide 6.5a, "Fitness").
 *
 * `TrainingCard`: this week. It is Today's training card, whole and unchanged (the session's name and line, or the dusk
 * scene on a day with nothing on; the week horizon; the band with its Runs / Workouts pill; the log line and its ring,
 * hold to mark done), drawn from the same parts Today uses. One difference: Today swaps the card for its Close card in the
 * evening; Fitness keeps the training card all day, so the evening's face is asked for again as the day's.
 *
 * `WeekCard`: any other week. The same card as that week's summary: its name ("Next week", "Week of Nov 23"), its dates,
 * the same horizon and band counted for that week, and the way back to this week. No log line.
 */
const dayFace = (log: Log, date: ISODate, minutes: number, when: TrainWhen, pm: AfternoonSettings) => {
  const r = whenFace(log, date, minutes, when, pm);
  if (r.face.kind !== 'evening') return r;
  const ph = { ...r.ph, phase: 'day' as const };
  return { ph, face: faceForWhen(faceOf(log, date, ph), when, pm, log.boot?.morningSettings?.run.pace) };
};

export const TrainingCard = memo(function TrainingCard({ date, log: real }: { date: ISODate; log: Log }): React.JSX.Element {
  const { log, markNow } = useMarkOverride(real, date);
  const clock = useFaceMinutes();
  const when = useTrainWhen(date);
  const pm = useAfternoon();
  const keyOf = (m: number) => {
    const f = dayFace(log, date, m, when, pm).face;
    return `${f.kind}|${f.key}|${f.halo}|${f.tall}`;
  };
  const minutes = useDeferredMinutes(clock, keyOf);
  const { ph, face } = useMemo(() => dayFace(log, date, minutes, when, pm), [log, date, minutes, when, pm]);
  return (
    <div className="pl-lead">
      <DayHero date={date} log={log} ph={ph} face={face} minutes={minutes} markNow={markNow} />
      {/* a second session today is its own compact card under the first, as on Today */}
      <OtherSessions date={date} log={real} />
    </div>
  );
});

/** The band's words for a week that is not this one: "Runs next week", "Runs last week", "Runs that week". */
const weekScene = (scene: HeroScene, mon: string, today: string): HeroScene => {
  const now = mondayOf(today);
  const word = mon === shiftDays(now, 7) ? 'next week' : mon === shiftDays(now, -7) ? 'last week' : 'that week';
  const swap = (s: string) => s.replace(/this week/i, word);
  return { ...scene, label: swap(scene.label), said: swap(scene.said), totalsSaid: scene.totalsSaid.replace(/^This week/, word.charAt(0).toUpperCase() + word.slice(1)) };
};

export const WeekCard = memo(function WeekCard({ mon, log, live, onThisWeek }: { mon: ISODate; log: Log; live: boolean; onThisWeek: () => void }): React.JSX.Element {
  const picked = useHeroView(log.today, mon);
  const week = useMemo(() => heroWeek(log.snap, mon), [log.snap, mon]);
  // the scene counts what the week holds: runs first, else workouts; a week with neither is the dusk scene
  const lead: HeroLead = week.runs.planned + week.runs.done > 0 || week.doneMiles > 0 ? 'run' : week.workouts.planned + week.workouts.done > 0 ? 'lift' : null;
  const scene = useMemo(() => weekScene(heroScene({ week, lead, hasRuns: false, picked }), mon, log.today), [week, lead, picked, mon, log.today]);
  const openWeek = useOpenWeek(log.today);
  const name = weekTitle(mon, log.today);
  const dates = dayRange(mon, shiftDays(mon, 6));
  const past = mon < mondayOf(log.today);
  return (
    <section className={`hero aura hz-card is-quiet pl-wkcard${scene.mode === 'dusk' ? ' is-dusk' : ''}`} aria-label={`${name}, ${dates}`}>
      <div className="hero-face hz-face">
        <HeroHorizon scene={scene} isToday={false} firstToday={false} quiet live={live} page={`week-${mon}`} onWeek={() => openWeek(mon)} onPick={(v) => setHeroView(log.today, mon, v)}>
          <h2 className="hero-stamp hz-name is-soft">{name}</h2>
          <p className="hero-line hz-line">{name.startsWith('Week of') ? dates : `${dates}${scene.mode === 'dusk' ? (past ? ' · Nothing was on' : ' · Nothing on yet') : ''}`}</p>
        </HeroHorizon>
        <div className="hz-ctl pl-wk-ctl">
          <Pressable className="pl-home" press="dim" onPress={onThisWeek} label="Back to this week">
            <ChevronLeft size={18} aria-hidden="true" />
            This week
          </Pressable>
        </div>
      </div>
    </section>
  );
});
