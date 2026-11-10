import { TOAST_MS, TOAST_UNDO_MS } from '@/lib/gesture';

/**
 * The toast's state, outside React so it can be tested without a DOM. One toast at a time: `show` replaces whatever is
 * up and starts its timer (TOAST_MS 4 s plain, TOAST_UNDO_MS 10 s with an action, or the action's own `duration`;
 * docs/feel.md §8, contracts §C.7); `act(id)` runs the action of the toast with that id. `pause(id)` stops the clock while
 * the toast is touched or focused and `resume(id)` starts it again with what was left (at least RESUME_MIN_MS), so a toast
 * never vanishes under a finger or a VoiceOver cursor (a11y-11).
 *
 * D-F1: an action that shows a follow-up toast ("Ease them" → "Eased. Undo") used to lose it, because the old code ran
 * the action and then cleared the toast, wiping the one the action had just shown. `act` clears only the toast that was
 * acted on, before running its action, so whatever the action shows stays up for its full time.
 */
export interface ToastAction {
  label: string;
  fn: () => void;
  /** How long the toast stays up, in ms (default and minimum TOAST_UNDO_MS, 10 s). For an Undo whose consequence is large, e.g. replacing a plan. */
  duration?: number;
}
export interface ToastSpec {
  id: number;
  text: string;
  action?: ToastAction;
}


// the timers are called through arrows: a bare `setTimeout` called as a method throws "Illegal invocation" in browsers
const realTimers = { set: (fn: () => void, ms: number) => setTimeout(fn, ms), clear: (t: ReturnType<typeof setTimeout> | undefined) => clearTimeout(t), now: () => Date.now() };
/** After a pause the toast has at least this long, however little was left. */
export const RESUME_MIN_MS = 2000;
export const createToastStore = (timers: { set: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>; clear: (t: ReturnType<typeof setTimeout> | undefined) => void; now?: () => number } = realTimers) => {
  let current: ToastSpec | null = null;
  let seq = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const now = timers.now ?? (() => Date.now());
  /** When the current toast goes (running), or how long it has left (paused). */
  let deadline = 0;
  let left: number | null = null;
  const arm = (id: number, ms: number) => {
    timers.clear(timer);
    deadline = now() + ms;
    left = null;
    timer = timers.set(() => dismiss(id), ms);
  };
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((f) => f());
  const dismiss = (id?: number) => {
    if (!current || (id !== undefined && current.id !== id)) return;
    timers.clear(timer);
    current = null;
    emit();
  };
  return {
    get: () => current,
    /** How many toasts have been shown so far (the id of the latest). */
    shown: () => seq,
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    show(text: string, action?: ToastAction): number {
      const id = ++seq;
      current = { id, text, action };
      // an action's own duration can only lengthen the stay: never shorter than the default for an action
      arm(id, action ? Math.max(action.duration ?? 0, TOAST_UNDO_MS) : TOAST_MS);
      emit();
      return id;
    },
    /** Stop the clock of toast `id` (a finger is down on it, or it or its button has focus). */
    pause(id: number) {
      if (!current || current.id !== id || left !== null) return;
      timers.clear(timer);
      timer = undefined;
      left = Math.max(0, deadline - now());
    },
    /** Start the clock again with what was left, at least RESUME_MIN_MS. */
    resume(id: number) {
      if (!current || current.id !== id || left === null) return;
      arm(id, Math.max(left, RESUME_MIN_MS));
    },
    /** Whether toast `id`'s clock is stopped. */
    paused: (id: number) => !!current && current.id === id && left !== null,
    /** Clear the toast `id` (only if it is still the one up), then run its action. */
    act(id: number) {
      const t = current;
      if (!t || t.id !== id) return;
      dismiss(id);
      t.action?.fn();
    },
    dismiss,
  };
};
export type ToastStore = ReturnType<typeof createToastStore>;

/**
 * The app's one toast: ToastProvider draws it, and code outside React (the outbox, the data layer's error handler) raises it
 * through `showToast`. Such a toast belongs to no tab, so a tab change leaves it up.
 */
export const toastStore = createToastStore();
export const showToast = (text: string, action?: ToastAction): number => toastStore.show(text, action);
