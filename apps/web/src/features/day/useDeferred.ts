import { today as liveToday } from '@logbook/shared';
import { useEffect, useReducer, useRef } from 'react';
import { IDLE_MS } from '@/lib/gesture';
import { useToday } from '@/lib/useToday';
import { useNowMinutes } from './useNow';

/**
 * Nothing on Today changes without a user action (docs/feel.md §5.3, §5.4; M14, M15). The clock still runs, but a change it
 * would make to what is on screen waits here until it is safe to show:
 *
 * - **A clock-driven face change** (the morning becoming the out face, the open face becoming the Close card at 18:00) is
 *   applied on the next interaction, after the tap has done its own thing (a tap on an orb at 18:00:30 lights the orb and,
 *   on the same tap, the Close card replaces the hero), or after `IDLE_MS` with no touch, no focused field, no sheet or
 *   menu, or on a foreground return. Never under a still finger, never under a moving one. A minute tick that keeps the
 *   same face (the countdown) is not a change and shows at once. The face crossfades (150 ms) when it changes.
 * - **The midnight rollover** is applied only when no field in the Today tab has focus and `hasDraft(shownDate)` is false,
 *   no sheet or menu is open, and one of: `IDLE_MS` without a touch, a tab change away from Today, a cold open (the page
 *   simply starts on the new day) or a foreground return. A draft always wins. DayView applies it as
 *   `handle.goTo(newToday, { mode: 'crossfade' })` and `nav.replace('/today')`.
 *
 * The idle clock of a waiting change runs from the later of its own start and the last touch, so a change that comes due
 * under an idle page still waits its 60 s before it appears (spec §14 test 43: from 17:59 a tap at 18:00:30 is the one
 * that brings the Close card).
 */
export type DeferReason = 'interaction' | 'idle' | 'foreground' | 'tab';
interface Waiter {
  kind: 'phase' | 'day';
  since: number;
  /** Extra conditions of its own (the midnight rule's draft). */
  ready?: () => boolean;
  apply: () => void;
}
const waiters = new Set<Waiter>();
let last = 0;
let down = 0;
let todayActive = true;
let installed = false;
let idleTimer: ReturnType<typeof setTimeout> | 0 = 0;
let afterUp: ReturnType<typeof setTimeout> | 0 = 0;

const now = () => Date.now();
const FIELD = 'input, textarea, select, [contenteditable="true"], [contenteditable=""]';
const focusedField = () => {
  const a = document.activeElement;
  return a instanceof HTMLElement && a.matches(FIELD) ? a : null;
};
/** A sheet or a menu is up (they stay in the DOM only while open or closing). */
const overlayOpen = () => !!document.querySelector('.sheet-wrap, .cm-layer');

const may = (w: Waiter, why: DeferReason) => {
  if (down > 0 || overlayOpen()) return false;
  if (w.kind === 'phase') {
    if (focusedField()) return false;
    // what an inactive Today shows nobody: it can change at once
    if (!todayActive) return true;
    if (why === 'idle') return now() - Math.max(last, w.since) >= IDLE_MS;
    return true;
  }
  // the day: a field in the Today tab with focus, or a draft, always wins; a tap alone never rolls it
  const f = focusedField();
  if (f && f.closest('.tab[data-tab="today"]')) return false;
  if (w.ready && !w.ready()) return false;
  if (why === 'interaction') return false;
  if (why === 'idle') return now() - Math.max(last, w.since) >= IDLE_MS;
  return true;
};

/** Try every waiting change for `why`; the ones that may apply now do, the rest keep waiting. */
export const runDeferred = (why: DeferReason) => {
  for (const w of [...waiters]) {
    if (!waiters.has(w) || !may(w, why)) continue;
    waiters.delete(w);
    w.apply();
  }
  scheduleIdle();
};

/** The idle moment that already ran: a change still blocked then waits for the next activity, which moves its moment on. */
let spent = -1;
const scheduleIdle = () => {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = 0;
  let due = Infinity;
  for (const w of waiters) {
    const d = Math.max(last, w.since) + IDLE_MS;
    if (d > spent) due = Math.min(due, d);
  }
  if (due === Infinity) return;
  idleTimer = setTimeout(() => {
    idleTimer = 0;
    spent = due;
    runDeferred('idle');
  }, Math.max(0, due - now()) + 5);
};

