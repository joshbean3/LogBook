import { isISODate, type Activity, type Session, type SessionMark } from '@logbook/shared';
import type { MonthBundle } from './types';

/*
 * A month, made safe to read. The app reads a month as if it were whole (`bundle.sessions.filter`, a session's `title` as
 * a string) in every screen that shows training, so a month that is not (an older server that does not send a list this
 * build reads, a copy an earlier build kept on the phone, one row with a field of the wrong kind) took every one of those
 * screens down at once. This is the one place it is checked, at the two doors a month comes in by: the request
 * (`fetchMonth`) and the snapshot built from what the phone holds (`buildSnapshot`).
 *
 * It repairs, it does not refuse: a missing list is empty, a field of the wrong kind is empty, a row that is not a row is
 * left out. A whole month comes back as the same object, so nothing is copied and nothing re-renders for it.
 */

const KINDS = new Set(['run', 'lift', 'cross', 'rest']);
const MARKS = new Set<string>(['done', 'floor', 'skip', 'sick'] satisfies SessionMark[]);
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const text = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const amount = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);

/** A session row as the app reads it, or null when it is not one (no id, no day, a kind the app does not draw). */
const sessionOf = (raw: unknown): Session | null => {
  if (!isObj(raw) || typeof raw.id !== 'string' || !raw.id || !isISODate(raw.date) || typeof raw.kind !== 'string' || !KINDS.has(raw.kind)) return null;
  const s = raw as unknown as Session;
  const fix: Partial<Session> = {};
  for (const k of ['type', 'title', 'details', 'blockId'] as const) if (s[k] !== null && typeof s[k] !== 'string') fix[k] = null;
  for (const k of ['miles', 'minutes'] as const) if (s[k] !== null && amount(s[k]) === null) fix[k] = null;
  if (typeof s.position !== 'number' || !Number.isFinite(s.position)) fix.position = 0;
  if (s.mark !== null && !(typeof s.mark === 'string' && MARKS.has(s.mark))) fix.mark = null;
  if (s.movedFrom !== null && !isISODate(s.movedFrom)) fix.movedFrom = null;
  return Object.keys(fix).length ? { ...s, ...fix } : s;
};

/** An activity as the app reads it, or null with no id or no day. Its numbers are numbers, its name a string. */
const activityOf = (raw: unknown): Activity | null => {
  if (!isObj(raw) || typeof raw.id !== 'string' || !raw.id || !isISODate(raw.date)) return null;
  const a = raw as unknown as Activity;
  const fix: Partial<Activity> = {};
  if (typeof a.name !== 'string') fix.name = '';
  if (typeof a.kind !== 'string') fix.kind = 'cross';
  for (const k of ['miles', 'movingSec', 'elevFt'] as const) if (typeof a[k] !== 'number' || !Number.isFinite(a[k])) fix[k] = 0;
  return Object.keys(fix).length ? { ...a, ...fix } : a;
};

/** The list with each row repaired or left out; the same array when nothing changed. */
const rows = <T>(list: unknown, one: (raw: unknown) => T | null, idOf?: (x: T) => string): T[] => {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  let same = true;
  const out: T[] = [];
  for (const raw of list) {
    const x = one(raw);
    const id = x && idOf ? idOf(x) : null;
    if (!x || (id !== null && seen.has(id))) {
      same = false;
      continue;
    }
    if (id !== null) seen.add(id);
    if (x !== raw) same = false;
    out.push(x);
  }
  return same ? (list as T[]) : out;
};
/** A list of rows the app only filters by date: kept when it is a list, with anything that is not a row left out. */
const plain = <T>(list: unknown): T[] => {
  if (!Array.isArray(list)) return [];
  return list.every(isObj) ? (list as T[]) : (list.filter(isObj) as T[]);
};

const done = new WeakMap<object, MonthBundle>();
/** `raw` as a month every reader can trust. The same object when it already is one; the same answer each time it is asked. */
export const wholeMonth = (raw: unknown): MonthBundle => {
  if (!isObj(raw)) return { month: '', sessions: [], checks: [], lifts: [], activities: [], morningDays: {}, journal: [], coach: [] };
  const hit = done.get(raw);
  if (hit) return hit;
  const b = raw as unknown as MonthBundle;
  const next: MonthBundle = {
    ...b,
    month: typeof b.month === 'string' ? b.month : '',
    sessions: rows(b.sessions, sessionOf, (s) => s.id),
    activities: rows(b.activities, activityOf, (a) => a.id),
    checks: plain(b.checks),
    lifts: plain(b.lifts),
    journal: plain(b.journal),
    coach: plain(b.coach),
    morningDays: isObj(b.morningDays) ? b.morningDays : {},
  };
  const whole = (Object.keys(next) as Array<keyof MonthBundle>).every((k) => next[k] === b[k]) ? b : next;
  done.set(raw, whole);
  return whole;
};
