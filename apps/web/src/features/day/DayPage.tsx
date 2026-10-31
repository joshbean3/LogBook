import { EVENING_START, mondayOf, monthOf, shiftDays, type Aim, type ISODate } from '@logbook/shared';
import { ChevronRight } from 'lucide-react';
import type * as React from 'react';
import { memo, useDeferredValue, useLayoutEffect, useMemo } from 'react';
import { useGoalMutations, useGoals } from '@/api/queries';
import { hideSplash } from '@/lib/native';
import { Group, Row, Section } from '@/ui/primitives';
import { dayTitle } from '@/ui/NavBar';
import { AskBar } from '../assistant/AskBar';
import { GoalRow } from '../goals/GoalRow';
import { useOpenGoal } from '../goals/GoalSheets';
import { goalOf } from '../goals/model';
import { useSaveSteps } from '../goals/Steps';
import { HabitsMeta, OrbRow } from '../habits/OrbRow';
import { useLog, type Log } from '../log/useLog';
import { PlanDay } from '../dayplan/PlanDay';
import { CLOSED_TITLE, EVENING_TITLE, useOpenCloseDay } from './CloseDay';
import { Hero } from './Hero';
import { useIsLive } from './live';
import { useFaceMinutes } from './useDeferred';
import { useNowMinutes } from './useNow';
import { WeekRow } from './WeekCard';

const TEST_HOOKS = typeof window !== 'undefined' && !!(import.meta.env.DEV || import.meta.env.VITE_FAKE_CLOCK);
// the sections that do not depend on which page is live: a commit (a role change) never re-renders them
const OrbRowM = memo(OrbRow);

/** The months a day page reads: a week either side (the rest words look a week ahead) and the shown week. */
export const monthsFor = (date: ISODate) => [...new Set([shiftDays(date, -8), date, shiftDays(date, 8), mondayOf(date), shiftDays(mondayOf(date), 6)].map(monthOf))].sort();

/** While the months load: the hero's own box. */
const HeroSkeleton = () => (
  <div className="card hero hero-skel" data-hero="loading" aria-busy="true" aria-label="Loading the day">
    <span className="skel hero-skel-a" />
    <span className="skel hero-skel-b" />
    <span className="skel hero-skel-c" />
  </div>
);

/** The live page's own: the splash goes in the rAF after its first paint with content. */
const LiveExtras = ({ date, loaded }: { date: ISODate; loaded: boolean }) => {
  const live = useIsLive(date);
  useLayoutEffect(() => {
    if (!live || !loaded) return;
    const raf = requestAnimationFrame(hideSplash);
    return () => cancelAnimationFrame(raf);
  }, [live, loaded]);
  return null;
};

/**
 * Today's goal (docs/system.md §2): the same `GoalRow` the Goals tab shows, as the hero variant. Tap → the goal's sheet
 * (the editor when it is unset); a step's Mark checks it in place; the row's Mark marks the goal done. The week goal is not
 * shown here.
 */
const GoalSection = ({ date, today }: { date: ISODate; today: ISODate }) => {
  const goals = useGoals();
  const goal = goalOf(goals.data, 'day', date);
  const open = useOpenGoal();
  const saveSteps = useSaveSteps();
  const { review } = useGoalMutations();
  const minutes = useNowMinutes();
  const now = useMemo(() => Date.now(), [Math.floor(minutes)]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!goals.data) return <div className="day-goal is-skel" aria-hidden="true" />;
  const toggleDone = (g: Aim) => {
    const next = g.status === 'done' ? 'open' : 'done';
    review.mutate({ id: g.id, status: next, ...(next === 'done' && g.steps.some((s) => !s.done) ? { steps: g.steps.map((s) => ({ ...s, done: true })) } : {}) });
  };
  return (
    <div className="day-goal">
      <GoalRow level="day" period={date} goal={goal} today={today} variant="hero" now={now} onOpen={() => open('day', date)} onToggleStep={goal ? (step) => saveSteps(goal, goal.steps.map((s) => (s.id === step.id ? { ...s, done: !s.done } : s))) : undefined} onToggleDone={goal ? () => toggleDone(goal) : undefined} />
    </div>
  );
};