/** A draft written or cleared (subscribeDrafts): the waiting rollover asks again whether it may apply. */
export const recheckDeferred = () => runDeferred('idle');

const activity = () => {
  last = now();
  scheduleIdle();
};

const install = () => {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  last = now();
  const cap = { capture: true, passive: true } as const;
  window.addEventListener(
    'pointerdown',
    () => {
      down++;
      if (afterUp) clearTimeout(afterUp);
      afterUp = 0;
      activity();
    },
    cap,
  );
  const up = (applies: boolean) => () => {
    down = Math.max(0, down - 1);
    activity();
    // the tap's own action first (its click comes after the pointerup, on touch often in a later task): the change waits
    // for that click, with a fallback for a release that makes none (a hold, a drag)
    if (applies && !down) {
      if (afterUp) clearTimeout(afterUp);
      afterUp = setTimeout(() => {
        afterUp = 0;
        runDeferred('interaction');
      }, 350);
    }
  };
  window.addEventListener('pointerup', up(true), cap);
  // a pointer the browser took for a scroll is a moving finger: nothing changes under it (idle, or the next tap)
  window.addEventListener('pointercancel', up(false), cap);
  // bubble phase on window: after the tap's own handlers (React's root listener runs first), and still inside the click, so
  // the change renders at the click's (discrete) priority, ahead of the background renders the tap's own write starts
  window.addEventListener('click', () => {
    if (afterUp) clearTimeout(afterUp);
    afterUp = 0;
    runDeferred('interaction');
  });
  window.addEventListener('keydown', activity, cap);
  window.addEventListener('keyup', () => setTimeout(() => runDeferred('interaction'), 0), cap);
  window.addEventListener('scroll', activity, cap);
  window.addEventListener('focusin', activity, cap);
  window.addEventListener('focusout', () => {
    activity();
    setTimeout(() => runDeferred('interaction'), 0);
  }, cap);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    // a return from the background is an open: the idle clock starts again and what may change, changes
    last = now();
    runDeferred('foreground');
  });
};

/** Wait for `w`; returns the cancel. A change on an inactive Today applies at once. */
export const deferChange = (w: Omit<Waiter, 'since'>): (() => void) => {
  install();
  const entry: Waiter = { ...w, since: now() };
  waiters.add(entry);
  if (w.kind === 'phase' && !todayActive && may(entry, 'tab')) {
    waiters.delete(entry);
    entry.apply();
  } else scheduleIdle();
  return () => {
    waiters.delete(entry);
    scheduleIdle();
  };
};

/** DayView tells the store whether Today is the active tab; a change away from it is a moment to apply. */
export const setTodayActive = (on: boolean) => {
  install();
  if (on === todayActive) return;
  todayActive = on;
  if (!on) runDeferred('tab');
};

/**
 * The minutes the hero's faces read: the clock's, except on a held day (the Today tab still on yesterday after midnight),
 * where the time is the held day's last minute, so its evening face stays as it was.
 */
export const useFaceMinutes = () => {
  const minutes = useNowMinutes();
  const shown = useToday();
  return shown < liveToday() ? 24 * 60 - 0.01 : minutes;
};

/**
 * The clock gate for one face (§5.3): `keyOf(minutes)` names the face those minutes would show. While the face the page
 * shows and the face the clock wants are the same, the minutes flow through (the countdown ticks); when they differ, the
 * shown minutes stay where they were until `runDeferred` says the change may apply.
 */
export const useDeferredMinutes = (minutes: number, keyOf: (m: number) => string): number => {
  const applied = useRef(minutes);
  const latest = useRef(minutes);
  latest.current = minutes;
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const want = keyOf(minutes);
  const same = want === keyOf(applied.current);
  if (same) applied.current = minutes;
  useEffect(() => {
    if (same) return;
    return deferChange({
      kind: 'phase',
      apply: () => {
        applied.current = latest.current;
        bump();
      },
    });
  }, [same, want]);
  return applied.current;
};

/** Test builds: the store's state for the acceptance scripts. */
if (typeof window !== 'undefined' && (import.meta.env.DEV || import.meta.env.VITE_FAKE_CLOCK)) {
  (window as unknown as { __deferred?: unknown }).__deferred = { waiting: () => [...waiters].map((w) => w.kind), active: () => todayActive, down: () => down };
}
