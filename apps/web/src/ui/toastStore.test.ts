import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TOAST_MS, TOAST_UNDO_MS as TOAST_ACTION_MS } from '@/lib/gesture';
import { RESUME_MIN_MS } from './toastStore';
import { createToastStore } from './toastStore';

describe('toast (D-F1)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('an action that shows a follow-up toast keeps it, for its own full time', () => {
    const store = createToastStore();
    const undo = vi.fn();
    // Plan → Not feeling 100% → "Ease them" → "Next 2 eased" with Undo
    const first = store.show('Skipped. Ease the next days?', { label: 'Ease them', fn: () => store.show('Next 2 eased', { label: 'Undo', fn: undo }) });
    vi.advanceTimersByTime(3000);
    store.act(first);
    expect(store.get()).toMatchObject({ text: 'Next 2 eased', action: { label: 'Undo' } });
    // the first toast's timer is gone: nothing clears the follow-up early
    vi.advanceTimersByTime(TOAST_ACTION_MS - 100);
    expect(store.get()?.text).toBe('Next 2 eased');
    store.act(store.get()!.id);
    expect(undo).toHaveBeenCalledOnce();
    expect(store.get()).toBeNull();
  });

  it('an action can ask for a longer stay, never a shorter one', () => {
    const store = createToastStore();
    store.show('Base is on your calendar. 51 sessions replaced.', { label: 'Undo', fn: () => {}, duration: 15_000 });
    vi.advanceTimersByTime(TOAST_ACTION_MS + 500);
    expect(store.get()?.action?.label).toBe('Undo');
    vi.advanceTimersByTime(15_000 - TOAST_ACTION_MS - 400);
    expect(store.get()).toBeNull();
    store.show('Moved.', { label: 'Undo', fn: () => {}, duration: 3000 });
    vi.advanceTimersByTime(TOAST_ACTION_MS - 1);
    expect(store.get()?.text).toBe('Moved.');
  });

  it('an action that shows nothing clears its toast', () => {
    const store = createToastStore();
    const fn = vi.fn();
    const id = store.show('Deleted', { label: 'Undo', fn });
    store.act(id);
    expect(fn).toHaveBeenCalledOnce();
    expect(store.get()).toBeNull();
  });

  it('acting on a toast that was already replaced does nothing to the new one', () => {
    const store = createToastStore();
    const stale = vi.fn();
    const old = store.show('Old', { label: 'Undo', fn: stale });
    store.show('New');
    store.act(old);
    expect(stale).not.toHaveBeenCalled();
    expect(store.get()?.text).toBe('New');
  });

  it('times out: 2.8s plain, 6.5s with an action; an old timer never clears a newer toast', () => {
    const store = createToastStore();
    store.show('Saved');
    vi.advanceTimersByTime(TOAST_MS - 1);
    expect(store.get()?.text).toBe('Saved');
    vi.advanceTimersByTime(1);
    expect(store.get()).toBeNull();
    store.show('Deleted', { label: 'Undo', fn: () => undefined });
    vi.advanceTimersByTime(2000);
    store.show('Moved');
    vi.advanceTimersByTime(TOAST_MS - 1);
    expect(store.get()?.text).toBe('Moved');
  });

  it('notifies subscribers', () => {
    const store = createToastStore();
    const fn = vi.fn();
    const off = store.subscribe(fn);
    store.show('Hi');
    store.dismiss();
    off();
    store.show('Again');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('an Undo toast stays 10 s, and its clock stops while it is touched or focused (a11y-11)', () => {
    expect(TOAST_ACTION_MS).toBe(10_000);
    const store = createToastStore({ set: (fn, ms) => setTimeout(fn, ms), clear: (t) => clearTimeout(t), now: () => Date.now() });
    const id = store.show('Deleted', { label: 'Undo', fn: () => undefined });
    vi.advanceTimersByTime(9000);
    store.pause(id);
    expect(store.paused(id)).toBe(true);
    vi.advanceTimersByTime(60_000);
    expect(store.get()?.id).toBe(id);
    store.resume(id);
    vi.advanceTimersByTime(RESUME_MIN_MS - 1);
    expect(store.get()?.id).toBe(id);
    vi.advanceTimersByTime(1);
    expect(store.get()).toBeNull();
  });

  it('resumes with what was left when that is more than the minimum', () => {
    const store = createToastStore({ set: (fn, ms) => setTimeout(fn, ms), clear: (t) => clearTimeout(t), now: () => Date.now() });
    const id = store.show('Deleted', { label: 'Undo', fn: () => undefined });
    vi.advanceTimersByTime(3000);
    store.pause(id);
    vi.advanceTimersByTime(5000);
    store.resume(id);
    vi.advanceTimersByTime(6999);
    expect(store.get()?.id).toBe(id);
    vi.advanceTimersByTime(1);
    expect(store.get()).toBeNull();
  });
});
