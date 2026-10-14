import { AFTER_LABELS, AFTER_ORDER, afterLabel, buildMorning, NEW_ACCOUNT_MORNING, normalizeAfterOrder, clockOfDay, morningDayFor, type MorningAfterKey, type MorningDayOverride, type MorningSettings, type MorningTimeline, type Session } from '@logbook/shared';
import { useEffect, useState } from 'react';

/**
 * The Morning page's pure model: the timeline for a day (the routine's block order is a setting `buildMorning` honours), the
 * clock (with a dev override), and the one per-device preference the page keeps (the one-time grip lesson).
 */

// ---------- time words ----------
/** "7:20 AM" split so the number can be big and the meridiem small. */
export const timeParts = (m: number) => {
  const [v = '', u = ''] = clockOfDay(m).split(' ');
  return { v, u };
};
/** "7:20" without the meridiem (a morning is all AM; the axis and the stamps say so once). */
export const short = (m: number) => timeParts(m).v;
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ---------- the routine order: the back-home blocks, in the athlete's order ----------
/*
 * The order is a morning setting on the server (`after.order`), and `buildMorning` lays the blocks out in it, so every
 * timeline (this page, Today's mini timeline, the routine editor's preview) follows it with nothing to apply here.
 */
export type AfterKey = MorningAfterKey;
export const AFTER_KEYS = AFTER_ORDER;
export const isAfterKey = (k: string): k is AfterKey => (AFTER_ORDER as readonly string[]).includes(k);

/**
 * A routine block's name: the athlete's own (`afterLabel`), and generic where the shared default is somebody's own habit:
 * the `smoothie` slot with no name of its own is "Breakfast", a meal anyone might have.
 */
export const routineName = (st: Pick<MorningSettings, 'after'> | null | undefined, k: AfterKey): string => {
  const name = afterLabel(st, k);
  return k === 'smoothie' && name === AFTER_LABELS.smoothie ? 'Breakfast' : name;
};

/**
 * A timeline block's name on this page. Routine blocks use `routineName`; the run's departure buffer keeps "Out the door"
 * (the hero's DOOR, the session sheet's OUT THE DOOR), so a routine block that would wear the same name on a morning with
 * a departure (a new account's last block is named "Out the door") goes by the routine's default name instead.
 */
export const blockLabel = (T: Pick<MorningTimeline, 'settings' | 'blocks'>, b: { key: string; label: string }): string => {
  if (!isAfterKey(b.key)) return b.label;
  const name = routineName(T.settings, b.key);
  const clash = T.blocks.some((x) => x.key === 'buffer' && x.label.toLowerCase() === name.toLowerCase());
  return clash ? AFTER_LABELS[b.key] : name;
};

/** The routine a new account starts from (contract 7), for any pre-load fallback and the routine editor's Reset. */
export const ROUTINE_DEFAULTS: MorningSettings = NEW_ACCOUNT_MORNING;

/** An order an earlier build kept on this device (`logbook.morning.order`): read once and forgotten, so it can go to the server. */
export const takeLegacyOrder = (): AfterKey[] | null => {
  try {
    const raw = localStorage.getItem('logbook.morning.order');
    if (raw == null) return null;
    localStorage.removeItem('logbook.morning.order');
    const list = JSON.parse(raw) as unknown;
    return Array.isArray(list) ? normalizeAfterOrder(list) : null;
  } catch {
    return null;
  }
};

export type DayPatch = Partial<Pick<MorningDayOverride, 'wake' | 'miles' | 'minutes' | 'mode' | 'type'>>;

/** The morning for a date: the plan, the day's override and the routine, with `patch` (a drag in progress) laid over the day. */
export const morningOf = (sessions: Session[], override: Partial<MorningDayOverride> | null, st: MorningSettings, patch?: DayPatch | null): MorningTimeline => {
  const day = morningDayFor(sessions, override, st);
  return buildMorning(patch ? { ...day, ...patch } : day, st);
};

/** Out the door: the start of the first buffer block (null on a rest morning). */
export const doorOf = (T: MorningTimeline) => (T.day.mode === 'rest' ? null : (T.blocks.find((b) => b.key === 'buffer')?.start ?? null));

/** The four stops of a morning (three on a rest morning: no door, no back). */
export const stopsOf = (T: MorningTimeline): Array<{ key: 'wake' | 'door' | 'back' | 'leave'; label: string; at: number }> => {
  const door = doorOf(T);
  return [
    { key: 'wake' as const, label: 'Wake', at: T.day.wake },
    ...(door != null
      ? [
          { key: 'door' as const, label: 'Door', at: door },
          { key: 'back' as const, label: 'Back', at: T.back },
        ]
      : []),
    { key: 'leave' as const, label: 'Leave', at: T.leave },
  ];
};

// ---------- the clock ----------
/**
 * `?at=HH:MM` fakes the clock so every phase of the morning can be checked. It works in a dev build, and on localhost so the
 * production build the QA server runs can be driven too. Nowhere else.
 */
const fakeNow = (): number | null => {
  if (typeof location === 'undefined') return null;
  const local = import.meta.env.DEV || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!local) return null;
  const x = /^(\d{1,2}):(\d{2})$/.exec(new URLSearchParams(location.search).get('at') ?? '');
  return x ? Number(x[1]) * 60 + Number(x[2]) : null;
};
const readNow = () => {
  const f = fakeNow();
  if (f != null) return f;
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
};
/** Minutes since midnight, refreshed every 30 seconds. */
export const useNowMinutes = () => {
  const [m, setM] = useState(readNow);
  useEffect(() => {
    const iv = setInterval(() => setM(readNow()), 30_000);
    return () => clearInterval(iv);
  }, []);
  return m;
};

// ---------- the one-time lesson: the wake grip nudges on the first visit ----------
const TAUGHT_KEY = 'logbook.morning.taught';
export const wasTaught = () => {
  try {
    return localStorage.getItem(TAUGHT_KEY) === '1';
  } catch {
    return true;
  }
};
export const markTaught = () => {
  try {
    localStorage.setItem(TAUGHT_KEY, '1');
  } catch {
    /* fine: the nudge may come once more */
  }
};
