import { daysBetween, mondayOf, type ISODate } from '@logbook/shared';
import { ChevronRight } from 'lucide-react';
import type * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useReduced } from '@/lib/motion';
import { Orb } from '@/ui/Orb';
import { PathCheck, PathLine, PathStop, Poster, PosterScene, WeekLights } from '@/ui/poster';
import { Button } from '@/ui/primitives';
import { HeroHorizon } from '../day/HeroHorizon';
import { heroScene, type HeroWeek } from '../day/heroWeek';
import { countWords } from '../dayplan/model';
import { weekBand, weekLabel, writtenWeek } from '../journal/days';
import { RangeBars, type BarMark } from '../progress/RangeBars';
import { bucketRuns, DEFAULT_RANGE, rangeSpan, type DayRun } from '../progress/ranges';
import { readoutWords, runRest } from '../progress/readout';
import '../progress/hero.css';
import '../progress/fitness.css';
import './cards.css';

/**
 * The welcome pager's three posters (features/auth/Start.tsx): Today, Fitness and Journal as the tabs draw them, built
 * from the same parts with sample content. They render before any account exists, so they read no query, no network and
 * no stored state: every number below is written here.
 *
 * - `TodaySample`: the day poster of Plan your day (features/dayplan/PlanDay.tsx, which needs the account's to-dos and
 *   goals), laid out from the kit's own parts exactly as PlanDay lays them out with a goal set: the goal as the title,
 *   the to-dos counted on the band, the to-dos as stops with the lit Next stop and its check.
 * - `FitnessSample`: the training card (features/day/Hero.tsx) as its real scene zone, `HeroHorizon`, drawn from the real
 *   `heroScene` for a sample week, inside the card's own classes; under it the Progress chart card with the real
 *   `RangeBars`.
 * - `JournalSample`: the dusk poster of the Journal (features/journal/JournalPoster.tsx) with the kit's `WeekLights`, the
 *   band's words from the real `weekBand`, and the line's field at rest, started from the day.
 * - `DockSample`: the assistant's bar from the dock (app/Dock.tsx), the screen's one Orb.
 *
 * Each is one picture to a screen reader (`role="img"` with a plain label) and takes no touch (`inert`). `live`: the
 * poster's page is the one on screen. Each poster makes one move, once, when its page is first seen (a to-do is ticked,
 * the week's sun comes up) and then holds; under Reduce Motion it is at its finished frame from the start.
 */

/** A Thursday. The samples' week is fixed, so the pictures are the same every day. */
const SAMPLE_TODAY: ISODate = '2026-03-05';
const noop = () => undefined;

/** The moves already made in this session: coming back to the pager holds each poster's finished frame. */
const played = new Set<string>();

/** The opening sunrise covers the first seconds of a cold open (app/BrandSplash.tsx): a poster's move waits for it. */
const splashUp = () => typeof document !== 'undefined' && !!document.querySelector('.brand-splash');
const useSplashGone = (): boolean => {
  const [gone, setGone] = useState(() => !splashUp());
  useEffect(() => {
    if (gone) return;
    const t = setInterval(() => !splashUp() && setGone(true), 100);
    return () => clearInterval(t);
  }, [gone]);
  return gone;
};

/** A picture of a piece of the app: one image to VoiceOver, nothing in it takes a touch or the focus. */
const Picture = ({ label, className, children }: { label: string; className: string; children: React.ReactNode }) => (
  <div className={`sm ${className}`} role="img" aria-label={label}>
    <div className="sm-in" inert aria-hidden="true">
      {children}
    </div>
  </div>
);

// ---------- Today ----------

const TODOS = [
  { id: 'a', text: 'Email Alex the draft' },
  { id: 'b', text: 'Call the bank' },
  { id: 'c', text: 'Pick up groceries' },
] as const;
/** How long the page is looked at before the first to-do is ticked, and how long its check stays filled where it is. */
const TICK_AFTER_MS = 900;
const CHECK_BEAT_MS = 320;

