import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ws01-trainWhen-type: the onboarding answer is kept on the account (`Bootstrap.trainWhen`), so a reinstall or a second
 * phone starts from it. A choice made on this phone wins. The store reads localStorage when the module loads, so each case
 * loads a fresh copy; the hooks are read outside React (useSyncExternalStore hands back its snapshot).
 */
vi.mock('react', async (orig) => ({ ...(await orig<typeof import('react')>()), useSyncExternalStore: (_sub: unknown, get: () => unknown) => get() }));

class MemStorage {
  m = new Map<string, string>();
  getItem = (k: string) => this.m.get(k) ?? null;
  setItem = (k: string, v: string) => void this.m.set(k, String(v));
  removeItem = (k: string) => void this.m.delete(k);
}
let local = new MemStorage();
const load = async () => {
  vi.resetModules();
  return import('./trainWhen');
};

describe('the account seeds when you train on a new device', () => {
  beforeEach(() => {
    local = new MemStorage();
    vi.stubGlobal('localStorage', local);
  });

  it('with nothing on this phone, the account answer becomes the default and the afternoon', async () => {
    const m = await load();
    expect(m.useTrainWhenDefault()).toBe('morning');
    m.seedTrainWhen({ when: 'afternoon', offWork: 1050 });
    expect(m.useTrainWhenDefault()).toBe('afternoon');
    expect(m.useTrainWhen('2026-11-10')).toBe('afternoon');
    expect(m.useAfternoon()).toEqual({ ...m.DEFAULT_AFTERNOON, offWork: 1050 });
    // written to this phone, so the next open reads it before the bootstrap arrives
    expect(local.getItem('logbook.trainWhen.default')).toBe('afternoon');
    expect(JSON.parse(local.getItem('logbook.afternoon')!).offWork).toBe(1050);
    const again = await load();
    expect(again.useTrainWhenDefault()).toBe('afternoon');
    expect(again.useAfternoon().offWork).toBe(1050);
  });

  it('a choice made on this phone wins', async () => {
    local.setItem('logbook.trainWhen.default', 'none');
    local.setItem('logbook.afternoon', JSON.stringify({ offWork: 960 }));
    const m = await load();
    m.seedTrainWhen({ when: 'afternoon', offWork: 1050 });
    expect(m.useTrainWhenDefault()).toBe('none');
    expect(m.useAfternoon().offWork).toBe(960);
    expect(local.getItem('logbook.trainWhen.default')).toBe('none');
  });

  it('a choice made after the seed wins over a later bootstrap', async () => {
    const m = await load();
    m.seedTrainWhen({ when: 'afternoon', offWork: 1050 });
    m.setTrainWhenDefault('morning');
    m.setAfternoon({ offWork: 1020 });
    m.seedTrainWhen({ when: 'afternoon', offWork: 1050 });
    expect(m.useTrainWhenDefault()).toBe('morning');
    expect(m.useAfternoon().offWork).toBe(1020);
  });

  it('no answer on the account, or no end of work, leaves the phone as it is', async () => {
    const m = await load();
    m.seedTrainWhen(null);
    m.seedTrainWhen(undefined);
    expect(m.useTrainWhenDefault()).toBe('morning');
    expect(local.getItem('logbook.trainWhen.default')).toBeNull();
    m.seedTrainWhen({ when: 'none', offWork: null });
    expect(m.useTrainWhenDefault()).toBe('none');
    expect(m.useAfternoon()).toEqual(m.DEFAULT_AFTERNOON);
    expect(local.getItem('logbook.afternoon')).toBeNull();
  });
});
