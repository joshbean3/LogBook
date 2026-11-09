import type { ISODate, Session } from '@logbook/shared';
import { useSyncExternalStore } from 'react';
import { shortClock } from './dayWords';
import type { Face } from './faces';
import type { Stop } from './MiniTimeline';

/**
 * When the day's training happens: before work (the morning timeline Logbook already plans), after work (an afternoon
 * timeline built the same way), or no set time. Chosen per day on Today's hero, with a default for days not chosen.
 * Kept on this device (localStorage), like the rest of the hero's view preferences.
 */
export type TrainWhen = 'morning' | 'afternoon' | 'none';

export interface AfternoonSettings {
  /** Minutes after midnight work ends. */
  offWork: number;
  /** Minutes from work to the door at home (0 for a run from the office). */
  commute: number;
  /** Changing before the run. */
  change: number;
  /** After the run until dinner: shower, stretch. */
  after: number;
}
export const DEFAULT_AFTERNOON: AfternoonSettings = { offWork: 17 * 60 + 30, commute: 30, change: 10, after: 30 };

const DAYS_KEY = 'logbook.trainWhen.days';
const DEFAULT_KEY = 'logbook.trainWhen.default';
const PM_KEY = 'logbook.afternoon';

const read = <T>(k: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(k);
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* private mode: lasts for the session */
  }
};

interface State {
  days: Record<string, TrainWhen>;
  fallback: TrainWhen;
  pm: AfternoonSettings;
}
let state: State = {
  days: read<Record<string, TrainWhen>>(DAYS_KEY, {}),
  fallback: (() => {
    try {
      const v = localStorage.getItem(DEFAULT_KEY);
      return v === 'afternoon' || v === 'none' ? v : 'morning';
    } catch {
      return 'morning';
    }
  })(),
  pm: read(PM_KEY, DEFAULT_AFTERNOON),
};
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};

/** The choice for a day: its own, else the default. */
export const trainWhenOf = (date: ISODate, s: State = state): TrainWhen => s.days[date] ?? s.fallback;

/** Choose for one day (60 days of choices are kept; older ones fall away). */
export const setTrainWhen = (date: ISODate, when: TrainWhen) => {
  const keep = Object.entries({ ...state.days, [date]: when })
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, 60);
  state = { ...state, days: Object.fromEntries(keep) };
  write(DAYS_KEY, state.days);
  emit();
};
export const setTrainWhenDefault = (when: TrainWhen) => {
  state = { ...state, fallback: when };
  try {
    localStorage.setItem(DEFAULT_KEY, when);
  } catch {
    /* session only */
  }
  emit();
};
export const setAfternoon = (patch: Partial<AfternoonSettings>) => {
  state = { ...state, pm: { ...state.pm, ...patch } };
  write(PM_KEY, state.pm);
  emit();
};

export const useTrainWhen = (date: ISODate): TrainWhen => useSyncExternalStore(subscribe, () => trainWhenOf(date), () => 'morning');
export const useTrainWhenDefault = (): TrainWhen => useSyncExternalStore(subscribe, () => state.fallback, () => 'morning');
export const useAfternoon = (): AfternoonSettings => useSyncExternalStore(subscribe, () => state.pm, () => DEFAULT_AFTERNOON);

/** How long the session takes: its minutes, else its miles at the easy pace (seconds a mile), else 45. */
export const sessionMinutes = (s: Pick<Session, 'miles' | 'minutes'> | null | undefined, pace: number | null | undefined) => {
  if (s?.minutes) return s.minutes;
  if (s?.miles) return Math.round((s.miles * (pace || 540)) / 60);
  return 45;
};

/** Off work · Run · Back · Dinner, the afternoon's four stops, built the way the morning's are (door from the routine before it, back from the run's length). */
export const afternoonStops = (pm: AfternoonSettings, runMin: number): Stop[] => {
  const run = pm.offWork + pm.commute + pm.change;
  const back = run + runMin;
  return [
    { key: 'off', label: 'Off work', at: pm.offWork },
    { key: 'run', label: 'Run', at: run },
    { key: 'back', label: 'Back', at: back },
    { key: 'dinner', label: 'Dinner', at: back + pm.after },
  ];
};

/**
 * The hero's face for the chosen time. Morning: as Logbook plans it. Afternoon: the afternoon's stops in place of the
 * morning's, and words to match. No set time: no line at all. Only a training day changes; a rest day keeps its morning.
 */
export const faceForWhen = (face: Face, when: TrainWhen, pm: AfternoonSettings, pace: number | null | undefined): Face => {
  if (when === 'morning' || !face.lead || face.lead.session.kind === 'rest' || face.tall) return face;
  const wasMorning = face.kind === 'morning';
  // the line that names the morning's door says when instead
  const doorLine = wasMorning || /^Out the door/.test(face.line ?? '');
  if (when === 'none') return { ...face, stops: undefined, stopsLabel: undefined, eyebrow: wasMorning ? 'TODAY' : face.eyebrow, line: doorLine ? (wasMorning ? 'Any time today' : 'Any time that day') : face.line };
  const stops = afternoonStops(pm, sessionMinutes(face.lead.session, pace));
  return {
    ...face,
    stops,
    stopsKind: 'afternoon',
    stopsLabel: `This afternoon: ${stops.map((s) => `${s.label.toLowerCase()} ${shortClock(s.at)}`).join(', ')}. Change the afternoon`,
    eyebrow: wasMorning ? 'TODAY' : face.eyebrow,
    line: doorLine ? `Run at ${shortClock(stops[1]!.at)}` : face.line,
  };
};