/** The day poster: today's goal, the to-dos counted on the band, and the to-dos as stops with the lit Next stop. */
export const TodaySample = ({ live }: { live: boolean }): React.JSX.Element => {
  const reduce = useReduced();
  const ready = useSplashGone();
  // 0: nothing done, the first to-do is Next. 1: its check is filled, where it is. 2: it is done and the light has moved on.
  const [phase, setPhase] = useState<0 | 1 | 2>(() => (played.has('today') ? 2 : 0));
  const at = reduce ? 2 : phase;
  useEffect(() => {
    if (at === 2) {
      played.add('today');
      return;
    }
    if (!live || !ready) return;
    const t = setTimeout(() => setPhase(at === 0 ? 1 : 2), at === 0 ? TICK_AFTER_MS : CHECK_BEAT_MS);
    return () => clearTimeout(t);
  }, [at, live, ready]);
  const done = at === 2 ? 1 : 0;
  return (
    <Picture className="sm-today" label={`Today in Orby. Today’s goal: Finish the report. To-dos today: ${countWords(1, TODOS.length)}. Next: ${TODOS[1].text}.`}>
      <Poster
        title="Finish the report"
        titleAs="p"
        titleSize="goal"
        now="Today’s goal"
        meta="9 h left"
        // the light and the Sunrise sun are on the page in view only, as on Today's own pager
        scene={<PosterScene lit={live} total={TODOS.length} done={done} />}
        band={{ label: 'To-dos today', words: countWords(done, TODOS.length) }}
        path={
          <PathLine>
            {TODOS.map((x, i) => {
              const next = live && i === done;
              return i < done ? (
                <PathStop key={x.id} id={x.id} state="done" title={x.text} />
              ) : (
                <PathStop key={x.id} id={x.id} state={next ? 'next' : 'ahead'} tag={next ? 'Next' : undefined} title={x.text} struck={at === 1 && i === 0} trailing={next ? <PathCheck checked={at === 1} label={x.text} onPress={noop} /> : undefined} />
              );
            })}
            <PathStop
              key="add"
              id="add"
              state="add"
              title="Add a to-do"
              trailing={
                <Button variant="quiet">
                  All to-dos <ChevronRight size={16} aria-hidden="true" />
                </Button>
              }
            />
          </PathLine>
        }
      />
    </Picture>
  );
};

// ---------- Fitness ----------

/**
 * The sample log: thirteen weeks of four runs (Monday, Wednesday, Thursday, the long one on Sunday), building from 9 miles
 * a week to this week's 20. Every past run is done; this week Monday and Wednesday are run, today's easy 4 and Sunday's
 * long run are ahead. The card's week and the chart's bars are both counted from it, by the app's own rules.
 */
const BUILD: readonly (readonly [number, number, number, number])[] = [
  [2, 2.5, 2, 2.5],
  [2, 3, 2, 3],
  [2.5, 3, 2.5, 3],
  [3, 3, 2.5, 3.5],
  [2.5, 2.5, 2, 3],
  [3, 3.5, 3, 3.5],
  [3, 4, 3, 4],
  [3.5, 4, 3, 4.5],
  [3, 3, 2.5, 3.5],
  [3.5, 4.5, 3.5, 4.5],
  [3.5, 4.5, 3.5, 5.5],
  [4, 5, 3.5, 5.5],
  [4, 5.5, 4, 6.5],
];
/** Monday, Wednesday, Thursday, Sunday, as days after the week's Monday. */
const RUN_DAYS = [0, 2, 3, 6] as const;
const NO_RUN: DayRun = { planned: 0, plannedRuns: 0, done: 0, runs: 0 };
/** What the sample log planned and ran on one day. */
export const sampleDay = (d: ISODate): DayRun => {
  const mon = mondayOf(d);
  const week = BUILD[BUILD.length - 1 - daysBetween(mon, mondayOf(SAMPLE_TODAY)) / 7];
  const at = RUN_DAYS.indexOf(daysBetween(mon, d) as (typeof RUN_DAYS)[number]);
  if (!week || at < 0) return NO_RUN;
  const miles = week[at]!;
  return d < SAMPLE_TODAY ? { planned: miles, plannedRuns: 1, done: miles, runs: 1 } : { planned: miles, plannedRuns: 1, done: 0, runs: 0 };
};

