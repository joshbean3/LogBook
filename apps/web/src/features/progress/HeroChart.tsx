import type * as React from 'react';
import { useMemo, useState } from 'react';
import { useNav } from '@/app/NavController';
import { haptics } from '@/lib/haptics';
import { STRAVA_BUILT } from '@/lib/features';
import { Button, EmptyState, Segmented } from '@/ui';
import { useNowMark, usePageShown } from '@/ui/nowBudget';
import type { Log } from '../log/useLog';
import { plural, weekTitle } from './data';
import { completion, HERO_MODES, HERO_WEEKS, lbShort, liftWeeks, miShort, runWeeks, weekRate, type HeroMode, type LiftWeek, type RunWeek } from './hero';
import { LiftList } from './LiftList';
import { PlanLine } from './PlanLine';
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

/** What the headline says for one week, in the mode's words. */
const weekLine = (mode: HeroMode, p: RunWeek | LiftWeek) => {
  if (mode === 'run') {
    const r = p as RunWeek;
    const unit = 'mi';
    return {
      big: miShort(r.done),
      of: r.planned > 0 ? `of ${miShort(r.planned)} ${unit}` : unit,
      sub: r.plannedRuns > 0 ? `${r.runs} of ${r.plannedRuns} ${plural(r.plannedRuns, 'run')}` : r.runs ? `${r.runs} ${plural(r.runs, 'run')}, none planned` : 'No runs planned',
      words: `${miShort(r.done)} ${r.planned > 0 ? `of ${miShort(r.planned)} planned ` : ''}miles, ${r.runs} ${plural(r.runs, 'run')}`,
    };
  }
  const l = p as LiftWeek;
  const unit = plural(l.planned || l.done, 'session');
  return {
    big: String(l.done),
    of: l.planned > 0 ? `of ${l.planned} ${unit}` : unit,
    sub: l.sets ? `${l.sets} ${plural(l.sets, 'set')}, ${lbShort(l.volume)} lb moved` : p.current ? 'No sets yet' : 'No sets logged',
    words: `${l.done} ${l.planned > 0 ? `of ${l.planned} planned ` : ''}lift ${plural(l.planned || l.done, 'session')}, ${l.sets} ${plural(l.sets, 'set')}`,
  };
};

/**
 * The hero: one card, one switch. Running draws weekly miles as two curves, the plan and what was run; the headline is this
 * week at rest and the week under the finger while scrubbing, and a tap on a week opens its sheet. Strength gives this week's
 * sessions against the plan, then the workouts themselves as a column of cards that open their sheets. The number at the
 * right is how much of the plan got done over the last four finished weeks (a scrubbed week's share while scrubbing).
 */
/** The empty card's ghost: the shape of the chart to come, two curves (the plan dashed, what was run solid). Shapes only. */
const CurveGhost = () => (
  <svg viewBox="0 0 300 96" width="100%" height={96} aria-hidden="true" className="ph-ghost">
    <path d="M6,70 C60,64 90,52 140,46 S230,30 294,18" className="ph-ghost-plan" />
    <path d="M6,78 C60,74 96,64 140,58 S220,48 250,40" className="ph-ghost-done" />
    <circle cx={250} cy={40} r={4} className="ph-ghost-dot" />
  </svg>
);

/**
 * A week on its own is not a chart: until two weeks have something in them, this week's bar (done of planned) stands in
 * for the plot, with one line that says the chart is coming.
 */
const FirstWeek = ({ p }: { p: RunWeek }) => {
  const share = p.planned > 0 ? Math.min(1, p.done / p.planned) : p.done > 0 ? 1 : 0;
  // the ruler's NOW tick is a Sunrise mark (guide 3.5 job 6) while this week shows on the page on screen
  const now = useNowMark('pointer', usePageShown() && p.current);
  return (
    <div className="ph-first">
      <span className="ph-first-bar" role="img" aria-label={p.planned > 0 ? `${miShort(p.done)} of ${miShort(p.planned)} miles this week` : `${miShort(p.done)} miles this week`}>
        <i style={{ transform: `scaleX(${share})` }} />
        {p.current ? <b className="ph-first-now" data-now={now === 'ink' ? 'ink' : undefined} style={{ '--at': share } as React.CSSProperties} /> : null}
      </span>
      <span className="ph-first-ends" aria-hidden="true">
        <span>0</span>
        <span>{p.planned > 0 ? `${miShort(p.planned)} mi` : ''}</span>
      </span>
      <p className="ph-first-line">Your weeks draw here as you go.</p>
    </div>
  );
};

/** The key under the chart; its "This week" swatch is the now dot's, a stamp-priority Sunrise mark. */
const Legend = () => {
  const now = useNowMark('stamp', usePageShown());
  return (
    <div className="ph-legend" aria-hidden="true">
      <span className="ph-key is-actual">Actual</span>
      <span className="ph-key is-plan">Plan</span>
      <span className="ph-key is-now" data-now={now === 'ink' ? 'ink' : undefined}>
        This week
      </span>
    </div>
  );
};

