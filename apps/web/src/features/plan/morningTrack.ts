import { durationWords, shiftDays, type MorningTimeline, type Tone } from '@logbook/shared';
import { doorOf, inWords, morningPhase, rowsOf, short } from '../morning/model';

/**
 * Plan's morning card, its pure part: which morning it shows, the stops on its track and where they sit, the one big line
 * and the quiet line under the track. The words come from the morning model (`morningPhase`, the rule under the Now card's
 * line), so Plan, Today's hero and This morning never disagree about where the morning is.
 */

/** Today's morning until its leave time has passed, then tomorrow's. */
export const whichMorning = (today: string, now: number, leaveToday: number | null): { date: string; rel: 'today' | 'tomorrow' } =>
  leaveToday != null && now >= leaveToday ? { date: shiftDays(today, 1), rel: 'tomorrow' } : { date: today, rel: 'today' };

export interface CardStop {
  key: 'wake' | 'door' | 'back' | 'leave';
  /** The caps label over the dot ("Run out"), and the one a 320 card uses ("Out"). */
  label: string;
  short: string;
  at: number;
}

/** The stops in order: Wake · Run out · Back · Leave (a gym morning goes out to the gym), or Wake · Leave on a rest morning. */
export const cardStops = (T: MorningTimeline): CardStop[] => {
  const door = doorOf(T);
  const out = T.day.mode === 'gym' ? 'Gym' : 'Run out';
  return [
    { key: 'wake', label: 'Wake', short: 'Wake', at: T.day.wake },
    ...(door != null
      ? [
          { key: 'door' as const, label: out, short: 'Out', at: door },
          { key: 'back' as const, label: 'Back', short: 'Back', at: T.back },
        ]
      : []),
    { key: 'leave', label: 'Leave', short: 'Leave', at: T.leave },
  ];
};

/**
 * Where each stop sits on the track, 0..1: in proportion to its time, but never closer to the one before than `gaps[i]`
 * (the stretch before stop i+1) so the caps labels and the stamps never touch, and the run's stretch keeps room for its
 * name. The first stop is at 0 and the last at 1; when the minimums cannot all fit, the stops are evenly spaced.
 */
export const trackOf = (ats: number[], gaps: number[]): number[] => {
  const n = ats.length - 1;
  if (n <= 0) return ats.map(() => 0);
  const need = (i: number) => gaps[i] ?? 0;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += need(i);
  if (sum > 1) return ats.map((_, i) => Math.round((i / n) * 1e4) / 1e4);
  const span = ats[n]! - ats[0]!;
  const p = ats.map((a) => (span > 0 ? (a - ats[0]!) / span : 0));
  p[0] = 0;
  p[n] = 1;
  // forward: each at least its gap after the one before; backward: each at least the gap before the one after
  for (let i = 1; i <= n; i++) p[i] = Math.max(p[i]!, p[i - 1]! + need(i - 1));
  p[n] = 1;
  for (let i = n - 1; i >= 0; i--) p[i] = Math.min(p[i]!, p[i + 1]! - need(i));
  p[0] = 0;
  return p.map((x) => Math.round(x * 1e4) / 1e4);
};

/**
 * The narrowest line (px between the edge dots' centres) that still shows `RUN OUT` and the times with AM/PM: below the
 * first the labels shorten (`OUT`) and the stamps step to 15; from the second the meridiem shows. morningcard.css's
 * container queries are these plus the dots' 12 px.
 */
export const LINE_LONG = 288;
export const LINE_AMPM = 388;

/**
 * The minimum stretches of a card's track, as fractions of a line `width` px wide: the run's (door → back) wide enough for
 * the pill with its name between two dots; the first and the last for the edge stop's label and stamp (which run inward
 * from the edge) and half its neighbour's. A two-stop line has no minimum.
 */
export const gapsOf = (stops: CardStop[], width: number): number[] => {
  if (stops.length <= 2) return stops.slice(1).map(() => 0);
  const edge = width >= LINE_AMPM ? 104 : width >= LINE_LONG ? 74 : 62;
  return stops.slice(1).map((s, i) => (stops[i]!.key === 'door' && s.key === 'back' ? 108 : edge) / Math.max(1, width));
};

/** Where `now` sits on the track: between the two stops it falls between, in proportion to the time; null outside the morning. */
export const nowOnTrack = (stops: CardStop[], pos: number[], now: number): number | null => {
  if (stops.length < 2 || now < stops[0]!.at || now > stops[stops.length - 1]!.at) return null;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]!.at;
    const b = stops[i + 1]!.at;
    if (now <= b) return pos[i]! + (b > a ? (now - a) / (b - a) : 1) * (pos[i + 1]! - pos[i]!);
  }
  return 1;
};

/**
 * The one big line: on today, where the morning is (`morningPhase`): `Wake time in 43 min`, `Out the door in 22 min`, `Back by
 * 7:40`, `Leave for work in 25 min`, `Left at 8:30`. Tomorrow's says when it starts: `Out the door at 6:45` on a run or gym
 * morning, `Leave for work at 8:30` on a rest morning.
 */
export const headline = (T: MorningTimeline, now: number, rel: 'today' | 'tomorrow'): string => {
  if (rel === 'tomorrow') {
    const door = doorOf(T);
    return door != null ? `Out the door at ${short(door)}` : `Leave for work at ${short(T.leave)}`;
  }
  const p = morningPhase(T, now);
  if (p.k === 'alarm') return `Wake time in ${inWords(p.at, now)}`;
  if (p.k === 'door') return `Out the door in ${inWords(p.at, now)}`;
  if (p.k === 'out') return `Back by ${short(p.at)}`;
  if (p.k === 'left') return `Left at ${short(p.at)}`;
  return `Leave for work in ${inWords(T.leave, now)}`;
};

/** The workout on the track: its name (`Easy 5`, `Strength`) and tone; a rest morning's is `Rest morning`. */
export const workOf = (T: MorningTimeline): { name: string; tone: Tone } => {
  if (T.day.mode === 'rest') return { name: 'Rest morning', tone: 'rest' };
  const b = T.blocks.find((x) => x.key === 'run' || x.key === 'gym');
  const name = T.day.plan.label.split(' · ')[0] || (T.day.mode === 'run' ? `${T.day.type} ${T.day.miles}` : T.day.type);
  return { name, tone: b?.tone ?? (T.day.mode === 'gym' ? 'lift' : 'easy') };
};

/** `6 steps · 1 h 55 min from waking to the door`: the schedule's rows (the wake time, the workout, the routine; not Free or a note). */
export const quietLine = (T: MorningTimeline): string => {
  const steps = rowsOf(T, 'today').filter((r) => r.kind !== 'free' && r.kind !== 'late').length;
  return `${steps} ${steps === 1 ? 'step' : 'steps'} · ${durationWords(T.leave - T.day.wake)} from waking to the door`;
};
