import type * as React from 'react';
import { useMemo, useRef, useState } from 'react';
import { mondayOf } from '@logbook/shared';
import { useNav } from '@/app/NavController';
import { haptics } from '@/lib/haptics';
import { STRAVA_BUILT } from '@/lib/features';
import { Button, EmptyState, Segmented } from '@/ui';
import { RangeControl } from '@/ui/charts';
import { useNowMark, usePageShown } from '@/ui/nowBudget';
import type { Log } from '../log/useLog';
import { plural } from './data';
import { completion, HERO_MODES, lbShort, liftWeeks, miShort, runRange, type HeroMode, type LiftWeek, type RunView } from './hero';
import { LiftList } from './LiftList';
import { PlanLine } from './PlanLine';
import { bucketTitle, keptOver, PROGRESS_RANGES, RANGE_WORDS, rangeContext, type ProgressRange, type RunBucket } from './ranges';
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

const pctText = (r: number) => `${Math.round(r * 100)}%`;
const runsWords = (b: Pick<RunBucket, 'runs' | 'plannedRuns'>) => (b.plannedRuns > 0 ? `${b.runs} of ${b.plannedRuns} ${plural(b.plannedRuns, 'run')}` : `${b.runs} ${plural(b.runs, 'run')}`);

/** This week, in words under the 1W headline: done, on plan with miles to go, or behind the plan so far. */
const weekTakeaway = (w: RunBucket) => {
  if (w.planned <= 0) return w.runs ? 'No runs planned this week' : 'No runs planned this week';
  if (w.done + 0.05 >= w.planned) return 'This week’s plan is done';
  const behind = w.plannedPast - w.done;
  return behind > 0.05 ? `${miShort(behind)} mi behind plan this week` : `On plan, ${miShort(w.planned - w.done)} mi to go`;
};

/** The empty card's ghost: the shape of the chart to come, two curves (the plan dashed, what was run solid). Shapes only. */
const CurveGhost = () => (
  <svg viewBox="0 0 300 96" width="100%" height={96} aria-hidden="true" className="ph-ghost">
    <path d="M6,70 C60,64 90,52 140,46 S230,30 294,18" className="ph-ghost-plan" />
    <path d="M6,78 C60,74 96,64 140,58 S220,48 250,40" className="ph-ghost-done" />
    <circle cx={250} cy={40} r={4} className="ph-ghost-dot" />
  </svg>
);

/**
 * This week as the guide's ruler (6.8): a 6 px Haze track, Deep Sky to the miles run, a Sunrise NOW tick there with "NOW" in
 * Ember caption over it, a Night Ink triangle under the track at the plan by the end of today, "0" and the week's plan under
 * the ends. It sits over the plot in 1W, and stands in for the chart before two weeks have anything in them.
 */
const Ruler = ({ w }: { w: RunBucket }) => {
  const share = w.planned > 0 ? Math.min(1, w.done / w.planned) : w.done > 0 ? 1 : 0;
  const by = w.planned > 0 ? Math.min(1, w.plannedNow / w.planned) : null;
  // the NOW tick is a Sunrise mark (guide 3.5 job 6) while this week shows on the page on screen
  const now = useNowMark('pointer', usePageShown() && w.current);
  return (
    <div className="ph-ruler" role="img" aria-label={w.planned > 0 ? `${miShort(w.done)} of ${miShort(w.planned)} miles this week. The plan by today: ${miShort(w.plannedNow)} miles.` : `${miShort(w.done)} miles this week`}>
      <span className="ph-ruler-now" aria-hidden="true" data-now={now === 'ink' ? 'ink' : undefined} style={{ '--at': share } as React.CSSProperties}>
        Now
      </span>
      <span className="ph-ruler-bar" aria-hidden="true">
        <i style={{ transform: `scaleX(${share})` }} />
        <b className="ph-ruler-tick" data-now={now === 'ink' ? 'ink' : undefined} style={{ '--at': share } as React.CSSProperties} />
        {by != null ? <em className="ph-ruler-by" style={{ '--at': by } as React.CSSProperties} /> : null}
      </span>
      <span className="ph-ruler-ends" aria-hidden="true">
        <span>0</span>
        <span>{w.planned > 0 ? `${miShort(w.planned)} mi` : ''}</span>
      </span>
    </div>
  );
};

/** What the Strength headline says for a week. */
const liftLine = (l: LiftWeek) => {
  const unit = plural(l.planned || l.done, 'session');
  return {
    big: String(l.done),
    of: l.planned > 0 ? `of ${l.planned} ${unit}` : unit,
    take: l.sets ? `${l.sets} ${plural(l.sets, 'set')}, ${lbShort(l.volume)} lb moved` : l.current ? 'No sets yet' : 'No sets logged',
    words: `${l.done} ${l.planned > 0 ? `of ${l.planned} planned ` : ''}lift ${unit}, ${l.sets} ${plural(l.sets, 'set')}`,
  };
};

