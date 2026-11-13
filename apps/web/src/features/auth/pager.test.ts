import { describe, expect, it } from 'vitest';
import { pageAfterTap, pageAt, pageForKey } from './pager';

describe('pageAt', () => {
  it('is the page the track shows most of', () => {
    expect(pageAt(0, 390, 3)).toBe(0);
    expect(pageAt(194, 390, 3)).toBe(0);
    expect(pageAt(196, 390, 3)).toBe(1);
    expect(pageAt(780, 390, 3)).toBe(2);
  });
  it('never leaves the pages (a rubber band past either end)', () => {
    expect(pageAt(-80, 390, 3)).toBe(0);
    expect(pageAt(2000, 390, 3)).toBe(2);
  });
  it('is the first page for a track with no width yet, or a position that is not a number', () => {
    expect(pageAt(400, 0, 3)).toBe(0);
    expect(pageAt(Number.NaN, 390, 3)).toBe(0);
    expect(pageAt(400, 390, 0)).toBe(0);
  });
});

describe('pageForKey', () => {
  it('goes on with Right and Up, back with Left and Down', () => {
    expect(pageForKey('ArrowRight', 0, 3)).toBe(1);
    expect(pageForKey('ArrowUp', 1, 3)).toBe(2);
    expect(pageForKey('ArrowLeft', 2, 3)).toBe(1);
    expect(pageForKey('ArrowDown', 1, 3)).toBe(0);
  });
  it('holds at the ends: nothing wraps', () => {
    expect(pageForKey('ArrowRight', 2, 3)).toBe(2);
    expect(pageForKey('ArrowLeft', 0, 3)).toBe(0);
  });
  it('goes to the first and the last with Home and End', () => {
    expect(pageForKey('Home', 2, 3)).toBe(0);
    expect(pageForKey('End', 0, 3)).toBe(2);
  });
  it('leaves every other key alone', () => {
    expect(pageForKey('Enter', 1, 3)).toBeNull();
    expect(pageForKey('Tab', 1, 3)).toBeNull();
    expect(pageForKey('a', 1, 3)).toBeNull();
  });
});

describe('pageAfterTap', () => {
  it('goes on a page, and from the last back to the first', () => {
    expect(pageAfterTap(0, 3)).toBe(1);
    expect(pageAfterTap(1, 3)).toBe(2);
    expect(pageAfterTap(2, 3)).toBe(0);
  });
  it('is the first page when there are none', () => {
    expect(pageAfterTap(0, 0)).toBe(0);
  });
});
