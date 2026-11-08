import { fmtDate, isSkipMark, label, mondayOf, num, sessionKey, shiftDays, tone, weekSummary, weekTotals, type Session } from '@logbook/shared';
import { Footprints } from 'lucide-react';
import type * as React from 'react';
import type { Log } from '../log/useLog';
import { weekMiles } from '../sessions/miles';
import type { BlockCardData } from './Blocks';
import { mileageHead } from './context';
import { PHASE_WORDS, type TrainingPhase } from './phases';
import './weekline.css';

const tenth = (v: number) => num(Math.round(v * 10) / 10);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const nameOf = (s: Session) => (s.kind === 'rest' ? 'Rest' : label(s));
const isTraining = (s: Session) => s.kind !== 'rest';

/**
 * The week's line ("26 mi · 5 runs") and the sentence under it, said forward: what is next, never a zero (docs/feel.md
 * §7.1). `ran` is the miles run so far; the bar under the line exists only once a mile is run.
 */
export const weekWords = (log: Log, mon: string) => {
  const t = log.today;
  // miles run count a run marked Done without Strava at its planned miles (contract 5), as Progress and Share do
  const w0 = weekSummary(log.snap, mon);
  const w = { ...w0, doneMiles: weekMiles(log.snap, mon, t).miles };
  const sun = shiftDays(mon, 6);
  const days = Array.from({ length: 7 }, (_, i) => shiftDays(mon, i));
  const training = days.flatMap((d) => log.snap.sessionsOn(d).filter(isTraining).map((s) => [d, s] as const));
  const live = training.filter(([d, s]) => {
    const k = sessionKey(log.snap, d, s);
    return k === 'today' || k === 'planned';
  });
  const next = live.find(([d]) => d >= t) ?? null;
  const when = (d: string) => (d === t ? 'today' : d === shiftDays(t, 1) ? 'tomorrow' : fmtDate('dowLong', d));
  const runsWord = plural(w.runsPlanned, 'run');
  let head: string;
  if (w.plannedMiles > 0) head = `${tenth(w.plannedMiles)} mi · ${runsWord}`;
  else if (training.length) head = `${plural(training.length, 'session')}`;
  else if (w.doneMiles > 0) head = `${tenth(w.doneMiles)} mi run`;
  else head = sun < t ? 'A quiet week' : 'An open week';
  let sub: string;
  if (sun < t) {
    // a past week: what happened, against what was planned
    sub = w.plannedMiles > 0 && w.doneMiles === 0 ? `${w.keptSessions ? `${w.keptSessions} of ${plural(training.length, 'session')} kept` : 'None of it run'}.${w.kept ? ' Kept.' : ''}` : w.plannedMiles > 0 ? `${tenth(w.doneMiles)} of ${tenth(w.plannedMiles)} mi run${w.runsPlanned ? ` · ${w.runsDone} of ${runsWord}` : ''}.${w.kept ? ' Kept.' : ''}` : w.kept ? 'Kept.' : training.length ? `${w.keptSessions} of ${plural(training.length, 'session')} kept.` : 'Nothing was planned.';
  } else if (mon > t) {
    const first = live[0];
    const long = training.filter(([, s]) => tone(s) === 'long').sort((a, b) => (Number(b[1].miles) || 0) - (Number(a[1].miles) || 0))[0];
    sub = first ? `Opens with ${nameOf(first[1])}, ${fmtDate('dowLong', first[0])}.${long && long !== first ? ` Long run ${fmtDate('dowLong', long[0])}.` : ''}` : 'Tap a day to add a session, or start a block below.';
  } else if (!training.length && w.doneMiles === 0) {
    sub = 'Tap a day to add a session, or start a block below.';
  } else if (w.doneMiles === 0 && !w.keptSessions) {
    // early in the week: say what's next, never "0 of 26"; "First run today" only when no run was planned before today
    sub = next ? (next[0] === t && next[1].kind === 'run' && !training.some(([d, s]) => d < t && s.kind === 'run' && !isSkipMark(s.mark)) ? 'First run today.' : `Next: ${nameOf(next[1])}, ${when(next[0])}.`) : 'Nothing left this week.';
  } else {
    const done = w.plannedMiles > 0 ? `${tenth(w.doneMiles)} of ${tenth(w.plannedMiles)} mi` : w.doneMiles > 0 ? `${tenth(w.doneMiles)} mi run` : `${w.keptSessions} kept`;
    sub = next ? `${done}. Next: ${nameOf(next[1])}, ${when(next[0])}.` : w.kept ? `${done}. Week kept.` : `${done}.`;
  }
  const progress = w.plannedMiles > 0 ? Math.min(1, w.doneMiles / w.plannedMiles) : w.doneMiles > 0 ? 1 : 0;
  return { head, sub, progress, ran: w.doneMiles, summary: w };
};


/**
 * The weeks the mileage bars show for a week page: the block's weeks when the page is inside the block (at most 12, the
 * page among them), else the six weeks before the page, the page and the week after.
 */
export const barWeeks = (d: BlockCardData, mon: string): string[] => {
  const b = d.b;
  if (b && shiftDays(mon, 6) >= b.start && mon <= b.end && d.arc.length) {
    const all = d.arc.map((w) => w.mon);
    if (all.length <= 12) return all;
    const i = Math.max(0, all.indexOf(mon));
    const from = Math.min(Math.max(0, i - 8), all.length - 12);
    return all.slice(from, from + 12);
  }
  return Array.from({ length: 8 }, (_, i) => shiftDays(mon, (i - 6) * 7));
};

