import { describe, expect, it } from 'vitest';
import { createLedger } from './ledger';

describe('a refused habit check goes back to what was saved', () => {
  it('one write refused: back to the state before it', () => {
    const l = createLedger();
    l.begin('h:d', false);
    expect(l.settle('h:d', false, true)).toBe(false);
    // the key is closed: a later write starts from what is saved then
    l.begin('h:d', true);
    expect(l.settle('h:d', false, false)).toBe(true);
  });
  it('a saved write has nothing to take back', () => {
    const l = createLedger();
    l.begin('h:d', false);
    expect(l.settle('h:d', true, true)).toBeNull();
  });
  it('waits for the last answer, then puts back the last state that was saved', () => {
    // lit (saved), then put out (refused): the tile ends lit
    const a = createLedger();
    a.begin('h:d', false);
    a.begin('h:d', true);
    expect(a.settle('h:d', true, true)).toBeNull();
    expect(a.settle('h:d', false, false)).toBe(true);
    // both refused, in either order: back to where it started
    const b = createLedger();
    b.begin('h:d', false);
    b.begin('h:d', true);
    expect(b.settle('h:d', false, false)).toBeNull();
    expect(b.settle('h:d', false, true)).toBe(false);
    // the first refused, the second saved: the second stands
    const c = createLedger();
    c.begin('h:d', false);
    c.begin('h:d', true);
    expect(c.settle('h:d', false, true)).toBeNull();
    expect(c.settle('h:d', true, false)).toBe(false);
  });
  it('keeps habits and days apart', () => {
    const l = createLedger();
    l.begin('a:d', false);
    l.begin('b:d', true);
    expect(l.settle('a:d', false, true)).toBe(false);
    expect(l.settle('b:d', true, false)).toBeNull();
    expect(l.settle('nobody', false, true)).toBeNull();
  });
});
