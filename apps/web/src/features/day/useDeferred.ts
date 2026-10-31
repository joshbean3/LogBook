import { today as liveToday } from '@logbook/shared';
import { IDLE_MS } from '@/lib/gesture';
import { useToday } from '@/lib/useToday';
import { useNowMinutes } from './useNow';

/**
 * The midnight rollover waits here (docs/feel.md §5.4): the Today tab still shows the held day until no field in it has
 * focus, `hasDraft(shownDate)` is false, no sheet or menu is open, and one of: `IDLE_MS` without a touch, a tab change
 * away from Today, or a foreground return. A draft always wins; a tap alone never rolls it. DayView applies it as
 * `handle.goTo(newToday, { mode: 'crossfade' })` and `nav.replace('/today')`.
 *
 * The clock's other changes (the status line's words) are words only (docs/system.md §5): they show as they come.
 */
export type DeferReason = 'interaction' | 'idle' | 'foreground' | 'tab';
interface Waiter {
  since: number;
  /** Extra conditions of its own (the draft). */
  ready?: () => boolean;
  apply: () => void;
}
const waiters = new Set<Waiter>();
let last = 0;
let down = 0;
let todayActive = true;
let installed = false;
let idleTimer: ReturnType<typeof setTimeout> | 0 = 0;

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
      activity();
    },
    cap,
  );
  const up = () => {
    down = Math.max(0, down - 1);
    activity();
  };
  window.addEventListener('pointerup', up, cap);
  window.addEventListener('pointercancel', up, cap);
  window.addEventListener('keydown', activity, cap);
  window.addEventListener('scroll', activity, cap);
  window.addEventListener('focusin', activity, cap);
  window.addEventListener('focusout', activity, cap);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    last = now();
    runDeferred('foreground');
  });
};

/** Wait for `w`; returns the cancel. */
export const deferChange = (w: Omit<Waiter, 'since'>): (() => void) => {
  install();
  const entry: Waiter = { ...w, since: now() };
  waiters.add(entry);
  scheduleIdle();
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
 * The minutes the hero's words read: the clock's, except on a held day (the Today tab still on yesterday after midnight),
 * where the time is the held day's last minute, so its words stay as they were.
 */
export const useFaceMinutes = () => {
  const minutes = useNowMinutes();
  const shown = useToday();
  return shown < liveToday() ? 24 * 60 - 0.01 : minutes;
};
