import { clock, METERS_PER_MILE, mi, num } from './dates.js';
import { isFastRun, isHardRun, isRace } from './sessions.js';
import type { Activity, HrZone, Lap, Session } from './types.js';

export const zoneOf = (zones: HrZone[] | null | undefined, hr: number | null | undefined): number | null => {
  if (!zones || hr == null) return null;
  const hit = zones.find((z) => z.min <= hr && (z.max == null || hr <= z.max));
  return hit ? hit.zone : null;
};

const Z = (zones: HrZone[], n: number): Partial<HrZone> => zones.find((z) => z.zone === n) ?? {};

export type Verdict = 'On target' | 'Too easy' | 'Too hard' | 'Race' | 'Unplanned';
export interface Grade {
  target: string | null;
  verdict: Verdict | null;
}

/** One run against the session planned for it, from average and peak heart rate. */
export const grade = (zones: HrZone[] | null | undefined, sess: Pick<Session, 'type'> | null, hr: { avg: number | null; max: number | null } | null): Grade | null => {
  if (!zones || !hr || hr.avg == null) return null;
  if (!sess) return { verdict: 'Unplanned', target: null };
  const z3 = Z(zones, 3);
  const z4 = Z(zones, 4);
  const z2 = Z(zones, 2);
  const t = sess.type ?? '';
  if (isHardRun(t)) {
    const lo = z3.min ?? 0;
    const hi = z4.max ?? Infinity;
    return { target: `${lo}–${hi} avg`, verdict: hr.avg < lo ? 'Too easy' : hr.avg > hi ? 'Too hard' : 'On target' };
  }
  if (isFastRun(t)) {
    const lo = z4.min ?? 0;
    return { target: `peak ≥ ${lo}`, verdict: hr.max == null ? null : hr.max >= lo ? 'On target' : 'Too easy' };
  }
  if (isRace(t)) return { target: null, verdict: 'Race' };
  const cap = z2.max ?? Infinity;
  return { target: `avg ≤ ${cap}`, verdict: hr.avg <= cap ? 'On target' : 'Too hard' };
};

export type Distance = 'long' | 'full' | 'close' | 'short';
export type Effort = 'easy' | 'on' | 'hard';
export type AssessVerdict = 'on' | 'off' | 'short' | 'na';

export interface Assessment {
  miles: number;
  movingSec: number;
  pace: string | null;
  avgHr: number | null;
  maxHr: number | null;
  /** Full-mile laps only, used for pacing. */
  laps: Lap[];
  lines: string[];
  verdict: AssessVerdict;
  head: string;
  distance: Distance | null;
  effort: Effort | null;
}

export const paceOf = (movingSec: number, miles: number): string | null => (miles > 0.1 && movingSec ? clock(movingSec / miles) : null);

const fmtDiff = (s: number) => `${Math.round(Math.abs(s))} s/mi`;

