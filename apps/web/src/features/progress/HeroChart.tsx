import { ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { mondayOf } from '@logbook/shared';
import { useIsActiveTab, useNav } from '@/app/NavController';
import { haptics } from '@/lib/haptics';
import { STRAVA_BUILT } from '@/lib/features';
import { Button, EmptyState, Pressable, SectionEmpty, Segmented, Skeleton, SkeletonGroup } from '@/ui';
import { RangeControl } from '@/ui/charts';
import { ProgressIcon } from '@/ui/icons';
import { usePageShown } from '@/ui/nowBudget';
import { setHeroView, useHeroView } from '../day/heroView';
import type { Log } from '../log/useLog';
import { chartEmpty, chartKeyOf, chartMode, liftRange, MODE_WORD, readingOn, runRange, todayView, VIEW_OF, type HeroMode, type LiftView, type Reading, type RunView } from './hero';
import { LiftList } from './LiftList';
import { RangeBars, type BarMark } from './RangeBars';
import { firstShown, PROGRESS_RANGES, RANGE_WORDS, UNIT_WORD, type ProgressRange } from './ranges';
import { liftAt, liftRest, liftWords, readoutWords, runAt, runRest, runWords, type Readout } from './readout';
import { useOpenWeek } from './sheets';
import './hero.css';

// ---------- the first-use hint: until a finger has read the chart once, remembered on this device ----------
const HINT_KEY = 'logbook.progress.scrubbed';
/** For a browser with no storage: the hint still goes after the first read, for this session. */
let readThisSession = false;
const hasRead = () => {
  if (readThisSession) return true;
  try {
    return localStorage.getItem(HINT_KEY) === '1';
  } catch {
    return false;
  }
};
/**
 * Whether the chart still says how it is read ("Drag across to see each week"), whether that has just been done, and the
 * way to say so. The line's words fade the moment the chart is first read. Its room is given back only when the card
 * mounts or the page next comes on screen, never while it is up: nothing folds away, and moves the range control, under a
 * finger that has just read the chart.
 */
const useScrubHint = () => {
  const shown = usePageShown();
  const [seen, setSeen] = useState(hasRead);
  const [read, setRead] = useState(false);
  useEffect(() => {
    if (shown) setSeen(hasRead());
  }, [shown]);
  const done = useCallback(() => {
    setRead(true);
    if (readThisSession) return;
    readThisSession = true;
    try {
      localStorage.setItem(HINT_KEY, '1');
    } catch {
      /* private mode: this session only */
    }
  }, []);
  return { hint: !seen, read, done };
};

/** The empty card's ghost: the shape of the chart to come, domes rising on a horizon. Shapes only. */
const BarsGhost = () => (
  <svg viewBox="0 0 300 96" width="100%" height={96} aria-hidden="true" className="ph-ghost">
    {[26, 38, 34, 52, 64].map((h, i) => (
      <path key={i} d={`M${46 + i * 46},84V${84 - h + 14}a14,14 0 0 1 28,0V84Z`} className={i === 4 ? 'ph-ghost-bar is-last' : 'ph-ghost-bar'} />
    ))}
    <path d="M16,84H284" className="ph-ghost-base" />
  </svg>
);

/**
 * The headline: the number with its context beside it, one line under it. While a bucket is read (`hold`) the block keeps
 * at least the height it had at rest, and any height it has grown to, so the plot below never moves under the finger.
 */
const Head = ({ r, hold }: { r: Readout; hold: boolean }) => {
  const ref = useRef<HTMLDivElement>(null);
  const rest = useRef(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!hold) {
      el.style.minHeight = '';
      rest.current = el.offsetHeight;
      return;
    }
    el.style.minHeight = `${Math.max(rest.current, el.offsetHeight)}px`;
  });
  return (
    <div className="ph-head" ref={ref}>
      <span className="sr-only">{readoutWords(r)}</span>
      <div className="ph-main" aria-hidden="true">
        <span className="ph-big">
          <span className="tnum">{r.big}</span>
          <small>{r.context}</small>
        </span>
        <span className="ph-take">{r.take}</span>
      </div>
    </div>
  );
};

type View = ({ mode: 'run' } & RunView) | ({ mode: 'lift' } & LiftView);
const UNIT_TITLE = { day: 'Daily', week: 'Weekly', month: 'Monthly' } as const;