/**
 * The hero (guide 6.4, layout standard 6.4): one card, read top down. Running / Strength first, in the quiet tone (the range
 * control below is the card's one Sky thumb); then the headline, the largest and darkest thing on the screen, with its
 * context on the same line; one takeaway line under it, which carries the share of the plan for the range (one big number
 * per card: the old "Last 4 weeks" box follows the range now and is said in words); then the chart and,
 * under the plot it changes, the range control. Running draws miles for the range (1W by day with this week's ruler over
 * it; 1M to 12M by week; All by week or, past about 18 months, by month). Strength gives this week against the plan, then the
 * workouts as date rows under a hairline. Scrubbing reads one point in the headline; a tap opens its week.
 */
export const HeroChart = ({ log, t, range, onRange, first, firstReady = true, onConnect, failed, onRetry }: { log: Log; t: string; range: ProgressRange; onRange: (r: ProgressRange) => void; first: string | null; firstReady?: boolean; onConnect: (() => void) | null; failed?: boolean; onRetry?: () => void }) => {
  const nav = useNav();
  const [mode, setMode] = useMode();
  const [scrub, setScrub] = useState<number | null>(null);
  const [opened, setOpened] = useState<number | null>(null);
  const openWeek = useOpenWeek(t);
  const loaded = (m: string) => log.snap.loaded(m);
  const fresh = useMemo(() => runRange(log.snap, t, range, first, (m) => log.snap.loaded(m)), [log.snap, t, range, first]);
  // a range whose months are still on their way keeps the last whole chart on screen (never a chart of gaps that fill in
  // one by one); a month that could not be read shows as a gap with Try again
  const lastWhole = useRef<RunView | null>(null);
  const whole = !fresh.buckets.some((b) => b.missing) && (range !== 'All' || firstReady);
  if (whole) lastWhole.current = fresh;
  const view = whole || failed || !lastWhole.current ? fresh : lastWhole.current;
  const lift = useMemo(() => liftWeeks(log.snap, t, loaded), [log.snap, t]); // eslint-disable-line react-hooks/exhaustive-deps
  // the last 13 weeks, whatever the range: this week's numbers, and whether there is anything before it yet
  const recent = useMemo(() => runRange(log.snap, t, '3M', first, loaded), [log.snap, t, first]); // eslint-disable-line react-hooks/exhaustive-deps
  const thisWeek = recent.buckets[recent.buckets.length - 1]!;
  const recentGaps = recent.buckets.some((b) => b.missing);
  const before = recent.buckets.some((b) => !b.current && !b.future && (b.planned > 0 || b.done > 0)) || (!!first && first < recent.span.from);

  const changeMode = (m: HeroMode) => {
    // a segmented change ticks once
    haptics.select();
    setScrub(null);
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

  // ---------- nothing planned and nothing run, ever (in the loaded months): the screen's empty state ----------
  const runAny = before || thisWeek.planned > 0 || thisWeek.done > 0 || view.weeks.some((p) => p.done > 0 || p.planned > 0);
  const liftAny = lift.some((p) => p.done > 0 || p.planned > 0 || p.missing);
  if ((mode === 'run' && !runAny && !recentGaps) || (mode === 'lift' && !liftAny)) {
    const strava = STRAVA_BUILT && !!onConnect;
    return (
      <section className="card is-hero has-glow ph" aria-label={mode === 'run' ? 'Running' : 'Strength'}>
        {seg}
        <EmptyState
          className="ph-empty"
          ghost={<CurveGhost />}
          verb={mode === 'run' && strava ? { label: 'Connect Strava', onPress: onConnect! } : { label: 'Plan a week', onPress: () => nav.go('/plan') }}
        >
          {mode === 'run' ? 'Plan a week and run it. Planned and done miles show up here.' : 'No lifts yet. Add a lift day to your plan and log its sets.'}
        </EmptyState>
      </section>
    );
  }

  // ---------- strength: this week against the plan, then the workouts ----------
  if (mode === 'lift') {
    const cur = lift[lift.length - 1]!;
    const line = liftLine(cur);
    const rate = completion(lift);
    return (
      <section className="card is-hero has-glow ph" aria-label="Strength">
        {seg}
        <div className="ph-head">
          <span className="sr-only">{`This week: ${line.words}.${rate ? ` Last ${rate.weeks} weeks: ${pctText(rate.rate)} of planned lift sessions done.` : ''}`}</span>
          <div className="ph-main" aria-hidden="true">
            <span className="ph-big">
              <span className="tnum">{line.big}</span>
              <small>{line.of} this week</small>
            </span>
            {/* the share of the plan over the last finished weeks, said in the takeaway (the list below has each workout's sets) */}
            <span className="ph-take">{rate ? `${pctText(rate.rate)} of plan over the last ${rate.weeks === 1 ? 'week' : `${rate.weeks} weeks`}` : line.take}</span>
          </div>
        </div>
        <hr className="rule" />
        <LiftList log={log} t={t} />
      </section>
    );
  }

  // ---------- running ----------
  const { span, buckets, weeks } = view;
  const gaps = buckets.some((p) => p.missing);
  // a chart needs a week before this one with something in it; until then this week's ruler stands in, with one line that
  // says the chart is coming (and no range control for a chart that is not drawn)
  const firstWeek = !recentGaps && !before;
  const is1W = range === '1W' || firstWeek;
  const ci = buckets.findIndex((p) => p.current);
  const live = !firstWeek && (scrub ?? opened) != null;
  const at = live ? buckets[(scrub ?? opened)!]! : null;
  const kept = gaps && failed ? null : keptOver(weeks);
  const total = buckets.reduce((s, b) => s + (b.missing ? 0 : b.done), 0);
  const runs = buckets.reduce((s, b) => s + (b.missing ? 0 : b.runs), 0);

  // the headline: at rest the range (1W: this week against its plan), while reading a point that point
  let big: string;
  let context: string;
  let take: string;
  if (at) {
    big = miShort(at.done);
    context = at.planned > 0 ? `of ${miShort(at.planned)} mi` : 'mi';
    take = `${bucketTitle(span.unit, at, t)} · ${at.future ? 'Planned' : runsWords(at)}`;
  } else if (is1W) {
    big = miShort(thisWeek.done);
    context = thisWeek.planned > 0 ? `of ${miShort(thisWeek.planned)} mi · ${runsWords(thisWeek)}` : `mi · ${runsWords(thisWeek)}`;
    take = firstWeek ? 'Your weeks draw here as you go.' : weekTakeaway(thisWeek);
  } else {
    big = miShort(total);
    context = `mi ${rangeContext(span, t)}`;
    // the share of the plan follows the range and lives in the takeaway: one big number per card (layout standard 8.10)
    take = kept ? (kept.behind < 0.5 ? 'On plan' : `${pctText(kept.rate)} of plan, ${miShort(kept.behind)} mi behind`) : runs ? `${runs} ${plural(runs, 'run')}, none planned` : 'No runs in this range';
  }

  const words = (i: number) => {
    const p = buckets[i]!;
    const name = bucketTitle(span.unit, p, t);
    if (p.missing) return `${name}: not loaded yet`;
    if (p.future) return `${name}: ${miShort(p.planned)} miles planned`;
    return `${name}: ${miShort(p.done)} ${p.planned > 0 ? `of ${miShort(p.planned)} planned ` : ''}miles, ${runsWords(p)}`;
  };
  const unitWord = span.unit === 'day' ? 'Daily' : span.unit === 'week' ? 'Weekly' : 'Monthly';
  const chartLabel = `${unitWord} miles, planned and run, ${RANGE_WORDS[range].toLowerCase()}. ${ci >= 0 ? `${words(ci)}.` : ''}`;
  const readWords = `${big} ${context}. ${take}.`;

  // a tap opens the week it falls in (a day opens its week); a month has no sheet of its own
  const openAt =
    span.unit === 'month'
      ? undefined
      : (i: number) => {
          const p = buckets[i];
          if (!p) return;
          // the headline names this point while its sheet is up
          setOpened(i);
          openWeek(mondayOf(p.key), 'open', () => setOpened(null));
        };

  return (
    <section className="card is-hero has-glow ph" aria-label="Running">
      {seg}
      <div className="ph-head">
        {/* the words VoiceOver hears when the point under the finger changes: a live region speaks its text, not its label */}
        <span className="sr-only" role="status">
          {readWords}
        </span>
        <div className="ph-main" aria-hidden="true">
          <span className="ph-big">
            <span className="tnum">{big}</span>
            <small>{context}</small>
          </span>
          <span className="ph-take">{take}</span>
        </div>
      </div>
      {is1W ? <Ruler w={thisWeek} /> : null}
      {firstWeek ? null : (
        <>
          <PlanLine key={`${range}-${span.from}`} span={span} buckets={buckets} label={chartLabel} words={words} onScrub={setScrub} onOpen={openAt} />
          {gaps && failed && onRetry ? (
            <div className="ph-retry" role="alert">
              <span>Some weeks didn’t load.</span>
              <Button variant="soft" size="sm" onClick={onRetry}>
                Try again
              </Button>
            </div>
          ) : null}
          <RangeControl className="ph-range" value={range} options={PROGRESS_RANGES} words={RANGE_WORDS} onChange={changeRange} label="Range" />
        </>
      )}
    </section>
  );
};
