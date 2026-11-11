import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { mondayOf } from '@logbook/shared';
import { useNav } from '@/app/NavController';
import { haptics } from '@/lib/haptics';
import { STRAVA_BUILT } from '@/lib/features';
import { Button, EmptyState, Segmented, Skeleton, SkeletonGroup } from '@/ui';
import { RangeControl } from '@/ui/charts';
import { usePageShown } from '@/ui/nowBudget';
import type { Log } from '../log/useLog';
import { HERO_MODES, liftRange, runRange, type HeroMode, type LiftView, type RunView } from './hero';
import { LiftList } from './LiftList';
import { RangeBars, type BarMark } from './RangeBars';
import { PROGRESS_RANGES, RANGE_WORDS, UNIT_WORD, type ProgressRange } from './ranges';
import { liftAt, liftRest, liftWords, readoutWords, runAt, runRest, runWords, type Readout } from './readout';
import { useOpenWeek } from './sheets';
import './hero.css';

// ---------- the chosen chart: a per-viewer convenience, remembered on this device ----------
const MODE_KEY = 'logbook.progress.hero';
const readMode = (): HeroMode => {
  try {
    const v = localStorage.getItem(MODE_KEY);
    return HERO_MODES.includes(v as HeroMode) ? (v as HeroMode) : 'run';
  } catch {
    return 'run';
  }
};
const useMode = () => {
  const [m, setM] = useState<HeroMode>(readMode);
  const set = (v: HeroMode) => {
    setM(v);
    try {
      localStorage.setItem(MODE_KEY, v);
    } catch {
      /* private mode: this session only */
    }
  };
  return [m, set] as const;
};

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
 * The hero (guide 6.4, layout standard 6.4): one card, read top down. Running / Strength first, in the quiet tone (the range
 * control below is the card's one Sky thumb); then the headline, the largest and darkest thing on the screen, with its
 * context on the same line; one takeaway line under it; then the chart and, under the plot it changes, the range control.
 *
 * Both charts are the same bars (`RangeBars`), one per day, week or month of the range: miles run, or lift sessions done.
 * History shows only what was done. The plan shows only for what is still ahead: the days to come in 1W and the rest of the
 * bucket holding today, as a dashed outline. In 1W the headline reads this week against its plan, in words. The card has
 * the same parts in every range, so the range control never moves when the range changes. Dragging across the plot reads
 * one bucket in the headline; a tap on a running week opens it. Strength keeps its workouts as date rows under a hairline.
 */
export const HeroChart = ({ log, t, range, onRange, first, liftFirst = null, firstReady = true, onConnect, failed, onRetry }: { log: Log; t: string; range: ProgressRange; onRange: (r: ProgressRange) => void; first: string | null; liftFirst?: string | null; firstReady?: boolean; onConnect: (() => void) | null; failed?: boolean; onRetry?: () => void }) => {
  const nav = useNav();
  const [mode, setMode] = useMode();
  const [scrub, setScrub] = useState<number | null>(null);
  const [opened, setOpened] = useState<number | null>(null);
  const hint = useScrubHint();
  const openWeek = useOpenWeek(t);
  const snap = log.snap;
  const loaded = useCallback((m: string) => snap.loaded(m), [snap]);
  // strength reaches back to its own first day when it has one (a logged set), else to where running began
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
  const before = mode === 'run' ? runBefore : liftBefore;
  // a range to choose needs a week before this one with something in it; until then this week draws by day
  const firstWeek = !recentGaps && !before;
  const shownRange: ProgressRange = firstWeek ? '1W' : range;

  const fresh = useMemo<View>(() => (mode === 'run' ? { mode, ...runRange(snap, t, shownRange, first, loaded) } : { mode, ...liftRange(snap, t, shownRange, liftStart, loaded) }), [mode, snap, t, shownRange, first, liftStart, loaded]);
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
    setMode(m);
  };
  const changeRange = (r: ProgressRange) => {
    setScrub(null);
    setOpened(null);
    onRange(r);
  };
  // two segmented controls share the card: the one that is not the range control is quiet (guide 6.3 amendment, F9)
  const seg = (
    <Segmented
      className="ph-seg"
      tone="quiet"
      label="Running or strength"
      value={mode}
      onChange={changeMode}
      options={[
        ['run', 'Running'],
        ['lift', 'Strength'],
      ]}
    />
  );
  const title = mode === 'run' ? 'Running' : 'Strength';
  const rangeRow = <RangeControl className="ph-range" value={range} options={PROGRESS_RANGES} words={RANGE_WORDS} onChange={changeRange} label="Range" />;

  // ---------- nothing planned and nothing done, ever (in the loaded months): the screen's empty state ----------
  const runAny = runBefore || week.planned > 0 || week.done > 0 || (view.mode === 'run' && view.buckets.some((p) => p.done > 0 || p.planned > 0));
  const liftAny = liftBefore || recentLift.buckets.some((p) => p.done > 0 || p.planned > 0) || (view.mode === 'lift' && view.buckets.some((p) => p.done > 0 || p.planned > 0));
  if (!recentGaps && !(mode === 'run' ? runAny : liftAny)) {
    const strava = STRAVA_BUILT && !!onConnect;
    return (
      <section className="card is-hero has-glow ph" aria-label={title}>
        {seg}
        <EmptyState
          className="ph-empty"
          ghost={<BarsGhost />}
          verb={mode === 'run' && strava ? { label: 'Connect Strava', onPress: onConnect! } : { label: 'Plan a week', onPress: () => nav.go('/plan') }}
        >
          {mode === 'run' ? 'Plan a week and run it. Your miles show up here.' : 'No lifts yet. Add a lift day to your plan and log its sets.'}
        </EmptyState>
      </section>
    );
  }

  const list =
    mode === 'lift' ? (
      <>
        <hr className="rule" />
        <LiftList log={log} t={t} />
      </>
    ) : null;

  if (pending && before) {
    return (
      <section className="card is-hero has-glow ph" aria-label={title}>
        {seg}
        <SkeletonGroup label={`Loading ${RANGE_WORDS[range].toLowerCase()}`} className="ph-wait">
          <Skeleton w={176} h={46} r="control" />
          <Skeleton w={208} h={16} />
          <span className="skel ph-wait-plot" aria-hidden="true" />
        </SkeletonGroup>
        {rangeRow}
        {list}
      </section>
    );
  }

  const { span } = view;
  const unit = span.unit;
  const byWeek = span.range === '1W';
  const gaps = view.buckets.some((p) => p.missing);
  // the bucket being read (under the finger, or the one whose sheet is up), if the chart on screen still has it; a bucket
  // that has not loaded has no number to read, so the headline stays as it is over a gap
  const ati = scrub ?? opened;
  const reading = ati != null && ati < view.buckets.length && !view.buckets[ati]!.missing;
  const readout: Readout =
    view.mode === 'run'
      ? reading
        ? runAt(unit, view.buckets[ati]!, t)
        : runRest(span, view.buckets, week, lastWeek, t, byWeek, firstWeek)
      : reading
        ? liftAt(unit, view.buckets[ati]!, t)
        : liftRest(span, view.buckets, liftWeek, t, byWeek);
  const marks: BarMark[] = view.buckets.map((b) => ({ key: b.key, value: b.done, ahead: b.ahead, current: b.current, future: b.future, missing: b.missing }));
  const words = (i: number) => (view.mode === 'run' ? runWords(unit, view.buckets[i]!, t) : liftWords(unit, view.buckets[i]!, t));
  const chartLabel = `${UNIT_TITLE[unit]} ${view.mode === 'run' ? 'miles' : 'lift sessions'}, ${RANGE_WORDS[span.range].toLowerCase()}.`;

  // a tap on a running day or week opens its week; a month has no sheet of its own, and the strength rows below open theirs
  const openAt =
    view.mode !== 'run' || unit === 'month'
      ? undefined
      : (i: number) => {
          const p = view.buckets[i];
          if (!p) return;
          // the headline names this bucket while its sheet is up
          setOpened(i);
          openWeek(mondayOf(p.key), 'open', () => setOpened(null));
        };

  return (
    <section className="card is-hero has-glow ph" aria-label={title}>
      {seg}
      <Head r={readout} hold={reading} />
      <RangeBars
        key={`${view.mode}-${span.range}-${span.unit}-${span.from}`}
        span={span}
        marks={marks}
        label={chartLabel}
        words={words}
        hint={hint.hint ? `Drag across to see each ${UNIT_WORD[unit]}` : null}
        hintRead={hint.read}
        onScrub={setScrub}
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
      {list}
    </section>
  );
};