/** Everything the app can say about a day's runs against what was planned, with no model involved. */
export const assess = (zones: HrZone[] | null | undefined, sess: Session | null, runs: Activity[]): Assessment => {
  const miles = runs.reduce((t, a) => t + a.miles, 0);
  const movingSec = runs.reduce((t, a) => t + a.movingSec, 0);
  const withHr = runs.filter((a) => a.avgHr != null && a.movingSec);
  const avgHr = withHr.length ? Math.round(withHr.reduce((t, a) => t + (a.avgHr as number) * a.movingSec, 0) / withHr.reduce((t, a) => t + a.movingSec, 0)) : null;
  const maxHr = runs.reduce<number | null>((m, a) => (a.maxHr != null && a.maxHr > (m ?? 0) ? a.maxHr : m), null);
  const laps = runs.flatMap((a) => a.laps ?? []).filter((l) => l[0] >= 0.9 * METERS_PER_MILE && l[1] > 0);
  const type = sess?.type ?? 'Unplanned';
  const lines: string[] = [];
  let distance: Distance | null = null;
  let effort: Effort | null = null;
  const planned = sess && Number(sess.miles) > 0 ? Number(sess.miles) : null;
  if (planned) {
    const pct = miles / planned;
    distance = pct >= 1.15 ? 'long' : pct >= 0.95 ? 'full' : pct >= 0.8 ? 'close' : 'short';
    lines.push(
      distance === 'full'
        ? `Full distance: ${mi(miles)} of ${num(planned)} mi.`
        : distance === 'long'
          ? `Went long: ${mi(miles)} mi against ${num(planned)} planned.`
          : `${distance === 'close' ? 'Close' : 'Short'}: ${mi(miles)} of ${num(planned)} mi (${Math.round(pct * 100)}%).`,
    );
  }
  if (zones && avgHr != null) {
    const za = zoneOf(zones, avgHr);
    const z2 = Z(zones, 2);
    const z3 = Z(zones, 3);
    const z4 = Z(zones, 4);
    if (isHardRun(type)) {
      const lo = z3.min ?? 0;
      const hi = z4.max ?? Infinity;
      const inZone = laps.filter((l) => l[2] != null && l[2] >= lo && l[2] <= hi).length;
      const lapNote = laps.length ? ` ${inZone} of ${laps.length} full miles reached Z3–Z4.` : '';
      if (avgHr < lo) {
        effort = 'easy';
        lines.push(`Too easy for threshold: averaged ${avgHr} bpm (Z${za}). Threshold work sits at ${lo}–${hi} bpm.${lapNote}`);
      } else if (avgHr > hi) {
        effort = 'hard';
        lines.push(`Harder than threshold: averaged ${avgHr} bpm (Z${za}).`);
      } else {
        effort = 'on';
        lines.push(`Threshold effort hit: averaged ${avgHr} bpm (Z${za}).${lapNote}`);
      }
    } else if (isFastRun(type)) {
      const lo = z4.min ?? 0;
      if (maxHr != null && maxHr >= lo) {
        effort = 'on';
        lines.push(`Reached the hard end: max ${maxHr} bpm (Z${zoneOf(zones, maxHr)}).`);
      } else {
        effort = 'easy';
        lines.push(`Never got above Z3 (max ${maxHr} bpm): the fast reps were likely too easy.`);
      }
    } else if (isRace(type)) {
      effort = 'on';
      lines.push(`Race effort: averaged ${avgHr}, max ${maxHr} bpm.`);
    } else {
      const cap = z2.max ?? Infinity;
      if (avgHr <= cap) {
        effort = 'on';
        lines.push(`${sess ? 'Easy effort held' : 'Easy effort'}: averaged ${avgHr} bpm (Z${za}), under the ${cap} ceiling.`);
      } else {
        effort = 'hard';
        lines.push(`Ran hot for an easy day: averaged ${avgHr} bpm (Z${za}). Keep easy runs under ${cap}.`);
      }
    }
  } else if (avgHr == null && runs.some((a) => a.perfAt)) {
    lines.push('No heart rate on this run, so effort can’t be checked.');
  }
  if (laps.length >= 3) {
    const p = laps.map((l) => l[1] / (l[0] / METERS_PER_MILE));
    const half = Math.floor(p.length / 2);
    const first = p.slice(0, half).reduce((t, x) => t + x, 0) / half;
    const second = p.slice(p.length - half).reduce((t, x) => t + x, 0) / half;
    const fast = clock(Math.min(...p));
    const slow = clock(Math.max(...p));
    if (first - second >= 5) lines.push(`Negative split: the second half was ${fmtDiff(first - second)} faster (${fast}–${slow}).`);
    else if (second - first >= 10) lines.push(`Faded: the second half was ${fmtDiff(second - first)} slower (${fast}–${slow}).`);
    else lines.push(`Even pacing: ${fast}–${slow} per mile.`);
    const hrs = laps.map((l) => l[2]).filter((x): x is number => x != null);
    if (hrs.length >= 4 && !isFastRun(type)) {
      const third = Math.max(1, Math.floor(hrs.length / 3));
      const drift = hrs.slice(-third).reduce((t, x) => t + x, 0) / third - hrs.slice(0, third).reduce((t, x) => t + x, 0) / third;
      if (drift >= 8 && Math.abs(first - second) < 10) lines.push(`Heart rate drifted up ${Math.round(drift)} bpm at a steady pace: heat, fatigue or fuel.`);
    }
  }
  const verdict: AssessVerdict = effort === 'easy' || effort === 'hard' ? 'off' : distance === 'short' ? 'short' : effort === 'on' || distance === 'full' || distance === 'long' ? 'on' : 'na';
  const words: string[] = [];
  if (distance === 'short') words.push('short');
  else if (distance === 'close') words.push('a little short');
  else if (distance === 'long') words.push('long');
  else if (distance === 'full') words.push('full distance');
  if (effort === 'easy') words.push('too easy');
  else if (effort === 'hard') words.push(isHardRun(type) ? 'too hard' : 'too hard for easy');
  else if (effort === 'on') words.push('effort on target');
  const joined = words.join(', ');
  const head = words.length ? joined.charAt(0).toUpperCase() + joined.slice(1) : sess ? 'Logged' : 'Unplanned run';
  return { miles, movingSec, pace: paceOf(movingSec, miles), avgHr, maxHr, laps, lines, verdict, head, distance, effort };
};

/** Estimated one-rep max (Epley). */
export const e1rm = (weight: number, reps: number): number => (reps <= 1 ? weight : weight * (1 + reps / 30));
