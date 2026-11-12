import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.stubGlobal('document', { addEventListener: vi.fn(), removeEventListener: vi.fn() });

/**
 * The Goals page turns the day with the minute that turns it (GoalsView): on each new minute it subscribes to the date
 * store again, which reads the clock at once. Without that the date waited for its 30 s poll while the clock already read
 * 00:00, and the poster said "Today’s goal · 24 h left" about a day that was over. This holds the store to the rule the
 * page relies on.
 */
describe('midnight with the Goals page open', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 12, 23, 59, 50));
  });
  afterEach(() => vi.useRealTimers());

  it('a fresh subscriber makes the date store read the clock at once, and the page already listening hears the new day', async () => {
    const { subscribeToday } = await import('@/lib/useToday');
    const page = vi.fn();
    const off = subscribeToday(page);
    // ten seconds past midnight: the 30 s poll has not come round yet
    vi.setSystemTime(new Date(2026, 10, 13, 0, 0, 10));
    expect(page).not.toHaveBeenCalled();
    // the minute tick, as GoalsView does it
    subscribeToday(() => undefined)();
    expect(page).toHaveBeenCalledTimes(1);
    off();
  });
});
