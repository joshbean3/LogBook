import { beforeEach, describe, expect, it, vi } from 'vitest';

const disk = new Map<string, unknown>();
vi.mock('idb-keyval', () => ({
  get: async (k: string) => structuredClone(disk.get(k)),
  set: async (k: string, v: unknown) => void disk.set(k, structuredClone(v)),
  del: async (k: string) => void disk.delete(k),
}));

import { claimDrafts, DRAFTS_KEY, getDraft, getEdit, hasDraft, holdSent, resetDraftsForTest, restoreDraft, setDraft, setEdit, subscribeDrafts } from './drafts';

const tick = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};
const never = async () => false;
type Stored = { uid: string; days: Record<string, { t?: string; s?: string[]; at: number }> };
const stored = () => disk.get(DRAFTS_KEY) as Stored | undefined;

beforeEach(() => {
  vi.useRealTimers();
  disk.clear();
  resetDraftsForTest();
});

/** contracts §F: the drafts store Today's midnight rule reads (docs/feel.md §5.4). */
describe('drafts', () => {
  it('holds one draft per day, trims for hasDraft and tells subscribers', () => {
    const seen: string[] = [];
    const off = subscribeDrafts(() => seen.push(getDraft('2026-10-23')));
    expect(getDraft('2026-10-23')).toBe('');
    expect(hasDraft('2026-10-23')).toBe(false);
    setDraft('2026-10-23', '   ');
    expect(hasDraft('2026-10-23')).toBe(false);
    setDraft('2026-10-23', 'Two sentences.');
    expect(hasDraft('2026-10-23')).toBe(true);
    expect(hasDraft('2026-10-24')).toBe(false);
    setDraft('2026-10-23', 'Two sentences.');
    expect(seen).toEqual(['   ', 'Two sentences.']);
    off();
    setDraft('2026-10-23', '');
    expect(seen).toHaveLength(2);
    expect(getDraft('2026-10-23')).toBe('');
  });

  it('puts refused words back on top of the draft, once', () => {
    expect(restoreDraft('2026-11-10', 'First.')).toBe(true);
    expect(getDraft('2026-11-10')).toBe('First.');
    expect(restoreDraft('2026-11-10', 'First.')).toBe(false);
    setDraft('2026-11-10', 'Started another.');
    expect(restoreDraft('2026-11-10', 'First.')).toBe(true);
    expect(getDraft('2026-11-10')).toBe('First.\n\nStarted another.');
  });

  it('keeps the words of a refused edit by entry id', () => {
    expect(getEdit('j1')).toBeNull();
    setEdit('j1', 'edited');
    expect(getEdit('j1')).toBe('edited');
    setEdit('j1', null);
    expect(getEdit('j1')).toBeNull();
  });
});

/** journal-06: a draft is on the device 400 ms after the last key, and comes back for the same account only. */
describe('drafts on the device', () => {
  it('writes nothing before the account is known, then writes the draft after 400 ms', async () => {
    vi.useFakeTimers();
    setDraft('2026-11-10', 'Typed before the app knew who I am.');
    await vi.advanceTimersByTimeAsync(500);
    expect(stored()).toBeUndefined();
    claimDrafts('u1', never);
    await vi.advanceTimersByTimeAsync(0);
    expect(stored()?.uid).toBe('u1');
    expect(stored()?.days['2026-11-10']?.t).toBe('Typed before the app knew who I am.');
    setDraft('2026-11-10', 'More.');
    await vi.advanceTimersByTimeAsync(399);
    expect(stored()?.days['2026-11-10']?.t).toBe('Typed before the app knew who I am.');
    await vi.advanceTimersByTimeAsync(2);
    expect(stored()?.days['2026-11-10']?.t).toBe('More.');
    // saved: the record goes
    setDraft('2026-11-10', '');
    await vi.advanceTimersByTimeAsync(401);
    expect(stored()).toBeUndefined();
  });

  it('brings a draft back after a reload, for the same account', async () => {
    disk.set(DRAFTS_KEY, { uid: 'u1', days: { '2026-11-09': { t: 'Long run, 9 miles.', at: Date.now() - 1000 } } });
    const seen: string[] = [];
    subscribeDrafts(() => seen.push(getDraft('2026-11-09')));
    expect(getDraft('2026-11-09')).toBe('');
    claimDrafts('u1', never);
    await tick();
    expect(getDraft('2026-11-09')).toBe('Long run, 9 miles.');
    expect(seen).toEqual(['Long run, 9 miles.']);
  });

  it('never shows one account the drafts of another, and deletes them', async () => {
    disk.set(DRAFTS_KEY, { uid: 'u1', days: { '2026-11-09': { t: 'Private words.', s: ['Sent words.'], at: Date.now() } } });
    const landed = vi.fn(never);
    claimDrafts('u2', landed);
    await tick();
    expect(getDraft('2026-11-09')).toBe('');
    expect(landed).not.toHaveBeenCalled();
    expect(stored()).toBeUndefined();
  });

  it('drops a draft untouched for 30 days', async () => {
    const day = 86_400_000;
    disk.set(DRAFTS_KEY, { uid: 'u1', days: { '2026-10-01': { t: 'old', at: Date.now() - 31 * day }, '2026-11-01': { t: 'recent', at: Date.now() - 29 * day } } });
    claimDrafts('u1', never);
    await tick();
    expect(getDraft('2026-10-01')).toBe('');
    expect(getDraft('2026-11-01')).toBe('recent');
    expect(Object.keys(stored()!.days)).toEqual(['2026-11-01']);
  });

  it('keeps sent words on the device until the save settles', async () => {
    claimDrafts('u1', never);
    await tick();
    setDraft('2026-11-10', 'On the wire.');
    const release = holdSent('2026-11-10', 'On the wire.');
    setDraft('2026-11-10', '');
    await tick();
    expect(stored()?.days['2026-11-10']?.s).toEqual(['On the wire.']);
    release();
    release();
    await tick();
    expect(stored()).toBeUndefined();
  });

  it('after the app died with a save on the wire: the words come back unless the entry is there', async () => {
    disk.set(DRAFTS_KEY, { uid: 'u1', days: { '2026-11-08': { s: ['Never landed.'], at: Date.now() }, '2026-11-09': { s: ['Landed.'], at: Date.now() }, '2026-11-07': { s: ['Offline now.'], at: Date.now() } } });
    claimDrafts('u1', async (date) => (date === '2026-11-09' ? true : date === '2026-11-07' ? null : false));
    await tick();
    await tick();
    expect(getDraft('2026-11-08')).toBe('Never landed.');
    expect(getDraft('2026-11-09')).toBe('');
    // not known: the words are kept rather than lost
    expect(getDraft('2026-11-07')).toBe('Offline now.');
    vi.useFakeTimers();
    setDraft('2026-11-08', 'Never landed. And more.');
    await vi.advanceTimersByTimeAsync(401);
    expect(stored()?.days['2026-11-09']).toBeUndefined();
    expect(stored()?.days['2026-11-08']).toEqual({ t: 'Never landed. And more.', at: expect.any(Number) });
  });
});