/** `Close the day · Two sentences, then sleep.` from 18:00 (and always on a past day): opens the Close sheet. */
const CloseRow = ({ date, log }: { date: ISODate; log: Log }) => {
  const open = useOpenCloseDay();
  const entries = log.snap.journalOn(date).length;
  return <Row className="close-row" title="Close the day" sub={entries ? CLOSED_TITLE : EVENING_TITLE} right={<ChevronRight size={16} className="lrow-chev" aria-hidden="true" />} onClick={() => open(date, dayTitle(date, log.today))} label={`Close the day. ${entries ? CLOSED_TITLE : EVENING_TITLE}`} />;
};

/** The week row and, in the evening or on a past day, the Close row, in one group. */
const Tail = ({ date, log }: { date: ISODate; log: Log }) => {
  const minutes = useFaceMinutes();
  const close = date < log.today || (date === log.today && minutes >= EVENING_START);
  return (
    <Group className="day-tail">
      <WeekRow date={date} log={log} />
      {close ? <CloseRow date={date} log={log} /> : null}
    </Group>
  );
};

interface DayPageProps {
  date: ISODate;
  live: boolean;
}

/** A neighbour's first frame: the page's shape only, so mounting it inside a commit's frame costs almost nothing. */
const DayShell = ({ date }: { date: ISODate }) => (
  <div className="day-page is-shell" data-day={date}>
    <div className="ask-bar is-skel" aria-hidden="true" />
    <div className="card hero hero-skel" data-hero="loading" aria-hidden="true" />
    <div className="day-goal is-skel" aria-hidden="true" />
    <section className="pd is-skel" aria-hidden="true" />
    <section className="sec-primary habits" aria-hidden="true">
      <div className="section-head">
        <h2 className="section-title">Habits</h2>
      </div>
      <div className="orbs-skel" />
    </section>
    <div className="group day-tail is-skel" aria-hidden="true" />
  </div>
);

/**
 * One day's page inside the pager (docs/system.md §2): the same five sections every day, in the same order, quiet when
 * there is nothing to say and never absent, so the page never collapses under a swipe: the Ask bar, the workout, the day's
 * goal, the schedule, the habits, then the week and (in the evening, or on a past day) the Close row. The bottom padding
 * lives here, inside the cur page, so the page's `min-height` includes it and a short day does not scroll.
 *
 * Memoised on `date`, with one memoised `useLog` per page: nothing renders while the track moves; a commit re-renders only
 * what depends on which page is live (the hero's once-a-day route draw, the week ring's fill) and mounts one new
 * neighbour as a shell.
 */
const DayContent = memo(function DayContent({ date }: { date: ISODate }): React.JSX.Element {
  if (TEST_HOOKS) {
    const h = (window as unknown as { __today?: { pageRenders: number } }).__today;
    if (h) h.pageRenders++;
  }
  const months = useMemo(() => monthsFor(date), [date]);
  /*
   * A write to the months (an orb, a to-do, a mark) re-renders every mounted page; the pages render it in the background
   * (`useDeferredValue`), so the next touch is handled between its slices. A new day (the midnight roll) is never deferred.
   */
  const fresh = useLog(months);
  const later = useDeferredValue(fresh);
  const log = later.today === fresh.today ? later : fresh;
  const today = log.today;
  const loaded = log.loaded(date) && !!log.boot;
  return (
    <div className="day-page" data-day={date}>
      <AskBar date={date} context={{ tab: 'today', date }} />
      {!loaded ? <HeroSkeleton /> : <Hero date={date} log={log} />}
      <LiveExtras date={date} loaded={loaded} />
      {loaded ? <GoalSection date={date} today={today} /> : <div className="day-goal is-skel" aria-hidden="true" />}
      {loaded ? <PlanDay date={date} today={today} /> : <section className="pd is-skel" aria-hidden="true" />}
      <Section title="Habits" meta={loaded ? <HabitsMeta date={date} log={log} /> : null} className="habits">
        <div inert={date > today || undefined}>{loaded ? <OrbRowM date={date} log={log} editable={date <= today} /> : <div className="orbs-skel" />}</div>
      </Section>
      {loaded ? <Tail date={date} log={log} /> : <div className="group day-tail is-skel" aria-hidden="true" />}
    </div>
  );
});

/** The page the pager renders: a neighbour mounts as its shell and fills in in the background; the cur page renders at once. */
export const DayPage = memo(function DayPage(p: DayPageProps): React.JSX.Element {
  const ready = useDeferredValue(true, p.live);
  return ready ? <DayContent date={p.date} /> : <DayShell date={p.date} />;
});
