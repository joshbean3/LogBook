import { afterEach, describe, expect, it, vi } from 'vitest';

/** A storage the module can read at its first use (the test's own `localStorage`). */
const fakeStorage = (seed: Record<string, string> = {}) => {
  const m = new Map(Object.entries(seed));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), dump: () => Object.fromEntries(m) };
};

describe('coachShown (code review 3 #1, day review 3 #1)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('keeps a read across a reload: a fresh module reads what the last one stored', async () => {
    const ls = fakeStorage();
    vi.stubGlobal('localStorage', ls);
    const a = await import('./coachShown');
    a.setCoachShown('2026-10-24', 's1', 'Even splits, well judged.');
    expect(a.coachShown('2026-10-24', 's1')).toBe('Even splits, well judged.');
    vi.resetModules();
    const b = await import('./coachShown');
    expect(b.coachShown('2026-10-24', 's1')).toBe('Even splits, well judged.');
    expect(b.coachShown('2026-10-24', 'other')).toBeNull();
  });

  it('keeps the last 30 reads only', async () => {
    vi.stubGlobal('localStorage', fakeStorage());
    const a = await import('./coachShown');
    for (let i = 0; i < 35; i++) a.setCoachShown(`2026-10-${String(1 + (i % 28)).padStart(2, '0')}`, `k${i}`, `read ${i}`);
    expect(a.coachShown('2026-10-01', 'k0')).toBeNull();
    expect(a.coachShown('2026-10-07', 'k34')).toBe('read 34');
  });

  it('works with a storage that throws (private mode): the session keeps it', async () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } });
    const a = await import('./coachShown');
    a.setCoachShown('2026-10-24', 'run', 'Easy and even.');
    expect(a.coachShown('2026-10-24', 'run')).toBe('Easy and even.');
  });
});
