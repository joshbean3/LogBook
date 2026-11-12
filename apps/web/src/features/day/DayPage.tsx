import { fmtDate, mondayOf, monthOf, shiftDays, type ISODate } from '@logbook/shared';
import { ChevronRight, Lock } from 'lucide-react';
import type * as React from 'react';
import { lazy, memo, Suspense, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useGoals, useHabitMutations, useTodos } from '@/api/queries';
import { STRAVA_BUILT } from '@/lib/features';
import { todayParts, usePrefs } from '@/lib/prefs';
import { hideSplash } from '@/lib/native';
import { SectionHeader } from '@/ui/layout';
import { Button, EmptyState, SectionEmpty } from '@/ui/primitives';
import { Pressable } from '@/ui/Pressable';
import { useSheet } from '@/ui/Sheet';
import { NAV_EVENT, type NavEventDetail } from '@/ui/nav';
import { useOpenHabitsHistory } from '../habits/HabitsHistory';
import { LearnedPrompt } from '../learned/LearnedPrompt';
import { useOpenTodayShows } from '../settings/TodayShows';
import { Composer } from '../journal/JournalDaySection';
import { HABIT_STARTERS, HabitsMeta, OrbRow } from '../habits/OrbRow';
import { useLog, type Log } from '../log/useLog';
import { StravaPrimer, useStravaPrimer } from '../onboarding';
import { PlanDay } from '../dayplan/PlanDay';
import { nothingSetUp, looksNew } from './firstRun';
import { FirstRunHero, type FirstRunAction } from './FirstRunHero';
import { preloadCloseDay } from './CloseDay';
import { Hero } from './Hero';
import { useIsLive } from './live';
import { useFaceMinutes } from './useDeferred';
import { dismissNudge, useNudge } from './nudge';
import { TheDayCard } from './TheDayCard';
import { HeldNote } from '../plan/Held';
import { DayTimeline } from './DayTimeline';
import { SectionGuard } from './SectionGuard';
import { StatusChip } from './StatusChip';
import { useFocus, useOpenWordSheet } from './WordSheet';

/** The Strava primer on Today exists only in a build that carries Strava (settings-18). */
const usePrimer: typeof useStravaPrimer = STRAVA_BUILT ? useStravaPrimer : () => ({ show: false, later: () => undefined });

const TEST_HOOKS = typeof window !== 'undefined' && !!(import.meta.env.DEV || import.meta.env.VITE_FAKE_CLOCK);
// the plan-end card is rare (a few days a block) and pulls in the builder: loaded when it is first needed

/** The months a day page reads: a week either side (the rest face looks a week ahead, the first-run test a week back) and the shown week. */
export const monthsFor = (date: ISODate) => [...new Set([shiftDays(date, -8), date, shiftDays(date, 8), mondayOf(date), shiftDays(mondayOf(date), 6)].map(monthOf))].sort();

const AddHabitsSheet = () => {
  const { add } = useHabitMutations();
  const sheet = useSheet();
  return (
    <EmptyState starters={HABIT_STARTERS} onStarter={(name) => add.mutateAsync(name)} verb={{ label: 'Done', onPress: () => sheet.close() }} startersLabel="Starter habits">
      Tap the ones you want to do every day. They show as tiles on Today.
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
    else if (STRAVA_BUILT) sheet.open({ title: 'Connect Strava', body: <StravaPrimer onLater={() => sheet.close()} /> });
  };
  return (
    <div className="hero hero-first" data-face="first">
      <FirstRunHero onAction={onAction} strava={log.features.strava} />
    </div>
  );
};

/**
 * The hero's slot on a day that looks new (`looksNew`): the first-run face only when there is also no to-do and no goal,
 * that is, when nothing at all is set up. Anyone with a habit, a plan, a to-do or a goal gets the day's own card.
 */
const FirstRunSlot = ({ date, log }: { date: ISODate; log: Log }) => {
  const todos = useTodos();
  const goals = useGoals();
  if (todos.data === undefined || goals.data === undefined) return todos.isError || goals.isError ? <Hero date={date} log={log} /> : <HeroSkeleton />;
  return nothingSetUp(todos.data, goals.data) ? <FirstRun log={log} /> : <Hero date={date} log={log} />;
};

/** While the months load: the hero's own box (the skeleton never sits anywhere else, §14 test 40). */
const HeroSkeleton = () => (
  <div className="hero aura hero-skel" data-face="loading" aria-busy="true" aria-label="Loading the day">
    <span className="skel hero-skel-a" />
    <span className="skel hero-skel-b" />
    <span className="skel hero-skel-c" />
  </div>
);

/**
 * The sentence: the owner's quote, one quiet serif line right under the large "Today" title (DayView puts it there) when
 * `focus.quote` is set; a tap edits it.
 */
