import { mondayOf, monthOf, shiftDays, type ISODate } from '@logbook/shared';
import { ChevronRight } from 'lucide-react';
import type * as React from 'react';
import { lazy, memo, Suspense, useDeferredValue, useEffect, useLayoutEffect, useMemo } from 'react';
import { useHabitMutations } from '@/api/queries';
import { hideSplash } from '@/lib/native';
import { EmptyState } from '@/ui/primitives';
import { Pressable } from '@/ui/Pressable';
import { useSheet } from '@/ui/Sheet';
import { NAV_EVENT, type NavEventDetail } from '@/ui/nav';
import { HABIT_STARTERS, OrbRow } from '../habits/OrbRow';
import { useLog, type Log } from '../log/useLog';
import { StravaPrimer, useStravaPrimer } from '../onboarding';
import { TodayTodos } from '../todos/TodayTodos';
import { planEndOf } from './dayWords';
import { FirstRunHero, type FirstRunAction } from './FirstRunHero';
import { preloadCloseDay } from './CloseDay';
import { Hero, SecondSession } from './Hero';
import { useIsLive } from './live';
import { MorningRow } from './MorningRow';
import { dismissNudge, useNudge } from './nudge';
import { TheDayCard } from './TheDayCard';
import { WeekCard } from './WeekCard';
import { useFocus, useOpenWordSheet } from './WordSheet';

const TEST_HOOKS = typeof window !== 'undefined' && !!(import.meta.env.DEV || import.meta.env.VITE_FAKE_CLOCK);
// the sections that do not depend on which page is live: a commit (a role change) never re-renders them (risk 1)
const OrbRowM = memo(OrbRow);
const TodayTodosM = memo(TodayTodos);
// the plan-end card is rare (a few days a block) and pulls in the builder: loaded when it is first needed
const PlanEnd = lazy(() => import('./PlanEnd'));

/** The months a day page reads: a week either side (the rest face looks a week ahead, the first-run test a week back) and the shown week. */
export const monthsFor = (date: ISODate) => [...new Set([shiftDays(date, -8), date, shiftDays(date, 8), mondayOf(date), shiftDays(mondayOf(date), 6)].map(monthOf))].sort();

/** The first day (§3.2 last row): nothing planned or run around today, and no plan or no habits yet, and nothing written. */
const isFirstRun = (log: Log, date: ISODate) => {
  if (date !== log.today) return false;
  const around = Array.from({ length: 16 }, (_, i) => shiftDays(log.today, i - 7));
  const hasPlan = around.some((d) => log.snap.sessionsOn(d).length > 0);
  const hasRuns = around.some((d) => log.snap.activitiesOn(d).length > 0);
  return !hasRuns && (!hasPlan || !log.habits.length) && !log.snap.journalOn(date).length;
};

const AddHabitsSheet = () => {
  const { add } = useHabitMutations();
  const sheet = useSheet();
  return (
    <EmptyState starters={HABIT_STARTERS} onStarter={(name) => add.mutateAsync(name)} verb={{ label: 'Done', onPress: () => sheet.close() }} startersLabel="Starter habits">
      Tap the ones you want to do every day. They become lights on Today.
    </EmptyState>
  );
};

/** Today's first-run face: the setup rows (`FirstRunHero`) wired to the habits sheet, the builder and the Strava primer. */
const FirstRun = ({ log }: { log: Log }) => {
  const sheet = useSheet();
  const onAction = (k: FirstRunAction) => {
    if (k === 'habits') sheet.open({ title: 'Add habits', body: <AddHabitsSheet /> });
    // the builder is WP4's large sheet; its module loads on the tap (it never weighs on Today's first paint)
    else if (k === 'plan') void import('../plan/Blocks').then((m) => m.openTemplate(sheet, log));
    else sheet.open({ title: 'Connect Strava', body: <StravaPrimer onLater={() => sheet.close()} /> });
  };
  return (
    <div className="hero hero-first" data-face="first">
      <FirstRunHero onAction={onAction} />
    </div>
  );
};

