import { describe, expect, it, vi } from 'vitest';

// the phone's locale, as the WebView reports it: en-GB (24 hour). Set before dayWords makes its one formatter.
const Real = Intl.DateTimeFormat;
vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function (l?: string | string[], o?: Intl.DateTimeFormatOptions) {
  return new Real(l ?? 'en-GB', o);
} as unknown as typeof Intl.DateTimeFormat);
const { clockParts, dayClock, shortClock } = await import('./dayWords');

describe('clock times follow the phone (24 hour; gap-qua-65)', () => {
  it('formats 6:45 in the morning and 5:30 in the afternoon', () => {
    expect(shortClock(6 * 60 + 45)).toBe('6:45');
    expect(shortClock(17 * 60 + 30)).toBe('17:30');
    expect(dayClock(17 * 60 + 30)).toBe('17:30');
    expect(clockParts(17 * 60 + 30)).toEqual({ v: '17:30', u: '' });
  });
});
