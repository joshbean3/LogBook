import { counts, dayKey, sessionStatus, type ISODate, type Snapshot, type StatusKey } from '@logbook/shared';
import { fmt } from '@/ui/captions';
import type { StripKind, StripStatus } from '@/ui/NavBar';
const ORDER: readonly StripKind[] = ['run', 'lift', 'cross'];

/** The day's word (`dayKey`) as the strip draws it: a day still open is planned; rest has no mark. */
const STRIP: Partial<Record<StatusKey, StripStatus>> = { done: 'done', bonus: 'bonus', floor: 'floor', planned: 'planned', today: 'planned', missed: 'missed', skipped: 'skipped' };

/**
 * The day's state for its strip cell, which is the kind pill's fill (guide 6.7): the fill says how much of the day is done.
 * It is the day's own word, with one addition: a day that is still open with one of its sessions already done is part done
 * ('floor', Haze), as a day that passed with one of two done is. Without it a run finished at 7 left the pill of a run and
 * lift day looking untouched until the lift was done too.
 */
export const stripStatus = (snap: Snapshot, d: ISODate): StripStatus => {
  const key = dayKey(snap, d);
  if ((key === 'today' || key === 'planned') && snap.sessionsOn(d).some((s) => counts(sessionStatus(snap, d, s)))) return 'floor';
  return STRIP[key] ?? null;
};

/**
 * The kinds a day calls for, for the strip's glyph: the planned sessions that still stand (rest and skipped or sick ones
 * left out), or, on a day with no plan, what was actually done (a bonus run, a lift logged set by set). At most two, run
 * first, so a cell never holds more than it can show at 52 px wide.
 */
export const stripKinds = (snap: Snapshot, d: ISODate, max = 2): StripKind[] => {
  const planned = snap
    .sessionsOn(d)
    .filter((s) => s.kind !== 'rest' && s.mark !== 'skip' && s.mark !== 'sick')
    .map((s) => s.kind as StripKind);
  const done = planned.length ? [] : [...snap.activitiesOn(d).map((a) => a.kind as StripKind), ...(snap.liftSetCountOn(d) > 0 ? (['lift'] as const) : [])];
  const have = new Set([...planned, ...done]);
  return ORDER.filter((k) => have.has(k)).slice(0, max);
};

const KIND_SAID: Record<StripKind, string> = { run: 'run', lift: 'strength', cross: 'workout' };
const STATUS_SAID: Record<Exclude<StripStatus, null>, string> = { done: 'done', bonus: 'bonus run', floor: 'floor', planned: 'planned run', missed: 'missed', skipped: 'skipped', rest: 'rest' };

/**
 * A strip cell's spoken name, as the strip says it (`Tuesday, November 10, run and strength`), with every kind the day calls
 * for: the glyphs stop at two, the words do not (today-top-29).
 */
export const stripLabel = (d: ISODate, kinds: readonly StripKind[], s: StripStatus): string => {
  const words = kinds.map((k) => KIND_SAID[k]);
  const list = words.length > 2 ? `${words.slice(0, -1).join(', ')} and ${words.at(-1)}` : words.join(' and ');
  const what = kinds.length ? `, ${list}${s && s !== 'planned' ? ` ${STATUS_SAID[s]}` : ''}` : s ? `, ${STATUS_SAID[s]}` : '';
  return `${fmt(d, { weekday: 'long', month: 'long', day: 'numeric' })}${what}`;
};
