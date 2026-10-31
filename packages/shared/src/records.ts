import { clock, METERS_PER_MILE, mi } from './dates.js';
import type { Activity, Lap } from './types.js';

/**
 * A run's records: what it did better than every run before it (`best`), or than every run before it this year (`year`).
 * Four kinds, in the order they are told: the fastest mile split, the fastest average pace (runs of 3 miles or more), the
 * longest run, the most climbing. A record needs a history to beat: with fewer than three earlier runs nothing is one.
 */
export type RecordKind = 'mile' | 'pace' | 'longest' | 'climb';
export interface RunRecord {
  kind: RecordKind;
  scope: 'best' | 'year';
  /** `Fastest mile` */
  title: string;
  /** the record itself: `6:42 /mi`, `13.1 mi`, `840 ft` */
  value: string;
  /** what it beat: `12 sec faster than your best`, `1.4 mi longer than your longest this year` */
  detail: string;
  /** for a split record, which of the run's laps (index into `laps`) */
  lap: number | null;
}

const isMile = (l: Lap) => l[0] >= 0.95 * METERS_PER_MILE && l[0] <= 1.05 * METERS_PER_MILE && l[1] > 0;
const mileSec = (l: Lap) => l[1] / (l[0] / METERS_PER_MILE);

/** The fastest whole-mile split of a run, and which lap it was. */
export const bestMile = (a: Activity): { sec: number; lap: number } | null => {
  let best: { sec: number; lap: number } | null = null;
  (a.laps ?? []).forEach((l, i) => {
    if (!isMile(l)) return;
    const s = mileSec(l);
    if (!best || s < best.sec) best = { sec: s, lap: i };
  });
  return best;
};

const PACE_MIN_MI = 3;
const paceOf = (a: Activity) => (a.miles >= PACE_MIN_MI && a.movingSec > 0 ? a.movingSec / a.miles : null);
const before = (x: Activity, run: Activity) => x.date < run.date || (x.date === run.date && (x.time ?? '') < (run.time ?? '') && x.id !== run.id);

export const recordsFor = (run: Activity, history: readonly Activity[]): RunRecord[] => {
  if (run.kind !== 'run') return [];
  const prior = history.filter((x) => x.kind === 'run' && x.id !== run.id && before(x, run));
  if (prior.length < 3) return [];
  const year = run.date.slice(0, 4);
  const thisYear = prior.filter((x) => x.date.startsWith(year));
  const out: RunRecord[] = [];

  /** Beat everything (best), else everything this year (year): `lower` is better for times, higher for the rest. */
  const judge = (mine: number | null, of: (a: Activity) => number | null, lower: boolean) => {
    if (mine == null) return null;
    const vals = (xs: Activity[]) => xs.map(of).filter((v): v is number => v != null);
    const top = (vs: number[]) => (vs.length ? (lower ? Math.min(...vs) : Math.max(...vs)) : null);
    const beats = (t: number | null) => t != null && (lower ? mine < t : mine > t);
    const all = top(vals(prior));
    if (all == null) return null;
    if (beats(all)) return { scope: 'best' as const, prev: all };
    const yr = top(vals(thisYear));
    if (yr != null && beats(yr)) return { scope: 'year' as const, prev: yr };
    return null;
  };
  const where = (scope: 'best' | 'year') => (scope === 'best' ? 'your best' : `your best this year`);

  const m = bestMile(run);
  const jm = judge(m?.sec ?? null, (a) => bestMile(a)?.sec ?? null, true);
  if (m && jm) out.push({ kind: 'mile', scope: jm.scope, title: 'Fastest mile', value: `${clock(m.sec)} /mi`, detail: `${Math.round(jm.prev - m.sec)} sec faster than ${where(jm.scope)}`, lap: m.lap });

  const p = paceOf(run);
  const jp = judge(p, paceOf, true);
  if (p != null && jp) out.push({ kind: 'pace', scope: jp.scope, title: 'Fastest pace', value: `${clock(p)} /mi`, detail: `${Math.round(jp.prev - p)} sec a mile faster than ${where(jp.scope)} over ${PACE_MIN_MI}+ mi`, lap: null });

  const jl = run.miles >= 3 ? judge(run.miles, (a) => a.miles, false) : null;
  if (jl) out.push({ kind: 'longest', scope: jl.scope, title: 'Longest run', value: `${mi(run.miles)} mi`, detail: `${mi(run.miles - jl.prev)} mi longer than ${jl.scope === 'best' ? 'your longest' : 'your longest this year'}`, lap: null });

  const jc = run.elevFt >= 100 ? judge(run.elevFt, (a) => a.elevFt, false) : null;
  if (jc) out.push({ kind: 'climb', scope: jc.scope, title: 'Most climbing', value: `${Math.round(run.elevFt)} ft`, detail: `${Math.round(run.elevFt - jc.prev)} ft more than ${jc.scope === 'best' ? 'your most' : 'your most this year'}`, lap: null });

  return out;
};

/** The record as a headline: `Your fastest mile yet!`, `Your longest run in 2026!` */
export const recordHeadline = (r: RunRecord, date: string): string => {
  const what = r.title.charAt(0).toLowerCase() + r.title.slice(1);
  const name = r.kind === 'climb' ? 'most climbing' : what;
  return r.scope === 'best' ? `Your ${name} yet!` : `Your ${name} in ${date.slice(0, 4)}!`;
};
