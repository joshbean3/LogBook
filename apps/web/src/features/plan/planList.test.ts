import { describe, expect, it } from 'vitest';
import { isShadowed, livePlans } from './planList';

const old = { id: 'a', start: '2026-11-16', end: '2027-02-07', createdAt: '2026-11-01T00:00:00Z', sessionCount: 0 };
const revised = { id: 'b', start: '2026-11-09', end: '2027-02-07', createdAt: '2026-11-10T00:00:00Z', sessionCount: 40 };

describe('livePlans (plan-29)', () => {
  it('a plan a revision took over whole is not listed: one plan for the range', () => {
    expect(isShadowed(old, [old, revised])).toBe(true);
    expect(livePlans([old, revised]).map((b) => b.id)).toEqual(['b']);
  });
  it('a plan that still has sessions stays, even under a newer plan', () => {
    expect(livePlans([{ ...old, sessionCount: 12 }, revised]).map((b) => b.id)).toEqual(['a', 'b']);
  });
  it('a plan the newer one only partly covers stays', () => {
    expect(livePlans([{ ...old, start: '2026-10-05' }, revised]).map((b) => b.id)).toEqual(['a', 'b']);
  });
  it('an empty plan with nothing newer over it stays (a plan whose sessions were all deleted by hand)', () => {
    expect(livePlans([old]).map((b) => b.id)).toEqual(['a']);
  });
  it('a count the server did not send is never read as zero', () => {
    expect(livePlans([{ ...old, sessionCount: undefined }, revised]).map((b) => b.id)).toEqual(['a', 'b']);
  });
});