export const HeroChart = ({ log, t, onConnect, failed, onRetry }: { log: Log; t: string; onConnect: (() => void) | null; failed?: boolean; onRetry?: () => void }) => {
  const nav = useNav();
  const [mode, setMode] = useMode();
  const [scrub, setScrub] = useState<number | null>(null);
  const [opened, setOpened] = useState<number | null>(null);
  const openWeek = useOpenWeek(t);
  const run = useMemo(() => runWeeks(log.snap, t, (m) => log.snap.loaded(m)), [log.snap, t]);
  const lift = useMemo(() => liftWeeks(log.snap, t, (m) => log.snap.loaded(m)), [log.snap, t]);
  const weeks: Array<RunWeek | LiftWeek> = mode === 'run' ? run : lift;

  const change = (m: HeroMode) => {
    // a segmented change ticks once
    haptics.select();
    setScrub(null);
    setMode(m);
  };
  const seg = (
    <Segmented
      className="ph-seg"
      label="Running or strength"
      value={mode}
      onChange={change}
      options={[
        ['run', 'Running'],
        ['lift', 'Strength'],
      ]}
    />
  );

  const gaps = weeks.some((p) => p.missing);
  const any = weeks.some((p) => p.done > 0 || p.planned > 0);
  if (!any && !gaps) {
    const strava = STRAVA_BUILT && !!onConnect;
    return (
      <section className="card ph" aria-label={mode === 'run' ? 'Running' : 'Strength'}>
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

  const ci = weeks.findIndex((p) => p.current);
  const shownI = scrub ?? opened ?? ci;
  const sp = weeks[shownI] ?? weeks[weeks.length - 1]!;
  const line = weekLine(mode, sp);
  // a rate over weeks that did not load would be a rate over the wrong weeks: none until they are in
  const rate = gaps && failed ? null : completion(weeks);
  // a chart needs two weeks with something in them; before that the week's own bar stands in (and no legend for lines not drawn)
  const drawn = weeks.filter((p) => !p.missing && (p.planned > 0 || p.done > 0)).length;
  const firstWeek = mode === 'run' && !gaps && drawn < 2;
  const live = scrub != null || opened != null;
  const wr = weekRate(sp);
  const side = live ? (wr != null ? { value: pctText(wr), cap: 'Of plan' } : { value: null, cap: 'No plan' }) : rate ? { value: pctText(rate.rate), cap: `Last ${rate.weeks === 1 ? 'week' : `${rate.weeks} weeks`}` } : null;
  const what = mode === 'run' ? 'planned miles' : 'planned lift sessions';
  const eyebrow = `${weekTitle(sp.w, t)}${sp.current ? ' so far' : ''}`;

  const words = (i: number) => {
    const p = weeks[i]!;
    return `${weekTitle(p.w, t)}${p.current ? ' so far' : ''}: ${p.missing ? 'not loaded yet' : weekLine(mode, p).words}`;
  };
  const chartLabel = `${mode === 'run' ? 'Weekly miles' : 'Weekly lift sessions'}, planned and done, last ${HERO_WEEKS} weeks. ${ci >= 0 ? `${words(ci)}.` : ''} ${rate ? `Last ${rate.weeks} weeks: ${pctText(rate.rate)} of ${what} done.` : ''}`;
  const readWords = sp.missing ? `${eyebrow}: not loaded yet` : `${eyebrow}: ${line.words}${live ? (wr != null ? `, ${pctText(wr)} of plan` : ', nothing planned') : rate ? `. Last ${rate.weeks} weeks: ${pctText(rate.rate)} of ${what} done` : ''}`;

  const openAt = (i: number) => {
    const p = weeks[i];
    if (!p) return;
    // the headline names this week while its sheet is up
    setOpened(i);
    openWeek(p.w, 'open', () => setOpened(null));
  };

  return (
    <section className="card ph" aria-label={mode === 'run' ? 'Running' : 'Strength'}>
      {seg}
      <div className="ph-head">
        {/* the words VoiceOver hears when the week under the finger changes: a live region speaks its text, not its label */}
        <span className="sr-only" role="status">
          {readWords}
        </span>
        <div className="ph-main" aria-hidden="true">
          <span className="ph-eyebrow">{eyebrow}</span>
          {sp.missing ? (
            <span className="ph-big is-word">Reading your weeks</span>
          ) : (
            <span className="ph-big">
              <span className="tnum">{line.big}</span>
              <small>{line.of}</small>
            </span>
          )}
          <span className="ph-sub">{sp.missing ? 'This month is on its way' : line.sub}</span>
        </div>
        {side ? (
          <div className="ph-side" aria-hidden="true">
            <span className={`ph-rate ${side.value ? '' : 'is-none'}`}>{side.value ?? '–'}</span>
            <span className="ph-cap">{side.cap}</span>
          </div>
        ) : null}
      </div>
      {mode === 'run' && firstWeek ? (
        <FirstWeek p={sp as RunWeek} />
      ) : mode === 'run' ? (
        <>
          <PlanLine weeks={weeks} label={chartLabel} words={words} onScrub={setScrub} onOpen={openAt} />
          <Legend />
          {gaps && failed && onRetry ? (
            <div className="ph-retry" role="alert">
              <span>Some weeks didn’t load.</span>
              <Button variant="soft" size="sm" onClick={onRetry}>
                Try again
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <LiftList log={log} t={t} />
      )}
    </section>
  );
};