/** While the months load: the hero's own box (the skeleton never sits anywhere else, §14 test 40). */
const HeroSkeleton = () => (
  <div className="hero aura hero-skel" data-face="loading" aria-busy="true" aria-label="Loading the day">
    <span className="skel hero-skel-a" />
    <span className="skel hero-skel-b" />
    <span className="skel hero-skel-c" />
  </div>
);

/** The sentence (§3.1 row 1b): one quiet serif line under the hero when `focus.quote` is set; a tap edits it. */
const Sentence = memo(function Sentence() {
  const focus = useFocus();
  const open = useOpenWordSheet();
  if (!focus.quote.trim()) return null;
  return (
    <Pressable className="sentence" press="dim" onPress={open} label={`${focus.quote}${focus.by ? `, ${focus.by}` : ''}. Edit`}>
      <span className="sentence-text">
        “{focus.quote.trim()}”{focus.by.trim() ? <span className="sentence-by"> — {focus.by.trim()}</span> : null}
      </span>
    </Pressable>
  );
});

/** The live page's own: the splash goes in the rAF after its first paint with content (spec §12; the caps are WP1's). */
const LiveExtras = ({ date, loaded }: { date: ISODate; loaded: boolean }) => {
  const live = useIsLive(date);
  useLayoutEffect(() => {
    if (!live || !loaded) return;
    const raf = requestAnimationFrame(hideSplash);
    // the evening's card is fetched once the first screen is up (idle), never in its way
    preloadCloseDay();
    return () => cancelAnimationFrame(raf);
  }, [live, loaded]);
  return null;
};

/** The nudge shows on the live page only. */
const NudgeSlot = ({ date, onMorning }: { date: ISODate; onMorning: (date: ISODate) => void }) => {
  const live = useIsLive(date);
  if (!live) return null;
  return (
    <Nudge
      onOpen={() => {
        dismissNudge();
        onMorning(date);
      }}
    />
  );
};

/** The one-time nudge (§3.1): `Your morning lives here now ›`, until tapped or This morning is first pushed. */
const Nudge = ({ onOpen }: { onOpen: () => void }) => {
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<NavEventDetail>).detail;
      if (d?.type === 'push' && /\/morning$/.test(d.path)) dismissNudge();
    };
    window.addEventListener(NAV_EVENT, on);
    return () => window.removeEventListener(NAV_EVENT, on);
  }, []);
  return (
    <Pressable className="nudge" press="dim" label="Your morning lives here now. Open This morning" onPress={onOpen}>
      Your morning lives here now <ChevronRight size={14} aria-hidden="true" />
    </Pressable>
  );
};

interface DayPageProps {
  date: ISODate;
  live: boolean;
  onMorning: (date: ISODate) => void;
}

/**
 * A neighbour's first frame (risk 1): the page's shape only (the hero's box, the row, the section heads, the week card's
 * box), so mounting the one new neighbour inside a commit's synchronous frame costs almost nothing; its content renders in
 * the background right after (`useDeferredValue`, interruptible by the next touch). Never a card over black.
 */
const DayShell = ({ date }: { date: ISODate }) => (
  <div className="day-page is-shell" data-day={date}>
    <div className="hero aura hero-skel" data-face="loading" aria-hidden="true" />
    <div className="morning-row" aria-hidden="true" />
    <section className="habits" aria-hidden="true">
      <div className="sec-head">
        <h2 className="sec-title">Habits</h2>
      </div>
      <div className="orbs-skel" />
    </section>
    <section className="todos" aria-hidden="true">
      <div className="section-head">
        <h2 className="section-title">To-dos</h2>
      </div>
    </section>
    <div className="week-card card is-skel" aria-hidden="true" />
  </div>
);

/**
 * One day's page inside the pager (docs/feel.md §3.1, §3.3): every day renders the same sections in the same order, quiet when
 * there is nothing to say, never absent, so the page never collapses under a swipe: the hero, the sentence (when set), the
 * This morning row, the second session (two-session days), habits, to-dos, the week card, the plan end (near or past a
 * block's end), the Strava primer (today, until connected), the day's card (past days). The bottom padding lives here, inside
 * the cur page, so the page's `min-height` includes it and a short day does not scroll.
 *
 * Memoised on `date` and `live`, with one memoised `useLog` per page (critic C12): nothing renders while the track moves; a
 * commit re-renders only what depends on which page is live (the hero and the week card: daily moments, the ring, the
 * shared line, `celebrate`) and mounts one new neighbour as a shell. Every other section takes no `live`: the pager makes a
 * neighbour `inert`, so it is untouchable without a prop.
 */
