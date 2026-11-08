import type { LiftSet } from '@logbook/shared';

/**
 * The lift log's arithmetic (LiftLog.tsx), kept pure: the day's sets by exercise, last session's sets for the hint, and
 * what the number pad and the stepper do to a field.
 */

const norm = (s: string) => s.trim().toLowerCase();

/** The day's sets by exercise, in the order each was first logged. */
export const groupsOf = (sets: LiftSet[]): Array<{ exercise: string; sets: LiftSet[] }> => {
  const out: Array<{ exercise: string; sets: LiftSet[] }> = [];
  for (const s of sets) {
    const g = out.find((x) => norm(x.exercise) === norm(s.exercise));
    if (g) g.sets.push(s);
    else out.push({ exercise: s.exercise, sets: [s] });
  }
  return out;
};

/** Every set of `exercise` from the last day before `date` it was done, in the order logged. */
export const lastSession = (all: LiftSet[], exercise: string, date: string): LiftSet[] => {
  const n = norm(exercise);
  if (!n) return [];
  const before = all.filter((s) => norm(s.exercise) === n && s.date < date);
  if (!before.length) return [];
  const day = before.reduce((d, s) => (s.date > d ? s.date : d), before[0]!.date);
  return before.filter((s) => s.date === day);
};

/** Last time's set at the same place (set 3 → last time's third set), else its last set; null with no history. */
export const hintFor = (prev: LiftSet[], index: number): LiftSet | null => prev[index] ?? prev[prev.length - 1] ?? null;

/** "135 × 8" */
export const setText = (s: { weight: number; reps: number }) => `${fmtNum(s.weight)} × ${s.reps}`;
export const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));

export type PadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'back';
/**
 * A key on a field. `fresh` (the field was just picked) makes the first digit replace what is there, as a selected field
 * would. Weight takes one decimal point and one decimal; reps whole numbers. At most 4 digits before the point.
 */
export const pressKey = (value: string, key: PadKey, opts: { fresh: boolean; decimals: boolean }): string => {
  if (key === 'back') return opts.fresh ? '' : value.slice(0, -1);
  const base = opts.fresh ? '' : value;
  if (key === '.') {
    if (!opts.decimals || base.includes('.')) return base;
    return `${base || '0'}.`;
  }
  const [whole = '', frac] = base.split('.');
  if (frac !== undefined) return frac.length >= 1 ? base : `${base}${key}`;
  if (whole.replace(/^0+/, '').length >= 4) return base;
  const next = `${whole}${key}`.replace(/^0+(?=\d)/, '');
  return next;
};

/** The stepper: weight by 5 lb, reps by 1, never below 0 (reps never below 1 once stepped). */
export const stepValue = (value: string, field: 'w' | 'r', dir: 1 | -1): string => {
  const v = Number(value) || 0;
  if (field === 'w') {
    // off the 5 lb grid (137.5), the first step lands on it
    const next = dir > 0 ? Math.floor(v / 5) * 5 + 5 : Math.ceil(v / 5) * 5 - 5;
    return fmtNum(Math.max(0, next));
  }
  return String(Math.max(1, Math.round(v) + dir));
};

/** A set can be added once it has a name, a weight (0 counts: bodyweight) and at least one rep. */
export const canAdd = (exercise: string, w: string, r: string) => !!exercise.trim() && w !== '' && Number(w) >= 0 && !Number.isNaN(Number(w)) && Number.isInteger(Number(r)) && Number(r) > 0;
