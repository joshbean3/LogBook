import { buildMorning, clockOfDay, morningDayFor, type MorningDayOverride, type MorningSettings, type MorningTimeline, type Session, type TimelineBlock } from '@logbook/shared';
import { useEffect, useState, useSyncExternalStore } from 'react';

/**
 * The Morning page's pure model: the timeline for a day (with the routine's block order applied), the clock (with a dev
 * override), and the two per-device preferences the page keeps (the routine order and the one-time grip lesson).
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
export type AfterKey = 'shower' | 'ready' | 'smoothie' | 'prep';
export const AFTER_KEYS: readonly AfterKey[] = ['shower', 'ready', 'smoothie', 'prep'];
export const AFTER_LABEL: Record<AfterKey, string> = { shower: 'Shower', ready: 'Get ready', smoothie: 'Blend smoothie', prep: 'Final prep' };

/*
 * The settings API has no field for the order (its schema strips unknown keys), so the order lives on this device until the
 * platform adds `after.order` (requested in REVIEW.md). The durations, which decide every time on the page, are on the server.
 */
const ORDER_KEY = 'logbook.morning.order';
const orderSubs = new Set<() => void>();
let orderCache: AfterKey[] | null = null;
const validOrder = (raw: unknown): AfterKey[] => {
  const list = Array.isArray(raw) ? raw.filter((k): k is AfterKey => AFTER_KEYS.includes(k as AfterKey)) : [];
  const seen = [...new Set(list)];
  return [...seen, ...AFTER_KEYS.filter((k) => !seen.includes(k))];
};
export const getRoutineOrder = (): AfterKey[] => {
  if (orderCache) return orderCache;
  try {
    orderCache = validOrder(JSON.parse(localStorage.getItem(ORDER_KEY) ?? '[]'));
  } catch {
    orderCache = [...AFTER_KEYS];
  }
  return orderCache;
};
export const setRoutineOrder = (order: AfterKey[]) => {
  orderCache = validOrder(order);
  try {
    localStorage.setItem(ORDER_KEY, JSON.stringify(orderCache));
  } catch {
    /* private mode: it lasts for this visit */
  }
  for (const f of orderSubs) f();
};
const subscribeOrder = (f: () => void) => {
  orderSubs.add(f);
  return () => void orderSubs.delete(f);
};
export const useRoutineOrder = () => useSyncExternalStore(subscribeOrder, getRoutineOrder, getRoutineOrder);

/** The back-home blocks re-timed in `order`. They are contiguous at the end of the morning, so the leave time never moves. */
export const applyOrder = (T: MorningTimeline, order: readonly AfterKey[]): MorningTimeline => {
  const first = T.blocks.findIndex((b) => (AFTER_KEYS as readonly string[]).includes(b.key));
  if (first < 0) return T;
  const after = T.blocks.slice(first);
  const rank = (b: TimelineBlock) => order.indexOf(b.key as AfterKey);
  const sorted = [...after].sort((a, b) => rank(a) - rank(b));
  if (sorted.every((b, i) => b === after[i])) return T;
  let t = after[0]!.start;
  const timed = sorted.map((b) => {
    const nb = { ...b, start: t, end: t + b.mins };
    t += b.mins;
    return nb;
  });
  return { ...T, blocks: [...T.blocks.slice(0, first), ...timed] };
};

export type DayPatch = Partial<Pick<MorningDayOverride, 'wake' | 'miles' | 'minutes' | 'mode' | 'type'>>;

/** The morning for a date: the plan, the day's override and the routine, with `patch` (a drag in progress) laid over the day. */
export const morningOf = (sessions: Session[], override: Partial<MorningDayOverride> | null, st: MorningSettings, order: readonly AfterKey[], patch?: DayPatch | null): MorningTimeline => {
  const day = morningDayFor(sessions, override, st);
  return applyOrder(buildMorning(patch ? { ...day, ...patch } : day, st), order);
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
