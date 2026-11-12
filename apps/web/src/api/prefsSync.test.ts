import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The account's copy of the preferences (edge cases): whatever `PUT /me/prefs` answers, the device copy stands and
 * nothing is thrown; quick changes send the newest record once; a device whose own copy disagrees with the account's
 * tells the account once, and only a server that knows the route.
 */
const api = vi.fn<(path: string, init?: { method?: string; json?: unknown }) => Promise<unknown>>();
vi.mock('./client', () => ({ api: (path: string, init?: { method?: string; json?: unknown }) => api(path, init) }));

const ON = { fitness: true, today: { habits: true, day: true, learned: true } };
const OFF = { ...ON, fitness: false };
const tick = () => new Promise((r) => setTimeout(r, 0));
/** A fresh launch: the modules' own state (started, the stored copy) starts over. */
const launch = async (stored: typeof ON | null) => {
  vi.resetModules();
  const prefs = await import('@/lib/prefs');
  prefs.resetPrefsForTest(stored);
  const { syncPrefs } = await import('./prefsSync');
  return { prefs, syncPrefs };
};

describe('the account’s copy of the preferences', () => {
  beforeEach(() => {
    api.mockReset();
    api.mockResolvedValue({ prefs: ON });
  });

  it('a change made here is sent whole; ten quick changes send the last record once', async () => {
    const { prefs, syncPrefs } = await launch(null);
    syncPrefs(undefined);
    for (let i = 0; i < 10; i++) prefs.setFitness(i % 2 === 1);
    prefs.setFitness(false);
    await tick();
    expect(api).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenCalledWith('/me/prefs', { method: 'PUT', json: OFF });
  });

  it.each([404, 405, 501, 500, 401, 429])('a server that answers %i changes nothing here and throws nothing', async (status) => {
    api.mockRejectedValue(Object.assign(new Error('no'), { status }));
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    const { prefs, syncPrefs } = await launch(null);
    syncPrefs(undefined);
    prefs.setFitness(false);
    prefs.setTodaySection('habits', false);
    await tick();
    await tick();
    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
    expect(prefs.getPrefs()).toEqual({ fitness: false, today: { habits: false, day: true, learned: true } });
  });

  it('a request that never answers holds nothing up: the next change still goes', async () => {
    api.mockReturnValue(new Promise(() => undefined));
    const { prefs, syncPrefs } = await launch(null);
    syncPrefs(undefined);
    prefs.setFitness(false);
    await tick();
    prefs.setFitness(true);
    await tick();
    expect(api).toHaveBeenCalledTimes(2);
    expect(prefs.fitnessOn()).toBe(true);
  });

  it('a new phone starts from the account’s copy, and sends nothing back', async () => {
    const { prefs, syncPrefs } = await launch(null);
    syncPrefs(OFF);
    await tick();
    expect(prefs.fitnessOn()).toBe(false);
    expect(api).not.toHaveBeenCalled();
  });

  it('this device’s copy rules when the account disagrees, and the account is told once', async () => {
    const { prefs, syncPrefs } = await launch(OFF);
    syncPrefs(ON);
    syncPrefs(ON);
    await tick();
    expect(prefs.fitnessOn()).toBe(false);
    expect(api).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenCalledWith('/me/prefs', { method: 'PUT', json: OFF });
  });

  it('the account has none saved yet (null): the device’s copy is sent; they agree: nothing is', async () => {
    const a = await launch(OFF);
    a.syncPrefs(null);
    await tick();
    expect(api).toHaveBeenCalledTimes(1);
    api.mockClear();
    const b = await launch(OFF);
    b.syncPrefs({ ...OFF, extra: 1 });
    await tick();
    expect(api).not.toHaveBeenCalled();
  });

  it('an older server (no `prefs` in its bootstrap) is never asked on launch', async () => {
    const { syncPrefs } = await launch(OFF);
    syncPrefs(undefined);
    await tick();
    expect(api).not.toHaveBeenCalled();
  });

  it('whatever the account sends is made whole first: junk seeds nothing', async () => {
    for (const junk of ['off', 5, [], true]) {
      const { prefs, syncPrefs } = await launch(null);
      syncPrefs(junk);
      expect(prefs.getPrefs()).toEqual(ON);
      expect(prefs.hasStoredPrefs()).toBe(false);
    }
    const { prefs, syncPrefs } = await launch(null);
    syncPrefs({ fitness: 'no', today: 7 });
    expect(prefs.getPrefs()).toEqual(ON);
  });
});
