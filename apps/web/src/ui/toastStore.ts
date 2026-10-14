/**
 * The toast's state, outside React so it can be tested without a DOM. One toast at a time: `show` replaces whatever is
 * up and starts its timer (2.8s, 6.5s with an action); `act(id)` runs the action of the toast with that id.
 *
 * D-F1: an action that shows a follow-up toast ("Ease them" → "Eased. Undo") used to lose it, because the old code ran
 * the action and then cleared the toast, wiping the one the action had just shown. `act` clears only the toast that was
 * acted on, before running its action, so whatever the action shows stays up for its full time.
 */
export interface ToastAction {
  label: string;
  fn: () => void;
}
export interface ToastSpec {
  id: number;
  text: string;
  action?: ToastAction;
}

export const TOAST_MS = 2800;
export const TOAST_ACTION_MS = 6500;

// the timers are called through arrows: a bare `setTimeout` called as a method throws "Illegal invocation" in browsers
const realTimers = { set: (fn: () => void, ms: number) => setTimeout(fn, ms), clear: (t: ReturnType<typeof setTimeout> | undefined) => clearTimeout(t) };
export const createToastStore = (timers: { set: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>; clear: (t: ReturnType<typeof setTimeout> | undefined) => void } = realTimers) => {
  let current: ToastSpec | null = null;
  let seq = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
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
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    show(text: string, action?: ToastAction): number {
      timers.clear(timer);
      const id = ++seq;
      current = { id, text, action };
      timer = timers.set(() => dismiss(id), action ? TOAST_ACTION_MS : TOAST_MS);
      emit();
      return id;
    },
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