/**
 * The Progress chart (guide 6.4, layout standard 6.4): one card, read top down. Runs / Workouts first, when both have
 * something to show, in the quiet tone (the range control below is the card's one Sky thumb); then the headline with its
 * context on the same line; one takeaway line under it; then the chart and, under the plot it changes, the range control.
 *
 * Runs / Workouts is the one switch the training card's pill also moves (`features/day/heroView.ts`, `chartMode`): a
 * change here changes the card's band, and a change there changes this chart. It holds for the day.
 *
 * Both charts are the same bars (`RangeBars`), one per day, week or month of the range: miles run, or workouts done.
 * History shows only what was done. The plan shows only for what is still ahead: the days to come in 1W and the rest of the
 * bucket holding today, as a dashed outline. In 1W the headline reads this week against its plan, in words. The card has
 * the same parts in every range and in both modes, so the range control never moves when the range changes. Dragging
 * across the plot reads one bucket in the headline; a tap on a running week opens it. The workouts themselves are date
 * rows in a card of their own, 12 under the chart (a card holds one unit, and three text sizes at most).
 *
 * `lead` (the old Progress tab): the card is the screen's hero, with the glow and the 44 px headline, and with nothing to
 * draw it is the screen's empty state. On Fitness the training card leads, so this is a plain card with the headline at
 * the value size, and with nothing to draw it is one quiet row, never an empty frame.
 *
 * `startFailed`: where history starts could not be learned (neither from the server nor from the months on this phone).
 * The All range then says so, with Try again and the other ranges still a tap away; it is never drawn from today.
 */
