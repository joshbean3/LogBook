import { counts, EVENING_START, type DayPhase, type ISODate, type Session } from '@logbook/shared';
import { useSyncExternalStore } from 'react';
import type { Log } from '../log/useLog';
import { shortClock } from './dayWords';
import { faceOf, heroLead, phaseOf, type Face } from './faces';
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

/** The session's own word for its start (today-top-06): a run is a Run, a lift a Lift, anything else a Start. */
export type SessionKind = Session['kind'];
export const startWord = (kind: SessionKind | null | undefined) => (kind === 'lift' ? 'Lift' : kind === 'run' || !kind ? 'Run' : 'Start');

/** Off work · Run · Back · Dinner, the afternoon's four stops, built the way the morning's are (door from the routine before it, back from the session's length). The second stop is named for the session (`Lift` on a strength day). */
export const afternoonStops = (pm: AfternoonSettings, runMin: number, kind?: SessionKind | null): Stop[] => {
  const run = pm.offWork + pm.commute + pm.change;
  const back = run + runMin;
  return [
    { key: 'off', label: 'Off work', at: pm.offWork },
    { key: 'run', label: startWord(kind), at: run },
    { key: 'back', label: 'Back', at: back },
    { key: 'dinner', label: 'Dinner', at: back + pm.after },
  ];
};

/**
 * The day's phase for the chosen time (today-top-02). The shared phase (`dayPhase`) knows one timeline, the morning's: it
 * says `morning` until the morning's door and `out` until its back time, whenever the session is really planned. This wraps
 * it for a session still open today (another day, a rest day and a session already done keep the shared phase):
 *
 * - Morning: the shared phase, untouched.
 * - Afternoon: the phases come from the afternoon's stops (Off work · Run · Back · Dinner). `morning` reads "before the
 *   session" (until Run), `out` runs from Run to Back, then `day` (the open face, with its ring) and the evening's Close card
 *   only once Dinner has passed (never before 18:00). So the card never says OUT at 7:10 and never closes the day five
 *   minutes before the run.
 * - No set time: no door and no back at all: `day` (the open face) until 18:00, then the Close card, which keeps the
 *   session's row and ring at its top.
 *
 * The morning's door and back are dropped from the result, so nothing downstream can count down to a door nobody is going
 * through. A mark (done, floor, skip) ends all of this at once: the shared phase answers for a settled day.
 */
export const phaseForWhen = (ph: DayPhase, when: TrainWhen, pm: AfternoonSettings, pace: number | null | undefined): DayPhase => {
  if (when === 'morning' || ph.phase === 'past' || ph.phase === 'future') return ph;
  // a cross day has no morning line to move (the shared phase plans run and gym mornings only): the switch is not offered
  const lead = heroLead(ph) ?? ph.primary;
  if (lead?.session.kind === 'cross') return ph;
  const open = ph.training.length > 0 && !(ph.primary && counts(ph.primary.status));
  if (!open) return ph;
  const { doorAt: _door, backBy: _back, doorIn: _in, outProgress: _out, ...base } = ph;
  const evening = ph.now >= EVENING_START;
  if (when === 'none') return { ...base, phase: evening ? 'evening' : 'day' };
  const [, run, back, dinner] = afternoonStops(pm, sessionMinutes(lead?.session, pace));
  // the morning's Leave is not this timeline's: the out face has no "Leave 8:30" under an evening run
  const pmBase = { ...base, wakeAt: undefined, leaveAt: undefined, doorAt: run!.at, backBy: back!.at };
  if (ph.now < run!.at) return { ...pmBase, phase: 'morning', doorIn: Math.ceil(run!.at - ph.now - 1e-9) };
  if (ph.now < back!.at) return { ...pmBase, phase: 'out', outProgress: back!.at > run!.at ? (ph.now - run!.at) / (back!.at - run!.at) : 1 };
  return { ...base, phase: evening && ph.now >= dinner!.at ? 'evening' : 'day' };
};

/**
 * The hero's face for the chosen time, from the face of the phase above. Morning: as Logbook plans it. Afternoon: before the
 * session, the afternoon's stops in place of the morning's and words to match (`later`); out and after it, the faces as
 * they are. No set time: no line at all, and the open face says so. Only a session still to come changes: a rest day keeps
 * its morning, and a session that is done, skipped or missed keeps its own face.
 */
export const faceForWhen = (face: Face, when: TrainWhen, pm: AfternoonSettings, pace: number | null | undefined): Face => {
  if (when === 'morning' || !face.lead || face.lead.session.kind === 'rest' || face.lead.session.kind === 'cross' || face.tall) return face;
  if (face.kind !== 'morning' && face.kind !== 'planned' && face.kind !== 'open') return face;
  const wasMorning = face.kind === 'morning';
  // the line that names the morning's door says when instead
  const doorLine = wasMorning || /^Out the door/.test(face.line ?? '');
  if (when === 'none') {
    if (face.kind === 'open') return { ...face, status: 'Any time today' };
    return { ...face, stops: undefined, stopsLabel: undefined, eyebrow: wasMorning ? 'TODAY' : face.eyebrow, line: doorLine ? (wasMorning ? 'Any time today' : 'Any time that day') : face.line };
  }
  // after the afternoon's session time the open face stands as it is: the ring, "Not logged yet"
  if (face.kind === 'open') return face;
  const kind = face.lead.session.kind;
  const stops = afternoonStops(pm, sessionMinutes(face.lead.session, pace), kind);
  return {
    ...face,
    ...(wasMorning ? { kind: 'later' as const, key: `later-${face.lead.session.id}` } : null),
    stops,
    stopsKind: 'afternoon',
    stopsLabel: `This afternoon: ${stops.map((s) => `${s.label.toLowerCase()} ${shortClock(s.at)}`).join(', ')}. Change the afternoon`,
    eyebrow: wasMorning ? 'TODAY' : face.eyebrow,
    line: doorLine ? `${startWord(kind)} at ${shortClock(stops[1]!.at)}` : face.line,
  };
};

/** The phase and the face the hero draws for a day at a minute, with the chosen training time fed into both. */
export const whenFace = (log: Log, date: ISODate, minutes: number, when: TrainWhen, pm: AfternoonSettings): { ph: DayPhase; face: Face } => {
  const pace = log.boot?.morningSettings?.run.pace;
  const ph = phaseForWhen(phaseOf(log, date, minutes), when, pm, pace);
  return { ph, face: faceForWhen(faceOf(log, date, ph), when, pm, pace) };
};