/** The sample's Fitness page in numbers: the training card's week, and the Progress chart at its usual range (3 months). */
export const sampleFitness = () => {
  const span = rangeSpan(DEFAULT_RANGE, SAMPLE_TODAY);
  const buckets = bucketRuns(span.buckets, sampleDay, SAMPLE_TODAY);
  const now = buckets.find((b) => b.current)!;
  const week: HeroWeek = { mon: now.key, runs: { planned: now.plannedRuns, done: now.runs }, workouts: { planned: 0, done: 0 }, doneMiles: now.done, plannedMiles: now.planned };
  const scene = heroScene({ week, lead: 'run', hasRuns: false, picked: null });
  const readout = runRest(span, buckets, now, buckets[buckets.indexOf(now) - 1] ?? null, SAMPLE_TODAY, false);
  const marks: BarMark[] = buckets.map((b) => ({ key: b.key, value: b.done, ahead: b.ahead, current: b.current, future: b.future, missing: b.missing }));
  const today = sampleDay(SAMPLE_TODAY).planned;
  return { span, scene, readout, marks, today };
};

/** The training card, then the top of the Progress chart: what is next, then how it is going. */
export const FitnessSample = ({ live }: { live: boolean }): React.JSX.Element => {
  const reduce = useReduced();
  const { span, scene, readout, marks, today } = useMemo(sampleFitness, []);
  // the week's sunrise plays the first time the page is seen, as it does on the first view of a day; after that it holds
  const [first] = useState(() => !played.has('fitness'));
  useEffect(() => {
    if (live || reduce) played.add('fitness');
  }, [live, reduce]);
  return (
    <Picture className="sm-fitness" label={`Fitness in Orby. Today: Easy ${today}, ${today} miles. ${scene.said.replace(/\. Open the week$/, '')}. Under it, Progress: ${readoutWords(readout)}`}>
      <section className="hero aura halo-upcoming hz-card">
        <span className="aura-glow" aria-hidden="true" />
        <div className="hero-face hz-face">
          <HeroHorizon scene={scene} isToday firstToday={first} quiet={false} live={live} page="welcome-sample" onWeek={noop} onPick={noop}>
            <span className="hero-stamp hz-name">Easy {today}</span>
            <p className="hero-line hz-line">{today} mi · floor 20 min</p>
          </HeroHorizon>
        </div>
      </section>
      <section className="card ph ph-plain no-seg">
        <div className="ph-head">
          <div className="ph-main">
            <span className="ph-big">
              <span className="tnum">{readout.big}</span>
              <small>{readout.context}</small>
            </span>
            <span className="ph-take">{readout.take}</span>
          </div>
        </div>
        <RangeBars span={span} marks={marks} label="Weekly miles" words={() => ''} onScrub={noop} />
      </section>
    </Picture>
  );
};

// ---------- Journal ----------

/** The six days before tonight: Saturday, Monday and Wednesday hold a line. */
const LINES = new Map([
  ['2026-02-28', 1],
  ['2026-03-02', 1],
  ['2026-03-04', 1],
]);
const NO_ENTRIES: ReadonlySet<string> = new Set();
/** The field's first words on a day with a run (features/learned/starter.ts). */
const STARTER = 'On my run today I learned';

/** The dusk poster: the question, the week's lights with tonight waiting, and the line's field, already started. */
export const JournalSample = (): React.JSX.Element => {
  const week = useMemo(() => writtenWeek(SAMPLE_TODAY, LINES, NO_ENTRIES), []);
  const band = weekBand(week, true);
  return (
    <Picture className="sm-journal" label={`Journal in Orby. What did you learn today? One line is enough. ${weekLabel(week)}`}>
      <Poster ground="dusk" className="ln-poster jn-poster" title="What did you learn today?" titleAs="p" meta="One line is enough." scene={<WeekLights days={week.days} tonight="waiting" />} band={band}>
        <div className="ln-entry">
          <div className="ln-entry-field">
            <textarea className="ln-field ln-entry-in" rows={2} readOnly tabIndex={-1} value={STARTER} />
            <span className="ln-entry-ghost">
              <span className="ln-entry-ghost-words">{STARTER}</span>
              <i className="ln-caret" />
            </span>
          </div>
        </div>
      </Poster>
    </Picture>
  );
};

// ---------- the dock ----------

/** The assistant's bar, as the dock draws it on every tab: the 28 px Orb and its words. A picture: it opens nothing here. */
export const DockSample = (): React.JSX.Element => (
  <div className="sm-dock" role="img" aria-label="The assistant’s bar, on every screen: Ask or change anything.">
    <div className="dock-ask pressable" aria-hidden="true">
      <Orb size={28} className="dock-ask-ic" state="still" />
      <span className="dock-ask-text">Ask or change anything</span>
    </div>
  </div>
);
