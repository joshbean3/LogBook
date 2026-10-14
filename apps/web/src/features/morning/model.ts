import { AFTER_LABELS, AFTER_ORDER, buildMorning, MORNING_DEFAULTS, normalizeAfterOrder, clockOfDay, morningDayFor, type MorningAfterKey, type MorningDayOverride, type MorningSettings, type MorningTimeline, type Session } from '@logbook/shared';
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
/**
 * The routine's names as the page says them: generic, nobody's own morning. The server's `smoothie` slot is a meal anyone
 * might have ("Breakfast"); the rest keep the shared names. (Contract 7: new accounts start with "Get ready 30" and the last
 * block 10, the others off.)
 */
export const AFTER_LABEL: Record<AfterKey, string> = { ...AFTER_LABELS, smoothie: 'Breakfast' };
/** A timeline block's name on this page: the routine's generic names, everything else as `buildMorning` wrote it. */
export const blockLabel = (b: { key: string; label: string }) => ((AFTER_ORDER as readonly string[]).includes(b.key) ? AFTER_LABEL[b.key as AfterKey] : b.label);

/**
 * The routine a new account starts from (contract 7), used wherever the page needs defaults before the account's own
 * settings arrive, and for the editor's Reset: get ready 30, the last block 10, shower and breakfast off.
 */
export const ROUTINE_DEFAULTS: MorningSettings = {
  ...MORNING_DEFAULTS,
  after: { ...MORNING_DEFAULTS.after, shower: 0, ready: 30, smoothie: 0, prep: 10, order: [...AFTER_ORDER] },
};

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