export const Sentence = memo(function Sentence() {
  const focus = useFocus();
  const open = useOpenWordSheet();
  if (!focus.quote.trim()) return null;
  return (
    <Pressable className="sentence" press="dim" onPress={open} label={`${focus.quote}${focus.by ? `, ${focus.by}` : ''}. Edit`}>
      <span className="sentence-text">
        “{focus.quote.trim()}”{focus.by.trim() ? <span className="sentence-by">, {focus.by.trim()}</span> : null}
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

/**
 * The nudge shows on the live page only. It reads its own store here, not in the page: its dismissal (the first push of This
 * morning) then re-renders this slot alone, not every mounted day page inside the push's task (feel review 2 #10).
 */
const NudgeSlot = ({ date, onMorning }: { date: ISODate; onMorning: (date: ISODate) => void }) => {
  const live = useIsLive(date);
  const nudge = useNudge();
  if (!live || !nudge) return null;
  return (
    <Nudge
      onOpen={() => {
        dismissNudge();
        onMorning(date);
      }}
    />
  );
};

/**
 * Just after midnight, yesterday is still the day you mean to close (today-top-31): until 3 AM, if yesterday has no entry,
 * one quiet row opens yesterday's composer in a sheet. It sits with yesterday's other business under the line in Plan your
 * day's poster, never above the hero. The date logic is untouched: Today is still the new day.
 */
const LATE_UNTIL = 3 * 60;
/** Is "Close yesterday" owed: before 3 AM, with no entry for yesterday? The poster draws its row only while it is. */
const closeYesterdayDue = (log: Log, now: number) => now < LATE_UNTIL && !log.snap.journalOn(shiftDays(log.today, -1)).length;
const CloseYesterday = ({ log }: { log: Log }) => {
  const sheet = useSheet();
  const live = useIsLive(log.today);
  const yesterday = shiftDays(log.today, -1);
  if (!live) return null;
  const open = () =>
    sheet.open({
      eyebrow: fmtDate('long', yesterday),
      title: 'Close yesterday',
      body: <Composer date={yesterday} today={log.today} rows={3} placeholder="How did yesterday go?" autoFocus label="Yesterday's entry" onSaved={() => sheet.close()} />,
    });
  return (
    <Pressable className="pd-yrow pd-close-y" press="surface" label="Close yesterday. Write yesterday's entry" onPress={open}>
      <span className="pd-yrow-text">Close yesterday</span>
      <ChevronRight size={18} aria-hidden="true" />
    </Pressable>
  );
};

const OrbRowM = memo(OrbRow);

/**
 * The day's habits, at the top of the page: the orbs (a tap lights one; a hold opens Note · Details · Archive; "+" adds),
 * how many are lit, and History (every habit's last 30 days). Locked on a day still to come.
 */
const HabitsTop = memo(function HabitsTop({ date, log }: { date: ISODate; log: Log }) {
  const history = useOpenHabitsHistory();
  return (
    <section className="habits day-habits" aria-label="Habits">
      <SectionHeader title="Habits" meta={<HabitsMeta date={date} log={log} />} action="History" onAction={history} actionLabel="Every habit's history" />
      {/* a day still to come: one row says when they open, not seven ghost tiles (layout plan 2.1 T15); History in the header
          still opens (today-body-18) */}
      {date > log.today && log.habits.length ? (
        <SectionEmpty className="day-habits-later" icon={<Lock size={18} aria-hidden="true" />} title="Not open yet" line={`Your ${log.habits.length === 1 ? 'habit opens' : `${log.habits.length} habits open`} on ${fmtDate('dow', date)}.`} />
      ) : (
        <div className="day-habits-card" inert={date > log.today || undefined}>
          <OrbRowM date={date} log={log} />
        </div>
      )}
    </section>
  );
});

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
 * A neighbour's first frame (risk 1): the page's shape only (the hero's box, the plan's box, the week card's box), so mounting the one new neighbour inside a commit's synchronous frame costs almost nothing; its content renders in
 * the background right after (`useDeferredValue`, interruptible by the next touch). Never a card over black.
 */
const DayShell = ({ date }: { date: ISODate }) => {
  const parts = todayParts(usePrefs());
  return (
    <div className="day-page is-shell" data-day={date} data-fitness={parts.includes('fitness') ? undefined : 'off'}>
      {parts.includes('fitness') ? <div className="hero aura hero-skel" data-face="loading" aria-hidden="true" /> : null}
      {parts.includes('day') ? <section className="pd is-skel" aria-hidden="true" /> : null}
    </div>
  );
};

/** Every Today section is switched off: one calm line and the way back to the switches (Settings, Today shows). */
const NothingShown = () => {
  const edit = useOpenTodayShows();
  return (
    <div className="day-none">
      <p className="day-none-line">Nothing is set to show on Today.</p>
      <Pressable className="day-none-link" press="dim" onPress={edit} label="Choose what Today shows">
        Choose what Today shows <ChevronRight size={18} aria-hidden="true" />
      </Pressable>
    </div>
  );
};

/**
 * The last thing on Today: one quiet link that opens the "Today shows" list as a sheet (the same list as Settings). A
 * choice of what a screen shows is made on that screen; the link is quiet, so it never competes with the day.
 */
const EditToday = () => {
  const edit = useOpenTodayShows();
  return (
    <div className="day-edit">
      <Button variant="quiet" size="sm" className="day-edit-link" onClick={edit} aria-label="Edit Today. Choose what Today shows">
        Edit Today
      </Button>
    </div>
  );
};

/**
 * One day's page inside the pager (docs/feel.md §3.1, §3.3): every day renders the same sections in the same order, quiet when
 * there is nothing to say, never absent, so the page never collapses under a swipe: the hero, the sentence (when set), the
 * day's plan, the second session (two-session days), the week card, the plan end (near or past a block's end), the Strava
 * primer (today, until connected), the day's card (past days). Habits sit at the top; the morning's schedule lives on Plan. The bottom padding lives here, inside
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
  const primer = usePrimer();
  const today = log.today;
  const isToday = date === today;
  const loaded = log.loaded(date) && !!log.boot;
  // a day that looks new may show the first-run face in the hero's slot (FirstRunSlot decides); nothing else on the page
  // depends on it: Plan your day, the habits and the evening's Close card are always there
  const bare = loaded && looksNew(log, date);
  const sheet = useSheet();
  // the builder is a large sheet; its module loads on the tap (never on Today's first paint)
  const logRef = useRef(log);
  logRef.current = log;
  const openPlan = useCallback(() => void import('../plan/Blocks').then((m) => m.openTemplate(sheet, logRef.current)), [sheet]);


  // what Today shows, and in what order (lib/prefs.ts): Fitness leads when it is on; with it off the day's own content does
  const parts = todayParts(usePrefs());
  const fitness = parts.includes('fitness');
  // the held day's clock (useDeferred): past midnight on a day still on screen it is that day's last minute, so "Close
  // yesterday" never offers the day before the one the person is still in
  const now = useFaceMinutes();
  // every section has its own boundary (SectionGuard): one that throws becomes one row, and the rest of Today stays
  const habits = !parts.includes('habits') ? null : loaded ? (
    <SectionGuard key="habits" name="Habits" resetKey={date}>
      <HabitsTop date={date} log={log} />
    </SectionGuard>
  ) : (
    <section key="habits" className="habits day-habits is-skel" aria-hidden="true" />
  );
  // Plan your day: the slim poster under the training card (no second sun); with Fitness off it leads the page, whole
  const day =
    parts.includes('day') && loaded ? (
      <SectionGuard key="day" name={isToday ? 'Plan your day' : 'The plan'} resetKey={date}>
        <PlanDay date={date} today={today} log={log} slim={fitness} yesterday={isToday && closeYesterdayDue(log, now) ? <CloseYesterday log={log} /> : null} />
      </SectionGuard>
    ) : null;
  // nothing is switched on: one line and the way to the switches, and nothing else on the page
  if (!parts.length)
    return (
      <div className="day-page" data-day={date} data-fitness="off">
        <LiveExtras date={date} loaded={loaded} />
        <NothingShown />
      </div>
    );

  return (
    <div className="day-page" data-day={date} data-fitness={fitness ? undefined : 'off'}>
      {fitness && loaded ? (
        <SectionGuard name="Training status" resetKey={date}>
          <StatusChip date={date} today={today} onPlan={openPlan} />
          <HeldNote date={date} log={log} />
        </SectionGuard>
      ) : null}
      {/* the day's training is the page's centrepiece: first, above the habits (HeroGauge carries the week's miles). With
          Fitness off the slot holds the evening's Close card only, and the day's own sections lead */}
      {!loaded ? (
        fitness ? (
          <HeroSkeleton />
        ) : null
      ) : (
        <SectionGuard name={fitness ? 'Training' : 'Close the day'} resetKey={date}>
          {fitness ? bare ? <FirstRunSlot date={date} log={log} /> : <Hero date={date} log={log} /> : <Hero date={date} log={log} closeOnly />}
        </SectionGuard>
      )}
      <LiveExtras date={date} loaded={loaded} />
      {/* the day's first decision sits above the repeat taps: Plan your day, then Habits, in both modes (layout standard 2.1) */}
      {[day, habits]}
      {parts.includes('learned') && loaded && isToday ? (
        <SectionGuard name="What I learned" resetKey={date}>
          <LearnedPrompt today={today} />
        </SectionGuard>
      ) : null}
      {fitness && STRAVA_BUILT && loaded && isToday && !bare && primer.show ? (
        <div className="strava-primer">
          <StravaPrimer onLater={primer.later} />
        </div>
      ) : null}
      {loaded && date < today ? (
        <SectionGuard name="The day" resetKey={date}>
          <TheDayCard date={date} log={log} />
        </SectionGuard>
      ) : null}
      {loaded ? (
        <SectionGuard name="Journal" resetKey={date}>
          <DayTimeline date={date} log={log} />
        </SectionGuard>
      ) : null}
      {loaded ? <EditToday /> : null}
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
