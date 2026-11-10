import { describe, expect, it, vi } from 'vitest';

// the phone's locale, as the WebView reports it: en-US (12 hour). Set before dayWords makes its one formatter.
const Real = Intl.DateTimeFormat;
vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function (l?: string | string[], o?: Intl.DateTimeFormatOptions) {
  return new Real(l ?? 'en-US', o);
} as unknown as typeof Intl.DateTimeFormat);
const { clockParts, dayClock, shortClock } = await import('./dayWords');

describe('clock times follow the phone (12 hour; gap-qua-65)', () => {
  it('formats 6:45 in the morning and 5:30 in the afternoon', () => {
    expect(shortClock(6 * 60 + 45)).toBe('6:45');
    expect(shortClock(17 * 60 + 30)).toBe('5:30');
    expect(dayClock(17 * 60 + 30).replace(/\s/g, ' ')).toBe('5:30 PM');
    expect(clockParts(6 * 60 + 45)).toEqual({ v: '6:45', u: 'AM' });
  });
});
