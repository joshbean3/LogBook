import { describe, expect, it } from 'vitest';
import { shortName, weekTitle } from './context';

describe('Plan context words', () => {
  it('drops the length a block name ends with, and keeps any other name', () => {
    expect(shortName('Half marathon · 12 weeks')).toBe('Half marathon');
    expect(shortName('Base · 1 week')).toBe('Base');
    expect(shortName('Spring 10K')).toBe('Spring 10K');
  });

  it('names a week by where it sits from today', () => {
    const today = '2026-11-08'; // a Sunday: its week starts Nov 2
    expect(weekTitle('2026-11-02', today)).toBe('This week');
    expect(weekTitle('2026-10-26', today)).toBe('Last week');
    expect(weekTitle('2026-11-09', today)).toBe('Next week');
    expect(weekTitle('2026-11-16', today)).toBe('Week of Nov 16');
  });
});