export interface BarWeek {
  mon: string;
  planned: number;
  ran: number;
  /** Ran at least what was planned. */
  hit: boolean;
  phase: TrainingPhase | null;
}
/** Planned and run miles per week, counted as the week line counts them (`weekTotals`, `weekMiles`). */
export const barData = (log: Log, weeks: string[], phases: BlockCardData['phases']): BarWeek[] =>
  weeks.map((mon) => {
    const ok = log.loaded(mon) && log.loaded(shiftDays(mon, 6));
    const planned = ok ? Math.round(weekTotals(log.snap, mon).planned * 100) / 100 : 0;
    const ran = ok && mon <= log.today ? weekMiles(log.snap, mon, log.today).miles : 0;
    return { mon, planned, ran, hit: planned > 0 && ran >= planned - 0.05, phase: phases[mon]?.phase ?? null };
  });

/**
 * The weekly mileage bars (docs/inspiration.md §6 Plan, refs 386, 714): a bar per week, miles run filled (the page's week
 * in orange, the newest point), each week's planned miles as a dotted cap (together a stepped dotted target line), a small
 * lit dot over a week that ran its target, the page's week lit behind; under them the block's phases as a band, then the
 * first and last week's dates.
 */
const MileBars = ({ data, mon, today }: { data: BarWeek[]; mon: string; today: string }) => {
  const max = Math.max(1, ...data.map((w) => Math.max(w.planned, w.ran)));
  const cur = data.find((w) => w.mon === mon);
  const hits = data.filter((w) => w.hit).length;
  const runs: Array<{ phase: TrainingPhase; n: number }> = [];
  for (const w of data) {
    if (!w.phase) continue;
    const last = runs[runs.length - 1];
    if (last && last.phase === w.phase) last.n++;
    else runs.push({ phase: w.phase, n: 1 });
  }
  const banded = data.every((w) => w.phase);
  const said = `Weekly miles, ${data.length} weeks.${cur ? ` This week ${tenth(cur.ran)} of ${tenth(cur.planned)} planned.` : ''} ${hits === 1 ? '1 week' : `${hits} weeks`} ran the target.`;
  return (
    <div className="pl-mb" style={{ '--n': data.length } as React.CSSProperties} role="img" aria-label={said}>
      <div className="pl-mb-plot">
        <span className="pl-mb-max tnum">{tenth(max)}</span>
        {data.map((w) => (
          <span key={w.mon} className={`pl-mb-wk ${w.mon === mon ? 'is-now' : ''} ${w.mon > today ? 'is-ahead' : ''} ${w.hit ? 'is-hit' : ''}`} style={{ '--p': w.planned / max, '--d': Math.min(w.ran, max) / max } as React.CSSProperties}>
            {w.planned > 0 ? <i className="pl-mb-plan" /> : null}
            {w.ran > 0 ? <i className="pl-mb-ran" /> : null}
            {w.planned > 0 ? <i className="pl-mb-target" /> : null}
            {w.hit ? <i className="pl-mb-hit" /> : null}
          </span>
        ))}
      </div>
      {banded && runs.length ? (
        <div className="pl-mb-band" aria-hidden="true">
          {runs.map((r, i) => (
            <span key={i} className={`pl-ph ph-${r.phase}`} style={{ gridColumn: `span ${r.n}` }}>
              <span>{r.phase === 'race' ? 'Race' : PHASE_WORDS[r.phase]}</span>
            </span>
          ))}
        </div>
      ) : null}
      <div className="pl-mb-axis" aria-hidden="true">
        <span>{fmtDate('md', data[0]!.mon)}</span>
        <span>{fmtDate('md', data[data.length - 1]!.mon)}</span>
      </div>
    </div>
  );
};

/**
 * The week's mileage in one card (docs/shape-system.md §2, §3): the label, the big stamped number with its small grey unit
 * (`10.5 of 26 mi`; a week ahead says what it plans), the runs as a status word at the right; the bars with their target and
 * the phase band; the legend; then under a hairline the sentence, said forward (what is next, never a zero).
 */
export const MileageCard = ({ log, mon, block, weeks }: { log: Log; mon: string; block: BlockCardData; weeks: string[] }) => {
  const w = weekWords(log, mon);
  const s = w.summary;
  const bars = barData(log, weeks, block.phases);
  const { value, unit, runsWord, hit } = mileageHead({ ran: w.ran, planned: s.plannedMiles, runsDone: s.runsDone, runsPlanned: s.runsPlanned, ahead: mon > log.today });
  return (
    <div className="card pl-mcard">
      <div className="pl-mc-head">
        <span className="pl-mc-top">
          <span className="tile-label">
            <Footprints size={16} aria-hidden="true" />
            Miles
          </span>
          {runsWord ? <span className={`tile-status ${hit ? 'is-hi' : 'is-none'}`}>{runsWord}</span> : null}
        </span>
        <span className="tile-value pl-mc-value">
          {value}
          <small>{unit}</small>
        </span>
      </div>
      <MileBars data={bars} mon={mon} today={log.today} />
      <div className="pl-mb-key" aria-hidden="true">
        <span>
          <i className="k-ran" />
          Run
        </span>
        <span>
          <i className="k-now" />
          This week
        </span>
        <span>
          <i className="k-plan" />
          Target
        </span>
      </div>
      <p className="pl-mc-foot">{w.sub}</p>
    </div>
  );
};