const DayContent = memo(function DayContent({ date, onMorning }: { date: ISODate; onMorning: (date: ISODate) => void }): React.JSX.Element {
  if (TEST_HOOKS) {
    const h = (window as unknown as { __today?: { pageRenders: number } }).__today;
    if (h) h.pageRenders++;
  }
  const months = useMemo(() => monthsFor(date), [date]);
  /*
   * A write to the months (an orb, a to-do, a mark) re-renders every mounted page; the pages render it in the background
   * (`useDeferredValue`: the urgent pass keeps the log it had, so its memoised sections bail out), so the next touch is
   * handled between its slices instead of after a 200 ms task at 4× (feel review 1 #4). What a tap shows first is the
   * control's own (the orb's fill, the mark's check, the hero's override) and never waits on this. A new day (the midnight
   * roll) is never deferred: the page that crossfades in must already be of its own day.
   */
  const fresh = useLog(months);
  const later = useDeferredValue(fresh);
  const log = later.today === fresh.today ? later : fresh;
  const primer = useStravaPrimer();
  const nudge = useNudge();
  const today = log.today;
  const isToday = date === today;
  const loaded = log.loaded(date) && !!log.boot;
  const first = loaded && isFirstRun(log, date);
  const end = loaded ? planEndOf(log, date) : null;


  const habitsLit = loaded ? log.habits.filter((h) => h.createdOn <= date && log.snap.isHabitDone(date, h.id)).length : 0;
  // the head's meta (§3.1 row 4, §3.3): `2 of 5` only when > 0; a future day counts its ghosts, `5 habits`
  const habitsMeta = date > today ? (log.habits.length ? `${log.habits.length} ${log.habits.length === 1 ? 'habit' : 'habits'}` : null) : habitsLit > 0 ? `${habitsLit} of ${log.habits.filter((h) => h.createdOn <= date).length}` : null;
  return (
    <div className="day-page" data-day={date}>
      {!loaded ? <HeroSkeleton /> : first ? <FirstRun log={log} /> : <Hero date={date} log={log} />}
      <LiveExtras date={date} loaded={loaded} />
      <Sentence />
      {isToday && nudge && loaded && !first ? <NudgeSlot date={date} onMorning={onMorning} /> : null}
      <MorningRow date={date} log={log} />
      {loaded ? <SecondSession date={date} log={log} /> : null}
      <section className="habits" aria-label="Habits" inert={date > today || undefined}>
        <div className="sec-head">
          <h2 className="sec-title">Habits</h2>
          {habitsMeta ? <span className="sec-meta tnum">{habitsMeta}</span> : null}
        </div>
        {loaded ? <OrbRowM date={date} log={log} editable={date <= today} /> : <div className="orbs-skel" />}
      </section>
      <section className="todos" aria-label="To-dos">
        <TodayTodosM date={date} />
      </section>
      {loaded ? <WeekCard date={date} log={log} /> : <div className="week-card card is-skel" />}
      {end ? (
        <Suspense fallback={null}>
          <PlanEnd log={log} date={date} />
        </Suspense>
      ) : null}
      {loaded && isToday && !first && primer.show ? (
        <div className="strava-primer">
          <StravaPrimer onLater={primer.later} />
        </div>
      ) : null}
      {loaded && date < today ? <TheDayCard date={date} log={log} /> : null}
    </div>
  );
});

/** The page the pager renders: a neighbour mounts as its shell and fills in in the background; the cur page renders at once. */
export const DayPage = memo(function DayPage(p: DayPageProps): React.JSX.Element {
  // the first render's value: the live page renders whole at once; a neighbour renders its shell, then fills in (React's
  // `initialValue` is what the mount shows, so it is `p.live`; `!p.live` mounted every new neighbour whole inside the commit)
  const ready = useDeferredValue(true, p.live);
  return ready ? <DayContent date={p.date} onMorning={p.onMorning} /> : <DayShell date={p.date} />;
});
