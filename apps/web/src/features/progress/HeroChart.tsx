import { useMemo, useState } from 'react';
import { useNav } from '@/app/NavController';
import { haptics } from '@/lib/haptics';
import { EmptyState, Segmented } from '@/ui';
import type { Log } from '../log/useLog';
import { plural, weekTitle } from './data';
import { completion, HERO_MODES, HERO_WEEKS, lbShort, liftWeeks, miShort, runWeeks, weekRate, type HeroMode, type LiftWeek, type RunWeek } from './hero';
import { PlanBars } from './PlanBars';
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
 * The hero: one card, one switch. Running draws weekly miles planned against run; Strength draws weekly lift sessions
 * planned against done, with the week's sets and volume in words. The headline is this week at rest and the week under the
 * finger while scrubbing; the number at the right is how much of the plan got done over the last four finished weeks (that
 * week's share while scrubbing). A tap on a week opens its sheet.
 */
export const HeroChart = ({ log, t, onConnect }: { log: Log; t: string; onConnect: () => void }) => {
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
      label="Chart"
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
    const strava = log.features.strava && !log.strava?.connected;
    return (
      <section className="card ph" aria-label={mode === 'run' ? 'Running' : 'Strength'}>
        {seg}
        <EmptyState
          className="ph-empty"
          ghost="bars"
          verb={mode === 'run' && strava ? { label: 'Connect Strava', onPress: onConnect } : { label: 'Plan a week', onPress: () => nav.go('/plan'), primary: true }}
        >
          {mode === 'run' ? 'Plan a week and run it. Planned and done miles show up here.' : 'No lifts yet. Plan a lift day or log a set, and it shows up here.'}
        </EmptyState>
      </section>
    );
  }

  const ci = weeks.findIndex((p) => p.current);
  const shownI = scrub ?? opened ?? ci;
  const sp = weeks[shownI] ?? weeks[weeks.length - 1]!;
  const line = weekLine(mode, sp);
  const rate = completion(weeks);
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
      <div className="ph-head" role="status" aria-label={readWords}>
        <div className="ph-main" aria-hidden="true">
          <span className="ph-eyebrow">{eyebrow}</span>
          {sp.missing ? (
            <span className="ph-big is-word">Loading</span>
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
      <PlanBars key={mode} mode={mode} weeks={weeks} count={mode === 'lift'} label={chartLabel} words={words} onScrub={setScrub} onOpen={openAt} />
      <div className="ph-legend" aria-hidden="true">
        <span className="ph-key is-done">Done</span>
        <span className="ph-key is-plan">Planned</span>
        <span className="ph-key is-now">This week</span>
      </div>
    </section>
  );
};