export const HeroChart = ({
  log,
  t,
  range,
  onRange,
  first,
  liftFirst = null,
  firstReady = true,
  startFailed = false,
  onConnect,
  failed,
  onRetry,
  lead = true,
}: {
  log: Log;
  t: string;
  range: ProgressRange;
  onRange: (r: ProgressRange) => void;
  first: string | null;
  liftFirst?: string | null;
  firstReady?: boolean;
  startFailed?: boolean;
  onConnect: (() => void) | null;
  failed?: boolean;
  onRetry?: () => void;
  lead?: boolean;
}) => {
  const nav = useNav();
  const picked = useHeroView(t, t);
  // what is being read, with the chart it was read on (hero.ts `readingOn`: a reading never outlives its chart)
  const [scrub, setScrub] = useState<Reading | null>(null);
  const [opened, setOpened] = useState<Reading | null>(null);
  const hint = useScrubHint();
  // the workouts list under the chart on Fitness: folded until asked for, and folded again once the tab is left
  const [listOpen, setListOpen] = useState(false);
  const listId = useId();
  const activeTab = useIsActiveTab();
  useEffect(() => {
    if (!activeTab) setListOpen(false);
  }, [activeTab]);
  const openWeek = useOpenWeek(t);
  const snap = log.snap;
  const loaded = useCallback((m: string) => snap.loaded(m), [snap]);
  // workouts reach back to their own first day when they have one (a logged set), else to where running began
  const liftStart = liftFirst ?? first;

  // the last 13 weeks, whatever the range: this week's numbers, and whether there is anything before it yet
  const recentRun = useMemo(() => runRange(snap, t, '3M', first, loaded), [snap, t, first, loaded]);
  const recentLift = useMemo(() => liftRange(snap, t, '3M', liftStart, loaded), [snap, t, liftStart, loaded]);
  const week = recentRun.buckets[recentRun.buckets.length - 1]!;
  const lastWeek = recentRun.buckets[recentRun.buckets.length - 2] ?? null;
  const liftWeek = recentLift.buckets[recentLift.buckets.length - 1]!;
  const recentGaps = recentRun.buckets.some((b) => b.missing);
  const runBefore = recentRun.buckets.some((b) => !b.current && (b.planned > 0 || b.done > 0)) || (!!first && first < recentRun.span.from);
  const liftBefore = recentLift.buckets.some((b) => !b.current && (b.planned > 0 || b.done > 0)) || (!!liftFirst && liftFirst < recentLift.span.from);
  // the chosen range, for both modes (each day is read once per snapshot: hero.ts): what each has decides the mode
  const chosenRun = useMemo(() => runRange(snap, t, range, first, loaded), [snap, t, range, first, loaded]);
  const chosenLift = useMemo(() => liftRange(snap, t, range, liftStart, loaded), [snap, t, range, liftStart, loaded]);
  const something = (bs: Array<{ missing: boolean; planned: number; done: number }>) => bs.some((b) => !b.missing && (b.planned > 0 || b.done > 0));
  // a mode exists when it has anything, done or planned, ever (in the loaded months); the one switch picks between those
  const has = {
    run: runBefore || week.planned > 0 || week.done > 0 || something(chosenRun.buckets),
    lift: liftBefore || liftWeek.planned > 0 || liftWeek.done > 0 || something(chosenLift.buckets),
  };
  const own = useMemo(() => todayView(snap, t), [snap, t]);
  const { mode, switchable } = chartMode({ picked, today: own, has, settled: !recentGaps });
  // the chosen range, and this week by day
  const chosen = useMemo<View>(() => (mode === 'run' ? { mode, ...chosenRun } : { mode, ...chosenLift }), [mode, chosenRun, chosenLift]);
  const days = useMemo<View>(() => (mode === 'run' ? { mode, ...runRange(snap, t, '1W', first, loaded) } : { mode, ...liftRange(snap, t, '1W', liftStart, loaded) }), [mode, snap, t, first, liftStart, loaded]);
  // anything before this week: in the last 13 weeks, by where history starts, or in the chosen range itself (a long range
  // can reach runs the other two do not know of: back after months away, on a server that cannot say where history starts)
  const monday = mondayOf(t);
  const before = (mode === 'run' ? runBefore : liftBefore) || chosen.buckets.some((b) => b.to < monday && !b.missing && (b.planned > 0 || b.done > 0));
  // a range to choose needs a week before this one with something in it; until then this week draws by day
  const firstWeek = !recentGaps && !before;
  const shownRange: ProgressRange = firstWeek ? '1W' : range;
  const fresh = firstWeek ? days : chosen;
  // a range whose months are still on their way keeps the last whole chart on screen (never a chart of gaps that fill in
  // one by one); a month that could not be read shows as a gap with Try again
  const lastWhole = useRef<View | null>(null);
  const whole = !fresh.buckets.some((b) => b.missing) && (shownRange !== 'All' || firstReady);
  if (whole) lastWhole.current = fresh;
  const held = lastWhole.current?.mode === mode ? lastWhole.current : null;
  const view = whole || failed || !held ? fresh : held;
  // the range's months are still on their way and no whole chart has been drawn yet (a long range remembered from the last
  // visit, on a cold open): its total would count only the months in so far, so the headline and the plot wait as skeletons
  const pending = !whole && !failed && !held;

  const changeMode = (m: HeroMode) => {
    // a segmented change ticks once
    haptics.select();
    setScrub(null);
    setOpened(null);
    // the one switch: the training card's pill follows (features/day/heroView.ts)
    setHeroView(t, t, VIEW_OF[m]);
  };
  const changeRange = (r: ProgressRange) => {
    setScrub(null);
    setOpened(null);
    onRange(r);
  };
  // two segmented controls share the card: the one that is not the range control is quiet (guide 6.3 amendment, F9).
  // It is there only when both have something to show; the words are the training card's pair
  const seg = switchable ? (
    <Segmented
      className="ph-seg"
      tone="quiet"
      label="Runs or workouts"
      value={mode}
      onChange={changeMode}
      options={[
        ['run', MODE_WORD.run],
        ['lift', MODE_WORD.lift],
      ]}
    />
  ) : null;
  const title = MODE_WORD[mode];
  const cardCls = lead ? 'card is-hero has-glow ph' : `card ph ph-plain${switchable ? '' : ' no-seg'}`;
  const rangeRow = <RangeControl className="ph-range" value={range} options={PROGRESS_RANGES} words={RANGE_WORDS} onChange={changeRange} label="Range" />;

  // ---------- nothing planned and nothing done, ever (in the loaded months) ----------
  if (!recentGaps && !has.run && !has.lift) {
    const strava = STRAVA_BUILT && !!onConnect;
    // on Fitness: one quiet row in the chart's place, never an empty frame (the week above it is where a session is added)
    if (!lead) {
      const e = chartEmpty(strava);
      return <SectionEmpty className="ph-none" icon={<ProgressIcon size={18} />} title={e.title} line={e.line} action={e.connect ? { label: 'Connect', onPress: onConnect!, voiceLabel: 'Connect Strava' } : undefined} />;
    }
    // the old Progress tab: the screen's empty state
    return (
      <section className={cardCls} aria-label={title}>
        <EmptyState className="ph-empty" ghost={<BarsGhost />} verb={strava ? { label: 'Connect Strava', onPress: onConnect! } : { label: 'Plan a week', onPress: () => nav.go('/plan') }}>
          Plan a week and run it. Your miles show up here.
        </EmptyState>
      </section>
    );
  }

  // the workouts themselves: a card of their own under the chart (layout standard 2.7), so the chart is the same card in
  // both modes. On Fitness the week above already lists this week's sessions, so the card is folded to one row, as the
  // week's own "Earlier this week" is, and opens in place
  const list =
    mode !== 'lift' ? null : lead ? (
      <section className="card ll-card" aria-label="Workouts, one by one">
        <LiftList log={log} t={t} />
      </section>
    ) : (
      <section className={`card ll-card ll-folds${listOpen ? ' is-open' : ''}`} aria-label="Workouts, one by one">
        <Pressable className="ll-fold" press="surface" aria-expanded={listOpen} aria-controls={listId} onPress={() => setListOpen((o) => !o)} label={`Workouts, one by one. ${listOpen ? 'Hide' : 'Show'}`}>
          <span className="ll-fold-title">Workouts, one by one</span>
          <ChevronDown size={18} className="ll-fold-chev" aria-hidden="true" />
        </Pressable>
        {listOpen ? (
          <div id={listId} className="ll-fold-body">
            <LiftList log={log} t={t} />
          </div>
        ) : null}
      </section>
    );

  // All has no first day to start from: say so, with the way to ask again. The other ranges do not need it
  if (!firstWeek && range === 'All' && startFailed && onRetry) {
    return (
      <>
        <section className={cardCls} aria-label={title}>
          {seg}
          <EmptyState className="ph-empty" verb={{ label: 'Try again', onPress: onRetry }}>
            Couldn’t load your whole history. Check your connection.
          </EmptyState>
          {rangeRow}
        </section>
        {list}
      </>
    );
  }

  if (pending && before) {
    return (
      <>
        <section className={cardCls} aria-label={title}>
          {seg}
          <SkeletonGroup label={`Loading ${RANGE_WORDS[range].toLowerCase()}`} className="ph-wait">
            <Skeleton w={176} h={46} r="control" />
            <Skeleton w={208} h={16} />
            <span className="skel ph-wait-plot" aria-hidden="true" />
          </SkeletonGroup>
          {rangeRow}
        </section>
        {list}
      </>
    );
  }

  const { span } = view;
  const unit = span.unit;
  const byWeek = span.range === '1W';
  const gaps = view.buckets.some((p) => p.missing);
  // the bucket being read (under the finger, or the one whose sheet is up), if the chart on screen still has it; a bucket
  // that has not loaded has no number to read, so the headline stays as it is over a gap
  const chartKey = chartKeyOf(view.mode, span);
  const ati = readingOn(scrub, chartKey) ?? readingOn(opened, chartKey);
  const reading = ati != null && ati < view.buckets.length && !view.buckets[ati]!.missing;
  const readout: Readout =
    view.mode === 'run'
      ? reading
        ? runAt(unit, view.buckets[ati]!, t)
        : runRest(span, view.buckets, week, lastWeek, t, byWeek, firstWeek, first)
      : reading
        ? liftAt(unit, view.buckets[ati]!, t)
        : liftRest(span, view.buckets, liftWeek, t, byWeek, liftStart);
  const marks: BarMark[] = view.buckets.map((b) => ({ key: b.key, value: b.done, ahead: b.ahead, current: b.current, future: b.future, missing: b.missing }));
  const words = (i: number) => (view.mode === 'run' ? runWords(unit, view.buckets[i]!, t) : liftWords(unit, view.buckets[i]!, t));
  const chartLabel = `${UNIT_TITLE[unit]} ${view.mode === 'run' ? 'miles' : 'workouts'}, ${RANGE_WORDS[span.range].toLowerCase()}.`;
  // where the bars start: at the first day the app knows of (a run or a lift), so a quiet week since then is drawn and read
  const logStart = [first, liftFirst].filter((d): d is string => !!d).sort()[0] ?? null;

  // a tap on a running day or week opens its week; a month has no sheet of its own, and the workout rows below open theirs
  const openAt =
    view.mode !== 'run' || unit === 'month'
      ? undefined
      : (i: number) => {
          const p = view.buckets[i];
          if (!p) return;
          // the headline names this bucket while its sheet is up
          setOpened({ chart: chartKey, i });
          openWeek(mondayOf(p.key), 'open', () => setOpened(null));
        };

  return (
    <>
      <section className={cardCls} aria-label={title}>
        {seg}
        <Head r={readout} hold={reading} />
        <RangeBars
          key={chartKey}
          span={span}
          marks={marks}
          label={chartLabel}
          words={words}
          from={firstShown(span, view.buckets, logStart)}
          // nothing to draw yet: workouts count in ones, miles in fives
          idle={view.mode === 'lift' ? 2 : undefined}
          hint={hint.hint ? `Drag across to see each ${UNIT_WORD[unit]}` : null}
          hintRead={hint.read}
          onScrub={(i) => setScrub(i == null ? null : { chart: chartKey, i })}
          onOpen={openAt}
          onRead={hint.done}
        />
        {gaps && failed && onRetry ? (
          <div className="ph-retry" role="alert">
            <span>{unit === 'month' ? 'Some months didn’t load.' : 'Some weeks didn’t load.'}</span>
            <Button variant="soft" size="sm" onClick={onRetry}>
              Try again
            </Button>
          </div>
        ) : null}
        {firstWeek ? null : rangeRow}
      </section>
      {list}
    </>
  );
};
