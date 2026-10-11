import { num } from './dates.js';
import type { Session, SessionKind, Tone } from './types.js';

export const KINDS: readonly SessionKind[] = ['run', 'lift', 'cross', 'rest'];

export const TYPES: Record<SessionKind, readonly string[]> = {
  run: ['Easy', 'Recovery', 'Long', 'Threshold', 'Tempo', 'Speed', 'Intervals', 'Hills', 'Fartlek', 'Race', 'Run'],
  lift: ['Strength', 'Upper', 'Lower', 'Full body', 'Mobility'],
  cross: ['Cross', 'Bike', 'Swim', 'Hyrox', 'Yoga', 'Walk', 'Heat'],
  rest: ['Rest'],
};

export const KIND_WORD: Record<SessionKind, string> = { run: 'Run', lift: 'Lift', cross: 'Cross', rest: 'Rest' };

type ToneInput = Pick<Session, 'kind' | 'type'> | null | undefined;

/** Color family for a session. The family carries meaning: easy, long, hard, fast, lift, cross, rest. */
export const tone = (s: ToneInput): Tone => {
  if (!s) return 'rest';
  if (s.kind === 'lift') return 'lift';
  if (s.kind === 'cross') return 'cross';
  if (s.kind === 'rest') return 'rest';
  const t = (s.type ?? '').toLowerCase();
  if (/long/.test(t)) return 'long';
  if (/threshold|tempo|race/.test(t)) return 'hard';
  if (/speed|interval|hill|fartlek/.test(t)) return 'fast';
  return 'easy';
};

export const isHardRun = (type: string | null | undefined): boolean => /threshold|tempo/i.test(type ?? '');
export const isFastRun = (type: string | null | undefined): boolean => /speed|interval|hill|fartlek/i.test(type ?? '');
export const isRace = (type: string | null | undefined): boolean => /race/i.test(type ?? '');

const FLOORS: Array<[RegExp, string]> = [
  [/threshold|tempo/i, '20 min with the middle 10 steady'],
  [/speed|interval|hill|fartlek/i, '20 min easy + 4 × 20 s strides'],
  [/long/i, '30 min easy'],
  [/race/i, 'Show up and run it easy'],
];

/** The minimum that still counts on a bad day. */
export const floorFor = (s: Pick<Session, 'kind' | 'type'> | null | undefined): string => {
  if (!s) return '';
  if (s.kind === 'lift') return '2 lifts, 20 min';
  if (s.kind === 'cross') return '20 min of anything';
  if (s.kind === 'rest') return '';
  const hit = FLOORS.find(([re]) => re.test(s.type ?? ''));
  return hit ? hit[1] : '20 min easy';
};

/** Short label: the title if there is one, else type + miles. */
export const label = (s: Pick<Session, 'kind' | 'type' | 'title' | 'miles'> | null | undefined): string => {
  if (!s) return '';
  if (s.title) return s.title;
  const base = s.type || KIND_WORD[s.kind];
  return s.kind === 'run' && s.miles ? `${base} ${num(s.miles)}` : base;
};

export const STATUS_WORD: Record<string, string> = {
  done: 'Done',
  floor: 'Floor',
  missed: 'Missed',
  open: 'To do',
  upcoming: 'Planned',
  rest: 'Rest',
  skipped: 'Skipped',
  bonus: 'Bonus',
  empty: '',
};
