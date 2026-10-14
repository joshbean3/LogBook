import { useSyncExternalStore } from 'react';
import { isNative } from './native';

/**
 * Named haptics (docs/experience.md §3.3, docs/foundation.md "Haptics").
 *
 * Call the event, not the motor: `haptics.toggle()` when a to-do is checked, `haptics.lift()` when a long-press lifts
 * something. At most one per action, fired on the frame of the visual peak, never for a tap that only navigates or opens a
 * sheet. Inside the iOS app these map to @capacitor/haptics; on Android browsers to `navigator.vibrate`; iOS Safari has no
 * vibration API, so every meaning must also be carried visually.
 */

export type HapticEvent = 'select' | 'toggle' | 'orb' | 'lift' | 'drop' | 'threshold' | 'success' | 'celebrate' | 'delete' | 'warning' | 'error';

type Cap = typeof import('@capacitor/haptics');
let cap: Cap | null = null;
if (isNative) void import('@capacitor/haptics').then((m) => (cap = m)).catch(() => undefined);

// ---------- the preference: logbook.haptics, on unless set to '0' ----------
const KEY = 'logbook.haptics';
const subs = new Set<() => void>();
let enabledCache: boolean | null = null;
const read = () => {
  try {
    return localStorage.getItem(KEY) !== '0';
  } catch {
    return true;
  }
};
/** Whether haptics are on. Default on (HIG: make haptics optional, not absent). */
export const getHapticsEnabled = () => (enabledCache ??= read());
export const setHapticsEnabled = (on: boolean) => {
  enabledCache = on;
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* private mode: it lasts for this session */
  }
  for (const f of subs) f();
};
const subscribe = (f: () => void) => {
  subs.add(f);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    enabledCache = null;
    f();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    subs.delete(f);
    window.removeEventListener('storage', onStorage);
  };
};
/** The Haptics switch for Settings: `[on, setOn]`, kept in step across the app and across tabs. */
export const useHapticsEnabled = () => {
  const on = useSyncExternalStore(subscribe, getHapticsEnabled, () => true);
  return [on, setHapticsEnabled] as const;
};

// ---------- the motors ----------
const vibrate = (p: number | number[]) => {
  try {
    if ('vibrate' in navigator) navigator.vibrate(p);
  } catch {
    /* unsupported */
  }
};
const impact = (style: 'Light' | 'Medium' | 'Heavy', fallback: number) => {
  if (cap) void cap.Haptics.impact({ style: cap.ImpactStyle[style] }).catch(() => undefined);
  else if (!isNative) vibrate(fallback);
};
const notify = (type: 'Success' | 'Warning' | 'Error', fallback: number[]) => {
  if (cap) void cap.Haptics.notification({ type: cap.NotificationType[type] }).catch(() => undefined);
  else if (!isNative) vibrate(fallback);
};

/* selection: start the generator once, tick, and end it after a quiet spell so the Taptic Engine can rest */
let selActive = false;
let selEnd: ReturnType<typeof setTimeout> | undefined;
let lastSelect = 0;
const SELECT_THROTTLE = 40;
const selection = (): void | false => {
  const now = performance.now();
  if (now - lastSelect < SELECT_THROTTLE) return false;
  lastSelect = now;
  if (cap) {
    const H = cap.Haptics;
    if (!selActive) {
      selActive = true;
      void H.selectionStart().catch(() => undefined);
    }
    void H.selectionChanged().catch(() => undefined);
    clearTimeout(selEnd);
    selEnd = setTimeout(() => {
      selActive = false;
      void H.selectionEnd().catch(() => undefined);
    }, 600);
  } else if (!isNative) vibrate(4);
};

/** Every haptic that fires is also announced as a `logbook:haptic` window event (detail = the event name), so the /dev/ui gallery and tests can see haptics on a desktop or in iOS Safari, where nothing vibrates. */
export const HAPTIC_EVENT = 'logbook:haptic';
const fire = (name: HapticEvent, fn: () => void | false) => () => {
  if (!getHapticsEnabled()) return;
  try {
    if (fn() === false) return; // throttled
  } catch {
    /* a missing plugin is never an error the user sees */
  }
  try {
    window.dispatchEvent(new CustomEvent(HAPTIC_EVENT, { detail: name }));
  } catch {
    /* no window (tests) */
  }
};

export const haptics: Record<HapticEvent, () => void> = {
  /** Day/week step, segmented change, tab change, scrub step, a drag crossing a slot. Throttled to one per 40ms. */
  select: fire('select', selection),
  /** A to-do checked, a star, a small toggle. */
  toggle: fire('toggle', () => impact('Light', 8)),
  /** A habit orb lit. (Soft when a native plugin exists; Light today.) */
  orb: fire('orb', () => impact('Light', 8)),
  /** A long-press lifts an object (ContextMenu, drag pick-up). */
  lift: fire('lift', () => impact('Medium', 14)),
  /** A drop into a slot. (Rigid when available; Light today.) */
  drop: fire('drop', () => impact('Light', 8)),
  /** A swipe crossing its commit threshold, pull-to-refresh armed. */
  threshold: fire('threshold', () => impact('Light', 8)),
  /** Session done, a Strava run lands, all habits lit, a multi-step save. */
  success: fire('success', () => notify('Success', [10, 30, 14])),
  /** Week ring closes, plan block completes: Heavy, then Success 120ms later. At most once a week. */
  celebrate: fire('celebrate', () => {
    impact('Heavy', 20);
    setTimeout(() => notify('Success', [10, 30, 14]), 120);
  }),
  /** A destructive action committed (with Undo). Never Warning: nothing went wrong. */
  delete: fire('delete', () => impact('Medium', 14)),
  /** A plan conflict on drop (two hard days back to back). */
  warning: fire('warning', () => notify('Warning', [20, 40, 20])),
  /** Sync failed, an action blocked. */
  error: fire('error', () => notify('Error', [30, 40, 30, 40, 30])),
};

/** Fire a named event, or nothing for `undefined`/`false`: handy for an optional `haptic` prop. */
export const fireHaptic = (e: HapticEvent | false | null | undefined) => {
  if (e) haptics[e]();
};

type LegacyKind = 'tick' | 'success' | 'warn';
const LEGACY: Record<LegacyKind, HapticEvent> = { tick: 'toggle', success: 'success', warn: 'warning' };
/**
 * @deprecated call the named event instead (`haptics.toggle()`, `haptics.select()`, …). The old kinds map to:
 * `tick` → `toggle` (Impact Light, as before), `success` → `success`, `warn` → `warning`. A new event name works too.
 */
export const haptic = (kind: LegacyKind | HapticEvent = 'tick') => {
  const e = (LEGACY as Record<string, HapticEvent | undefined>)[kind] ?? (kind as HapticEvent);
  haptics[e]?.();
};
