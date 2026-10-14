import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createToastStore, TOAST_ACTION_MS, TOAST_MS } from './toastStore';

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

  it('an action can ask for a longer stay (the 8s Undo after replacing a plan)', () => {
    const store = createToastStore();
    store.show('Base is on your calendar. 51 sessions replaced.', { label: 'Undo', fn: () => {}, duration: 8000 });
    vi.advanceTimersByTime(TOAST_ACTION_MS + 500);
    expect(store.get()?.action?.label).toBe('Undo');
    vi.advanceTimersByTime(8000 - TOAST_ACTION_MS - 400);
    expect(store.get()).toBeNull();
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
});
