import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const listeners: Array<() => void> = [];
vi.stubGlobal('document', {
  addEventListener: vi.fn((_t: string, f: () => void) => listeners.push(f)),
  removeEventListener: vi.fn((_t: string, f: () => void) => listeners.splice(listeners.indexOf(f), 1)),
});

describe('the live date (perf-10)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 10, 23, 59, 40));
  });
  afterEach(() => vi.useRealTimers());

  it('one interval and one visibility listener for every subscriber, gone with the last', async () => {
    const { subscribeToday, liveTodayStats } = await import('./useToday');
    const a = vi.fn();
    const b = vi.fn();
    const offA = subscribeToday(a);
    const offB = subscribeToday(b);
    expect(liveTodayStats()).toEqual({ subscribers: 2, timer: true });
    expect(listeners).toHaveLength(1);
    vi.advanceTimersByTime(30_000);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    offA();
    expect(liveTodayStats().timer).toBe(true);
    offB();
    expect(liveTodayStats()).toEqual({ subscribers: 0, timer: false });
    expect(listeners).toHaveLength(0);
  });
});
